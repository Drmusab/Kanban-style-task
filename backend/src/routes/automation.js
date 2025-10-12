const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { db } = require('../utils/database');
const { triggerWebhook } = require('../services/webhook');
const { sendNotification } = require('../services/notifications');

// Get all automation rules
router.get('/', (req, res) => {
  db.all(
    'SELECT ar.*, u.username as created_by_name FROM automation_rules ar LEFT JOIN users u ON ar.created_by = u.id ORDER BY ar.created_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Parse JSON fields for each rule
      const rules = rows.map(row => ({
        ...row,
        trigger_config: JSON.parse(row.trigger_config),
        action_config: JSON.parse(row.action_config)
      }));
      
      res.json(rules);
    }
  );
});

// Get a specific automation rule
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT ar.*, u.username as created_by_name FROM automation_rules ar LEFT JOIN users u ON ar.created_by = u.id WHERE ar.id = ?',
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Automation rule not found' });
      }
      
      // Parse JSON fields
      const rule = {
        ...row,
        trigger_config: JSON.parse(row.trigger_config),
        action_config: JSON.parse(row.action_config)
      };
      
      res.json(rule);
    }
  );
});

// Create a new automation rule
router.post('/', [
  body('name').notEmpty().withMessage('Rule name is required'),
  body('trigger_type').notEmpty().withMessage('Trigger type is required'),
  body('trigger_config').notEmpty().withMessage('Trigger config is required'),
  body('action_type').notEmpty().withMessage('Action type is required'),
  body('action_config').notEmpty().withMessage('Action config is required'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { 
    name, 
    trigger_type, 
    trigger_config, 
    action_type, 
    action_config, 
    enabled = 1, 
    created_by 
  } = req.body;
  
  db.run(
    'INSERT INTO automation_rules (name, trigger_type, trigger_config, action_type, action_config, enabled, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, trigger_type, JSON.stringify(trigger_config), action_type, JSON.stringify(action_config), enabled, created_by],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({ id: this.lastID, message: 'Automation rule created successfully' });
    }
  );
});

// Update an automation rule
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('Rule name cannot be empty'),
  body('trigger_type').optional().notEmpty().withMessage('Trigger type cannot be empty'),
  body('action_type').optional().notEmpty().withMessage('Action type cannot be empty'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { id } = req.params;
  const { 
    name, 
    trigger_type, 
    trigger_config, 
    action_type, 
    action_config, 
    enabled 
  } = req.body;
  
  // Build update query dynamically
  const updates = [];
  const values = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  
  if (trigger_type !== undefined) {
    updates.push('trigger_type = ?');
    values.push(trigger_type);
  }
  
  if (trigger_config !== undefined) {
    updates.push('trigger_config = ?');
    values.push(JSON.stringify(trigger_config));
  }
  
  if (action_type !== undefined) {
    updates.push('action_type = ?');
    values.push(action_type);
  }
  
  if (action_config !== undefined) {
    updates.push('action_config = ?');
    values.push(JSON.stringify(action_config));
  }
  
  if (enabled !== undefined) {
    updates.push('enabled = ?');
    values.push(enabled);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  db.run(
    `UPDATE automation_rules SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Automation rule not found' });
      }
      
      res.json({ message: 'Automation rule updated successfully' });
    }
  );
});

// Delete an automation rule
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM automation_rules WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }
    
    res.json({ message: 'Automation rule deleted successfully' });
  });
});

// Get automation logs
router.get('/logs', (req, res) => {
  const { ruleId, limit = 50 } = req.query;
  
  let query = `
    SELECT al.*, ar.name as rule_name
    FROM automation_logs al
    JOIN automation_rules ar ON al.rule_id = ar.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (ruleId) {
    query += ' AND al.rule_id = ?';
    params.push(ruleId);
  }
  
  query += ' ORDER BY al.created_at DESC LIMIT ?';
  params.push(limit);
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json(rows);
  });
});

// Manually trigger an automation rule
router.post('/:id/trigger', async (req, res) => {
  const { id } = req.params;
  const { payload } = req.body;
  
  // Get the rule
  db.get(
    'SELECT * FROM automation_rules WHERE id = ? AND enabled = 1',
    [id],
    async (err, rule) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!rule) {
        return res.status(404).json({ error: 'Automation rule not found or disabled' });
      }
      
      try {
        const triggerConfig = JSON.parse(rule.trigger_config);
        const actionConfig = JSON.parse(rule.action_config);
        
        // Check if trigger conditions are met
        let triggerMet = true;
        
        if (rule.trigger_type === 'task_moved') {
          if (triggerConfig.columnId && payload.columnId !== triggerConfig.columnId) {
            triggerMet = false;
          }
          
          if (triggerConfig.priority && payload.priority !== triggerConfig.priority) {
            triggerMet = false;
          }
        }
        
        if (!triggerMet) {
          return res.status(400).json({ error: 'Trigger conditions not met' });
        }
        
        // Execute the action
        let actionResult = { success: false };
        
        if (rule.action_type === 'webhook') {
          actionResult = await triggerWebhook(actionConfig.webhookId, payload);
        } else if (rule.action_type === 'notification') {
          actionResult = await sendNotification(actionConfig.title, actionConfig.message);
        } else if (rule.action_type === 'move_task') {
          // Move task to another column
          db.run(
            'UPDATE tasks SET column_id = ? WHERE id = ?',
            [actionConfig.columnId, payload.taskId],
            function(err) {
              if (err) {
                actionResult = { success: false, error: err.message };
              } else {
                actionResult = { success: true, message: 'Task moved successfully' };
              }
            }
          );
        }
        
        // Log the automation execution
        db.run(
          'INSERT INTO automation_logs (rule_id, status, message) VALUES (?, ?, ?)',
          [id, actionResult.success ? 'success' : 'failed', actionResult.message || actionResult.error],
          function(err) {
            if (err) {
              console.error('Failed to log automation execution:', err);
            }
          }
        );
        
        if (actionResult.success) {
          res.json({
            success: true,
            message: 'Automation rule triggered successfully',
            result: actionResult
          });
        } else {
          res.status(400).json({
            success: false,
            message: 'Automation rule execution failed',
            error: actionResult.error
          });
        }
      } catch (error) {
        // Log the automation execution
        db.run(
          'INSERT INTO automation_logs (rule_id, status, message) VALUES (?, ?, ?)',
          [id, 'failed', error.message],
          function(err) {
            if (err) {
              console.error('Failed to log automation execution:', err);
            }
          }
        );
        
        res.status(500).json({
          success: false,
          message: 'Automation rule execution failed',
          error: error.message
        });
      }
    }
  );
});

module.exports = router;