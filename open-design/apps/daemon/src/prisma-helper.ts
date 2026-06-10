/**
 * Prisma Schema Helper.
 *
 * Validates, generates, and applies Prisma schema changes for
 * Next.js projects. This module is only active when the project
 * type is `nextjs-standalone` or `nextjs-pages`.
 *
 * Flow:
 *   1. AI edits `prisma/schema.prisma` via `<file-edit>` block
 *   2. Before writing: `validateSchema()` checks syntax
 *   3. After writing: `generateClient()` updates TypeScript types
 *   4. Optionally: `pushToDatabase()` applies changes to DB
 *   5. All actions are logged to `prisma_migrations_log` table
 */

import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrismaValidationResult {
  valid: boolean;
  errors: PrismaError[];
  warnings: PrismaWarning[];
}

export interface PrismaError {
  line?: number;
  column?: number;
  message: string;
}

export interface PrismaWarning {
  message: string;
}

export interface PrismaGenerateResult {
  success: boolean;
  output: string;
  durationMs: number;
}

export interface PrismaPushResult {
  success: boolean;
  output: string;
  warnings: string[];
  durationMs: number;
}

export interface PrismaMigrateResult {
  success: boolean;
  output: string;
  migrationName?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// PrismaSchemaHelper class
// ---------------------------------------------------------------------------

export class PrismaSchemaHelper {
  private readonly projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  /**
   * Validate Prisma schema syntax without running generate.
   * Called BEFORE file is written to disk to catch syntax errors.
   */
  async validateSchema(schemaContent: string): Promise<PrismaValidationResult> {
    // 1. Write schema to a temporary file
    const tmpPath = path.join(os.tmpdir(), `prisma-validate-${Date.now()}.prisma`);
    try {
      await writeFile(tmpPath, schemaContent, 'utf-8');

      // 2. Run prisma validate
      const { stdout, stderr } = await execAsync(
        'npx',
        ['prisma', 'validate', `--schema=${tmpPath}`],
        {
          cwd: this.projectDir,
          timeout: 15000,
        },
      );

      return {
        valid: true,
        errors: [],
        warnings: parsePrismaWarnings(stderr || stdout),
      };
    } catch (error: any) {
      const stderr = error.stderr || error.message || '';
      return {
        valid: false,
        errors: parsePrismaErrors(stderr),
        warnings: [],
      };
    } finally {
      // 3. Clean up temp file
      await unlink(tmpPath).catch(() => {});
    }
  }

  /**
   * After schema is written to disk, generate Prisma Client.
   * This updates the TypeScript types in node_modules/.prisma/client.
   */
  async generateClient(): Promise<PrismaGenerateResult> {
    const start = Date.now();
    try {
      const { stdout, stderr } = await execAsync(
        'npx',
        ['prisma', 'generate'],
        {
          cwd: this.projectDir,
          timeout: 30000,
        },
      );

      return {
        success: true,
        output: stdout || stderr || 'Prisma Client generated successfully',
        durationMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stderr || error.message || 'Prisma generate failed',
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Push schema changes to the database (development mode).
   * Uses `prisma db push` which applies changes without creating migration files.
   * Only runs if user confirms via UI.
   */
  async pushToDatabase(): Promise<PrismaPushResult> {
    const start = Date.now();
    try {
      const { stdout, stderr } = await execAsync(
        'npx',
        ['prisma', 'db', 'push', '--accept-data-loss'],
        {
          cwd: this.projectDir,
          timeout: 60000,
        },
      );

      return {
        success: true,
        output: stdout || stderr || 'Database schema pushed successfully',
        warnings: parsePrismaWarnings(stderr || stdout).map(w => w.message),
        durationMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stderr || error.message || 'Prisma db push failed',
        warnings: [],
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Create a named migration (production-safe approach).
   * Uses `prisma migrate dev --name <name>`.
   */
  async createMigration(name: string): Promise<PrismaMigrateResult> {
    const start = Date.now();
    try {
      const { stdout, stderr } = await execAsync(
        'npx',
        ['prisma', 'migrate', 'dev', '--name', name],
        {
          cwd: this.projectDir,
          timeout: 120000,
        },
      );

      return {
        success: true,
        output: stdout || stderr || 'Migration created successfully',
        migrationName: name,
        durationMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stderr || error.message || 'Migration failed',
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Check whether the project has a Prisma schema file.
   */
  async hasPrismaSchema(): Promise<boolean> {
    const schemaPath = path.join(this.projectDir, 'prisma', 'schema.prisma');
    try {
      const s = await stat(schemaPath);
      return s.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Read the current Prisma schema content.
   */
  async readSchema(): Promise<string | null> {
    const schemaPath = path.join(this.projectDir, 'prisma', 'schema.prisma');
    try {
      return await readFile(schemaPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Backup the Prisma schema before editing.
   */
  async backupSchema(): Promise<string | null> {
    const schemaPath = path.join(this.projectDir, 'prisma', 'schema.prisma');
    const backupPath = schemaPath + '.bak';
    try {
      const s = await stat(schemaPath);
      if (s.isFile()) {
        await copyFile(schemaPath, backupPath);
        return backupPath;
      }
    } catch {
      // File doesn't exist
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse Prisma error messages from stderr.
 */
function parsePrismaErrors(stderr: string): PrismaError[] {
  const errors: PrismaError[] = [];

  // Prisma validation errors typically look like:
  // Error: The model "User" does not have an id field.
  // or:
  // error: Error validating: The argument "provider" is required...
  const lines = stderr.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('Error:') || trimmed.startsWith('error:')) {
      const message = trimmed.replace(/^(Error|error):\s*/, '');
      errors.push({ message });
    }
  }

  // If no structured errors found, treat the whole stderr as one error
  if (errors.length === 0 && stderr.trim()) {
    errors.push({ message: stderr.trim() });
  }

  return errors;
}

/**
 * Parse Prisma warning messages from output.
 */
function parsePrismaWarnings(output: string): PrismaWarning[] {
  const warnings: PrismaWarning[] = [];

  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('Warn:') || trimmed.startsWith('warn:')) {
      const message = trimmed.replace(/^(Warn|warn):\s*/, '');
      warnings.push({ message });
    }
  }

  return warnings;
}
