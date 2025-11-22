const express = require('express');
const router = express.Router();
const { allAsync } = require('../utils/database');

const WEEK_DAYS = 7;

const getSevenDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - WEEK_DAYS);
  return date.toISOString();
};

router.get('/weekly', async (_req, res) => {
  try {
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

    res.json({
      rangeStart: since,
      rangeEnd: new Date().toISOString(),
      created: createdCount,
      completed: completedCount,
      overdue: overdueCount,
      byColumn,
    });
  } catch (error) {
    console.error('Failed to build weekly report:', error);
    res.status(500).json({ error: 'Unable to generate report', details: error.message });
  }
});

module.exports = router;
