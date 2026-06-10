/**
 * Next.js Fast Refresh preview integration.
 *
 * Connects to a running Next.js dev server (typically localhost:3000)
 * and monitors its state for Fast Refresh events. Unlike Vite HMR
 * which uses a WebSocket overlay, Next.js dev server communicates
 * status through its built-in DevOverlay and turbopack file watcher.
 *
 * Key differences from Vite preview:
 * - Default port is 3000 (not 5173)
 * - Uses Next.js turbopack for Fast Refresh (not Vite chokidar)
 * - Server Components are rendered server-side (no client HMR for those)
 * - API routes in app/api/ are auto-reloaded by Next.js
 * - Prisma schema changes require `prisma generate` + optional `db push`
 * - middleware.ts and next.config.ts changes may require server restart
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NextjsPreviewState {
  /** Whether the Next.js dev server appears to be running. */
  serverOnline: boolean;
  /** The URL for the preview iframe. */
  previewUrl: string;
  /** The detected dev server port. */
  port: number;
  /** Whether the preview is currently loading. */
  loading: boolean;
  /** Last error message, if any. */
  error: string | null;
  /** Whether a server restart is needed (e.g. after middleware/config change). */
  restartNeeded: boolean;
}

export interface NextjsPreviewOptions {
  /** Project ID for daemon API calls. */
  projectId: string;
  /** Dev server port (auto-detected if not provided). */
  port?: number;
  /** Daemon base URL for API calls. */
  daemonBaseUrl?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Next.js default dev server port. */
export const NEXTJS_DEFAULT_PORT = 3000;

/** Timeout for dev server health check (ms). */
const HEALTH_CHECK_TIMEOUT_MS = 3000;

/** Interval between periodic health checks (ms). */
const HEALTH_CHECK_INTERVAL_MS = 8000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for managing Next.js Fast Refresh preview.
 *
 * Monitors the Next.js dev server health and provides a preview URL
 * that can be used in an iframe or embedded browser view.
 */
export function useNextjsPreview(options: NextjsPreviewOptions): NextjsPreviewState {
  const { projectId, port: initialPort, daemonBaseUrl } = options;
  const [serverOnline, setServerOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restartNeeded, setRestartNeeded] = useState(false);
  const [port, setPort] = useState(initialPort ?? NEXTJS_DEFAULT_PORT);
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const previewUrl = `http://localhost:${port}`;

  const checkServerHealth = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const resp = await fetch(previewUrl, {
        signal: controller.signal,
        mode: 'no-cors',
        cache: 'no-store',
      });
      // Any response (even opaque) means the server is running
      if (!serverOnline) {
        setServerOnline(true);
        setLoading(false);
        setError(null);
      }
    } catch {
      if (serverOnline) {
        setServerOnline(false);
        setError('Next.js dev server is not running. Start it with `npm run dev`.');
      }
      setLoading(false);
    } finally {
      clearTimeout(timer);
    }
  }, [previewUrl, serverOnline]);

  // Auto-detect port from daemon API on mount
  useEffect(() => {
    if (initialPort !== undefined) return;

    async function detectPort() {
      try {
        const base = daemonBaseUrl ?? '';
        const resp = await fetch(
          `${base}/api/projects/${encodeURIComponent(projectId)}/detect-dev-port`,
          { method: 'POST' },
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.devPort && typeof data.devPort === 'number') {
            setPort(data.devPort);
          }
        }
      } catch {
        // Fall back to default port
      }
    }

    detectPort();
  }, [projectId, initialPort, daemonBaseUrl]);

  // Periodic health check
  useEffect(() => {
    checkServerHealth();

    checkTimerRef.current = setInterval(checkServerHealth, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [checkServerHealth]);

  // Listen for file change events from daemon SSE
  useEffect(() => {
    if (!daemonBaseUrl) return;

    const eventSource = new EventSource(
      `${daemonBaseUrl}/api/projects/${encodeURIComponent(projectId)}/events`,
    );

    eventSource.addEventListener('file-change', (event) => {
      try {
        const data = JSON.parse(event.data);
        // Check if middleware or config changed — these need restart
        if (
          data.filePath === 'middleware.ts' ||
          data.filePath === 'middleware.js' ||
          data.filePath === 'next.config.ts' ||
          data.filePath === 'next.config.js' ||
          data.filePath === 'next.config.mjs'
        ) {
          setRestartNeeded(true);
        }
        // Prisma schema changes handled by prisma-helper
        // Other .tsx/.ts changes trigger Fast Refresh automatically
      } catch {
        // Ignore malformed events
      }
    });

    eventSource.addEventListener('error', () => {
      // SSE connection error — non-fatal
    });

    return () => {
      eventSource.close();
    };
  }, [projectId, daemonBaseUrl]);

  return {
    serverOnline,
    previewUrl,
    port,
    loading,
    error,
    restartNeeded,
  };
}
