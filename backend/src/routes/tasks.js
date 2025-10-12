const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/database');
const { recordTaskHistory } = require('../utils/history');
const { triggerAutomation } = require('../services/automation');

// Get all tasks
router.get('/', (req, res) => {
  const { boardId, columnId, swimlaneId, assignedTo, tags, dueBefore, dueAfter } = req.query;
  
  let query = `
    SELECT t.*, c.name as column_name, s.name as swimlane_name, 
           u1.username as created_by_name, u2.username as assigned_to_name
    FROM tasks t
    JOIN columns c ON t.column_id = c.id
    LEFT JOIN swimlanes s ON t.swimlane_id = s.id
    LEFT JOIN users u1 ON t.created_by = u1.id
    LEFT JOIN users u2 ON t.assigned_to = u2.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (boardId) {
    query += ' AND c.board_id = ?';
    params.push(boardId);
  }
  
  if (columnId) {
    query += ' AND t.column_id = ?';
    params.push(columnId);
  }
  
  if (swimlaneId) {
    query += ' AND t.swimlane_id = ?';
    params.push(swimlaneId);
  }
  
  if (assignedTo) {
    query += ' AND t.assigned_to = ?';
    params.push(assignedTo);
  }
  
  if (dueBefore) {
    query += ' AND t.due_date <= ?';
    params.push(dueBefore);
  }
  
  if (dueAfter) {
    query += ' AND t.due_date >= ?';
    params.push(dueAfter);
  }
  
  query += ' ORDER BY t.position ASC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Get tags for each task
    const tasksWithTags = rows.map(task => {
      return new Promise((resolve) => {
        db.all(
          'SELECT tg.* FROM tags tg JOIN task_tags tt ON tg.id = tt.tag_id WHERE tt.task_id = ?',
          [task.id],
          (err, tagRows) => {
            if (err) {
              resolve({ ...task, tags: [] });
            } else {
              resolve({ ...task, tags: tagRows });
            }
          }
        );
      });
    });
    
    Promise.all(tasksWithTags).then(tasks => {
      res.json(tasks);
    });
  });
});

// Get a specific task
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT t.*, c.name as column_name, s.name as swimlane_name, 
            u1.username as created_by_name, u2.username as assigned_to_name
     FROM tasks t
     JOIN columns c ON t.column_id = c.id
     LEFT JOIN swimlanes s ON t.swimlane_id = s.id
     LEFT JOIN users u1 ON t.created_by = u1.id
     LEFT JOIN users u2 ON t.assigned_to = u2.id
     WHERE t.id = ?`,
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Get tags for the task
      db.all(
        'SELECT tg.* FROM tags tg JOIN task_tags tt ON tg.id = tt.tag_id WHERE tt.task_id = ?',
        [id],
        (err, tagRows) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Get subtasks for the task
          db.all(
            'SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC',
            [id],
            (err, subtaskRows) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              // Get attachments for the task
              db.all(
                'SELECT * FROM attachments WHERE task_id = ?',
                [id],
                (err, attachmentRows) => {
                  if (err) {
                    return res.status(500).json({ error: err.message });
                  }
                  
                  // Get task history
                  db.all(
                    `SELECT th.*, u.username as user_name 
                     FROM task_history th 
                     LEFT JOIN users u ON th.user_id = u.id 
                     WHERE th.task_id = ? 
                     ORDER BY th.created_at DESC`,
                    [id],
                    (err, historyRows) => {
                      if (err) {
                        return res.status(500).json({ error: err.message });
                      }
                      
                      res.json({
                        ...row,
                        tags: tagRows,
                        subtasks: subtaskRows,
                        attachments: attachmentRows,
                        history: historyRows
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

// Create a new task
router.post('/', [
  body('title').notEmpty().withMessage('Title is required'),
  body('column_id').isInt().withMessage('Column ID must be an integer'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const {
    title,
    description,
    column_id,
    swimlane_id,
    priority = 'medium',
    due_date,
    recurring_rule,
    pinned = 0,
    created_by,
    assigned_to,
    tags = []
  } = req.body;
  
  // Get the next position for the task in the column
  db.get(
    'SELECT MAX(position) as maxPosition FROM tasks WHERE column_id = ? AND (swimlane_id = ? OR (swimlane_id IS NULL AND ? IS NULL))',
    [column_id, swimlane_id, swimlane_id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const position = (row.maxPosition || 0) + 1;
      
      db.run(
        `INSERT INTO tasks (title, description, column_id, swimlane_id, position, priority, due_date, recurring_rule, pinned, created_by, assigned_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description, column_id, swimlane_id, position, priority, due_date, recurring_rule, pinned, created_by, assigned_to],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          const taskId = this.lastID;
          
          // Record task history
          recordTaskHistory(taskId, 'created', null, null, created_by);
          
          // Add tags to the task
          if (tags.length > 0) {
            const tagPromises = tags.map(tagId => {
              return new Promise((resolve, reject) => {
                db.run(
                  'INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)',
                  [taskId, tagId],
                  (err) => {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
            });
            
            Promise.all(tagPromises)
              .then(() => {
                // Trigger automation for task creation
                triggerAutomation('task_created', { taskId, columnId, priority, assignedTo: assigned_to });
                res.status(201).json({ id: taskId, message: 'Task created successfully' });
              })
              .catch(err => {
                res.status(500).json({ error: err.message });
              });
          } else {
            // Trigger automation for task creation
            triggerAutomation('task_created', { taskId, columnId, priority, assignedTo: assigned_to });
            res.status(201).json({ id: taskId, message: 'Task created successfully' });
          }
        }
      );
    }
  );
});

// Update a task
router.put('/:id', [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { id } = req.params;
  const {
    title,
    description,
    column_id,
    swimlane_id,
    position,
    priority,
    due_date,
    recurring_rule,
    pinned,
    assigned_to,
    updated_by
  } = req.body;
  
  // Get current task data for history tracking
  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, currentTask) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
      if (title !== currentTask.title) {
        recordTaskHistory(id, 'title_changed', currentTask.title, title, updated_by);
      }
    }
    
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
      if (description !== currentTask.description) {
        recordTaskHistory(id, 'description_changed', currentTask.description, description, updated_by);
      }
    }
    
    if (column_id !== undefined) {
      updates.push('column_id = ?');
      values.push(column_id);
      if (column_id !== currentTask.column_id) {
        recordTaskHistory(id, 'column_changed', currentTask.column_id, column_id, updated_by);
        // Trigger automation for column change
        triggerAutomation('task_moved', { taskId: id, oldColumnId: currentTask.column_id, newColumnId: column_id });
      }
    }
    
    if (swimlane_id !== undefined) {
      updates.push('swimlane_id = ?');
      values.push(swimlane_id);
      if (swimlane_id !== currentTask.swimlane_id) {
        recordTaskHistory(id, 'swimlane_changed', currentTask.swimlane_id, swimlane_id, updated_by);
      }
    }
    
    if (position !== undefined) {
      updates.push('position = ?');
      values.push(position);
    }
    
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
      if (priority !== currentTask.priority) {
        recordTaskHistory(id, 'priority_changed', currentTask.priority, priority, updated_by);
      }
    }
    
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(due_date);
      if (due_date !== currentTask.due_date) {
        recordTaskHistory(id, 'due_date_changed', currentTask.due_date, due_date, updated_by);
      }
    }
    
    if (recurring_rule !== undefined) {
      updates.push('recurring_rule = ?');
      values.push(recurring_rule);
    }
    
    if (pinned !== undefined) {
      updates.push('pinned = ?');
      values.push(pinned);
    }
    
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      values.push(assigned_to);
      if (assigned_to !== currentTask.assigned_to) {
        recordTaskHistory(id, 'assignment_changed', currentTask.assigned_to, assigned_to, updated_by);
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    db.run(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({ message: 'Task updated successfully' });
      }
    );
  });
});

// Delete a task
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const { deleted_by } = req.body;
  
  // Get current task data for history tracking
  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Record task history
      recordTaskHistory(id, 'deleted', null, null, deleted_by);
      
      // Trigger automation for task deletion
      triggerAutomation('task_deleted', { taskId: id, columnId: task.column_id });
      
      res.json({ message: 'Task deleted successfully' });
    });
  });
});

// Add a subtask to a task
router.post('/:id/subtasks', [
  body('title').notEmpty().withMessage('Subtask title is required'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { id } = req.params;
  const { title, completed = 0 } = req.body;
  
  // Get the next position for the subtask
  db.get(
    'SELECT MAX(position) as maxPosition FROM subtasks WHERE task_id = ?',
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const position = (row.maxPosition || 0) + 1;
      
      db.run(
        'INSERT INTO subtasks (task_id, title, completed, position) VALUES (?, ?, ?, ?)',
        [id, title, completed, position],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          res.status(201).json({ id: this.lastID, message: 'Subtask created successfully' });
        }
      );
    }
  );
});

// Update a subtask
router.put('/:taskId/subtasks/:subtaskId', [
  body('title').optional().notEmpty().withMessage('Subtask title cannot be empty'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { taskId, subtaskId } = req.params;
  const { title, completed, position } = req.body;
  
  // Build update query dynamically
  const updates = [];
  const values = [];
  
  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  
  if (completed !== undefined) {
    updates.push('completed = ?');
    values.push(completed);
  }
  
  if (position !== undefined) {
    updates.push('position = ?');
    values.push(position);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(subtaskId, taskId);
  
  db.run(
    `UPDATE subtasks SET ${updates.join(', ')} WHERE id = ? AND task_id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Subtask not found' });
      }
      
      res.json({ message: 'Subtask updated successfully' });
    }
  );
});

// Delete a subtask
router.delete('/:taskId/subtasks/:subtaskId', (req, res) => {
  const { taskId, subtaskId } = req.params;
  
  db.run(
    'DELETE FROM subtasks WHERE id = ? AND task_id = ?',
    [subtaskId, taskId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Subtask not found' });
      }
      
      res.json({ message: 'Subtask deleted successfully' });
    }
  );
});

// Add tags to a task
router.post('/:id/tags', (req, res) => {
  const { id } = req.params;
  const { tagIds } = req.body;
  
  if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
    return res.status(400).json({ error: 'Tag IDs array is required' });
  }
  
  const tagPromises = tagIds.map(tagId => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)',
        [id, tagId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
  
  Promise.all(tagPromises)
    .then(() => {
      res.json({ message: 'Tags added to task successfully' });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

// Remove tags from a task
router.delete('/:id/tags', (req, res) => {
  const { id } = req.params;
  const { tagIds } = req.body;
  
  if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
    return res.status(400).json({ error: 'Tag IDs array is required' });
  }
  
  const placeholders = tagIds.map(() => '?').join(',');
  
  db.run(
    `DELETE FROM task_tags WHERE task_id = ? AND tag_id IN (${placeholders})`,
    [id, ...tagIds],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.json({ message: 'Tags removed from task successfully' });
    }
  );
});

module.exports = router;