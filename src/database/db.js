const path = require("path");
const Database = require("better-sqlite3");

const dbPath =
  process.env.DB_PATH ||
  path.join(process.cwd(), "monitor.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.prepare(`
  CREATE TABLE IF NOT EXISTS monitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Monitoring',
    followers TEXT DEFAULT 'N/A',
    timeframe TEXT DEFAULT 'Auto',
    review TEXT DEFAULT 'Under review',
    created_at INTEGER NOT NULL
  )
`).run();

const columns = db
  .prepare("PRAGMA table_info(monitors)")
  .all()
  .map((column) => column.name);

const migrations = [
  ["auto_complete_at", "INTEGER DEFAULT NULL"],
  ["channel_id", "TEXT DEFAULT NULL"],
  ["message_id", "TEXT DEFAULT NULL"],
  ["last_checked_at", "INTEGER DEFAULT NULL"],
  ["last_check_ok", "INTEGER DEFAULT 0"],
  ["recovery_streak", "INTEGER DEFAULT 0"],
  ["monitor_type", "TEXT DEFAULT 'edited'"],
];

for (const [name, definition] of migrations) {
  if (!columns.includes(name)) {
    db.prepare(
      `ALTER TABLE monitors ADD COLUMN ${name} ${definition}`
    ).run();

    console.log(`✅ Added ${name} column`);
  }
}

console.log(`💾 SQLite database: ${dbPath}`);

module.exports = db;
