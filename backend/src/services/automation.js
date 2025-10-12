const { db } = require('../utils/database');
const { triggerWebhook } = require('./webhook');
const { sendNotification } = require('./notifications');

// Trigger automation based on event type
const triggerAutomation = async (eventType, eventData) => {
  try {
    // Get automation rules that match the event type
    db.all(
      'SELECT * FROM automation_rules WHERE trigger_type = ? AND enabled = 1',
      [eventType],
      async (err, rules) => {
        if (err) {
          console.error('Error fetching automation rules:', err);
          return;
        }
        
        for (const rule of rules) {
          try {
            const triggerConfig = JSON.parse(rule.trigger_config);
            const actionConfig = JSON.parse(rule.action_config);
            
            // Check if trigger conditions are met
            if (checkTriggerConditions(triggerConfig, eventData)) {
              // Execute the action
              await executeAction(rule.action_type, actionConfig, eventData);
              
              // Log the automation execution
              db.run(
                'INSERT INTO automation_logs (rule_id, status, message) VALUES (?, ?, ?)',
                [rule.id, 'success', `Triggered by ${eventType}`],
                function(err) {
                  if (err) {
                    console.error('Failed to log automation execution:', err);
                  }
                }
              );
            }
          } catch (error) {
            console.error(`Error executing automation rule ${rule.id}:`, error);
            
            // Log the automation execution failure
            db.run(
              'INSERT INTO automation_logs (rule_id, status, message) VALUES (?, ?, ?)',
              [rule.id, 'failed', error.message],
              function(err) {
                if (err) {
                  console.error('Failed to log automation execution:', err);
                }
              }
            );
          }
        }
      }
    );
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
const executeAction = async (actionType, actionConfig, eventData) => {
  switch (actionType) {
    case 'webhook':
      await triggerWebhook(actionConfig.webhookId, eventData);
      break;
    case 'notification':
      await sendNotification(
        actionConfig.title || 'Automation Triggered',
        actionConfig.message || `Automation triggered by event: ${JSON.stringify(eventData)}`
      );
      break;
    case 'move_task':
      if (eventData.taskId && actionConfig.columnId) {
        db.run(
          'UPDATE tasks SET column_id = ? WHERE id = ?',
          [actionConfig.columnId, eventData.taskId],
          function(err) {
            if (err) {
              throw new Error(`Failed to move task: ${err.message}`);
            }
          }
        );
      }
      break;
    case 'update_task':
      if (eventData.taskId) {
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
        
        if (updates.length > 0) {
          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(eventData.taskId);
          
          db.run(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
            values,
            function(err) {
              if (err) {
                throw new Error(`Failed to update task: ${err.message}`);
              }
            }
          );
        }
      }
      break;
    case 'create_task':
      if (actionConfig.title && actionConfig.columnId) {
        db.run(
          `INSERT INTO tasks (title, description, column_id, priority, due_date, created_by, assigned_to)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            actionConfig.title,
            actionConfig.description || '',
            actionConfig.columnId,
            actionConfig.priority || 'medium',
            actionConfig.dueDate || null,
            actionConfig.createdBy || null,
            actionConfig.assignedTo || null
          ],
          function(err) {
            if (err) {
              throw new Error(`Failed to create task: ${err.message}`);
            }
          }
        );
      }
      break;
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
};

module.exports = { triggerAutomation };