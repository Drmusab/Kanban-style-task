const { getAsync, runAsync, allAsync } = require('../utils/database');
const { recordTaskHistory } = require('../utils/history');

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

// Create a new instance of a recurring task
const createRecurringTask = async (originalTask, recurringRule) => {
  if (!originalTask || !originalTask.due_date) {
    throw new Error('Cannot create recurring task without a valid due date');
  }

  const lastDueDate = new Date(originalTask.due_date);

  if (Number.isNaN(lastDueDate.getTime())) {
    throw new Error('Cannot create recurring task without a valid due date');
  }

  if (!recurringRule || typeof recurringRule !== 'object') {
    throw new Error('Recurring rule must be provided as an object');
  }

  const { frequency, interval, endDate, maxOccurrences } = recurringRule;

  if (!frequency) {
    throw new Error('Recurring rule frequency is required');
  }

  const normalizedInterval = isPositiveInteger(interval) ? interval : 1;
  const nextDueDate = new Date(lastDueDate.getTime());

  switch (frequency) {
    case 'daily':
      nextDueDate.setDate(nextDueDate.getDate() + normalizedInterval);
      break;
    case 'weekly':
      nextDueDate.setDate(nextDueDate.getDate() + (normalizedInterval * 7));
      break;
    case 'monthly':
      nextDueDate.setMonth(nextDueDate.getMonth() + normalizedInterval);
      break;
    case 'yearly':
      nextDueDate.setFullYear(nextDueDate.getFullYear() + normalizedInterval);
      break;
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }

  if (endDate) {
    const parsedEndDate = new Date(endDate);
    if (Number.isNaN(parsedEndDate.getTime())) {
      throw new Error('Recurring rule end date is invalid');
    }

    if (parsedEndDate < nextDueDate) {
      return null;
    }
  }

  if (isPositiveInteger(maxOccurrences)) {
    const ruleToMatch = originalTask.recurring_rule || JSON.stringify(recurringRule);
    const occurrencesRow = await getAsync(
      'SELECT COUNT(*) as count FROM tasks WHERE recurring_rule = ?',
      [ruleToMatch]
    );

    if ((occurrencesRow?.count || 0) >= maxOccurrences) {
      return null;
    }
  }

  const positionRow = await getAsync(
    'SELECT MAX(position) as maxPosition FROM tasks WHERE column_id = ?',
    [originalTask.column_id]
  );

  const position = ((positionRow && positionRow.maxPosition) || 0) + 1;

  const recurringRuleValue = originalTask.recurring_rule || JSON.stringify(recurringRule);

  const insertResult = await runAsync(
    `INSERT INTO tasks (title, description, column_id, position, priority, due_date, recurring_rule, created_by, assigned_to)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      originalTask.title,
      originalTask.description,
      originalTask.column_id,
      position,
      originalTask.priority,
      nextDueDate.toISOString(),
      recurringRuleValue,
      originalTask.created_by,
      originalTask.assigned_to
    ]
  );

  const taskId = insertResult.lastID;

  recordTaskHistory(taskId, 'created', null, null, originalTask.created_by);

  const tagRows = await allAsync(
    'SELECT tag_id FROM task_tags WHERE task_id = ?',
    [originalTask.id]
  );

  if (tagRows.length > 0) {
    await Promise.all(
      tagRows.map(tagRow =>
        runAsync('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [taskId, tagRow.tag_id])
      )
    );
  }

  return taskId;
};

module.exports = { createRecurringTask };
