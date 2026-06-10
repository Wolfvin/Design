/**
 * Vite HMR Preview Provider.
 *
 * Provides a React hook (`useVitePreview`) that manages the Vite dev server
 * connection for live preview. Replaces the old `iframe srcdoc` preview with
 * a Vite HMR-powered iframe that connects to the user's running Vite dev
 * server.
 *
 * Key features:
 *   - Auto-detects Vite port from project config files
 *   - Periodic health checks to detect server online/offline state
 *   - SSE integration via `useProjectFileEvents` for file change safety net
 *   - Manual port override support
 *   - Refresh key for iframe reload control
 *
 * Part of the Open Design App Developer migration (Phase 3-B).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  autoDetectVitePort,
  checkViteServerOnline,
  HEALTH_CHECK_INTERVAL_MS,
  VITE_DEFAULT_PORT,
} from './vite-port-detector';
import {
  useProjectFileEvents,
  type ProjectEvent,
} from './project-events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** State returned by `useVitePreview`. */
export interface VitePreviewState {
  /** The resolved preview URL (http://localhost:{port}) */
  previewUrl: string;
  /** The detected or configured Vite port */
  vitePort: number;
  /** Whether the Vite dev server appears to be running */
  serverOnline: boolean;
  /** Loading state during port detection */
  detecting: boolean;
  /** Error message if detection failed */
  error: string | null;
  /** Force refresh the preview iframe */
  refresh: () => void;
  /** Manually set the port (override auto-detection) */
  setPort: (port: number) => void;
  /** Refresh key — changes trigger iframe reload */
  refreshKey: number;
}

/** Options for `useVitePreview`. */
export interface UseVitePreviewOptions {
  /** Whether the hook is active (default: true). When false, stops health checks and SSE. */
  enabled?: boolean;
  /** Custom health check interval in ms (default: 5000). */
  healthCheckIntervalMs?: number;
  /** Custom health check timeout in ms (default: 2000). */
  healthCheckTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPreviewUrl(port: number): string {
  return `http://localhost:${port}`;
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

/**
 * Manage a Vite HMR preview connection for a project.
 *
 * Auto-detects the Vite dev server port from project configuration files,
 * monitors server health, and integrates with the project SSE stream for
 * file-change awareness.
 *
 * @param projectId - The OD project ID.
 * @param options - Optional configuration.
 * @returns A `VitePreviewState` object for driving a preview iframe.
 *
 * @example
 * ```tsx
 * function MyPreview({ projectId }) {
 *   const { previewUrl, serverOnline, refresh, refreshKey } = useVitePreview(projectId);
 *   return (
 *     <iframe
 *       key={refreshKey}
 *       src={previewUrl}
 *       sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
 *     />
 *   );
 * }
 * ```
 */
export function useVitePreview(
  projectId: string,
  options: UseVitePreviewOptions = {},
): VitePreviewState {
  const {
    enabled = true,
    healthCheckIntervalMs = HEALTH_CHECK_INTERVAL_MS,
  } = options;

  // --- State ---
  const [vitePort, setVitePort] = useState<number>(VITE_DEFAULT_PORT);
  const [serverOnline, setServerOnline] = useState(false);
  const [detecting, setDetecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [manuallySetPort, setManuallySetPort] = useState<number | null>(null);

  // --- Refs ---
  const healthCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // --- Port detection ---
  useEffect(() => {
    if (!enabled || !projectId) {
      setDetecting(false);
      return;
    }

    let cancelled = false;

    async function detectPort() {
      setDetecting(true);
      setError(null);

      try {
        const result = await autoDetectVitePort(projectId);
        if (cancelled) return;

        // Only use the detected port if the user hasn't manually overridden it
        if (manuallySetPort === null) {
          setVitePort(result.port);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Port detection failed';
        setError(message);
        // Fall back to default port
        if (manuallySetPort === null) {
          setVitePort(VITE_DEFAULT_PORT);
        }
      } finally {
        if (!cancelled) {
          setDetecting(false);
        }
      }
    }

    detectPort();

    return () => {
      cancelled = true;
    };
  }, [projectId, enabled, manuallySetPort]);

  // --- Health check ---
  useEffect(() => {
    if (!enabled) {
      if (healthCheckTimerRef.current) {
        clearInterval(healthCheckTimerRef.current);
        healthCheckTimerRef.current = null;
      }
      return;
    }

    // Initial check
    let cancelled = false;
    checkViteServerOnline(vitePort).then((online) => {
      if (!cancelled) setServerOnline(online);
    });

    // Periodic checks
    healthCheckTimerRef.current = setInterval(() => {
      checkViteServerOnline(vitePort).then((online) => {
        if (!cancelled) setServerOnline(online);
      });
    }, healthCheckIntervalMs);

    return () => {
      cancelled = true;
      if (healthCheckTimerRef.current) {
        clearInterval(healthCheckTimerRef.current);
        healthCheckTimerRef.current = null;
      }
    };
  }, [vitePort, enabled, healthCheckIntervalMs]);

  // --- SSE integration: bump refreshKey on file changes ---
  const handleProjectEvent = useCallback((evt: ProjectEvent) => {
    if (evt.type === 'file-changed') {
      // Bump the refresh key so the iframe reloads as a safety net.
      // Vite HMR handles most updates natively, but this ensures a
      // full reload for changes that HMR might miss (e.g. config changes,
      // new files that aren't imported yet).
      setRefreshKey((prev) => prev + 1);
    }
  }, []);

  useProjectFileEvents(
    projectId,
    enabled,
    handleProjectEvent,
  );

  // --- Actions ---
  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const setPort = useCallback((port: number) => {
    if (port > 0 && port < 65536) {
      setManuallySetPort(port);
      setVitePort(port);
      setError(null);
    }
  }, []);

  // --- Computed ---
  const previewUrl = buildPreviewUrl(vitePort);

  return {
    previewUrl,
    vitePort,
    serverOnline,
    detecting,
    error,
    refresh,
    setPort,
    refreshKey,
  };
}

// ---------------------------------------------------------------------------
// Convenience hook: URL only
// ---------------------------------------------------------------------------

/**
 * Get just the Vite preview URL for a project.
 *
 * Lightweight alternative to `useVitePreview` when you only need the URL
 * and don't care about server status or refresh controls.
 *
 * @param projectId - The OD project ID.
 * @returns The preview URL string (e.g. `http://localhost:5173`).
 */
export function useVitePreviewUrl(projectId: string): string {
  const { previewUrl } = useVitePreview(projectId, { enabled: true });
  return previewUrl;
}
