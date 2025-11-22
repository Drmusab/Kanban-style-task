const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DEFAULT_DB_PATH = path.join(__dirname, '../../data/kanban.db');
const configuredPath = process.env.DATABASE_PATH || DEFAULT_DB_PATH;
const isInMemoryDatabase = configuredPath === ':memory:' || configuredPath === 'memory';
const resolvedPath = isInMemoryDatabase ? ':memory:' : configuredPath;

if (!isInMemoryDatabase) {
  const dataDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const db = new sqlite3.Database(resolvedPath);

const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

const getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Users table
        await runAsync(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Boards table
        await runAsync(`CREATE TABLE IF NOT EXISTS boards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          template BOOLEAN DEFAULT 0,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users (id)
        )`);

        // Columns table
        await runAsync(`CREATE TABLE IF NOT EXISTS columns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          board_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#3498db',
          icon TEXT,
          position INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
        )`);

        // Swimlanes table
        await runAsync(`CREATE TABLE IF NOT EXISTS swimlanes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          board_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#ecf0f1',
          position INTEGER NOT NULL,
          collapsed BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
        )`);

        // Tasks table
        await runAsync(`CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          column_id INTEGER NOT NULL,
          swimlane_id INTEGER,
          position INTEGER NOT NULL,
          priority TEXT DEFAULT 'medium',
          due_date DATETIME,
          recurring_rule TEXT,
          pinned BOOLEAN DEFAULT 0,
          created_by INTEGER,
          assigned_to INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (column_id) REFERENCES columns (id) ON DELETE CASCADE,
          FOREIGN KEY (swimlane_id) REFERENCES swimlanes (id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES users (id),
          FOREIGN KEY (assigned_to) REFERENCES users (id)
        )`);

        // Tags table
        await runAsync(`CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          color TEXT DEFAULT '#95a5a6',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Task tags junction table
        await runAsync(`CREATE TABLE IF NOT EXISTS task_tags (
          task_id INTEGER,
          tag_id INTEGER,
          PRIMARY KEY (task_id, tag_id),
          FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
        )`);

        // Subtasks table
        await runAsync(`CREATE TABLE IF NOT EXISTS subtasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          completed BOOLEAN DEFAULT 0,
          position INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
        )`);

        // Attachments table
        await runAsync(`CREATE TABLE IF NOT EXISTS attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER,
          mime_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
        )`);

        // Task history table
        await runAsync(`CREATE TABLE IF NOT EXISTS task_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Integrations table
        await runAsync(`CREATE TABLE IF NOT EXISTS integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config TEXT NOT NULL,
          enabled BOOLEAN DEFAULT 1,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users (id)
        )`);

        // Automation rules table
        await runAsync(`CREATE TABLE IF NOT EXISTS automation_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          trigger_config TEXT NOT NULL,
          action_type TEXT NOT NULL,
          action_config TEXT NOT NULL,
          enabled BOOLEAN DEFAULT 1,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users (id)
        )`);

        // Automation logs table
        await runAsync(`CREATE TABLE IF NOT EXISTS automation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rule_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (rule_id) REFERENCES automation_rules (id) ON DELETE CASCADE
        )`);

        // Settings table for application configuration
        await runAsync(`CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create indexes for better performance
        await runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id)');
        await runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_swimlane_id ON tasks(swimlane_id)');
        await runAsync('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
        await runAsync('CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id)');
        await runAsync('CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs(rule_id)');

        // Ensure a default demo user exists for first-run experience
        const userCount = await getAsync('SELECT COUNT(*) as count FROM users');
        if (!userCount || userCount.count === 0) {
          const passwordHash = bcrypt.hashSync('demo123', 10);
          await runAsync(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            ['demo', 'demo@example.com', passwordHash, 'admin']
          );
        }

        // Insert default board and metadata if none exist
        const boardCount = await getAsync('SELECT COUNT(*) as count FROM boards');
        if (!boardCount || boardCount.count === 0) {
          const boardResult = await runAsync(
            'INSERT INTO boards (name, description, template) VALUES (?, ?, ?)',
            ['Default Board', 'A basic Kanban board', 0]
          );

          const boardId = boardResult.lastID;

          const columns = [
            { name: 'To Do', color: '#e74c3c', icon: 'clipboard-list', position: 0 },
            { name: 'In Progress', color: '#f39c12', icon: 'spinner', position: 1 },
            { name: 'Review', color: '#3498db', icon: 'eye', position: 2 },
            { name: 'Done', color: '#2ecc71', icon: 'check-circle', position: 3 }
          ];

          for (const column of columns) {
            await runAsync(
              'INSERT INTO columns (board_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?)',
              [boardId, column.name, column.color, column.icon, column.position]
            );
          }

          const tags = [
            { name: 'Bug', color: '#e74c3c' },
            { name: 'Feature', color: '#2ecc71' },
            { name: 'Enhancement', color: '#3498db' },
            { name: 'Urgent', color: '#e67e22' }
          ];

          for (const tag of tags) {
            await runAsync('INSERT INTO tags (name, color) VALUES (?, ?)', [tag.name, tag.color]);
          }
        }

        // Insert default settings if none exist
        const settingsCount = await getAsync('SELECT COUNT(*) as count FROM settings');
        if (!settingsCount || settingsCount.count === 0) {
          const defaultSettings = [
            { key: 'report_schedule_day', value: '1', description: 'Day of week for weekly report (0=Sunday, 1=Monday, etc.)' },
            { key: 'report_schedule_hour', value: '9', description: 'Hour of day for weekly report (0-23)' },
            { key: 'report_schedule_minute', value: '0', description: 'Minute of hour for weekly report (0, 15, 30, 45)' }
          ];

          for (const setting of defaultSettings) {
            await runAsync(
              'INSERT INTO settings (key, value, description) VALUES (?, ?, ?)',
              [setting.key, setting.value, setting.description]
            );
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
};

const TABLES_IN_DELETE_ORDER = [
  'automation_logs',
  'task_history',
  'attachments',
  'subtasks',
  'task_tags',
  'tasks',
  'swimlanes',
  'columns',
  'boards',
  'automation_rules',
  'integrations',
  'tags',
  'users'
];

const clearDatabase = async () => {
  for (const table of TABLES_IN_DELETE_ORDER) {
    try {
      await runAsync(`DELETE FROM ${table}`);
    } catch (error) {
      if (error.message && error.message.includes('no such table')) {
        // Skip tables that are not present in the current schema
        continue;
      }
      throw error;
    }
  }
};

module.exports = { db, initDatabase, runAsync, getAsync, allAsync, clearDatabase };
