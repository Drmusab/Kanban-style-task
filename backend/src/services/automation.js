const { allAsync, getAsync, runAsync } = require('../utils/database');
const { triggerWebhook } = require('./webhook');
const { sendNotification } = require('./notifications');

// Trigger automation based on event type
const triggerAutomation = async (eventType, eventData) => {
  try {
    const rules = await allAsync(
      'SELECT * FROM automation_rules WHERE trigger_type = ? AND enabled = 1',
      [eventType]
    );

    for (const rule of rules) {
      try {
        const triggerConfig = parseConfig(rule.trigger_config, 'trigger');
        const actionConfig = parseConfig(rule.action_config, 'action');

        if (!checkTriggerConditions(triggerConfig, eventData)) {
          continue;
        }

        const result = await executeAutomationAction(rule.action_type, actionConfig, eventData);

        const status = result?.success === false ? 'failed' : 'success';
        const message = result?.message || result?.error || `Triggered by ${eventType}`;

        await runAsync(
          'INSERT INTO automation_logs (rule_id, status, message) VALUES (?, ?, ?)',
          [rule.id, status, message]
        );
      } catch (error) {
        console.error(`Error executing automation rule ${rule.id}:`, error);

        try {
          await runAsync(
            'INSERT INTO automation_logs (rule_id, status, message) VALUES (?, ?, ?)',
            [rule.id, 'failed', error.message]
          );
        } catch (logError) {
          console.error('Failed to log automation execution:', logError);
        }
      }
    }
  } catch (error) {
    console.error('Error in triggerAutomation:', error);
  }
};

// Check if trigger conditions are met
const checkTriggerConditions = (triggerConfig, eventData) => {
  // For task_created, task_updated, task_deleted events
  if (triggerConfig.columnId && eventData.columnId !== triggerConfig.columnId) {
    return false;
  }
  
  if (triggerConfig.priority && eventData.priority !== triggerConfig.priority) {
    return false;
  }
  
  if (triggerConfig.assignedTo && eventData.assignedTo !== triggerConfig.assignedTo) {
    return false;
  }
  
  // For task_moved event
  if (eventData.oldColumnId && triggerConfig.fromColumnId && eventData.oldColumnId !== triggerConfig.fromColumnId) {
    return false;
  }
  
  if (eventData.newColumnId && triggerConfig.toColumnId && eventData.newColumnId !== triggerConfig.toColumnId) {
    return false;
  }
  
  // For task_due, task_overdue events
  if (triggerConfig.priority && eventData.priority !== triggerConfig.priority) {
    return false;
  }
  
  return true;
};

// Execute an automation action
const executeAutomationAction = async (actionType, actionConfig, eventData) => {
  switch (actionType) {
    case 'webhook':
      return triggerWebhook(actionConfig.webhookId, eventData);
    case 'notification':
      return sendNotification(
        actionConfig.title || 'Automation Triggered',
        actionConfig.message || `Automation triggered by event: ${JSON.stringify(eventData)}`
      );
    case 'move_task': {
      if (!eventData.taskId || !actionConfig.columnId) {
        return { success: false, error: 'Task ID and destination column are required to move a task' };
      }

      const result = await runAsync(
        'UPDATE tasks SET column_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [actionConfig.columnId, eventData.taskId]
      );

      if (result.changes === 0) {
        return { success: false, error: 'Task not found' };
      }

      return { success: true, message: 'Task moved successfully' };
    }
    case 'update_task': {
      if (!eventData.taskId) {
        return { success: false, error: 'Task ID is required to update a task' };
      }

      const updates = [];
      const values = [];

      if (actionConfig.priority) {
        updates.push('priority = ?');
        values.push(actionConfig.priority);
      }

      if (actionConfig.dueDate) {
        updates.push('due_date = ?');
        values.push(actionConfig.dueDate);
      }

      if (actionConfig.assignedTo) {
        updates.push('assigned_to = ?');
        values.push(actionConfig.assignedTo);
      }

      if (updates.length === 0) {
        return { success: false, error: 'No task fields were provided to update' };
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(eventData.taskId);

      const result = await runAsync(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      if (result.changes === 0) {
        return { success: false, error: 'Task not found' };
      }

      return { success: true, message: 'Task updated successfully' };
    }
    case 'create_task': {
      if (!actionConfig.title || !actionConfig.columnId) {
        return { success: false, error: 'Task title and column are required to create a task' };
      }

      const columnId = actionConfig.columnId;
      const columnPosition = await getAsync(
        'SELECT MAX(position) as maxPosition FROM tasks WHERE column_id = ?',
        [columnId]
      );

      const position = ((columnPosition && columnPosition.maxPosition) || 0) + 1;

      const result = await runAsync(
        `INSERT INTO tasks (title, description, column_id, position, priority, due_date, created_by, assigned_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actionConfig.title,
          actionConfig.description || '',
          columnId,
          position,
          actionConfig.priority || 'medium',
          actionConfig.dueDate || null,
          actionConfig.createdBy || null,
          actionConfig.assignedTo || null,
        ]
      );

      return {
        success: true,
        message: 'Task created successfully',
        taskId: result.lastID,
      };
    }
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
};

const parseConfig = (configString, label) => {
  try {
    return JSON.parse(configString);
  } catch (error) {
    throw new Error(`Invalid ${label} configuration: ${error.message}`);
  }
};

module.exports = { triggerAutomation, checkTriggerConditions, executeAutomationAction };