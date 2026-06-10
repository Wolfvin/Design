import path from 'node:path';

/**
 * Result of validating a file path for a file-edit write operation.
 */
export interface PathValidationResult {
  valid: boolean;
  reason?: string;
  resolvedPath?: string;  // fully resolved absolute path
  relativePath?: string;  // sanitized relative path
}

/**
 * Extensions that are allowed for file-edit writes.
 * Covers source code, config, and documentation file types.
 */
const ALLOWED_EXTENSIONS = new Set([
  '.tsx', '.ts', '.jsx', '.js',
  '.css', '.scss',
  '.html',
  '.json',
  '.md',
  '.yaml', '.yml',
  '.toml',
  '.rs',
]);

/**
 * Binary extensions that are explicitly blocked from file-edit writes.
 */
const BLOCKED_BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.wasm',
]);

/**
 * Directory names that are off-limits for file-edit writes.
 */
const BLOCKED_DIR_SEGMENTS = new Set([
  '.git',
  'node_modules',
]);

/**
 * Validate a file path from a `<file-edit>` block before writing it to a
 * project directory. Enforces path-safety rules (no traversal, must resolve
 * within the project base, no blocked directories, allowed extensions only).
 */
export function validateFilePath(
  editPath: string,
  projectBaseDir: string,
): PathValidationResult {
  if (typeof editPath !== 'string' || editPath.length === 0) {
    return { valid: false, reason: 'path must be a non-empty string' };
  }

  // Must be relative — no leading slash, no drive letter (Windows)
  if (editPath.startsWith('/')) {
    return { valid: false, reason: 'path must be relative (no leading /)' };
  }
  if (/^[A-Za-z]:/.test(editPath)) {
    return { valid: false, reason: 'path must be relative (no drive letter)' };
  }

  // No path traversal
  const normalized = path.normalize(editPath);
  if (normalized.startsWith('..') || editPath.includes('..')) {
    return { valid: false, reason: 'path must not contain .. traversal' };
  }

  // Must resolve within project base directory
  const resolvedPath = path.resolve(projectBaseDir, normalized);
  const relativeToBase = path.relative(projectBaseDir, resolvedPath);
  if (
    relativeToBase.startsWith('..') ||
    path.isAbsolute(relativeToBase) ||
    relativeToBase === ''
  ) {
    return { valid: false, reason: 'path must resolve within the project directory' };
  }

  // No writing to blocked directories (.git/, node_modules/)
  const segments = normalized.split(/[/\\]/);
  for (const segment of segments) {
    if (BLOCKED_DIR_SEGMENTS.has(segment)) {
      return { valid: false, reason: `path must not write inside ${segment}/` };
    }
  }

  // No .env files
  const basename = path.basename(normalized);
  if (basename === '.env' || basename.startsWith('.env.')) {
    return { valid: false, reason: 'path must not write .env files' };
  }

  // Check extension
  const ext = path.extname(normalized).toLowerCase();

  // Block binary extensions
  if (BLOCKED_BINARY_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `binary extension ${ext} is not allowed` };
  }

  // Must have an allowed extension
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `extension ${ext} is not in the allowed list` };
  }

  // No extension is allowed (e.g. Makefile, Dockerfile, .gitignore)
  // — but .env is still blocked above.

  return {
    valid: true,
    resolvedPath,
    relativePath: normalized,
  };
}
