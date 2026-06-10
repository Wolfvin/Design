import fs from 'node:fs/promises';
import path from 'node:path';
import type { Express } from 'express';
import type { RouteDeps } from './server-context.js';
import { validateFilePath } from './file-path-validator.js';
import { writeFileEditToProject, writeFileEditsBatch } from './file-edit-pipeline.js';
import type { FileEdit, FileEditPipelineOptions } from './file-edit-pipeline.js';
import {
  isPrismaSchemaFile,
  validatePrismaSchema,
  runPrismaGenerate,
  runPrismaDbPush,
} from './prisma-helper.js';
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
}

  // ─── Next.js Mode Routes ───────────────────────────────────────────

  // POST /api/projects/:id/detect-dev-port
  // Unified port detection — auto-detect dev server port for any project type.
  // Supports Vite (5173), Next.js (3000), and Tauri projects.
  app.post('/api/projects/:id/detect-dev-port', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    const projectDirPath = projectDir(PROJECTS_DIR, projectId);

    try {
      // First detect the project type to determine which port to look for
      const fileMap = await buildFileMap(PROJECTS_DIR, projectId);
      const filePaths = fileMap.map((f) => f.path);
      const projectType = detectProjectType(filePaths);

      let devPort: number | null = null;
      let devServerType: string = 'vite';

      if (projectType === 'nextjs') {
        devServerType = 'nextjs';
        // Check next.config.* for devServer.port
        const nextConfigNames = ['next.config.ts', 'next.config.mjs', 'next.config.js'];
        for (const configName of nextConfigNames) {
          try {
            const content = await fs.readFile(path.join(projectDirPath, configName), 'utf8');
            const portMatch = content.match(/port\s*:\s*(\d+)/);
            if (portMatch) { devPort = parseInt(portMatch[1], 10); break; }
          } catch { /* file doesn't exist */ }
        }

        // Check package.json scripts for -p or --port flag
        if (devPort === null) {
          try {
            const pkgContent = await fs.readFile(path.join(projectDirPath, 'package.json'), 'utf8');
            const pkg = JSON.parse(pkgContent);
            const devScript = pkg.scripts?.dev || '';
            const pMatch = devScript.match(/-p\s+(\d+)/);
            const portMatch = devScript.match(/--port\s+(\d+)/);
            if (pMatch) devPort = parseInt(pMatch[1], 10);
            else if (portMatch) devPort = parseInt(portMatch[1], 10);
          } catch { /* ignore */ }
        }

        // Default Next.js port
        if (devPort === null) devPort = 3000;
      } else {
        // Vite / Tauri detection
        devPort = await detectVitePort(projectDirPath);
        if (devPort === null) {
          // Check tauri.conf.json for devUrl port
          try {
            const tauriConfig = await fs.readFile(
              path.join(projectDirPath, 'src-tauri', 'tauri.conf.json'), 'utf8'
            );
            const config = JSON.parse(tauriConfig);
            const devUrl = config.build?.devUrl || '';
            const urlMatch = devUrl.match(/localhost:(\d+)/);
            if (urlMatch) devPort = parseInt(urlMatch[1], 10);
          } catch { /* not a Tauri project */ }
        }
        if (devPort === null) devPort = 5173; // Default Vite port
      }

      // Persist detected port
      try {
        updateProjectVitePort(db as any, projectId, devPort);
      } catch (err) {
        console.warn(`[file-edit-routes] failed to persist dev port: ${err}`);
      }

      res.json({ devPort, devServerType, projectType });
    } catch (err: any) {
      console.error(`[file-edit-routes] detect-dev-port failed: ${err.message}`);
      return sendApiError(res, 500, 'INTERNAL_ERROR', 'Failed to detect dev port');
    }
  });

  // POST /api/projects/:id/nextjs/restart
  // Restart the Next.js dev server for a project.
  // Called by the nextjs-preview.ts client when middleware.ts or
  // next.config.ts changes require a full dev server restart.
  app.post('/api/projects/:id/nextjs/restart', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    try {
      const projectDirPath = projectDir(PROJECTS_DIR, projectId);

      // Check if this is actually a Next.js project
      const nextConfigNames = ['next.config.ts', 'next.config.mjs', 'next.config.js'];
      let isNextjs = false;
      for (const configName of nextConfigNames) {
        try {
          await fs.access(path.join(projectDirPath, configName));
          isNextjs = true;
          break;
        } catch { continue; }
      }

      if (!isNextjs) {
        return sendApiError(res, 400, 'BAD_REQUEST', 'Project is not a Next.js project');
      }

      // The actual dev server restart is managed externally (by the user's
      // terminal or a process manager). This endpoint serves as a signal
      // that a restart is needed and returns the restart instructions.
      // In future, we could integrate with a process manager to auto-restart.
      res.json({
        ok: true,
        message: 'Next.js dev server restart required. Restart manually or via process manager.',
        projectId,
        restartRequired: true,
      });
    } catch (err: any) {
      console.error(`[file-edit-routes] nextjs/restart failed: ${err.message}`);
      return sendApiError(res, 500, 'INTERNAL_ERROR', 'Failed to process restart request');
    }
  });

  // POST /api/projects/:id/sync-tokens/nextjs
  // Sync design tokens specifically for Next.js projects.
  // In addition to writing tokens.css + tailwind-theme.css, also injects
  // @import directives into app/globals.css for Next.js App Router.
  app.post('/api/projects/:id/sync-tokens/nextjs', async (req, res) => {
    const projectId = req.params.id;
    if (!isSafeId(projectId)) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'invalid project id');
    }

    try {
      const { syncDesignTokensToNextjsProject } = await import('./design-token-sync.js');

      const designSystemsDir = (ctx.paths as any).DESIGN_SYSTEMS_DIR;
      const userDesignSystemsDir = (ctx.paths as any).USER_DESIGN_SYSTEMS_DIR;

      if (!designSystemsDir) {
        return sendApiError(res, 500, 'INTERNAL_ERROR', 'DESIGN_SYSTEMS_DIR not configured');
      }

      const result = await syncDesignTokensToNextjsProject(projectId, PROJECTS_DIR, {
        db: db as any,
        designSystemsDir,
        userDesignSystemsDir: userDesignSystemsDir || '',
      });

      res.json({
        ok: true,
        tokensPath: result.tokensPath,
        tailwindPath: result.tailwindPath,
        tokensHash: result.tokensHash,
        wasUpdated: result.wasUpdated,
        backupCreated: result.backupCreated,
      });
    } catch (err: any) {
      console.error(`[file-edit-routes] sync-tokens/nextjs failed: ${err.message}`);
      return sendApiError(res, 500, 'TOKEN_SYNC_ERROR', err.message);
    }
  });
}
