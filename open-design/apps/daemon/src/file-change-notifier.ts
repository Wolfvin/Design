/**
 * File Change Notifier — Daemon-side module.
 *
 * Watches for file changes across project directories and notifies the
 * frontend via Server-Sent Events (SSE). Complements the existing
 * `useProjectFileEvents` hook on the web side, providing:
 *
 *   1. A chokidar-based watcher for the entire projects root, with
 *      per-project filtering and debouncing.
 *   2. An Express SSE route (`GET /api/projects/:id/file-events`)
 *      for streaming fine-grained file change events to the frontend.
 *   3. A programmatic `notifyFileChange()` export so the file-edit
 *      pipeline can emit synthetic events without touching disk.
 *
 * Part of the Open Design App Developer migration (Phase 3.3, GAP 2).
 */

import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Express, Response } from 'express';

import { isIgnoredProjectDirName } from './project-ignored-dirs.js';
import { isSafeId, projectDir, resolveProjectDir } from './projects.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Action that triggered the change event. */
export type FileChangeAction = 'create' | 'modify' | 'delete';

/** A single file change event payload pushed over SSE. */
export interface FileChangeEvent {
  /** Relative file path within the project root. */
  path: string;
  /** What happened to the file. */
  action: FileChangeAction;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Source of the event: 'watcher' (disk) or 'pipeline' (programmatic). */
  source: 'watcher' | 'pipeline';
}

/** Callback invoked when a file change is detected for a project. */
export type FileChangeCallback = (projectId: string, event: FileChangeEvent) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Directories that should never be watched. */
const IGNORED_DIR_SEGMENTS = new Set([
  '.git',
  'node_modules',
  '.od',
  '.open-design',
  'dist',
  '.next',
  '.cache',
  '.turbo',
  'coverage',
  '__pycache__',
  '.venv',
  'target',
]);

/** File extensions that should never emit events. */
const IGNORED_EXTENSIONS = new Set([
  '.bak',
  '.tmp',
  '.log',
  '.swp',
  '.swo',
]);

/** Debounce window in ms — rapid changes within this window are coalesced. */
const DEBOUNCE_MS = 150;

/** Maximum events to buffer per project before forcing a flush. */
const MAX_BUFFERED_EVENTS = 200;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Per-project SSE subscribers keyed by project id. */
const projectSinks = new Map<string, Set<(event: FileChangeEvent) => void>>();

/** Global watchers (one chokidar per project root). */
const projectWatchers = new Map<string, {
  watcher: FSWatcher;
  refCount: number;
  closing: Promise<void> | null;
}>();

/** Per-project debounce timers. */
const debounceTimers = new Map<string, {
  timer: ReturnType<typeof setTimeout> | null;
  buffer: FileChangeEvent[];
}>();

/** Global listeners (called for every project event). */
const globalListeners = new Set<FileChangeCallback>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the ignored predicate for chokidar.
 * Rejects paths inside .git, node_modules, .bak/.tmp files, etc.
 */
function makeFileChangeIgnored(rootDir: string): (absPath: string) => boolean {
  return (absPath: string): boolean => {
    const rel = path.relative(rootDir, absPath);
    if (!rel || rel === '' || rel.startsWith('..')) return false;

    // Check directory segments
    const segments = rel.split(/[\\/]/);
    for (const seg of segments) {
      const lower = seg.toLowerCase();
      if (IGNORED_DIR_SEGMENTS.has(lower)) return true;
      if (isIgnoredProjectDirName(lower)) return true;
    }

    // Check file extension
    const ext = path.extname(absPath).toLowerCase();
    if (IGNORED_EXTENSIONS.has(ext)) return true;

    return false;
  };
}

/**
 * Map a chokidar event type to our action enum.
 */
function chokidarKindToAction(kind: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'): FileChangeAction | null {
  switch (kind) {
    case 'add':
    case 'addDir':
      return 'create';
    case 'change':
      return 'modify';
    case 'unlink':
    case 'unlinkDir':
      return 'delete';
    default:
      return null;
  }
}

/**
 * Flush buffered events for a project to all subscribers.
 */
function flushProjectEvents(projectId: string): void {
  const entry = debounceTimers.get(projectId);
  if (!entry || entry.buffer.length === 0) return;

  const events = entry.buffer.splice(0, entry.buffer.length);
  entry.timer = null;

  const sinks = projectSinks.get(projectId);
  if (sinks) {
    for (const event of events) {
      for (const sink of sinks) {
        try {
          sink(event);
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[file-change-notifier] sink threw for', event.path, err);
          }
        }
      }
    }
  }

  // Also notify global listeners
  for (const cb of globalListeners) {
    for (const event of events) {
      try {
        cb(projectId, event);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[file-change-notifier] global listener threw', err);
        }
      }
    }
  }
}

/**
 * Buffer a file change event with debouncing.
 */
function bufferEvent(projectId: string, event: FileChangeEvent): void {
  let entry = debounceTimers.get(projectId);
  if (!entry) {
    entry = { timer: null, buffer: [] };
    debounceTimers.set(projectId, entry);
  }

  entry.buffer.push(event);

  // Force-flush if buffer gets too large
  if (entry.buffer.length >= MAX_BUFFERED_EVENTS) {
    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    flushProjectEvents(projectId);
    return;
  }

  // Reset debounce timer
  if (entry.timer !== null) {
    clearTimeout(entry.timer);
  }
  entry.timer = setTimeout(() => flushProjectEvents(projectId), DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Watcher management
// ---------------------------------------------------------------------------

/**
 * Ensure a chokidar watcher exists for the given project directory.
 */
function ensureWatcher(projectId: string, dir: string): void {
  let entry = projectWatchers.get(projectId);
  if (entry) {
    entry.refCount++;
    return;
  }

  const watcher = chokidar.watch(dir, {
    ignored: makeFileChangeIgnored(dir),
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 50,
    },
    persistent: true,
    followSymlinks: false,
    ignorePermissionErrors: true,
  });

  entry = { watcher, refCount: 1, closing: null };
  projectWatchers.set(projectId, entry);

  const broadcast = (kind: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir') => (absPath: string) => {
    const action = chokidarKindToAction(kind);
    if (!action) return;

    const rel = path.relative(dir, absPath);
    if (!rel || rel.startsWith('..')) return;

    const event: FileChangeEvent = {
      path: rel.split(path.sep).join('/'),
      action,
      timestamp: new Date().toISOString(),
      source: 'watcher',
    };

    bufferEvent(projectId, event);
  };

  watcher.on('add', broadcast('add'));
  watcher.on('addDir', broadcast('addDir'));
  watcher.on('change', broadcast('change'));
  watcher.on('unlink', broadcast('unlink'));
  watcher.on('unlinkDir', broadcast('unlinkDir'));

  watcher.on('error', (err) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[file-change-notifier] chokidar error for', projectId, err);
    }
  });
}

/**
 * Decrement watcher refcount; close if zero.
 */
async function releaseWatcher(projectId: string): Promise<void> {
  const entry = projectWatchers.get(projectId);
  if (!entry) return;

  entry.refCount--;
  if (entry.refCount <= 0) {
    projectWatchers.delete(projectId);
    if (!entry.closing) {
      entry.closing = entry.watcher.close();
    }
    await entry.closing;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Programmatic notification — emit a file change event without touching disk.
 *
 * Used by the file-edit pipeline after successfully writing an edit.
 *
 * @param projectId - The OD project id.
 * @param filePath - Relative file path within the project.
 * @param action - What happened: 'create', 'modify', or 'delete'.
 */
export function notifyFileChange(projectId: string, filePath: string, action: FileChangeAction): void {
  const event: FileChangeEvent = {
    path: filePath,
    action,
    timestamp: new Date().toISOString(),
    source: 'pipeline',
  };

  bufferEvent(projectId, event);

  // Also immediately push to any active SSE sinks so programmatic
  // notifications bypass the debounce window (the pipeline already
  // debounces on its own).
  flushProjectEvents(projectId);
}

/**
 * Register a global listener for all project file changes.
 *
 * @returns An unsubscribe function.
 */
export function onFileChange(callback: FileChangeCallback): () => void {
  globalListeners.add(callback);
  return () => {
    globalListeners.delete(callback);
  };
}

/**
 * Start the file change notifier for a given projects root directory.
 *
 * Sets up the chokidar watchers (lazily, on first SSE subscriber) and
 * registers the Express route for SSE streaming.
 *
 * @param projectsRoot - Absolute path to the projects parent directory.
 * @param app - Express application to register routes on.
 * @param deps - Dependencies for project resolution and SSE.
 * @returns A cleanup function that closes all watchers and removes sinks.
 */
export function startFileChangeNotifier(
  projectsRoot: string,
  app: Express,
  deps: {
    createSseResponse: (res: Response) => { send: (event: string, data: unknown) => void };
    sendApiError: (res: Response, status: number, code: string, message: string) => void;
    getProject: (projectId: string) => any;
  },
): () => Promise<void> {
  // Register the SSE route
  app.get('/api/projects/:id/file-events', (req, res) => {
    const projectId = req.params.id;

    if (!isSafeId(projectId)) {
      return deps.sendApiError(res, 400, 'INVALID_ID', 'Invalid project id');
    }

    const project = deps.getProject(projectId);
    if (!project) {
      return deps.sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    // Resolve the actual project directory (handles folder-imported projects)
    const dir = typeof project.metadata?.baseDir === 'string' && project.metadata.baseDir
      ? resolveProjectDir(projectsRoot, projectId, project.metadata)
      : projectDir(projectsRoot, projectId);

    // Create SSE connection
    const sse = deps.createSseResponse(res);
    const sink = (event: FileChangeEvent) => {
      sse.send('file-changed', event);
    };

    // Register sink
    let sinks = projectSinks.get(projectId);
    if (!sinks) {
      sinks = new Set();
      projectSinks.set(projectId, sinks);
    }
    sinks.add(sink);

    // Start watching (lazy)
    ensureWatcher(projectId, dir);

    // Send ready event
    sse.send('ready', { projectId });

    // Cleanup on disconnect
    const cleanup = () => {
      sinks!.delete(sink);
      if (sinks!.size === 0) {
        projectSinks.delete(projectId);
        void releaseWatcher(projectId);
      }
      // Clear debounce timer if no more sinks
      if (!projectSinks.has(projectId)) {
        const entry = debounceTimers.get(projectId);
        if (entry?.timer) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }
      }
    };

    res.on('close', cleanup);
    res.on('finish', cleanup);
  });

  // Return cleanup function
  return async function cleanup(): Promise<void> {
    // Close all watchers
    const closePromises: Promise<void>[] = [];
    for (const [projectId, entry] of projectWatchers) {
      projectWatchers.delete(projectId);
      if (!entry.closing) {
        entry.closing = entry.watcher.close();
      }
      closePromises.push(entry.closing);
    }

    // Clear all debounce timers
    for (const [, entry] of debounceTimers) {
      if (entry.timer !== null) {
        clearTimeout(entry.timer);
      }
    }
    debounceTimers.clear();

    // Clear all sinks
    projectSinks.clear();
    globalListeners.clear();

    await Promise.allSettled(closePromises);
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** @internal Test-only: reset all internal state. */
export async function _resetForTests(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  for (const [, entry] of projectWatchers) {
    if (!entry.closing) {
      entry.closing = entry.watcher.close();
    }
    closePromises.push(entry.closing);
  }
  projectWatchers.clear();

  for (const [, entry] of debounceTimers) {
    if (entry.timer !== null) {
      clearTimeout(entry.timer);
    }
  }
  debounceTimers.clear();

  projectSinks.clear();
  globalListeners.clear();

  await Promise.allSettled(closePromises);
}

/** @internal Test-only: get the number of active watchers. */
export function _activeWatcherCount(): number {
  return projectWatchers.size;
}

/** @internal Test-only: get the number of active sinks for a project. */
export function _sinkCount(projectId: string): number {
  return projectSinks.get(projectId)?.size ?? 0;
}
