/**
 * Unified Dev Port Detector — supports Vite, Next.js, and Tauri.
 *
 * Auto-detects the dev server port by reading project configuration
 * files. For Next.js projects, it checks next.config.ts and package.json
 * scripts. For Tauri/Vite projects, it checks vite.config.ts,
 * package.json scripts, and tauri.conf.json.
 *
 * Fallback ports:
 *   - Vite: 5173
 *   - Next.js: 3000
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DevServerType = 'vite' | 'nextjs' | 'custom';

export interface DevPortDetectionResult {
  /** Detected port number. */
  port: number;
  /** How the port was determined. */
  source: 'config' | 'package-json' | 'tauri-config' | 'fallback';
  /** The type of dev server. */
  serverType: DevServerType;
}

// ---------------------------------------------------------------------------
// Default ports
// ---------------------------------------------------------------------------

const VITE_DEFAULT_PORT = 5173;
const NEXTJS_DEFAULT_PORT = 3000;

/**
 * Get the default port for a given server type.
 */
export function getDefaultDevPort(serverType: DevServerType): number {
  switch (serverType) {
    case 'nextjs':
      return NEXTJS_DEFAULT_PORT;
    case 'vite':
    case 'custom':
    default:
      return VITE_DEFAULT_PORT;
  }
}

/**
 * Determine the dev server type from a project type string.
 */
export function devServerTypeFromProjectType(projectType?: string): DevServerType {
  if (!projectType) return 'vite';
  if (projectType.startsWith('nextjs')) return 'nextjs';
  return 'vite';
}

// ---------------------------------------------------------------------------
// Server-side port detection (daemon API)
// ---------------------------------------------------------------------------

/**
 * Auto-detect the dev server port via the daemon API.
 *
 * The daemon reads project config files (vite.config.ts, next.config.ts,
 * package.json, tauri.conf.json) and returns the detected port.
 */
export async function autoDetectDevPort(
  projectId: string,
  projectType?: string,
): Promise<DevPortDetectionResult> {
  const serverType = devServerTypeFromProjectType(projectType);

  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/detect-dev-port`,
      { method: 'POST' },
    );

    if (res.ok) {
      const data = await res.json();
      return {
        port: data.port ?? getDefaultDevPort(serverType),
        source: data.source ?? 'fallback',
        serverType,
      };
    }
  } catch {
    // Daemon not reachable — use fallback
  }

  return {
    port: getDefaultDevPort(serverType),
    source: 'fallback',
    serverType,
  };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseDevPortDetectorOptions {
  /** Whether to enable auto-detection. Default: true. */
  enabled?: boolean;
  /** Manual port override. If set, auto-detection is skipped. */
  manualPort?: number;
}

export interface UseDevPortDetectorResult {
  /** The detected or manual port. */
  port: number;
  /** How the port was determined. */
  source: 'manual' | 'config' | 'package-json' | 'tauri-config' | 'fallback';
  /** The dev server type. */
  serverType: DevServerType;
  /** Whether detection is in progress. */
  loading: boolean;
  /** Re-run auto-detection. */
  detect: () => Promise<void>;
}

/**
 * React hook for detecting the dev server port.
 *
 * Auto-detects on mount and when the project ID changes. Can be
 * overridden with a manual port.
 */
export function useDevPortDetector(
  projectId: string,
  projectType?: string,
  options: UseDevPortDetectorOptions = {},
): UseDevPortDetectorResult {
  const { enabled = true, manualPort } = options;
  const serverType = devServerTypeFromProjectType(projectType);

  const [port, setPort] = useState<number>(() =>
    manualPort ?? getDefaultDevPort(serverType),
  );
  const [source, setSource] = useState<UseDevPortDetectorResult['source']>(
    manualPort ? 'manual' : 'fallback',
  );
  const [loading, setLoading] = useState(false);

  const detect = useCallback(async () => {
    if (!enabled || !projectId) return;
    setLoading(true);
    try {
      const result = await autoDetectDevPort(projectId, projectType);
      setPort(result.port);
      setSource(result.source);
    } finally {
      setLoading(false);
    }
  }, [projectId, projectType, enabled]);

  useEffect(() => {
    if (manualPort !== undefined) {
      setPort(manualPort);
      setSource('manual');
      return;
    }

    if (enabled && projectId) {
      detect();
    }
  }, [projectId, projectType, enabled, manualPort, detect]);

  return { port, source, serverType, loading, detect };
}
