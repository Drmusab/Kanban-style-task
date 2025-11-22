const express = require('express');
const { body, validationResult } = require('express-validator');
const { runAsync } = require('../utils/database');

const router = express.Router();

const recurringRuleSchema = [
  body('title').notEmpty().withMessage('Title is required'),
  body('columnId').isInt().withMessage('columnId is required'),
  body('startAt').notEmpty().withMessage('startAt is required'),
  body('frequency').isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('frequency must be daily, weekly, monthly, or yearly'),
  body('interval').optional().isInt({ min: 1 }).withMessage('interval must be a positive integer'),
  body('occurrences').optional().isInt({ min: 1 }).withMessage('occurrences must be a positive integer'),
  body('endDate').optional().isString(),
];

router.post('/', recurringRuleSchema, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description = '', columnId, startAt, frequency, interval, occurrences, endDate } = req.body;
  const startDate = new Date(startAt);
  if (Number.isNaN(startDate.getTime())) {
    return res.status(400).json({ error: 'startAt must be a valid date' });
  }

  const recurringRule = {
    frequency,
    interval: interval || 1,
    maxOccurrences: occurrences,
    endDate,
  };

  try {
    const insertResult = await runAsync(
      `INSERT INTO tasks (title, description, column_id, position, priority, due_date, recurring_rule)
       VALUES (?, ?, ?, (SELECT IFNULL(MAX(position), 0) + 1 FROM tasks WHERE column_id = ?), 'medium', ?, ?)` ,
      [title, description, columnId, columnId, startDate.toISOString(), JSON.stringify(recurringRule)]
    );

    const baseTaskId = insertResult.lastID;

    res.status(201).json({
      message: 'Routine created with recurring tasks',
      taskId: baseTaskId,
      recurringRule,
    });
  } catch (error) {
    console.error('Failed to create routine task:', error);
    res.status(500).json({ error: 'Unable to create routine task', details: error.message });
  }
});

module.exports = router;
