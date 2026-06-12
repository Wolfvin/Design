/**
 * Hash computation for smart update and rollback
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * Compute SHA-256 hash of a string, return first 7 hex chars
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 7);
}

/**
 * Compute hash of all source DS files (for repoHash in manifest)
 */
export async function hashDesignSystemSource(dsDir: string, manifest: { files?: Record<string, string> }): Promise<string> {
  const contents: string[] = [];

  const filePaths = manifest.files || {};
  const orderedKeys = Object.keys(filePaths).sort();

  for (const key of orderedKeys) {
    const relativePath = filePaths[key];
    const fullPath = join(dsDir, relativePath);
    try {
      const content = await readFile(fullPath, 'utf-8');
      contents.push(content.trim());
    } catch {
      // File doesn't exist, skip
    }
  }

  const combined = contents.join('\0');
  return hashContent(combined);
}

/**
 * Compute hash of the entire design/ directory (for rollback)
 * Excludes manifest.json, contract.json, execution-plan.json
 */
export async function hashDesignDirectory(designDir: string): Promise<string> {
  const excludeFiles = new Set(['manifest.json', 'contract.json', 'execution-plan.json']);
  const filePaths: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && !excludeFiles.has(entry.name)) {
        filePaths.push(fullPath);
      }
    }
  }

  try {
    await walk(designDir);
  } catch {
    return '0000000'; // Directory doesn't exist
  }

  filePaths.sort();

  const contents: string[] = [];
  for (const fp of filePaths) {
    const rel = relative(designDir, fp);
    try {
      const content = await readFile(fp, 'utf-8');
      contents.push(`${rel}\0${content.trim()}`);
    } catch {
      // Skip unreadable files
    }
  }

  return hashContent(contents.join('\0'));
}
