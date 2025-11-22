const express = require('express');
const { body, validationResult } = require('express-validator');
const { runAsync, getAsync } = require('../utils/database');
const { recordTaskHistory } = require('../utils/history');
const { emitEvent } = require('../services/eventBus');

const router = express.Router();

const normalize = (value) => (value || '').trim();

const findColumnByName = async (name) => {
  return getAsync('SELECT * FROM columns WHERE LOWER(name) = LOWER(?) LIMIT 1', [name]);
};

const findTaskByTitle = async (title) => {
  return getAsync('SELECT * FROM tasks WHERE LOWER(title) = LOWER(?) LIMIT 1', [title]);
};

const getNextPosition = async (columnId) => {
  const row = await getAsync('SELECT MAX(position) as maxPosition FROM tasks WHERE column_id = ?', [columnId]);
  return ((row && row.maxPosition) || 0) + 1;
};

const createTask = async ({ title, description = '', columnId, dueDate }) => {
  const position = await getNextPosition(columnId);
  const insertResult = await runAsync(
    `INSERT INTO tasks (title, description, column_id, position, due_date)
     VALUES (?, ?, ?, ?, ?)` ,
    [title, description, columnId, position, dueDate || null]
  );

  recordTaskHistory(insertResult.lastID, 'created', null, null, null);
  emitEvent('task', 'created', { taskId: insertResult.lastID, columnId });

  return insertResult.lastID;
};

const moveTaskToColumn = async (taskId, columnId) => {
  const position = await getNextPosition(columnId);
  await runAsync(
    'UPDATE tasks SET column_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [columnId, position, taskId]
  );
  recordTaskHistory(taskId, 'moved', null, `column:${columnId}`, null);
  emitEvent('task', 'moved', { taskId, columnId });
};

const updateTaskDueDate = async (taskId, dueDate) => {
  await runAsync(
    'UPDATE tasks SET due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [dueDate, taskId]
  );
  recordTaskHistory(taskId, 'updated', 'due_date', dueDate, null);
  emitEvent('task', 'updated', { taskId, dueDate });
};

const parseCreateCommand = (command) => {
  const match = command.match(/create (?:a )?task(?: called| named)?\s+"?([^\"]+?)"?(?: in| to)?\s+(?:column )?"?([^\"]+?)"?/i);
  if (match) {
    return {
      action: 'create',
      title: normalize(match[1]),
      columnName: normalize(match[2])
    };
  }
  return null;
};

const parseMoveCommand = (command) => {
  const match = command.match(/move task\s+"?([^\"]+?)"?\s+to\s+"?([^\"]+?)"?/i);
  if (match) {
    return {
      action: 'move',
      title: normalize(match[1]),
      columnName: normalize(match[2])
    };
  }
  return null;
};

const parseCompleteCommand = (command) => {
  const match = command.match(/(?:complete|mark) task\s+"?([^\"]+?)"?/i);
  if (match) {
    return { action: 'complete', title: normalize(match[1]) };
  }
  return null;
};

const parseDueDateCommand = (command) => {
  const match = command.match(/set due date for task\s+"?([^\"]+?)"?\s+to\s+([^"\n]+)/i);
  if (match) {
    return { action: 'set_due', title: normalize(match[1]), dueDate: normalize(match[2]) };
  }
  return null;
};

const parseCommand = (command) => {
  return (
    parseCreateCommand(command) ||
    parseMoveCommand(command) ||
    parseCompleteCommand(command) ||
    parseDueDateCommand(command)
  );
};

router.post('/command', [body('command').notEmpty().withMessage('Command text is required')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { command } = req.body;
  const parsed = parseCommand(command);

  if (!parsed) {
    return res.status(400).json({ error: 'Unable to understand the command. Try specifying the task title and column.' });
  }

  try {
    if (parsed.action === 'create') {
      const column = await findColumnByName(parsed.columnName);
      if (!column) {
        return res.status(404).json({ error: `Column "${parsed.columnName}" was not found` });
      }

      const taskId = await createTask({ title: parsed.title, columnId: column.id });
      return res.json({
        action: 'create',
        success: true,
        taskId,
        columnId: column.id,
        message: `Created task "${parsed.title}" in ${column.name}`
      });
    }

    const task = await findTaskByTitle(parsed.title);
    if (!task) {
      return res.status(404).json({ error: `Task "${parsed.title}" not found` });
    }

    if (parsed.action === 'move') {
      const column = await findColumnByName(parsed.columnName);
      if (!column) {
        return res.status(404).json({ error: `Column "${parsed.columnName}" was not found` });
      }

      await moveTaskToColumn(task.id, column.id);
      return res.json({
        action: 'move',
        success: true,
        taskId: task.id,
        columnId: column.id,
        message: `Moved task "${task.title}" to ${column.name}`
      });
    }

    if (parsed.action === 'complete') {
      const doneColumn = await findColumnByName('Done');
      if (!doneColumn) {
        return res.status(400).json({ error: 'A "Done" column is required to complete tasks automatically.' });
      }

      await moveTaskToColumn(task.id, doneColumn.id);
      return res.json({
        action: 'complete',
        success: true,
        taskId: task.id,
        columnId: doneColumn.id,
        message: `Marked task "${task.title}" as complete`
      });
    }

    if (parsed.action === 'set_due') {
      const dueDate = new Date(parsed.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({ error: 'Due date could not be parsed. Use an ISO date or clear description like "2024-12-01 17:00".' });
      }

      await updateTaskDueDate(task.id, dueDate.toISOString());
      return res.json({
        action: 'set_due',
        success: true,
        taskId: task.id,
        dueDate: dueDate.toISOString(),
        message: `Updated due date for "${task.title}"`
      });
    }

    return res.status(400).json({ error: 'Command detected but no action executed.' });
  } catch (error) {
    console.error('AI command execution failed:', error);
    return res.status(500).json({ error: 'Failed to execute command', details: error.message });
  }
});

router.get('/patterns', async (_req, res) => {
  res.json({
    examples: [
      'Create task "Write release notes" in Done',
      'Move task "Upgrade dependencies" to In Progress',
      'Complete task "Push to production"',
      'Set due date for task "Write tests" to 2024-11-01 17:00'
    ],
    description: 'These commands are designed for n8n AI Agent nodes to translate natural language into Kanban CRUD actions.'
  });
});

module.exports = router;
