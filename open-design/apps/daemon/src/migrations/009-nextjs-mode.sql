-- 009-nextjs-mode.sql
-- Add Next.js mode support: project type, dev server type, dev port,
-- Prisma migration logging.

-- Add project_type column to projects table
ALTER TABLE projects ADD COLUMN project_type TEXT;

-- Add tech_stack column to projects table
ALTER TABLE projects ADD COLUMN tech_stack TEXT;

-- Add dev_port column to projects table (nullable, populated via auto-detect)
ALTER TABLE projects ADD COLUMN dev_port INTEGER;

-- Add dev_server_type column to projects table (vite | nextjs | custom)
ALTER TABLE projects ADD COLUMN dev_server_type TEXT;

-- Add file_edits_json column to messages table
ALTER TABLE messages ADD COLUMN file_edits_json TEXT;

-- Add last_file_edits column to conversations table
ALTER TABLE conversations ADD COLUMN last_file_edits_json TEXT;

-- Prisma migrations log table
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
