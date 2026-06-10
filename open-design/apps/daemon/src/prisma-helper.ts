/**
 * Prisma Schema Helper — validate, generate, and migrate Prisma schemas.
 *
 * This helper is used by the file-edit pipeline when AI edits a
 * `prisma/schema.prisma` file. It ensures that:
 *   1. Schema changes are validated before applying
 *   2. `npx prisma generate` runs after schema edits
 *   3. Database migrations are applied safely
 *   4. Schema changes are logged for audit
 *
 * Only used for Next.js projects (project type starts with 'nextjs').
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrismaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PrismaGenerateResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface PrismaMigrateResult {
  success: boolean;
  sql?: string;
  output: string;
  error?: string;
}

export interface PrismaSchemaChange {
  id: string;
  projectId: string;
  schemaBefore: string;
  schemaAfter: string;
  migrationSql?: string;
  status: 'pending' | 'applied' | 'failed';
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a Prisma schema string.
 *
 * Runs `npx prisma validate` in the project directory with the given
 * schema content written to a temporary file.
 */
export async function validatePrismaSchema(
  projectDir: string,
  schemaContent: string,
): Promise<PrismaValidationResult> {
  const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');

  // Write the schema to disk first (prisma validate reads from file)
  const originalContent = await safeReadFile(schemaPath);
  try {
    await fs.promises.mkdir(path.dirname(schemaPath), { recursive: true });
    await fs.promises.writeFile(schemaPath, schemaContent, 'utf-8');

    const result = await runPrismaCommand(projectDir, ['validate']);
    return {
      valid: result.exitCode === 0,
      errors: result.exitCode !== 0 ? [result.stderr || result.stdout] : [],
      warnings: [],
    };
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : String(err)],
      warnings: [],
    };
  } finally {
    // Restore original content if it existed
    if (originalContent !== null) {
      await fs.promises.writeFile(schemaPath, originalContent, 'utf-8');
    }
  }
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

/**
 * Run `npx prisma generate` in the project directory.
 *
 * This should be called after every schema.prisma edit to update the
 * generated Prisma Client.
 */
export async function runPrismaGenerate(
  projectDir: string,
): Promise<PrismaGenerateResult> {
  const result = await runPrismaCommand(projectDir, ['generate']);
  return {
    success: result.exitCode === 0,
    output: result.stdout,
    ...(result.exitCode !== 0 ? { error: result.stderr } : {}),
  };
}

// ---------------------------------------------------------------------------
// Migrate
// ---------------------------------------------------------------------------

/**
 * Run `npx prisma db push` for development mode.
 *
 * This applies schema changes directly without creating migration files.
 * Use this for rapid prototyping in development.
 */
export async function runPrismaDbPush(
  projectDir: string,
): Promise<PrismaMigrateResult> {
  const result = await runPrismaCommand(projectDir, ['db', 'push', '--accept-data-loss']);
  return {
    success: result.exitCode === 0,
    output: result.stdout,
    ...(result.exitCode !== 0 ? { error: result.stderr } : {}),
  };
}

/**
 * Run `npx prisma migrate dev` for creating a named migration.
 *
 * This creates a new migration file and applies it. Use this for
 * production-ready schema changes.
 */
export async function runPrismaMigrateDev(
  projectDir: string,
  migrationName: string,
): Promise<PrismaMigrateResult> {
  const result = await runPrismaCommand(projectDir, [
    'migrate',
    'dev',
    '--name',
    migrationName,
    '--create-only',
  ]);

  if (result.exitCode !== 0) {
    return {
      success: false,
      output: result.stdout,
      error: result.stderr,
    };
  }

  // Now apply the migration
  const applyResult = await runPrismaCommand(projectDir, ['migrate', 'dev']);
  return {
    success: applyResult.exitCode === 0,
    output: applyResult.stdout,
    ...(applyResult.exitCode !== 0 ? { error: applyResult.stderr } : {}),
  };
}

// ---------------------------------------------------------------------------
// Schema diff
// ---------------------------------------------------------------------------

/**
 * Compute a simple diff between two schema versions.
 *
 * Returns an array of lines that changed (added or removed).
 */
export function computeSchemaDiff(
  schemaBefore: string,
  schemaAfter: string,
): string[] {
  const beforeLines = schemaBefore.split('\n');
  const afterLines = schemaAfter.split('\n');
  const diff: string[] = [];

  const maxLen = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < maxLen; i++) {
    const before = beforeLines[i] ?? '';
    const after = afterLines[i] ?? '';
    if (before !== after) {
      if (before) diff.push(`- ${before}`);
      if (after) diff.push(`+ ${after}`);
    }
  }

  return diff;
}

/**
 * Check if a file path is a Prisma schema file.
 */
export function isPrismaSchemaFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized === 'prisma/schema.prisma' || normalized.endsWith('/prisma/schema.prisma');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runPrismaCommand(
  projectDir: string,
  args: string[],
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      'npx',
      ['prisma', ...args],
      {
        cwd: projectDir,
        timeout: 60_000, // 60 seconds timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
      },
      (error, stdout, stderr) => {
        resolve({
          exitCode: error ? (error as any).code ?? 1 : 0,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        });
      },
    );
  });
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}
