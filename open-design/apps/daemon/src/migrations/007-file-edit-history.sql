-- Migration 007: file_edit_history and project type columns
-- Part of the Phase 1-E file edit → disk write pipeline.
-- Note: design_token_sync_log already exists (created by design-token-sync.ts).

CREATE TABLE IF NOT EXISTS file_edit_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'edit',  -- 'edit' | 'create' | 'delete'
  diff_json TEXT,                         -- JSON diff of changes
  content_hash TEXT NOT NULL,            -- SHA-256 of new content
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_file_edit_history_project
  ON file_edit_history(project_id);

CREATE INDEX IF NOT EXISTS idx_file_edit_history_path
  ON file_edit_history(project_id, file_path);

-- Add new columns to projects table (safe ALTER TABLE with column-existence checks)
-- Note: These are applied in db.ts via PRAGMA table_info checks since SQLite
-- does not support IF NOT EXISTS on ALTER TABLE. The SQL below is the
-- canonical reference for what the migration adds.

-- ALTER TABLE projects ADD COLUMN project_type TEXT;
-- ALTER TABLE projects ADD COLUMN tech_stack TEXT;
-- ALTER TABLE projects ADD COLUMN vite_port INTEGER;
