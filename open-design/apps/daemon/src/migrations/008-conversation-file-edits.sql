-- Migration 008: Add file-edit columns to conversations and messages tables
-- Part of the App Developer migration (Phase 1-E extension).
--
-- This migration adds:
--   1. conversations.last_file_edits — JSON array of file paths edited in this
--      conversation. Enables quick lookup of "which conversations touched file X?"
--      Example: ["src/components/LoginPage.tsx", "src/styles/tokens.css"]
--
--   2. messages.file_edits_json — JSON array of file edit records for this message.
--      Replaces the old produced_files_json artifact manifest with structured
--      per-file edit records including action type and line counts.
--      Example: [{"path":"src/components/LoginPage.tsx","action":"edit","lineCount":42}]
--
-- Note: SQLite does not support IF NOT EXISTS on ALTER TABLE, so the actual
-- column additions are applied in db.ts via PRAGMA table_info checks.
-- This SQL file is the canonical reference for what the migration adds.

-- Add last_file_edits to conversations
-- Stores JSON array of file paths edited in this conversation
ALTER TABLE conversations ADD COLUMN last_file_edits TEXT;

-- Add file_edits_json to messages
-- Stores JSON array of file edit records for this message
ALTER TABLE messages ADD COLUMN file_edits_json TEXT;

-- Create index for fast lookup of conversations that edited a specific file
-- (uses JSON string search since SQLite doesn't have native JSON index)
CREATE INDEX IF NOT EXISTS idx_conversations_file_edits
  ON conversations(project_id);
