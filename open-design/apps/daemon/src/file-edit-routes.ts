import fs from 'node:fs/promises';
import path from 'node:path';
import type { Express } from 'express';
import type { RouteDeps } from './server-context.js';
import { validateFilePath } from './file-path-validator.js';
import { writeFileEditToProject, writeFileEditsBatch } from './file-edit-pipeline.js';
import type { FileEdit, FileEditPipelineOptions } from './file-edit-pipeline.js';
import {
  insertFileEditHistory,
  listFileEditHistory,
  updateProjectType,
  updateProjectTechStack,
  updateProjectVitePort,
} from './file-edit-persistence.js';
import { isSafeId, projectDir } from './projects.js';

export interface RegisterFileEditRoutesDeps extends RouteDeps<'db' | 'http' | 'paths' | 'projectFiles'> {}

/**
 * Known project type detection signatures.
 */
const PROJECT_TYPE_SIGNATURES: Record<string, string[]> = {
  'nextjs': ['next.config.js', 'next.config.mjs', 'next.config.ts'],
  'vite-react': ['vite.config.ts', 'vite.config.js', 'vite.config.mts'],
  'vite-vanilla': ['index.html', 'vite.config.ts', 'vite.config.js'],
  'react-cra': ['react-app-env.d.ts', 'config-overrides.js'],
  'astro': ['astro.config.mjs', 'astro.config.ts'],
  'sveltekit': ['svelte.config.js', 'svelte.config.ts'],
  'nuxt': ['nuxt.config.ts', 'nuxt.config.js'],
  'remix': ['remix.config.js', 'remix.config.ts'],
  'angular': ['angular.json'],
  'vue-cli': ['vue.config.js', 'vue.config.ts'],
};

/**
 * Tech stack detection based on lock/config files.
 */
function detectTechStack(files: string[]): string[] {
  const stack: string[] = [];
  if (files.some((f) => f === 'package.json')) stack.push('node');
  if (files.some((f) => f === 'Cargo.toml')) stack.push('rust');
  if (files.some((f) => f === 'requirements.txt' || f === 'pyproject.toml')) stack.push('python');
  if (files.some((f) => f === 'go.mod')) stack.push('go');
  if (files.some((f) => f === 'tsconfig.json')) stack.push('typescript');
  if (files.some((f) => f === 'tailwind.config.js' || f === 'tailwind.config.ts')) stack.push('tailwind');
  if (files.some((f) => f === 'postcss.config.js' || f === 'postcss.config.mjs')) stack.push('postcss');
  return stack;
}

/**
 * Auto-detect project type from existing files.
 */
function detectProjectType(files: string[]): string {
  for (const [type, signatures] of Object.entries(PROJECT_TYPE_SIGNATURES)) {
    if (signatures.every((sig) => files.some((f) => f === sig || f.endsWith('/' + sig)))) {
      return type;
    }
  }
  // Fallback heuristics
  if (files.some((f) => f === 'package.json')) return 'node';
  if (files.some((f) => f === 'Cargo.toml')) return 'rust';
  return 'unknown';
}

/**
 * Attempt to detect the Vite dev server port from project config.
 */
async function detectVitePort(projectDir: string): Promise<number | null> {
  // Check vite.config.* for server.port
  const viteConfigNames = ['vite.config.ts', 'vite.config.js', 'vite.config.mts'];
  for (const configName of viteConfigNames) {
    try {
      const content = await fs.readFile(path.join(projectDir, configName), 'utf8');
      const portMatch = content.match(/port\s*:\s*(\d+)/);
      if (portMatch) return parseInt(portMatch[1], 10);
    } catch { /* file doesn't exist */ }
  }

  // Check package.json scripts for --port
  try {
    const pkgContent = await fs.readFile(path.join(projectDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgContent);
    const scripts = pkg.scripts ?? {};
    for (const script of Object.values(scripts)) {
      if (typeof script !== 'string') continue;
      const portMatch = script.match(/--port\s+(\d+)/);
      if (portMatch) return parseInt(portMatch[1], 10);
    }
  } catch { /* package.json doesn't exist or is malformed */ }

  // Default Vite port
  return null;
}

/**
 * Attempt to detect the Next.js dev server port from project config.
 */
async function detectNextjsPort(projectDirPath: string): Promise<number> {
  // Check next.config.* for devServer.port
  const nextConfigNames = ['next.config.ts', 'next.config.js', 'next.config.mts', 'next.config.mjs'];
  for (const configName of nextConfigNames) {
    try {
      const content = await fs.readFile(path.join(projectDirPath, configName), 'utf8');
      const portMatch = content.match(/devServer\s*:\s*\{[^}]*port\s*:\s*(\d+)/);
      if (portMatch) return parseInt(portMatch[1], 10);
    } catch { /* file doesn't exist */ }
  }

  // Check package.json scripts for --port or -p
  try {
    const pkgContent = await fs.readFile(path.join(projectDirPath, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgContent);
    const scripts = pkg.scripts ?? {};
    for (const script of Object.values(scripts)) {
      if (typeof script !== 'string') continue;
      const portMatch = script.match(/--port\s+(\d+)/);
      if (portMatch) return parseInt(portMatch[1], 10);
      const pMatch = script.match(/-p\s+(\d+)/);
      if (pMatch) return parseInt(pMatch[1], 10);
    }
  } catch { /* package.json doesn't exist or is malformed */ }

  // Default Next.js port
  return 3000;
}

/**
 * Build a file map (relative paths with sizes) for a project directory.
 */
async function buildFileMap(
  projectsRoot: string,
  projectId: string,
): Promise<Array<{ path: string; size: number }>> {
  const dir = projectDir(projectsRoot, projectId);
  const result: Array<{ path: string; size: number }> = [];

  async function walk(currentDir: string, relDir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      if (entry.name === 'node_modules') continue;

      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const absPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absPath, relPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(absPath);
          result.push({ path: relPath, size: stat.size });
        } catch { /* skip unreadable files */ }
      }
    }
  }

  await walk(dir, '');
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

export function registerFileEditRoutes(app: Express, ctx: RegisterFileEditRoutesDeps) {
  const { db } = ctx;
  const { sendApiError } = ctx.http;
  const { PROJECTS_DIR } = ctx.paths;
  const { resolveProjectDir: resolveDir } = ctx.projectFiles;

  // POST /api/projects/:id/file-edits
  // Write one or more file edits to a project.
  app.post('/api/projects/:id/file-edits', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    const body = req.body || {};
    const edits: FileEdit[] = Array.isArray(body.edits) ? body.edits : (body.edit ? [body.edit] : []);

    if (edits.length === 0) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'edits array must not be empty');
    }

    // Validate each edit
    for (const edit of edits) {
      if (typeof edit?.filePath !== 'string' || !edit.filePath.trim()) {
        return sendApiError(res, 400, 'BAD_REQUEST', 'each edit must have a non-empty filePath');
      }
      if (typeof edit.content !== 'string' && (typeof edit.search !== 'string' || edit.replace === undefined)) {
        return sendApiError(res, 400, 'BAD_REQUEST', 'each edit must have content or search/replace');
      }
    }

    // Resolve project base directory
    const project = (db as any).prepare?.(`SELECT metadata_json FROM projects WHERE id = ?`).get(projectId);
    let metadata: any = undefined;
    if (project?.metadata_json) {
      try { metadata = JSON.parse(project.metadata_json); } catch { /* ignore */ }
    }
    const projectBaseDir = resolveDir(PROJECTS_DIR, projectId, metadata);

    const pipelineOptions: FileEditPipelineOptions = {
      validatePaths: body.validatePaths !== false,
      createBackup: body.createBackup !== false,
      dryRun: body.dryRun === true,
    };

    try {
      const results = await writeFileEditsBatch(projectBaseDir, edits, pipelineOptions);

      // Log to file_edit_history (skip in dry-run mode)
      if (!pipelineOptions.dryRun) {
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const edit = edits[i];
          if (result.action !== 'skipped') {
            try {
              insertFileEditHistory(db as any, {
                projectId,
                conversationId: edit.conversationId,
                messageId: edit.messageId,
                filePath: result.path,
                action: result.action === 'created' ? 'create' : 'edit',
                contentHash: result.newHash,
              });
            } catch (err) {
              console.warn(`[file-edit-routes] failed to log edit history: ${err}`);
            }
          }
        }
      }

      res.json({ results });
    } catch (err: any) {
      console.error(`[file-edit-routes] write failed: ${err.message}`);
      return sendApiError(res, 422, 'VALIDATION_FAILED', err.message);
    }
  });

  // GET /api/projects/:id/file-edits
  // List file edit history for a project.
  app.get('/api/projects/:id/file-edits', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    const filePath = typeof req.query.filePath === 'string' ? req.query.filePath : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;

    const history = listFileEditHistory(db as any, projectId, { filePath, limit });
    res.json({ history });
  });

  // POST /api/projects/:id/validate-edit
  // Validate a file edit without actually writing.
  app.post('/api/projects/:id/validate-edit', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    const body = req.body || {};
    const editPath = body.filePath;
    if (typeof editPath !== 'string' || !editPath.trim()) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'filePath is required');
    }

    // Resolve project base directory
    const project = (db as any).prepare?.(`SELECT metadata_json FROM projects WHERE id = ?`).get(projectId);
    let metadata: any = undefined;
    if (project?.metadata_json) {
      try { metadata = JSON.parse(project.metadata_json); } catch { /* ignore */ }
    }
    const projectBaseDir = resolveDir(PROJECTS_DIR, projectId, metadata);

    const validation = validateFilePath(editPath, projectBaseDir);
    res.json({ validation });
  });

  // GET /api/projects/:id/file-map
  // Generate a file map for the project.
  app.get('/api/projects/:id/file-map', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    try {
      const fileMap = await buildFileMap(PROJECTS_DIR, projectId);
      res.json({ files: fileMap });
    } catch (err: any) {
      console.error(`[file-edit-routes] file-map failed: ${err.message}`);
      return sendApiError(res, 500, 'INTERNAL_ERROR', 'Failed to generate file map');
    }
  });

  // POST /api/projects/:id/detect-type
  // Auto-detect project type.
  app.post('/api/projects/:id/detect-type', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    try {
      const fileMap = await buildFileMap(PROJECTS_DIR, projectId);
      const filePaths = fileMap.map((f) => f.path);
      const projectType = detectProjectType(filePaths);
      const techStack = detectTechStack(filePaths);

      // Persist detected type/stack
      try {
        updateProjectType(db as any, projectId, projectType);
        if (techStack.length > 0) {
          updateProjectTechStack(db as any, projectId, techStack.join(','));
        }
      } catch (err) {
        console.warn(`[file-edit-routes] failed to persist project type: ${err}`);
      }

      res.json({ projectType, techStack });
    } catch (err: any) {
      console.error(`[file-edit-routes] detect-type failed: ${err.message}`);
      return sendApiError(res, 500, 'INTERNAL_ERROR', 'Failed to detect project type');
    }
  });

  // POST /api/projects/:id/detect-vite-port
  // Auto-detect Vite port from project config.
  app.post('/api/projects/:id/detect-vite-port', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    const projectDirPath = projectDir(PROJECTS_DIR, projectId);

    try {
      const vitePort = await detectVitePort(projectDirPath);

      if (vitePort !== null) {
        try {
          updateProjectVitePort(db as any, projectId, vitePort);
        } catch (err) {
          console.warn(`[file-edit-routes] failed to persist vite port: ${err}`);
        }
      }

      res.json({ vitePort });
    } catch (err: any) {
      console.error(`[file-edit-routes] detect-vite-port failed: ${err.message}`);
      return sendApiError(res, 500, 'INTERNAL_ERROR', 'Failed to detect Vite port');
    }
  });

  // ── Next.js-specific routes ─────────────────────────────────────────

  // POST /api/projects/:id/detect-dev-port
  // Unified dev port detection (Vite + Next.js).
  app.post('/api/projects/:id/detect-dev-port', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    const projectDirPath = projectDir(PROJECTS_DIR, projectId);

    try {
      // First, detect project type to determine which port detection to use
      const fileMap = await buildFileMap(PROJECTS_DIR, projectId);
      const filePaths = fileMap.map((f) => f.path);
      const projectType = detectProjectType(filePaths);

      let devPort: number | null = null;
      let devServerType: 'vite' | 'nextjs' | 'custom' = 'vite';

      if (projectType === 'nextjs') {
        // Next.js port detection
        devServerType = 'nextjs';
        devPort = await detectNextjsPort(projectDirPath);
      } else {
        // Vite / Tauri port detection
        devPort = await detectVitePort(projectDirPath);
      }

      // Persist detected port
      if (devPort !== null) {
        try {
          updateProjectVitePort(db as any, projectId, devPort);
        } catch (err) {
          console.warn(`[file-edit-routes] failed to persist dev port: ${err}`);
        }
      }

      res.json({ devPort, devServerType, projectType });
    } catch (err: any) {
      console.error(`[file-edit-routes] detect-dev-port failed: ${err.message}`);
      return sendApiError(res, 500, 'INTERNAL_ERROR', 'Failed to detect dev port');
    }
  });

  // POST /api/projects/:id/prisma/generate
  // Run `npx prisma generate` after schema edit (Next.js only).
  app.post('/api/projects/:id/prisma/generate', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(execFile);

      const projectDirPath = projectDir(PROJECTS_DIR, projectId);
      const start = Date.now();

      const { stdout, stderr } = await execAsync('npx', ['prisma', 'generate'], {
        cwd: projectDirPath,
        timeout: 30000,
      });

      res.json({
        success: true,
        output: stdout || stderr,
        durationMs: Date.now() - start,
      });
    } catch (err: any) {
      res.json({
        success: false,
        output: err.stderr || err.message,
        durationMs: 0,
      });
    }
  });

  // POST /api/projects/:id/prisma/validate
  // Validate Prisma schema syntax (Next.js only).
  app.post('/api/projects/:id/prisma/validate', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    const body = req.body || {};
    const schemaContent = body.schemaContent;

    if (typeof schemaContent !== 'string') {
      return sendApiError(res, 400, 'BAD_REQUEST', 'schemaContent string is required');
    }

    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const { writeFile, unlink } = await import('node:fs/promises');
      const os = await import('node:os');
      const pathMod = await import('node:path');
      const execAsync = promisify(execFile);

      const projectDirPath = projectDir(PROJECTS_DIR, projectId);
      const tmpPath = pathMod.join(os.tmpdir(), `prisma-validate-${Date.now()}.prisma`);

      try {
        await writeFile(tmpPath, schemaContent, 'utf-8');
        const { stdout, stderr } = await execAsync(
          'npx', ['prisma', 'validate', `--schema=${tmpPath}`],
          { cwd: projectDirPath, timeout: 15000 },
        );

        res.json({ valid: true, errors: [], warnings: [] });
      } catch (err: any) {
        res.json({
          valid: false,
          errors: [{ message: err.stderr || err.message || 'Validation failed' }],
          warnings: [],
        });
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    } catch (err: any) {
      console.error(`[file-edit-routes] prisma validate failed: ${err.message}`);
      return sendApiError(res, 500, 'INTERNAL_ERROR', 'Failed to validate Prisma schema');
    }
  });

  // POST /api/projects/:id/prisma/migrate
  // Run `npx prisma db push` (Next.js only, requires user confirmation).
  app.post('/api/projects/:id/prisma/migrate', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(execFile);

      const projectDirPath = projectDir(PROJECTS_DIR, projectId);
      const start = Date.now();

      const { stdout, stderr } = await execAsync(
        'npx', ['prisma', 'db', 'push', '--accept-data-loss'],
        { cwd: projectDirPath, timeout: 60000 },
      );

      res.json({
        success: true,
        output: stdout || stderr,
        warnings: [],
        durationMs: Date.now() - start,
      });
    } catch (err: any) {
      res.json({
        success: false,
        output: err.stderr || err.message,
        warnings: [],
        durationMs: 0,
      });
    }
  });

  // POST /api/projects/:id/nextjs/restart
  // Signal that Next.js dev server needs restart (after middleware/config changes).
  app.post('/api/projects/:id/nextjs/restart', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    // We don't actually restart the server — we just acknowledge the request
    // and return a flag that the frontend can use to show a restart notification.
    // The user manually restarts their dev server.
    res.json({
      restartNeeded: true,
      message: 'Next.js dev server restart may be required after middleware or config changes. Please restart your dev server manually.',
    });
  });
}
