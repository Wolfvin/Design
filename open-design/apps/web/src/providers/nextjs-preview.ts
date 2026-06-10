/**
 * Next.js Fast Refresh Preview — connects to a running Next.js dev server.
 *
 * This hook manages the connection to a Next.js dev server for live
 * preview of file edits. Unlike Vite HMR (which uses a simple HTTP
 * check), Next.js preview needs to handle:
 *
 *   1. Fast Refresh via turbopack (file system watching)
 *   2. Server Component rendering (no client-side reload needed)
 *   3. Prisma schema changes (requires `prisma generate`)
 *   4. Middleware changes (requires dev server restart)
 *
 * The preview is displayed via an iframe pointing to the Next.js
 * dev server URL (default: http://localhost:3000).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NextjsPreviewState {
  /** Whether the Next.js dev server is reachable. */
  serverOnline: boolean;
  /** The preview URL (e.g., http://localhost:3000). */
  previewUrl: string | null;
  /** The detected port. */
  port: number;
  /** Whether the server status is being checked. */
  checking: boolean;
  /** Whether a restart is needed (after middleware/config change). */
  requiresRestart: boolean;
  /** Last error message (if any). */
  error: string | null;
  /** Manually check the server status. */
  checkServer: () => Promise<void>;
  /** Trigger a dev server restart via the daemon API. */
  restartServer: () => Promise<void>;
  /** Reload the preview iframe. */
  reloadPreview: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NEXTJS_DEFAULT_PORT = 3000;
const CHECK_INTERVAL_MS = 5000;
const CHECK_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNextjsPreview(
  projectId: string,
  options: {
    /** Override the port (skips auto-detection). */
    port?: number;
    /** Whether the preview is enabled. Default: true. */
    enabled?: boolean;
  } = {},
): NextjsPreviewState {
  const { port: manualPort, enabled = true } = options;
  const port = manualPort ?? NEXTJS_DEFAULT_PORT;

  const [serverOnline, setServerOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [requiresRestart, setRequiresRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ----- Server reachability check -----

  const checkServer = useCallback(async () => {
    if (!enabled) return;
    setChecking(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
      await fetch(`http://localhost:${port}`, {
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setServerOnline(true);
    } catch (err) {
      setServerOnline(false);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Server check timed out');
      }
    } finally {
      setChecking(false);
    }
  }, [port, enabled]);

  // ----- Restart dev server via daemon API -----

  const restartServer = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/nextjs/restart`,
        { method: 'POST' },
      );
      if (res.ok) {
        setRequiresRestart(false);
        // Wait a moment for the server to restart
        setTimeout(() => checkServer(), 2000);
      }
    } catch {
      setError('Failed to restart dev server');
    }
  }, [projectId, checkServer]);

  // ----- Reload preview iframe -----

  const reloadPreview = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }, []);

  // ----- Auto-check on mount and periodically -----

  useEffect(() => {
    if (!enabled) return;

    checkServer();

    intervalRef.current = setInterval(checkServer, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, checkServer]);

  // ----- Listen for file change notifications from daemon -----

  useEffect(() => {
    if (!enabled || !serverOnline) return;

    // Subscribe to file change events via SSE
    const eventSource = new EventSource(
      `/api/projects/${encodeURIComponent(projectId)}/file-events`,
    );

    eventSource.addEventListener('file-change', (event) => {
      try {
        const data = JSON.parse(event.data);
        const filePath: string = data.filePath ?? '';

        // Middleware changes require a restart
        if (filePath === 'middleware.ts' || filePath === 'src/middleware.ts') {
          setRequiresRestart(true);
        }

        // next.config changes require a restart
        if (filePath.startsWith('next.config')) {
          setRequiresRestart(true);
        }

        // Prisma schema changes — auto-generate is handled by daemon
        if (filePath.includes('prisma/schema.prisma')) {
          // Daemon runs prisma generate automatically
        }
      } catch {
        // Ignore malformed events
      }
    });

    eventSource.addEventListener('error', () => {
      // SSE connection error — will auto-reconnect
    });

    return () => {
      eventSource.close();
    };
  }, [projectId, enabled, serverOnline]);

  // ----- Build preview URL -----

  const previewUrl = serverOnline ? `http://localhost:${port}` : null;

  return {
    serverOnline,
    previewUrl,
    port,
    checking,
    requiresRestart,
    error,
    checkServer,
    restartServer,
    reloadPreview,
  };
}
