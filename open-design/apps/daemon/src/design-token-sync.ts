// Design Token Sync service.
//
// Syncs the active design system for a project (read from DESIGN.md via the
// token contract pipeline) into the project's source tree as two CSS files:
//
//   src/styles/tokens.css          — the OD TOKEN_SCHEMA contract (:root block)
//   src/styles/tailwind-theme.css  — Tailwind v4 @theme mapping that imports tokens.css
//
// These files can be imported by React components, giving the new app-dev
// model the same token fidelity that the old artifact-paste model had, but
// persisted to source files that survive HMR and agent edits.
//
// The sync is hash-gated: if the SHA-256 of the tokens.css content matches
// the last-synced hash, the write is skipped to prevent unnecessary HMR
// reloads. Backups (.bak) are created only when the on-disk file differs
// from the new content.

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type Database from 'better-sqlite3';
import chokidar, { type FSWatcher } from 'chokidar';

import {
  TOKEN_SCHEMA,
} from '@open-design/contracts/design-systems/token-schema';
import {
  renderTailwindV4Css,
} from '@open-design/contracts/design-systems/derived-token-outputs';

import {
  buildDesignTokenContract,
  type DesignTokenContract,
  type SourceDesignToken,
} from './design-token-contract.js';
import { parseFrontmatter, type FrontmatterObject } from './frontmatter.js';
import {
  resolveDesignSystemAssets,
} from './design-systems.js';
import { getProject } from './db.js';
import { isSafeId, resolveProjectDir } from './projects.js';

// ─── Public types ──────────────────────────────────────────────────────

export interface TokenSyncResult {
  /** Relative path within the project directory, e.g. "src/styles/tokens.css". */
  tokensPath: string;
  /** Relative path within the project directory, e.g. "src/styles/tailwind-theme.css". */
  tailwindPath: string;
  /** SHA-256 hex digest of the tokens.css content for change detection. */
  tokensHash: string;
  /** True if at least one file was actually written (content changed). */
  wasUpdated: boolean;
  /** True if .bak files were created before overwriting. */
  backupCreated: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────

const TOKENS_REL = 'src/styles/tokens.css';
const TAILWIND_REL = 'src/styles/tailwind-theme.css';

// ─── Database migration ────────────────────────────────────────────────

export function migrateDesignTokenSyncLog(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS design_token_sync_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    TEXT    NOT NULL,
      design_system_id TEXT NOT NULL,
      tokens_hash   TEXT    NOT NULL,
      was_updated   INTEGER NOT NULL DEFAULT 0,
      backup_created INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_design_token_sync_log_project
      ON design_token_sync_log(project_id, created_at DESC);
  `);
}

// ─── Core sync function ────────────────────────────────────────────────

export async function syncDesignTokensToProject(
  projectId: string,
  projectsRoot: string,
  options: {
    db: Database.Database;
    designSystemsDir: string;
    userDesignSystemsDir: string;
  },
): Promise<TokenSyncResult> {
  const { db, designSystemsDir, userDesignSystemsDir } = options;

  // 1. Validate project ID and read project metadata.
  if (!isSafeId(projectId)) {
    throw new Error(`Invalid project id: ${projectId}`);
  }
  const project = getProject(db, projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const designSystemId = project.designSystemId;
  if (!designSystemId) {
    throw new Error(`Project ${projectId} has no active design system`);
  }

  // 2. Resolve project directory (handles both managed and folder-imported projects).
  const metadata = project.metadata ?? undefined;
  const projectDir = resolveProjectDir(projectsRoot, projectId, metadata);

  // 3. Read the design system assets (tokens.css, DESIGN.md body).
  const assets = await resolveDesignSystemAssets(
    designSystemId,
    designSystemsDir,
    userDesignSystemsDir,
  );

  // 4. Build the token contract if tokens.css is not already available.
  let tokensCss: string;
  if (assets.tokensCss) {
    tokensCss = assets.tokensCss;
  } else {
    // Derive tokens from the DESIGN.md body using the existing contract algorithm.
    const designMdRaw = await readDesignMdForSystem(
      designSystemsDir,
      userDesignSystemsDir,
      designSystemId,
    );
    if (!designMdRaw) {
      throw new Error(
        `Cannot read DESIGN.md for design system ${designSystemId}`,
      );
    }
    tokensCss = deriveTokensCssFromDesignMd(designMdRaw);
  }

  // 5. Render the tailwind-theme.css.
  const declared = new Set(
    TOKEN_SCHEMA.map((spec) => spec.name),
  );
  const bindingsForTailwind = Array.from(declared).map((name) => ({
    name,
    layer: '',
    value: '',
    confidence: '',
    reason: '',
    sources: [] as string[],
  }));
  const tailwindCss = renderTailwindV4Css(bindingsForTailwind);

  // 6. Compute SHA-256 hash for change detection.
  const tokensHash = sha256Hex(tokensCss);

  // 7. Check if the hash matches the last sync (skip write if unchanged).
  const lastHash = getLastSyncHash(db, projectId);
  if (lastHash === tokensHash) {
    return {
      tokensPath: TOKENS_REL,
      tailwindPath: TAILWIND_REL,
      tokensHash,
      wasUpdated: false,
      backupCreated: false,
    };
  }

  // 8. Backup existing files if they differ from new content.
  let backupCreated = false;
  const tokensAbs = path.join(projectDir, TOKENS_REL);
  const tailwindAbs = path.join(projectDir, TAILWIND_REL);

  backupCreated = await backupIfDifferent(tokensAbs, tokensCss);
  backupCreated = (await backupIfDifferent(tailwindAbs, tailwindCss)) || backupCreated;

  // 9. Ensure directories exist and write the files.
  await mkdir(path.dirname(tokensAbs), { recursive: true });
  await mkdir(path.dirname(tailwindAbs), { recursive: true });
  await writeFile(tokensAbs, tokensCss, 'utf8');
  await writeFile(tailwindAbs, tailwindCss, 'utf8');

  // 10. Log the sync to the database.
  const now = Date.now();
  db.prepare(
    `INSERT INTO design_token_sync_log
       (project_id, design_system_id, tokens_hash, was_updated, backup_created, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(projectId, designSystemId, tokensHash, 1, backupCreated ? 1 : 0, now);

  return {
    tokensPath: TOKENS_REL,
    tailwindPath: TAILWIND_REL,
    tokensHash,
    wasUpdated: true,
    backupCreated,
  };
}

// ─── Watcher ───────────────────────────────────────────────────────────

/**
 * Start a chokidar watcher that monitors changes to design system files
 * (DESIGN.md, tokens.css, tailwind-v4.css) and triggers sync for any
 * project that uses the changed design system.
 *
 * The watcher is long-lived; callers should keep a reference and call
 * `close()` on the returned handle when done.
 */
export function startDesignTokenWatcher(
  projectsRoot: string,
  onChange: (projectId: string, result: TokenSyncResult) => void,
  options: {
    db: Database.Database;
    designSystemsDir: string;
    userDesignSystemsDir: string;
  },
): { close: () => Promise<void> } {
  const { db, designSystemsDir, userDesignSystemsDir } = options;

  const watchedDirs = [designSystemsDir, userDesignSystemsDir].filter(Boolean);
  if (watchedDirs.length === 0) {
    return { close: async () => {} };
  }

  // Map from design-system directory names to project IDs that use them.
  // Refreshed on every change event so new projects are picked up.
  function projectIdsForDesignSystem(designSystemId: string): string[] {
    const rows = db
      .prepare(
        `SELECT id FROM projects WHERE design_system_id = ?`,
      )
      .all(designSystemId) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  function designSystemIdFromPath(filePath: string): string | null {
    // Extract the design system directory name from the changed file path.
    // Design system files live under <root>/<design-system-id>/DESIGN.md (or tokens.css, etc.)
    for (const root of watchedDirs) {
      const rel = path.relative(root, filePath);
      if (!rel || rel.startsWith('..')) continue;
      const segments = rel.split(/[\\/]/);
      if (segments.length < 2) continue;
      const dirName = segments[0];
      if (!dirName || dirName.startsWith('.')) continue;
      // Built-in design systems use the directory name as id;
      // user-installed ones use "user:" prefix.
      if (root === userDesignSystemsDir) {
        return `user:${dirName}`;
      }
      return dirName;
    }
    return null;
  }

  let watcher: FSWatcher | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;
  const pendingChanges = new Set<string>(); // design system ids

  function scheduleSync(designSystemId: string): void {
    pendingChanges.add(designSystemId);
    if (debounceTimer !== null) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const ids = new Set(pendingChanges);
      pendingChanges.clear();
      for (const dsId of ids) {
        const projectIds = projectIdsForDesignSystem(dsId);
        for (const pid of projectIds) {
          syncDesignTokensToProject(pid, projectsRoot, options)
            .then((result) => {
              onChange(pid, result);
            })
            .catch((err) => {
              if (process.env.NODE_ENV === 'development') {
                console.warn(
                  `[design-token-sync] watcher sync failed for project ${pid}:`,
                  err,
                );
              }
            });
        }
      }
    }, 500);
  }

  // Watch for changes to DESIGN.md, tokens.css, and tailwind-v4.css files.
  watcher = chokidar.watch(watchedDirs, {
    ignoreInitial: true,
    persistent: true,
    followSymlinks: false,
    ignored: (filePath: string) => {
      const basename = path.basename(filePath);
      // Only watch files relevant to design tokens.
      return !(
        basename === 'DESIGN.md' ||
        basename === 'tokens.css' ||
        basename === 'tailwind-v4.css' ||
        basename === 'manifest.json'
      );
    },
  });

  watcher.on('change', (filePath: string) => {
    const dsId = designSystemIdFromPath(filePath);
    if (dsId) scheduleSync(dsId);
  });

  watcher.on('add', (filePath: string) => {
    const dsId = designSystemIdFromPath(filePath);
    if (dsId) scheduleSync(dsId);
  });

  watcher.on('error', (err: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[design-token-sync] watcher error:', err);
    }
  });

  return {
    close: async () => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (watcher) {
        await watcher.close();
        watcher = null;
      }
    },
  };
}

// ─── API route handler ─────────────────────────────────────────────────

/**
 * Express route handler for `POST /api/projects/:id/sync-tokens`.
 *
 * Usage (inside the daemon's route registration):
 *
 *   app.post('/api/projects/:id/sync-tokens', handleSyncTokensRoute(ctx));
 */
export function handleSyncTokensRoute(ctx: {
  db: Database.Database;
  http: { sendApiError: (res: any, status: number, code: string, message: string) => void };
  paths: { PROJECTS_DIR: string; DESIGN_SYSTEMS_DIR: string; USER_DESIGN_SYSTEMS_DIR: string };
}) {
  return async (req: { params: { id: string } }, res: any) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      ctx.http.sendApiError(res, 400, 'BAD_REQUEST', 'Invalid project id');
      return;
    }

    try {
      const result = await syncDesignTokensToProject(projectId, ctx.paths.PROJECTS_DIR, {
        db: ctx.db,
        designSystemsDir: ctx.paths.DESIGN_SYSTEMS_DIR,
        userDesignSystemsDir: ctx.paths.USER_DESIGN_SYSTEMS_DIR,
      });

      res.json({
        ok: true,
        tokensPath: result.tokensPath,
        tailwindPath: result.tailwindPath,
        tokensHash: result.tokensHash,
        wasUpdated: result.wasUpdated,
        backupCreated: result.backupCreated,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      ctx.http.sendApiError(res, 500, 'TOKEN_SYNC_ERROR', message);
    }
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────

/**
 * Derive tokens.css from a raw DESIGN.md string using the existing
 * TOKEN_SCHEMA binding algorithm from design-token-contract.ts.
 */
function deriveTokensCssFromDesignMd(designMdRaw: string): string {
  const { data: frontmatter, body } = parseFrontmatter(designMdRaw);

  // Extract source tokens from the DESIGN.md frontmatter and body.
  const sourceTokens = extractSourceTokensFromDesignMd(frontmatter, body);

  // Run the existing contract builder which uses TOKEN_SCHEMA + ROLE_HINTS.
  const contract: DesignTokenContract = buildDesignTokenContract({
    sourceTokens,
    generatedAt: new Date(),
  });

  return contract.tokensCss;
}

/**
 * Parse DESIGN.md frontmatter and body to extract SourceDesignToken entries
 * that the contract builder can bind against TOKEN_SCHEMA.
 *
 * The DESIGN.md frontmatter may contain a `colors` map, `typography` settings,
 * and `spacing` values. The body contains Markdown tables and prose that
 * define color swatches, type scales, and spacing tokens.
 */
function extractSourceTokensFromDesignMd(
  frontmatter: FrontmatterObject,
  body: string,
): SourceDesignToken[] {
  const tokens: SourceDesignToken[] = [];
  const source = 'DESIGN.md';

  // ─── Frontmatter colors ────────────────────────────────────────────
  const colors = frontmatter['colors'];
  if (colors && typeof colors === 'object' && !Array.isArray(colors)) {
    for (const [name, value] of Object.entries(colors as Record<string, unknown>)) {
      if (typeof value !== 'string') continue;
      const cssName = name.startsWith('--') ? name : `--${name.replace(/\s+/g, '-').toLowerCase()}`;
      tokens.push({
        name: cssName,
        value: value.trim(),
        source,
        line: 1,
      });
    }
  }

  // ─── Frontmatter typography ────────────────────────────────────────
  const typography = frontmatter['typography'];
  if (typography && typeof typography === 'object' && !Array.isArray(typography)) {
    for (const [name, value] of Object.entries(typography as Record<string, unknown>)) {
      if (typeof value !== 'string') continue;
      const cssName = name.startsWith('--') ? name : `--${name.replace(/\s+/g, '-').toLowerCase()}`;
      tokens.push({
        name: cssName,
        value: value.trim(),
        source,
        line: 1,
      });
    }
  }

  // ─── Frontmatter spacing ───────────────────────────────────────────
  const spacing = frontmatter['spacing'];
  if (spacing && typeof spacing === 'object' && !Array.isArray(spacing)) {
    for (const [name, value] of Object.entries(spacing as Record<string, unknown>)) {
      if (typeof value !== 'string') continue;
      const cssName = name.startsWith('--') ? name : `--${name.replace(/\s+/g, '-').toLowerCase()}`;
      tokens.push({
        name: cssName,
        value: value.trim(),
        source,
        line: 1,
      });
    }
  }

  // ─── Body: CSS custom property declarations ────────────────────────
  // Match patterns like `--bg: #f8fafc` in Markdown code blocks or tables.
  const cssVarRe = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = cssVarRe.exec(body)) !== null) {
    const name = match[1];
    const value = match[2]?.trim();
    if (!name || !value) continue;
    // Avoid duplicating frontmatter-extracted tokens.
    if (tokens.some((t) => t.name === name)) continue;
    const line = lineNumberAt(body, match.index);
    tokens.push({ name, value, source, line });
  }

  // ─── Body: Markdown table hex colors ───────────────────────────────
  // Match `| Name | Value |` style tables with hex color values.
  const hexColorRe = /(?:^|\s)(#[0-9a-fA-F]{3,8})\b/g;
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Only look at table rows that contain a pipe and a hex color.
    if (!line.includes('|')) continue;
    hexColorRe.lastIndex = 0;
    while ((match = hexColorRe.exec(line)) !== null) {
      const value = match[1];
      if (!value) continue;
      // Try to extract the token name from the first column.
      const columns = line.split('|').map((c) => c.trim());
      const nameCandidate = columns[1]; // Usually the label column.
      if (!nameCandidate) continue;
      const cssName = nameCandidate.startsWith('--')
        ? nameCandidate
        : `--${nameCandidate.replace(/\s+/g, '-').toLowerCase()}`;
      if (tokens.some((t) => t.name === cssName)) continue;
      tokens.push({
        name: cssName,
        value,
        source,
        line: i + 1,
      });
    }
  }

  return tokens;
}

function lineNumberAt(text: string, index: number): number {
  let line = 1;
  for (let offset = 0; offset < index && offset < text.length; offset += 1) {
    if (text.charCodeAt(offset) === 10) line += 1;
  }
  return line;
}

/**
 * Read the DESIGN.md file for a given design system, checking both
 * built-in and user-installed roots.
 */
async function readDesignMdForSystem(
  builtInRoot: string,
  userRoot: string,
  designSystemId: string,
): Promise<string | null> {
  // Determine the directory name for the design system.
  const dirId = designSystemId.startsWith('user:')
    ? designSystemId.slice('user:'.length)
    : designSystemId;

  if (!/^[A-Za-z0-9._-]+$/.test(dirId) || dirId === '.' || dirId === '..') {
    return null;
  }

  // Check user-installed first (higher priority), then built-in.
  const roots =
    designSystemId.startsWith('user:')
      ? [userRoot]
      : [builtInRoot, userRoot];

  for (const root of roots) {
    if (!root) continue;
    try {
      const filePath = path.join(root, dirId, 'DESIGN.md');
      const s = await stat(filePath);
      if (s.isFile()) {
        return await readFile(filePath, 'utf8');
      }
    } catch {
      // Continue to next root.
    }
  }

  return null;
}

/**
 * Create a .bak backup of `filePath` if it exists and its content differs
 * from `newContent`. Returns true if a backup was created.
 */
async function backupIfDifferent(
  filePath: string,
  newContent: string,
): Promise<boolean> {
  let existingContent: string | null = null;
  try {
    const s = await stat(filePath);
    if (s.isFile()) {
      existingContent = await readFile(filePath, 'utf8');
    }
  } catch {
    // File does not exist — no backup needed.
    return false;
  }

  if (existingContent === null || existingContent === newContent) {
    return false;
  }

  const bakPath = `${filePath}.bak`;
  await copyFile(filePath, bakPath);
  return true;
}

/**
 * Get the SHA-256 hash from the most recent sync for a project.
 * Returns null if no sync has been recorded.
 */
function getLastSyncHash(db: Database.Database, projectId: string): string | null {
  const row = db
    .prepare(
      `SELECT tokens_hash FROM design_token_sync_log
        WHERE project_id = ?
     ORDER BY created_at DESC
        LIMIT 1`,
    )
    .get(projectId) as { tokens_hash: string } | undefined;
  return row?.tokens_hash ?? null;
}

/** Compute a SHA-256 hex digest of a string. */
function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
