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
import { detectProjectType as detectProjectTypeFull } from './prompts/project-type-detector.js';
import { PrismaSchemaHelper } from './prisma-helper.js';

export interface RegisterFileEditRoutesDeps extends RouteDeps<'db' | 'http' | 'paths' | 'projectFiles'> {}

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
      const projectDirPath = projectDir(PROJECTS_DIR, projectId);
      const detection = await detectProjectTypeFull(projectDirPath);
      const projectType = detection.type;
      const techStack = detection.techStack;

      // Persist detected type/stack
      try {
        updateProjectType(db as any, projectId, projectType);
        if (techStack) {
          updateProjectTechStack(db as any, projectId, techStack);
        }
      } catch (err) {
        console.warn(`[file-edit-routes] failed to persist project type: ${err}`);
      }

      res.json({
        projectType,
        techStack,
        devPort: detection.devPort,
        devServerType: detection.devServerType,
      });
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
      const detection = await detectProjectTypeFull(projectDirPath);
      const vitePort = detection.devPort ?? detection.vitePort ?? null;

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
      const detection = await detectProjectTypeFull(projectDirPath);
      const projectType = detection.type;
      const devServerType = detection.devServerType ?? 'vite';
      const devPort = detection.devPort ?? null;

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
      const projectDirPath = projectDir(PROJECTS_DIR, projectId);
      const helper = new PrismaSchemaHelper(projectDirPath);
      const result = await helper.generateClient();

      res.json({
        success: result.success,
        output: result.output,
        durationMs: result.durationMs,
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
      const projectDirPath = projectDir(PROJECTS_DIR, projectId);
      const helper = new PrismaSchemaHelper(projectDirPath);
      const result = await helper.validateSchema(schemaContent);

      res.json({
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
      });
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
      const projectDirPath = projectDir(PROJECTS_DIR, projectId);
      const helper = new PrismaSchemaHelper(projectDirPath);
      const result = await helper.pushToDatabase();

      res.json({
        success: result.success,
        output: result.output,
        warnings: result.warnings,
        durationMs: result.durationMs,
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
