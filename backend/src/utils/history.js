const { db } = require('./database');

// Record a task history event
const recordTaskHistory = (taskId, action, oldValue, newValue, userId) => {
  db.run(
    'INSERT INTO task_history (task_id, action, old_value, new_value, user_id) VALUES (?, ?, ?, ?, ?)',
    [taskId, action, oldValue, newValue, userId],
    (err) => {
      if (err) {
        console.error('Failed to record task history:', err);
      }
    }
  );
};

module.exports = { recordTaskHistory };