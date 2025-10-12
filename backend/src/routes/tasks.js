const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { db } = require('../utils/database');
const { recordTaskHistory } = require('../utils/history');
const { triggerAutomation } = require('../services/automation');
const apiKeyAuth = require('../middleware/apiKeyAuth');

const createTaskValidations = [
  body('title').notEmpty().withMessage('Title is required'),
  body('column_id').custom((value, { req }) => {
    const incoming = value ?? req.body.columnId;

    if (incoming === undefined || incoming === null || incoming === '') {
      throw new Error('Column ID must be an integer');
    }

    const parsed = Number(incoming);

    if (!Number.isInteger(parsed)) {
      throw new Error('Column ID must be an integer');
    }

    req.body.column_id = parsed;
    return true;
  }),
];

const updateTaskValidations = [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
];

const webhookUpdateValidations = [
  body('id').isInt().withMessage('Task ID is required'),
  ...updateTaskValidations,
];

const webhookDeleteValidations = [
  body('id').isInt().withMessage('Task ID is required'),
];

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
router.post('/', createTaskValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const result = await createTaskRecord(req.body);
    res.status(201).json({ ...result, message: 'Task created successfully' });
  } catch (error) {
    handleTaskError(res, error);
  }
});

// API-key protected endpoint for external automation (e.g. n8n) to create tasks
router.post('/create', apiKeyAuth, createTaskValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const result = await createTaskRecord(req.body);
    res.status(201).json({ ...result, message: 'Task created successfully', source: 'automation' });
  } catch (error) {
    handleTaskError(res, error);
  }
});

// Update a task
router.put('/:id', updateTaskValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const result = await updateTaskRecord(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    handleTaskError(res, error);
  }
});

// API-key protected endpoint for external automation to update tasks
router.post('/update', apiKeyAuth, webhookUpdateValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const result = await updateTaskRecord(req.body.id, req.body);
    res.json({ ...result, source: 'automation' });
  } catch (error) {
    handleTaskError(res, error);
  }
});

// Delete a task
router.delete('/:id', async (req, res) => {
  try {
    const result = await deleteTaskRecord(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    handleTaskError(res, error);
  }
});

// API-key protected endpoint for external automation to delete tasks
router.post('/delete', apiKeyAuth, webhookDeleteValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const result = await deleteTaskRecord(req.body.id, req.body);
    res.json({ ...result, source: 'automation' });
  } catch (error) {
    handleTaskError(res, error);
  }
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

function normalizeOptionalInt(value, { treatUndefinedAsNull = false } = {}) {
  if (value === undefined) {
    return treatUndefinedAsNull ? null : undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

async function createTaskRecord(data) {
  const title = data.title;
  const columnId = Number(data.column_id ?? data.columnId);
  const swimlaneId = normalizeOptionalInt(data.swimlane_id ?? data.swimlaneId, { treatUndefinedAsNull: true });
  const description = data.description ?? '';
  const priority = data.priority ?? 'medium';
  const dueDate = data.due_date ?? data.dueDate ?? null;
  const recurringRule = data.recurring_rule ?? data.recurringRule ?? null;
  const pinned = data.pinned ?? 0;
  const createdBy = normalizeOptionalInt(data.created_by ?? data.createdBy, { treatUndefinedAsNull: true });
  const assignedTo = normalizeOptionalInt(data.assigned_to ?? data.assignedTo, { treatUndefinedAsNull: true });
  const tags = Array.isArray(data.tags)
    ? data.tags
    : Array.isArray(data.tagIds)
      ? data.tagIds
      : [];
  const tagIds = tags
    .map(tag => {
      if (tag && typeof tag === 'object') {
        return tag.id ?? tag.tag_id ?? tag.value;
      }
      return tag;
    })
    .filter(tag => tag !== undefined && tag !== null)
    .map(tag => normalizeOptionalInt(tag, { treatUndefinedAsNull: true }))
    .filter(tag => tag !== null);

  return new Promise((resolve, reject) => {
    db.get(
      'SELECT MAX(position) as maxPosition FROM tasks WHERE column_id = ? AND (swimlane_id = ? OR (swimlane_id IS NULL AND ? IS NULL))',
      [columnId, swimlaneId, swimlaneId],
      (err, row) => {
        if (err) {
          return reject({ status: 500, message: err.message });
        }

        const position = (row?.maxPosition || 0) + 1;

        db.run(
          `INSERT INTO tasks (title, description, column_id, swimlane_id, position, priority, due_date, recurring_rule, pinned, created_by, assigned_to)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            title,
            description,
            columnId,
            swimlaneId,
            position,
            priority,
            dueDate,
            recurringRule,
            pinned,
            createdBy,
            assignedTo,
          ],
          function(insertErr) {
            if (insertErr) {
              return reject({ status: 500, message: insertErr.message });
            }

            const taskId = this.lastID;

            recordTaskHistory(taskId, 'created', null, null, createdBy);

            const finalize = () => {
              triggerAutomation('task_created', {
                taskId,
                columnId,
                priority,
                assignedTo,
              });

              resolve({ id: taskId });
            };

            if (tagIds.length === 0) {
              finalize();
              return;
            }

            const tagPromises = tagIds.map(tagId => new Promise((tagResolve, tagReject) => {
              db.run(
                'INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)',
                [taskId, tagId],
                (tagErr) => {
                  if (tagErr) {
                    tagReject(tagErr);
                  } else {
                    tagResolve();
                  }
                }
              );
            }));

            Promise.all(tagPromises)
              .then(finalize)
              .catch(tagErr => reject({ status: 500, message: tagErr.message }));
          }
        );
      }
    );
  });
}

async function updateTaskRecord(id, data) {
  const title = data.title;
  const description = data.description;
  const columnId = normalizeOptionalInt(data.column_id ?? data.columnId);
  const swimlaneId = normalizeOptionalInt(data.swimlane_id ?? data.swimlaneId);
  const position = normalizeOptionalInt(data.position);
  const priority = data.priority;
  const dueDate = data.due_date ?? data.dueDate;
  const recurringRule = data.recurring_rule ?? data.recurringRule;
  const pinned = data.pinned;
  const assignedTo = normalizeOptionalInt(data.assigned_to ?? data.assignedTo);
  const updatedBy = normalizeOptionalInt(data.updated_by ?? data.updatedBy);

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, currentTask) => {
      if (err) {
        return reject({ status: 500, message: err.message });
      }

      if (!currentTask) {
        return reject({ status: 404, message: 'Task not found' });
      }

      const updates = [];
      const values = [];

      if (title !== undefined) {
        updates.push('title = ?');
        values.push(title);
        if (title !== currentTask.title) {
          recordTaskHistory(id, 'title_changed', currentTask.title, title, updatedBy);
        }
      }

      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
        if (description !== currentTask.description) {
          recordTaskHistory(id, 'description_changed', currentTask.description, description, updatedBy);
        }
      }

      if (columnId !== undefined) {
        updates.push('column_id = ?');
        values.push(columnId);
        if (columnId !== currentTask.column_id) {
          recordTaskHistory(id, 'column_changed', currentTask.column_id, columnId, updatedBy);
          triggerAutomation('task_moved', {
            taskId: Number(id),
            oldColumnId: currentTask.column_id,
            newColumnId: columnId,
          });
        }
      }

      if (swimlaneId !== undefined) {
        updates.push('swimlane_id = ?');
        values.push(swimlaneId);
        if (swimlaneId !== currentTask.swimlane_id) {
          recordTaskHistory(id, 'swimlane_changed', currentTask.swimlane_id, swimlaneId, updatedBy);
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
          recordTaskHistory(id, 'priority_changed', currentTask.priority, priority, updatedBy);
        }
      }

      if (dueDate !== undefined) {
        updates.push('due_date = ?');
        values.push(dueDate);
        if (dueDate !== currentTask.due_date) {
          recordTaskHistory(id, 'due_date_changed', currentTask.due_date, dueDate, updatedBy);
        }
      }

      if (recurringRule !== undefined) {
        updates.push('recurring_rule = ?');
        values.push(recurringRule);
      }

      if (pinned !== undefined) {
        updates.push('pinned = ?');
        values.push(pinned);
      }

      if (assignedTo !== undefined) {
        updates.push('assigned_to = ?');
        values.push(assignedTo);
        if (assignedTo !== currentTask.assigned_to) {
          recordTaskHistory(id, 'assignment_changed', currentTask.assigned_to, assignedTo, updatedBy);
        }
      }

      if (updates.length === 0) {
        return reject({ status: 400, message: 'No valid fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      db.run(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(updateErr) {
          if (updateErr) {
            return reject({ status: 500, message: updateErr.message });
          }

          resolve({ message: 'Task updated successfully' });
        }
      );
    });
  });
}

async function deleteTaskRecord(id, data) {
  const deletedBy = normalizeOptionalInt(data?.deleted_by ?? data?.deletedBy, { treatUndefinedAsNull: true });

  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
      if (err) {
        return reject({ status: 500, message: err.message });
      }

      if (!task) {
        return reject({ status: 404, message: 'Task not found' });
      }

      db.run('DELETE FROM tasks WHERE id = ?', [id], function(deleteErr) {
        if (deleteErr) {
          return reject({ status: 500, message: deleteErr.message });
        }

        recordTaskHistory(id, 'deleted', null, null, deletedBy);

        triggerAutomation('task_deleted', {
          taskId: Number(id),
          columnId: task.column_id,
        });

        resolve({ message: 'Task deleted successfully' });
      });
    });
  });
}

function handleTaskError(res, error) {
  if (!error) {
    return res.status(500).json({ error: 'Unknown error' });
  }

  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }

  const message = error.message || error.toString();
  return res.status(500).json({ error: message });
}
