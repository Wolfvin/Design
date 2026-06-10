/**
 * File-edit conversation and message column helpers.
 *
 * Provides read/write access to the `last_file_edits` column on the
 * `conversations` table and the `file_edits_json` column on the `messages`
 * table — both added by migration 008.
 *
 * These columns support the App Developer migration by tracking which files
 * were edited in each conversation and the structured edit records per message.
 */

import type Database from 'better-sqlite3';

type SqliteDb = Database.Database;
type DbRow = Record<string, any>;

// ---------- FileEditRecord ----------

/**
 * A structured record of a single file edit within a message.
 * Stored as a JSON array element in `messages.file_edits_json`.
 */
export interface FileEditRecord {
  /** Relative file path within the project */
  path: string;
  /** What kind of edit was performed */
  action: 'edit' | 'create' | 'delete';
  /** Number of lines in the resulting file (optional) */
  lineCount?: number;
  /** SHA-256 hash of the file content after edit (optional) */
  contentHash?: string;
}

// ---------- Migration ----------

/**
 * Apply the migration-008 column additions to conversations and messages.
 *
 * Uses PRAGMA table_info checks since SQLite does not support
 * `ALTER TABLE … ADD COLUMN … IF NOT EXISTS`.
 */
export function migrateConversationFileEdits(db: SqliteDb): void {
  // Add last_file_edits to conversations
  const conversationCols = db.prepare(`PRAGMA table_info(conversations)`).all() as DbRow[];
  if (!conversationCols.some((c: DbRow) => c.name === 'last_file_edits')) {
    db.exec(`ALTER TABLE conversations ADD COLUMN last_file_edits TEXT`);
  }

  // Add file_edits_json to messages
  const messageCols = db.prepare(`PRAGMA table_info(messages)`).all() as DbRow[];
  if (!messageCols.some((c: DbRow) => c.name === 'file_edits_json')) {
    db.exec(`ALTER TABLE messages ADD COLUMN file_edits_json TEXT`);
  }

  // Create index for fast lookup of conversations by project
  // (used to find conversations that may have edited a specific file)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_file_edits
      ON conversations(project_id)
  `);
}

// ---------- conversations.last_file_edits ----------

/**
 * Update the `last_file_edits` column on a conversation row.
 *
 * Stores a JSON array of file paths that were edited in this conversation.
 * The list is replaced entirely (not merged) on each call, so callers should
 * merge with the existing list themselves if they want to append.
 *
 * @param db         - SQLite database instance
 * @param conversationId - Primary key of the conversation
 * @param filePaths  - Array of relative file paths edited in this conversation
 */
export async function updateConversationFileEdits(
  db: SqliteDb,
  conversationId: string,
  filePaths: string[],
): Promise<void> {
  const json = JSON.stringify(fileFilePaths(filePaths));
  db.prepare(
    `UPDATE conversations SET last_file_edits = ?, updated_at = ? WHERE id = ?`,
  ).run(json, Date.now(), conversationId);
}

/**
 * Read the `last_file_edits` column from a conversation row.
 *
 * Returns the parsed array of file paths, or an empty array if the column
 * is NULL or contains invalid JSON.
 *
 * @param db             - SQLite database instance
 * @param conversationId - Primary key of the conversation
 * @returns Array of relative file paths
 */
export async function getConversationFileEdits(
  db: SqliteDb,
  conversationId: string,
): Promise<string[]> {
  const row = db.prepare(
    `SELECT last_file_edits AS lastFileEdits FROM conversations WHERE id = ?`,
  ).get(conversationId) as DbRow | undefined;

  if (!row || row.lastFileEdits == null) return [];
  return parseJsonArray<string>(row.lastFileEdits);
}

// ---------- messages.file_edits_json ----------

/**
 * Update the `file_edits_json` column on a message row.
 *
 * Stores a JSON array of {@link FileEditRecord} objects describing the
 * file edits produced by this message. The list is replaced entirely on
 * each call.
 *
 * @param db        - SQLite database instance
 * @param messageId - Primary key of the message
 * @param edits     - Array of file edit records
 */
export async function updateMessageFileEdits(
  db: SqliteDb,
  messageId: string,
  edits: FileEditRecord[],
): Promise<void> {
  const json = JSON.stringify(edits);
  db.prepare(
    `UPDATE messages SET file_edits_json = ? WHERE id = ?`,
  ).run(json, messageId);
}

/**
 * Read the `file_edits_json` column from a message row.
 *
 * Returns the parsed array of {@link FileEditRecord} objects, or an empty
 * array if the column is NULL or contains invalid JSON.
 *
 * @param db        - SQLite database instance
 * @param messageId - Primary key of the message
 * @returns Array of file edit records
 */
export async function getMessageFileEdits(
  db: SqliteDb,
  messageId: string,
): Promise<FileEditRecord[]> {
  const row = db.prepare(
    `SELECT file_edits_json AS fileEditsJson FROM messages WHERE id = ?`,
  ).get(messageId) as DbRow | undefined;

  if (!row || row.fileEditsJson == null) return [];
  return parseJsonArray<FileEditRecord>(row.fileEditsJson);
}

// ---------- Helpers ----------

/**
 * De-duplicate and sort an array of file paths for storage.
 */
function fileFilePaths(paths: string[]): string[] {
  return [...new Set(paths)].sort();
}

/**
 * Safely parse a JSON text column into an array.
 * Returns an empty array on invalid JSON or non-array values.
 */
function parseJsonArray<T>(jsonText: string): T[] {
  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) return parsed as T[];
    return [];
  } catch {
    return [];
  }
}
