const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { allAsync } = require('../utils/database');
const { broadcastN8nEvent } = require('../services/n8n');

const WEEK_DAYS = 7;

const getSevenDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - WEEK_DAYS);
  return date.toISOString();
};

const buildWeeklyReport = async () => {
  const since = getSevenDaysAgo();

  const created = await allAsync(
    'SELECT COUNT(*) as count FROM tasks WHERE created_at >= ?',
    [since]
  );
  const createdCount = created?.[0]?.count || 0;

  const completed = await allAsync(
    `SELECT COUNT(*) as count
       FROM tasks t
       JOIN columns c ON t.column_id = c.id
       WHERE LOWER(c.name) = 'done' AND t.updated_at >= ?`,
    [since]
  );
  const completedCount = completed?.[0]?.count || 0;

  const overdue = await allAsync(
    'SELECT COUNT(*) as count FROM tasks WHERE due_date IS NOT NULL AND due_date < ? AND column_id NOT IN (SELECT id FROM columns WHERE LOWER(name) = "done")',
    [new Date().toISOString()]
  );
  const overdueCount = overdue?.[0]?.count || 0;

  const byColumn = await allAsync(
    `SELECT c.name as column, COUNT(t.id) as count
       FROM columns c
       LEFT JOIN tasks t ON t.column_id = c.id
       GROUP BY c.id
       ORDER BY c.position ASC`
  );

  return {
    rangeStart: since,
    rangeEnd: new Date().toISOString(),
    created: createdCount,
    completed: completedCount,
    overdue: overdueCount,
    byColumn,
  };
};

router.get('/weekly', async (_req, res) => {
  try {
    const report = await buildWeeklyReport();
    res.json(report);
  } catch (error) {
    console.error('Failed to build weekly report:', error);
    res.status(500).json({ error: 'Unable to generate report', details: error.message });
  }
});

router.post(
  '/weekly/dispatch',
  [body('includeBreakdown').optional().isBoolean()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const report = await buildWeeklyReport();
      const payload = req.body.includeBreakdown ? report : {
        rangeStart: report.rangeStart,
        rangeEnd: report.rangeEnd,
        created: report.created,
        completed: report.completed,
        overdue: report.overdue,
      };

      const n8nResult = await broadcastN8nEvent('weekly_report', payload);

      if (!n8nResult.success) {
        return res.status(502).json({
          error: 'Unable to deliver report to n8n',
          details: n8nResult.message || n8nResult.error,
          deliveries: n8nResult,
        });
      }

      res.json({
        message: 'Weekly report dispatched to n8n',
        deliveries: n8nResult.deliveries,
      });
    } catch (error) {
      console.error('Failed to dispatch weekly report:', error);
      res.status(500).json({ error: 'Unable to dispatch report', details: error.message });
    }
  }
);

module.exports = router;
