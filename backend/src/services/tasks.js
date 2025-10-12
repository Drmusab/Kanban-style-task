const { db } = require('../utils/database');
const { recordTaskHistory } = require('../utils/history');

// Create a new instance of a recurring task
const createRecurringTask = (originalTask, recurringRule) => {
  return new Promise((resolve, reject) => {
    const { frequency, interval, endDate, maxOccurrences } = recurringRule;
    
    // Calculate the next due date
    const lastDueDate = new Date(originalTask.due_date);
    let nextDueDate = new Date(lastDueDate);
    
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
        return reject(new Error(`Unknown frequency: ${frequency}`));
    }
    
    // Check if we've reached the end date
    if (endDate && new Date(endDate) < nextDueDate) {
      return resolve(null);
    }
    
    // Get the next position for the task in the column
    db.get(
      'SELECT MAX(position) as maxPosition FROM tasks WHERE column_id = ?',
      [originalTask.column_id],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        
        const position = (row.maxPosition || 0) + 1;
        
        // Create the new task
        db.run(
          `INSERT INTO tasks (title, description, column_id, position, priority, due_date, recurring_rule, created_by, assigned_to)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            originalTask.title,
            originalTask.description,
            originalTask.column_id,
            position,
            originalTask.priority,
            nextDueDate.toISOString(),
            originalTask.recurring_rule,
            originalTask.created_by,
            originalTask.assigned_to
          ],
          function(err) {
            if (err) {
              return reject(err);
            }
            
            const taskId = this.lastID;
            
            // Record task history
            recordTaskHistory(taskId, 'created', null, null, originalTask.created_by);
            
            // Copy tags from the original task
            db.all(
              'SELECT tag_id FROM task_tags WHERE task_id = ?',
              [originalTask.id],
              (err, tagRows) => {
                if (err) {
                  return reject(err);
                }
                
                if (tagRows.length > 0) {
                  const tagPromises = tagRows.map(tagRow => {
                    return new Promise((resolve, reject) => {
                      db.run(
                        'INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)',
                        [taskId, tagRow.tag_id],
                        (err) => {
                          if (err) reject(err);
                          else resolve();
                        }
                      );
                    });
                  });
                  
                  Promise.all(tagPromises)
                    .then(() => resolve(taskId))
                    .catch(err => reject(err));
                } else {
                  resolve(taskId);
                }
              }
            );
          }
        );
      }
    );
  });
};

module.exports = { createRecurringTask };