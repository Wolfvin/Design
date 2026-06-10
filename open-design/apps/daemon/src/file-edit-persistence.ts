import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

type SqliteDb = Database.Database;
type DbRow = Record<string, any>;

/**
 * Apply the file_edit_history migration (007) to the database.
 * Creates the file_edit_history table and adds project_type, tech_stack,
 * and vite_port columns to projects.
 *
 * Note: The design_token_sync_log table is already created by
 * migrateDesignTokenSyncLog in design-token-sync.ts — we do not
 * recreate it here to avoid a schema conflict.
 */
export function migrateFileEditHistory(db: SqliteDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_edit_history (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
      message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      file_path TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'edit',
      diff_json TEXT,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_file_edit_history_project
      ON file_edit_history(project_id);

    CREATE INDEX IF NOT EXISTS idx_file_edit_history_path
      ON file_edit_history(project_id, file_path);
  `);

  // Add new columns to projects table (safe: check existence first)
  const projectCols = db.prepare(`PRAGMA table_info(projects)`).all() as DbRow[];
  if (!projectCols.some((c: DbRow) => c.name === 'project_type')) {
    db.exec(`ALTER TABLE projects ADD COLUMN project_type TEXT`);
  }
  if (!projectCols.some((c: DbRow) => c.name === 'tech_stack')) {
    db.exec(`ALTER TABLE projects ADD COLUMN tech_stack TEXT`);
  }
  if (!projectCols.some((c: DbRow) => c.name === 'vite_port')) {
    db.exec(`ALTER TABLE projects ADD COLUMN vite_port INTEGER`);
  }
}

// ---------- file_edit_history CRUD ----------

export interface FileEditHistoryInsert {
  projectId: string;
  conversationId?: string;
  messageId?: string;
  filePath: string;
  action: 'edit' | 'create' | 'delete';
  diffJson?: string;
  contentHash: string;
}

export function insertFileEditHistory(db: SqliteDb, input: FileEditHistoryInsert): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO file_edit_history
       (id, project_id, conversation_id, message_id, file_path, action, diff_json, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.projectId,
    input.conversationId ?? null,
    input.messageId ?? null,
    input.filePath,
    input.action,
    input.diffJson ?? null,
    input.contentHash,
  );
  return id;
}

export function listFileEditHistory(
  db: SqliteDb,
  projectId: string,
  opts?: { filePath?: string; limit?: number },
): DbRow[] {
  const limit = typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : 100;
  if (opts?.filePath) {
    return db.prepare(
      `SELECT id, project_id AS projectId, conversation_id AS conversationId,
              message_id AS messageId, file_path AS filePath, action,
              diff_json AS diffJson, content_hash AS contentHash, created_at AS createdAt
         FROM file_edit_history
        WHERE project_id = ? AND file_path = ?
        ORDER BY created_at DESC
        LIMIT ?`,
    ).all(projectId, opts.filePath, limit) as DbRow[];
  }
  return db.prepare(
    `SELECT id, project_id AS projectId, conversation_id AS conversationId,
            message_id AS messageId, file_path AS filePath, action,
            diff_json AS diffJson, content_hash AS contentHash, created_at AS createdAt
       FROM file_edit_history
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
  ).all(projectId, limit) as DbRow[];
}

// ---------- project type / tech_stack / vite_port ----------

export function updateProjectType(
  db: SqliteDb,
  projectId: string,
  projectType: string,
): void {
  db.prepare(
    `UPDATE projects SET project_type = ?, updated_at = ? WHERE id = ?`,
  ).run(projectType, Date.now(), projectId);
}

export function updateProjectTechStack(
  db: SqliteDb,
  projectId: string,
  techStack: string,
): void {
  db.prepare(
    `UPDATE projects SET tech_stack = ?, updated_at = ? WHERE id = ?`,
  ).run(techStack, Date.now(), projectId);
}

export function updateProjectVitePort(
  db: SqliteDb,
  projectId: string,
  vitePort: number,
): void {
  db.prepare(
    `UPDATE projects SET vite_port = ?, updated_at = ? WHERE id = ?`,
  ).run(vitePort, Date.now(), projectId);
}

/**
 * Apply the Next.js mode migration (009) to the database.
 *
 * Adds:
 * - dev_port column (unified dev server port)
 * - dev_server_type column (vite, nextjs, or custom)
 * - project_type column (granular project type detection)
 * - prisma_migrations_log table (tracks Prisma schema changes for Next.js projects)
 * - Backfills existing Vite projects with dev_server_type and dev_port
 */
export function migrateNextjsMode(db: SqliteDb): void {
  // Add new columns to projects table (safe: check existence first)
  const projectCols = db.prepare(`PRAGMA table_info(projects)`).all() as DbRow[];

  if (!projectCols.some((c: DbRow) => c.name === 'dev_port')) {
    db.exec(`ALTER TABLE projects ADD COLUMN dev_port INTEGER`);
  }
  if (!projectCols.some((c: DbRow) => c.name === 'dev_server_type')) {
    db.exec(`ALTER TABLE projects ADD COLUMN dev_server_type TEXT CHECK(dev_server_type IN ('vite', 'nextjs', 'custom')) DEFAULT 'vite'`);
  }
  if (!projectCols.some((c: DbRow) => c.name === 'project_type')) {
    // project_type may already exist from migration 007 (file-edit-history)
    // Only add if it doesn't exist
    db.exec(`ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT NULL`);
  }

  // Create index on project_type
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type)`);

  // Create prisma_migrations_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS prisma_migrations_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id      TEXT    NOT NULL,
      schema_before   TEXT,
      schema_after    TEXT,
      migration_sql   TEXT,
      status          TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending', 'validated', 'applied', 'failed')),
      error_message   TEXT,
      duration_ms     INTEGER,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prisma_migrations_log_project
      ON prisma_migrations_log(project_id, created_at DESC);
  `);

  // Backfill: Set dev_server_type and dev_port for existing Vite projects
  db.exec(`
    UPDATE projects SET
      dev_server_type = 'vite',
      dev_port = vite_port
    WHERE vite_port IS NOT NULL AND dev_port IS NULL;
  `);
}
