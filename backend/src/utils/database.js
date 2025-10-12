const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/kanban.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Boards table
      db.run(`CREATE TABLE IF NOT EXISTS boards (
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
      db.run(`CREATE TABLE IF NOT EXISTS columns (
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
      db.run(`CREATE TABLE IF NOT EXISTS swimlanes (
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
      db.run(`CREATE TABLE IF NOT EXISTS tasks (
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
      db.run(`CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#95a5a6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Task tags junction table
      db.run(`CREATE TABLE IF NOT EXISTS task_tags (
        task_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (task_id, tag_id),
        FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
      )`);

      // Subtasks table
      db.run(`CREATE TABLE IF NOT EXISTS subtasks (
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
      db.run(`CREATE TABLE IF NOT EXISTS attachments (
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
      db.run(`CREATE TABLE IF NOT EXISTS task_history (
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
      db.run(`CREATE TABLE IF NOT EXISTS integrations (
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
      db.run(`CREATE TABLE IF NOT EXISTS automation_rules (
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
      db.run(`CREATE TABLE IF NOT EXISTS automation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rule_id) REFERENCES automation_rules (id) ON DELETE CASCADE
      )`);

      // Create indexes for better performance
      db.run('CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_tasks_swimlane_id ON tasks(swimlane_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
      db.run('CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs(rule_id)');

      // Insert default data
      db.get('SELECT COUNT(*) as count FROM boards', (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row.count === 0) {
          // Create default board
          db.run('INSERT INTO boards (name, description, template) VALUES (?, ?, ?)', 
            ['Default Board', 'A basic Kanban board', 0], function(err) {
            if (err) {
              reject(err);
              return;
            }

            const boardId = this.lastID;

            // Create default columns
            const columns = [
              { name: 'To Do', color: '#e74c3c', icon: 'clipboard-list', position: 0 },
              { name: 'In Progress', color: '#f39c12', icon: 'spinner', position: 1 },
              { name: 'Review', color: '#3498db', icon: 'eye', position: 2 },
              { name: 'Done', color: '#2ecc71', icon: 'check-circle', position: 3 }
            ];

            columns.forEach(column => {
              db.run('INSERT INTO columns (board_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?)',
                [boardId, column.name, column.color, column.icon, column.position]);
            });

            // Create default tags
            const tags = [
              { name: 'Bug', color: '#e74c3c' },
              { name: 'Feature', color: '#2ecc71' },
              { name: 'Enhancement', color: '#3498db' },
              { name: 'Urgent', color: '#e67e22' }
            ];

            tags.forEach(tag => {
              db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [tag.name, tag.color]);
            });

            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  });
};

module.exports = { db, initDatabase };