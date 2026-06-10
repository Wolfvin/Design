/**
 * Next.js Mode Migration — adds columns and tables for Next.js project support.
 *
 * Reads the SQL from 009-nextjs-mode.sql and applies it safely using
 * ALTER TABLE with existence checks (SQLite doesn't support IF NOT EXISTS
 * for ALTER TABLE columns).
 */

import type Database from 'better-sqlite3';

type SqliteDb = Database.Database;
type DbRow = Record<string, any>;

/**
 * Apply the Next.js mode migration.
 *
 * Adds:
 *   - projects.project_type (TEXT)
 *   - projects.tech_stack (TEXT)
 *   - projects.dev_port (INTEGER)
 *   - projects.dev_server_type (TEXT)
 *   - messages.file_edits_json (TEXT)
 *   - conversations.last_file_edits_json (TEXT)
 *   - prisma_migrations_log table
 */
export function migrateNextjsMode(db: SqliteDb): void {
  // --- Add columns to projects table ---
  const projectCols = db.prepare(`PRAGMA table_info(projects)`).all() as DbRow[];

  if (!projectCols.some((c: DbRow) => c.name === 'project_type')) {
    db.exec(`ALTER TABLE projects ADD COLUMN project_type TEXT`);
  }
  if (!projectCols.some((c: DbRow) => c.name === 'tech_stack')) {
    db.exec(`ALTER TABLE projects ADD COLUMN tech_stack TEXT`);
  }
  if (!projectCols.some((c: DbRow) => c.name === 'dev_port')) {
    db.exec(`ALTER TABLE projects ADD COLUMN dev_port INTEGER`);
  }
  if (!projectCols.some((c: DbRow) => c.name === 'dev_server_type')) {
    db.exec(`ALTER TABLE projects ADD COLUMN dev_server_type TEXT`);
  }

  // --- Add columns to messages table ---
  const messageCols = db.prepare(`PRAGMA table_info(messages)`).all() as DbRow[];
  if (!messageCols.some((c: DbRow) => c.name === 'file_edits_json')) {
    db.exec(`ALTER TABLE messages ADD COLUMN file_edits_json TEXT`);
  }

  // --- Add columns to conversations table ---
  const conversationCols = db.prepare(`PRAGMA table_info(conversations)`).all() as DbRow[];
  if (!conversationCols.some((c: DbRow) => c.name === 'last_file_edits_json')) {
    db.exec(`ALTER TABLE conversations ADD COLUMN last_file_edits_json TEXT`);
  }

  // --- Create prisma_migrations_log table ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS prisma_migrations_log (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      schema_before TEXT NOT NULL,
      schema_after TEXT NOT NULL,
      migration_sql TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      applied_at INTEGER,
      error TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prisma_migrations_project
      ON prisma_migrations_log(project_id, created_at DESC);
  `);
}
