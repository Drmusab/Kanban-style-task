const { allAsync, getAsync } = require('../utils/database');
const { triggerWebhook } = require('./webhook');

// Helper function to calculate completion rate
const calculateCompletionRate = (completed, total) => {
  if (total === 0) return '0%';
  return ((completed / total) * 100).toFixed(2) + '%';
};

// Generate a weekly report
const generateWeeklyReport = async () => {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceISO = since.toISOString();
  const now = new Date().toISOString();

  try {
    // Tasks created this week
    const createdTasks = await allAsync(
      'SELECT COUNT(*) as count FROM tasks WHERE created_at >= ?',
      [sinceISO]
    );

    // Tasks completed this week
    const completedTasks = await allAsync(
      `SELECT COUNT(*) as count
       FROM tasks t
       JOIN columns c ON t.column_id = c.id
       WHERE LOWER(c.name) = 'done' AND t.updated_at >= ?`,
      [sinceISO]
    );

    // Overdue tasks
    const overdueTasks = await allAsync(
      `SELECT COUNT(*) as count FROM tasks 
       WHERE due_date IS NOT NULL 
       AND due_date < ? 
       AND column_id NOT IN (SELECT id FROM columns WHERE LOWER(name) = 'done')`,
      [now]
    );

    // Tasks by column
    const tasksByColumn = await allAsync(
      `SELECT c.name as column, COUNT(t.id) as count
       FROM columns c
       LEFT JOIN tasks t ON t.column_id = c.id
       GROUP BY c.id
       ORDER BY c.position ASC`
    );

    // Tasks by priority
    const tasksByPriority = await allAsync(
      `SELECT priority, COUNT(*) as count
       FROM tasks
       WHERE column_id NOT IN (SELECT id FROM columns WHERE LOWER(name) = 'done')
       GROUP BY priority`
    );

    // Average completion time (tasks completed this week)
    const completionTimes = await allAsync(
      `SELECT 
        CAST((JULIANDAY(t.updated_at) - JULIANDAY(t.created_at)) * 24 AS REAL) as hours
       FROM tasks t
       JOIN columns c ON t.column_id = c.id
       WHERE LOWER(c.name) = 'done' AND t.updated_at >= ?`,
      [sinceISO]
    );

    let avgCompletionTime = 0;
    if (completionTimes && completionTimes.length > 0) {
      const totalHours = completionTimes.reduce((sum, row) => sum + (row.hours || 0), 0);
      avgCompletionTime = totalHours / completionTimes.length;
    }

    // Top 5 most active boards
    const activeBoards = await allAsync(
      `SELECT 
        b.id,
        b.name,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT CASE WHEN t.updated_at >= ? THEN t.id END) as recent_activity
       FROM boards b
       LEFT JOIN columns c ON c.board_id = b.id
       LEFT JOIN tasks t ON t.column_id = c.id
       GROUP BY b.id
       ORDER BY recent_activity DESC, task_count DESC
       LIMIT 5`,
      [sinceISO]
    );

    const report = {
      period: {
        start: sinceISO,
        end: now,
        days: 7
      },
      summary: {
        tasksCreated: createdTasks?.[0]?.count || 0,
        tasksCompleted: completedTasks?.[0]?.count || 0,
        tasksOverdue: overdueTasks?.[0]?.count || 0,
        completionRate: calculateCompletionRate(
          completedTasks?.[0]?.count || 0,
          createdTasks?.[0]?.count || 0
        ),
        avgCompletionTimeHours: avgCompletionTime.toFixed(2)
      },
      tasksByColumn: tasksByColumn || [],
      tasksByPriority: tasksByPriority || [],
      activeBoards: activeBoards || []
    };

    return report;
  } catch (error) {
    console.error('Failed to generate weekly report:', error);
    throw error;
  }
};

// Generate a custom date range report
const generateCustomReport = async (startDate, endDate) => {
  const start = new Date(startDate).toISOString();
  const end = new Date(endDate).toISOString();
  const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));

  try {
    const createdTasks = await allAsync(
      'SELECT COUNT(*) as count FROM tasks WHERE created_at >= ? AND created_at <= ?',
      [start, end]
    );

    const completedTasks = await allAsync(
      `SELECT COUNT(*) as count
       FROM tasks t
       JOIN columns c ON t.column_id = c.id
       WHERE LOWER(c.name) = 'done' AND t.updated_at >= ? AND t.updated_at <= ?`,
      [start, end]
    );

    const tasksByColumn = await allAsync(
      `SELECT c.name as column, COUNT(t.id) as count
       FROM columns c
       LEFT JOIN tasks t ON t.column_id = c.id AND t.created_at >= ? AND t.created_at <= ?
       GROUP BY c.id
       ORDER BY c.position ASC`,
      [start, end]
    );

    return {
      period: {
        start,
        end,
        days
      },
      summary: {
        tasksCreated: createdTasks?.[0]?.count || 0,
        tasksCompleted: completedTasks?.[0]?.count || 0,
        completionRate: calculateCompletionRate(
          completedTasks?.[0]?.count || 0,
          createdTasks?.[0]?.count || 0
        )
      },
      tasksByColumn: tasksByColumn || []
    };
  } catch (error) {
    console.error('Failed to generate custom report:', error);
    throw error;
  }
};

// Send report to n8n webhooks
const sendReportToN8n = async (report) => {
  try {
    const integrations = await allAsync(
      'SELECT * FROM integrations WHERE type = ? AND enabled = 1',
      ['n8n_webhook']
    );

    if (!integrations || integrations.length === 0) {
      return {
        success: false,
        message: 'No n8n webhooks configured'
      };
    }

    const reportPayload = {
      type: 'report',
      reportType: 'weekly',
      timestamp: new Date().toISOString(),
      data: report
    };

    const results = await Promise.allSettled(
      integrations.map(integration =>
        triggerWebhook(integration.id, reportPayload)
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    
    return {
      success: successCount > 0,
      message: `Report sent to ${successCount} of ${integrations.length} webhooks`,
      results
    };
  } catch (error) {
    console.error('Failed to send report to n8n:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate productivity analytics
const generateProductivityAnalytics = async (days = 30) => {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  try {
    // Daily completion trend
    const dailyCompletions = await allAsync(
      `SELECT 
        DATE(t.updated_at) as date,
        COUNT(*) as count
       FROM tasks t
       JOIN columns c ON t.column_id = c.id
       WHERE LOWER(c.name) = 'done' AND t.updated_at >= ?
       GROUP BY DATE(t.updated_at)
       ORDER BY date ASC`,
      [sinceISO]
    );

    // User productivity (if assigned_to is being used)
    const userProductivity = await allAsync(
      `SELECT 
        assigned_to,
        COUNT(*) as tasks_completed
       FROM tasks t
       JOIN columns c ON t.column_id = c.id
       WHERE LOWER(c.name) = 'done' 
         AND t.updated_at >= ? 
         AND assigned_to IS NOT NULL
       GROUP BY assigned_to
       ORDER BY tasks_completed DESC`,
      [sinceISO]
    );

    // Task velocity (tasks completed per week)
    const velocity = await allAsync(
      `SELECT 
        CAST((JULIANDAY('now') - JULIANDAY(t.updated_at)) / 7 AS INTEGER) as week_ago,
        COUNT(*) as count
       FROM tasks t
       JOIN columns c ON t.column_id = c.id
       WHERE LOWER(c.name) = 'done' AND t.updated_at >= ?
       GROUP BY week_ago
       ORDER BY week_ago ASC`,
      [sinceISO]
    );

    return {
      period: {
        days,
        start: sinceISO,
        end: new Date().toISOString()
      },
      dailyCompletions: dailyCompletions || [],
      userProductivity: userProductivity || [],
      velocity: velocity || []
    };
  } catch (error) {
    console.error('Failed to generate productivity analytics:', error);
    throw error;
  }
};

module.exports = {
  generateWeeklyReport,
  generateCustomReport,
  sendReportToN8n,
  generateProductivityAnalytics
};
