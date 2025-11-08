const cron = require('node-cron');
const { db } = require('../utils/database');
const { triggerAutomation } = require('./automation');
const { sendNotification } = require('./notifications');
const { createRecurringTask } = require('./tasks');

// Start the scheduler
const startScheduler = () => {
  console.log('Starting task scheduler...');
  
  // Check for due tasks every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date().toISOString();
      
      // Get tasks that are due or overdue
      db.all(
        'SELECT * FROM tasks WHERE due_date <= ? AND due_date IS NOT NULL',
        [now],
        async (err, tasks) => {
          if (err) {
            console.error('Error checking due tasks:', err);
            return;
          }
          
          for (const task of tasks) {
            const dueDate = new Date(task.due_date);
            const nowDate = new Date();
            
            // Check if task is overdue (more than 1 hour past due date)
            if (nowDate - dueDate > 60 * 60 * 1000) {
              // Trigger automation for overdue task
              triggerAutomation('task_overdue', { taskId: task.id, columnId: task.column_id });
              
              // Send notification for overdue task
              sendNotification(
                `Overdue Task: ${task.title}`,
                `Task "${task.title}" was due on ${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString()}`
              );
            }
            // Check if task is due (within 1 hour of due date)
            else if (nowDate - dueDate >= 0) {
              // Trigger automation for due task
              triggerAutomation('task_due', { taskId: task.id, columnId: task.column_id });
              
              // Send notification for due task
              sendNotification(
                `Due Task: ${task.title}`,
                `Task "${task.title}" is due now`
              );
            }
            // Check if task is due soon (within 1 hour of due date)
            else if (dueDate - nowDate <= 60 * 60 * 1000) {
              // Trigger automation for task due soon
              triggerAutomation('task_due_soon', { taskId: task.id, columnId: task.column_id });
              
              // Send notification for task due soon
              sendNotification(
                `Task Due Soon: ${task.title}`,
                `Task "${task.title}" is due at ${dueDate.toLocaleTimeString()}`
              );
            }
          }
        }
      );
    } catch (error) {
      console.error('Error in scheduler:', error);
    }
  });
  
  // Check for recurring tasks daily at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get tasks with recurring rules
      db.all(
        'SELECT * FROM tasks WHERE recurring_rule IS NOT NULL',
        async (err, tasks) => {
          if (err) {
            console.error('Error checking recurring tasks:', err);
            return;
          }
          
          for (const task of tasks) {
            try {
              const recurringRule = JSON.parse(task.recurring_rule);
              const lastDueDate = new Date(task.due_date);

              // Check if we need to create a new instance of this recurring task
              if (shouldCreateRecurringTask(lastDueDate, recurringRule, today)) {
                await createRecurringTask(task, recurringRule);
              }
            } catch (error) {
              console.error(`Error processing recurring task ${task.id}:`, error);
            }
          }
        }
      );
    } catch (error) {
      console.error('Error in recurring task scheduler:', error);
    }
  });
  
  // Clean up old automation logs weekly
  cron.schedule('0 0 * * 0', async () => {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoStr = oneWeekAgo.toISOString();
      
      db.run(
        'DELETE FROM automation_logs WHERE created_at < ?',
        [oneWeekAgoStr],
        function(err) {
          if (err) {
            console.error('Error cleaning up automation logs:', err);
          } else {
            console.log(`Cleaned up ${this.changes} old automation log entries`);
          }
        }
      );
    } catch (error) {
      console.error('Error in log cleanup scheduler:', error);
    }
  });
  
  console.log('Task scheduler started');
};

// Check if a new instance of a recurring task should be created
const shouldCreateRecurringTask = (lastDueDate, recurringRule, today) => {
  const nextDueDate = calculateNextDueDate(lastDueDate, recurringRule);
  return nextDueDate && nextDueDate.toISOString().split('T')[0] === today;
};

// Calculate the next due date for a recurring task
const calculateNextDueDate = (lastDueDate, recurringRule) => {
  if (!(lastDueDate instanceof Date) || Number.isNaN(lastDueDate.getTime())) {
    return null;
  }

  const { frequency, interval, endDate, maxOccurrences } = recurringRule;
  const nextDueDate = new Date(lastDueDate);
  
  switch (frequency) {
    case 'daily':
      nextDueDate.setDate(nextDueDate.getDate() + (interval || 1));
      break;
    case 'weekly':
      nextDueDate.setDate(nextDueDate.getDate() + ((interval || 1) * 7));
      break;
    case 'monthly':
      nextDueDate.setMonth(nextDueDate.getMonth() + (interval || 1));
      break;
    case 'yearly':
      nextDueDate.setFullYear(nextDueDate.getFullYear() + (interval || 1));
      break;
    default:
      return null;
  }
  
  // Check if we've reached the end date
  if (endDate && new Date(endDate) < nextDueDate) {
    return null;
  }
  
  return nextDueDate;
};

module.exports = { startScheduler };