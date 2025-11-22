const { allAsync } = require('../utils/database');
const { triggerWebhook } = require('./webhook');

// Send a notification (can be sent to n8n webhooks and/or logged)
const sendNotification = async (title, message, options = {}) => {
  try {
    const {
      type = 'info',
      taskId = null,
      boardId = null,
      priority = 'normal',
      sendToN8n = true,
      metadata = {}
    } = options;

    // Log notification
    console.log(`NOTIFICATION [${type.toUpperCase()}]: ${title} - ${message}`);
    
    // Send to n8n webhooks if enabled
    if (sendToN8n) {
      try {
        const integrations = await allAsync(
          'SELECT * FROM integrations WHERE type = ? AND enabled = 1',
          ['n8n_webhook']
        );

        if (integrations && integrations.length > 0) {
          const notificationPayload = {
            type: 'notification',
            title,
            message,
            notificationType: type,
            priority,
            taskId,
            boardId,
            timestamp: new Date().toISOString(),
            metadata
          };

          // Send to all enabled n8n webhooks
          const webhookPromises = integrations.map(integration =>
            triggerWebhook(integration.id, notificationPayload)
          );

          await Promise.allSettled(webhookPromises);
        }
      } catch (webhookError) {
        console.error('Failed to send notification to n8n:', webhookError);
        // Don't fail the notification if webhook fails
      }
    }
    
    return {
      success: true,
      message: 'Notification sent successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Send a task reminder notification
const sendTaskReminder = async (task) => {
  const title = 'Task Reminder';
  const message = `Task "${task.title}" is due`;
  
  return sendNotification(title, message, {
    type: 'reminder',
    taskId: task.id,
    priority: task.priority || 'normal',
    metadata: {
      dueDate: task.due_date,
      columnId: task.column_id
    }
  });
};

// Send a routine reminder notification
const sendRoutineReminder = async (task) => {
  const title = 'Routine Reminder';
  const message = `Routine task "${task.title}" is scheduled`;
  
  return sendNotification(title, message, {
    type: 'routine',
    taskId: task.id,
    priority: task.priority || 'normal',
    metadata: {
      dueDate: task.due_date,
      recurringRule: task.recurring_rule
    }
  });
};

// Send task due notification
const sendTaskDueNotification = async (task, minutesUntilDue) => {
  const title = 'Task Due Soon';
  const message = minutesUntilDue > 0 
    ? `Task "${task.title}" is due in ${minutesUntilDue} minutes`
    : `Task "${task.title}" is overdue`;
  
  return sendNotification(title, message, {
    type: 'due',
    taskId: task.id,
    priority: 'high',
    metadata: {
      dueDate: task.due_date,
      minutesUntilDue,
      isOverdue: minutesUntilDue <= 0
    }
  });
};

module.exports = { 
  sendNotification,
  sendTaskReminder,
  sendRoutineReminder,
  sendTaskDueNotification
};