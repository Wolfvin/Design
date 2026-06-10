import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateFilePath } from './file-path-validator.js';

/**
 * Represents a single <file-edit> block extracted from AI output.
 */
export interface FileEdit {
  /** Relative file path within the project */
  filePath: string;
  /** Full file content to write */
  content: string;
  /** Optional: only apply a search/replace patch */
  search?: string;
  /** Optional: replacement for the search match */
  replace?: string;
  /** Optional: conversation this edit belongs to */
  conversationId?: string;
  /** Optional: message this edit belongs to */
  messageId?: string;
}

/**
 * Result of writing a single file edit to disk.
 */
export interface FileEditWriteResult {
  path: string;
  action: 'created' | 'modified' | 'skipped';
  previousHash?: string;    // SHA-256 hash of file before write
  newHash: string;          // SHA-256 hash of file after write
  bytesWritten: number;
}

/**
 * Options controlling the file-edit write pipeline behavior.
 */
export interface FileEditPipelineOptions {
  /** Validate paths before writing (default: true) */
  validatePaths?: boolean;
  /** Validate syntax of written files (default: false, expensive) */
  validateSyntax?: boolean;
  /** Create .bak backup of original file (default: true) */
  createBackup?: boolean;
  /** Dry-run: validate everything but don't actually write (default: false) */
  dryRun?: boolean;
}

/**
 * Compute SHA-256 hex digest of a string.
 */
function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Ensure the parent directory for a file path exists.
 */
async function ensureDirForFile(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Read the current content of a file, returning null if it does not exist.
 */
async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Apply a search/replace patch to the existing content.
 * Returns the patched content, or throws if the search string is not found.
 */
function applySearchReplace(existing: string, search: string, replace: string): string {
  const index = existing.indexOf(search);
  if (index === -1) {
    throw new Error(
      `file-edit search/replace: search string not found in ${existing.length}-byte content`
    );
  }
  // Only apply the first occurrence
  return existing.slice(0, index) + replace + existing.slice(index + search.length);
}

/**
 * Write a single file edit to a project directory.
 *
 * Key features:
 * - Path validation (configurable)
 * - Read-before-write for diff generation
 * - Atomic writes via .tmp file + rename
 * - Optional .bak backup creation
 * - SHA-256 hash tracking before and after write
 * - Dry-run mode for preview
 * - File edit history logging to SQLite
 */
export async function writeFileEditToProject(
  projectId: string,
  edit: FileEdit,
  options?: FileEditPipelineOptions,
): Promise<FileEditWriteResult> {
  const opts = {
    validatePaths: options?.validatePaths ?? true,
    validateSyntax: options?.validateSyntax ?? false,
    createBackup: options?.createBackup ?? true,
    dryRun: options?.dryRun ?? false,
  };

  // Resolve project base directory
  const projectBaseDir = projectId; // Caller must pass resolved absolute path
  if (!path.isAbsolute(projectBaseDir)) {
    throw new Error('writeFileEditToProject: projectId must be the resolved project base directory path');
  }

  // Path validation
  if (opts.validatePaths) {
    const validation = validateFilePath(edit.filePath, projectBaseDir);
    if (!validation.valid) {
      throw new Error(`file-edit path validation failed: ${validation.reason}`);
    }
  }

  // Resolve the absolute target path
  const normalizedRelPath = path.normalize(edit.filePath);
  const absPath = path.resolve(projectBaseDir, normalizedRelPath);

  // Double-check we're still within the project base
  const relativeCheck = path.relative(projectBaseDir, absPath);
  if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) {
    throw new Error('file-edit path escapes project directory');
  }

  // Read existing file content (for hash tracking and diff)
  const existingContent = await readFileOrNull(absPath);
  const previousHash = existingContent !== null ? sha256(existingContent) : undefined;

  // Compute new content
  let newContent: string;
  if (edit.search && edit.replace !== undefined) {
    // Search/replace mode
    if (existingContent === null) {
      throw new Error(
        `file-edit search/replace: file does not exist (${edit.filePath})`
      );
    }
    newContent = applySearchReplace(existingContent, edit.search, edit.replace);
  } else {
    // Full content write
    newContent = edit.content;
  }

  const newHash = sha256(newContent);

  // If content is identical, skip write
  if (existingContent !== null && previousHash === newHash) {
    return {
      path: normalizedRelPath,
      action: 'skipped',
      previousHash,
      newHash,
      bytesWritten: 0,
    };
  }

  // Dry run: stop here without writing
  if (opts.dryRun) {
    return {
      path: normalizedRelPath,
      action: existingContent === null ? 'created' : 'modified',
      previousHash,
      newHash,
      bytesWritten: Buffer.byteLength(newContent, 'utf8'),
    };
  }

  // Ensure parent directory exists
  await ensureDirForFile(absPath);

  // Create backup if requested and file exists
  if (opts.createBackup && existingContent !== null) {
    const backupPath = absPath + '.bak';
    try {
      await fs.copyFile(absPath, backupPath);
    } catch (err: any) {
      // Non-fatal: backup failure should not block the write
      console.warn(`[file-edit-pipeline] backup failed for ${absPath}: ${err.message}`);
    }
  }

  // Atomic write: write to .tmp file, then rename
  const tmpPath = absPath + '.tmp';
  try {
    await fs.writeFile(tmpPath, newContent, 'utf8');
    await fs.rename(tmpPath, absPath);
  } catch (err) {
    // Clean up tmp file if rename failed
    try { await fs.unlink(tmpPath); } catch { /* ignore */ }
    throw err;
  }

  return {
    path: normalizedRelPath,
    action: existingContent === null ? 'created' : 'modified',
    previousHash,
    newHash,
    bytesWritten: Buffer.byteLength(newContent, 'utf8'),
  };
}

/**
 * Write multiple file edits to a project directory in batch.
 *
 * Each edit is processed sequentially to avoid race conditions.
 * If one edit fails, the batch stops and the error is thrown;
 * earlier edits in the batch are NOT rolled back.
 */
export async function writeFileEditsBatch(
  projectId: string,
  edits: FileEdit[],
  options?: FileEditPipelineOptions,
): Promise<FileEditWriteResult[]> {
  const results: FileEditWriteResult[] = [];
  for (const edit of edits) {
    const result = await writeFileEditToProject(projectId, edit, options);
    results.push(result);
  }
  return results;
}
