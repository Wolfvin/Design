-- Migration 009: Next.js mode support
--
-- Adds fields for dual-mode (Tauri + Next.js) project support:
-- - dev_port: Unified dev server port (replaces vite_port for new code)
-- - dev_server_type: Identifies the preview mechanism (vite, nextjs, custom)
-- - project_type: More granular types including nextjs-standalone, nextjs-pages
-- - prisma_migrations_log: Track Prisma schema changes for Next.js projects

-- Add dev_port column (nullable, populated by auto-detect)
ALTER TABLE projects ADD COLUMN dev_port INTEGER;

-- Add dev_server_type column
ALTER TABLE projects ADD COLUMN dev_server_type TEXT CHECK(dev_server_type IN ('vite', 'nextjs', 'custom')) DEFAULT 'vite';

-- Add project_type column for granular type detection
ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT NULL;

-- Create index on project_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);

-- Create prisma_migrations_log table for Next.js projects
CREATE TABLE IF NOT EXISTS prisma_migrations_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      TEXT    NOT NULL,
  schema_before   TEXT,          -- Schema content before the edit
  schema_after    TEXT,          -- Schema content after the edit
  migration_sql   TEXT,          -- SQL that was applied (if any)
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending', 'validated', 'applied', 'failed')),
  error_message   TEXT,          -- Error details if status = 'failed'
  duration_ms     INTEGER,      -- How long the operation took
  created_at      INTEGER NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prisma_migrations_log_project
  ON prisma_migrations_log(project_id, created_at DESC);

-- Backfill: Set dev_server_type and project_type for existing projects
-- based on existing vite_port values
UPDATE projects SET
  dev_server_type = 'vite',
  dev_port = vite_port
WHERE vite_port IS NOT NULL AND dev_port IS NULL;
