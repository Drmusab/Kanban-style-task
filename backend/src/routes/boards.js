const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { db } = require('../utils/database');

// Get all boards
router.get('/', (req, res) => {
  const { template } = req.query;
  
  let query = `
    SELECT b.*, u.username as created_by_name
    FROM boards b
    LEFT JOIN users u ON b.created_by = u.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (template !== undefined) {
    query += ' AND b.template = ?';
    params.push(template === 'true' ? 1 : 0);
  }
  
  query += ' ORDER BY b.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json(rows);
  });
});

// Get a specific board with all its data
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM boards WHERE id = ?', [id], (err, board) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Get columns for the board
    db.all(
      'SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC',
      [id],
      (err, columns) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Get swimlanes for the board
        db.all(
          'SELECT * FROM swimlanes WHERE board_id = ? ORDER BY position ASC',
          [id],
          (err, swimlanes) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            res.json({
              ...board,
              columns,
              swimlanes
            });
          }
        );
      }
    );
  });
});

// Create a new board
router.post('/', [
  body('name').notEmpty().withMessage('Board name is required'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { name, description, template = 0, created_by } = req.body;
  
  db.run(
    'INSERT INTO boards (name, description, template, created_by) VALUES (?, ?, ?, ?)',
    [name, description, template, created_by],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({ id: this.lastID, message: 'Board created successfully' });
    }
  );
});

// Update a board
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('Board name cannot be empty'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { id } = req.params;
  const { name, description, template } = req.body;
  
  // Build update query dynamically
  const updates = [];
  const values = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  
  if (template !== undefined) {
    updates.push('template = ?');
    values.push(template);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  db.run(
    `UPDATE boards SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Board not found' });
      }
      
      res.json({ message: 'Board updated successfully' });
    }
  );
});

// Delete a board
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM boards WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    res.json({ message: 'Board deleted successfully' });
  });
});

// Create a new column for a board
router.post('/:id/columns', [
  body('name').notEmpty().withMessage('Column name is required'),
  body('position').isInt().withMessage('Position must be an integer'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { id } = req.params;
  const { name, color = '#3498db', icon, position } = req.body;
  
  db.run(
    'INSERT INTO columns (board_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?)',
    [id, name, color, icon, position],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({ id: this.lastID, message: 'Column created successfully' });
    }
  );
});

// Update a column
router.put('/:boardId/columns/:columnId', [
  body('name').optional().notEmpty().withMessage('Column name cannot be empty'),
  body('position').optional().isInt().withMessage('Position must be an integer'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { boardId, columnId } = req.params;
  const { name, color, icon, position } = req.body;
  
  // Build update query dynamically
  const updates = [];
  const values = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  
  if (color !== undefined) {
    updates.push('color = ?');
    values.push(color);
  }
  
  if (icon !== undefined) {
    updates.push('icon = ?');
    values.push(icon);
  }
  
  if (position !== undefined) {
    updates.push('position = ?');
    values.push(position);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(columnId, boardId);
  
  db.run(
    `UPDATE columns SET ${updates.join(', ')} WHERE id = ? AND board_id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Column not found' });
      }
      
      res.json({ message: 'Column updated successfully' });
    }
  );
});

// Delete a column
router.delete('/:boardId/columns/:columnId', (req, res) => {
  const { boardId, columnId } = req.params;
  
  db.run(
    'DELETE FROM columns WHERE id = ? AND board_id = ?',
    [columnId, boardId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Column not found' });
      }
      
      res.json({ message: 'Column deleted successfully' });
    }
  );
});

// Create a new swimlane for a board
router.post('/:id/swimlanes', [
  body('name').notEmpty().withMessage('Swimlane name is required'),
  body('position').isInt().withMessage('Position must be an integer'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { id } = req.params;
  const { name, color = '#ecf0f1', position, collapsed = 0 } = req.body;
  
  db.run(
    'INSERT INTO swimlanes (board_id, name, color, position, collapsed) VALUES (?, ?, ?, ?, ?)',
    [id, name, color, position, collapsed],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({ id: this.lastID, message: 'Swimlane created successfully' });
    }
  );
});

// Update a swimlane
router.put('/:boardId/swimlanes/:swimlaneId', [
  body('name').optional().notEmpty().withMessage('Swimlane name cannot be empty'),
  body('position').optional().isInt().withMessage('Position must be an integer'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { boardId, swimlaneId } = req.params;
  const { name, color, position, collapsed } = req.body;
  
  // Build update query dynamically
  const updates = [];
  const values = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  
  if (color !== undefined) {
    updates.push('color = ?');
    values.push(color);
  }
  
  if (position !== undefined) {
    updates.push('position = ?');
    values.push(position);
  }
  
  if (collapsed !== undefined) {
    updates.push('collapsed = ?');
    values.push(collapsed);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(swimlaneId, boardId);
  
  db.run(
    `UPDATE swimlanes SET ${updates.join(', ')} WHERE id = ? AND board_id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Swimlane not found' });
      }
      
      res.json({ message: 'Swimlane updated successfully' });
    }
  );
});

// Delete a swimlane
router.delete('/:boardId/swimlanes/:swimlaneId', (req, res) => {
  const { boardId, swimlaneId } = req.params;
  
  db.run(
    'DELETE FROM swimlanes WHERE id = ? AND board_id = ?',
    [swimlaneId, boardId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Swimlane not found' });
      }
      
      res.json({ message: 'Swimlane deleted successfully' });
    }
  );
});

// Duplicate a board
router.post('/:id/duplicate', (req, res) => {
  const { id } = req.params;
  const { name, created_by } = req.body;
  
  // Get the original board
  db.get('SELECT * FROM boards WHERE id = ?', [id], (err, board) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Create the new board
    db.run(
      'INSERT INTO boards (name, description, template, created_by) VALUES (?, ?, ?, ?)',
      [name || `${board.name} (Copy)`, board.description, 0, created_by],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const newBoardId = this.lastID;
        
        // Get columns from the original board
        db.all(
          'SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC',
          [id],
          (err, columns) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            // Create columns for the new board
            const columnPromises = columns.map(column => {
              return new Promise((resolve, reject) => {
                db.run(
                  'INSERT INTO columns (board_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?)',
                  [newBoardId, column.name, column.color, column.icon, column.position],
                  function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                  }
                );
              });
            });
            
            Promise.all(columnPromises)
              .then(() => {
                // Get swimlanes from the original board
                db.all(
                  'SELECT * FROM swimlanes WHERE board_id = ? ORDER BY position ASC',
                  [id],
                  (err, swimlanes) => {
                    if (err) {
                      return res.status(500).json({ error: err.message });
                    }
                    
                    // Create swimlanes for the new board
                    const swimlanePromises = swimlanes.map(swimlane => {
                      return new Promise((resolve, reject) => {
                        db.run(
                          'INSERT INTO swimlanes (board_id, name, color, position, collapsed) VALUES (?, ?, ?, ?, ?)',
                          [newBoardId, swimlane.name, swimlane.color, swimlane.position, swimlane.collapsed],
                          function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                          }
                        );
                      });
                    });
                    
                    Promise.all(swimlanePromises)
                      .then(() => {
                        res.status(201).json({ 
                          id: newBoardId, 
                          message: 'Board duplicated successfully' 
                        });
                      })
                      .catch(err => {
                        res.status(500).json({ error: err.message });
                      });
                  }
                );
              })
              .catch(err => {
                res.status(500).json({ error: err.message });
              });
          }
        );
      }
    );
  });
});

module.exports = router;