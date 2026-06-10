/**
 * Unified dev server preview provider.
 *
 * Provides a single interface for preview that automatically selects
 * the appropriate mechanism based on project type:
 * - Vite HMR for Tauri / plain Vite projects
 * - Next.js Fast Refresh for Next.js projects
 * - Legacy iframe srcdoc for design-mode skills
 *
 * This replaces the old `useVitePreview()` hook as the primary
 * preview entry point for app-developer mode.
 */

import { useState, useEffect, useCallback } from 'react';
import { useVitePreview } from './vite-preview.js';
import { useNextjsPreview, type NextjsPreviewState } from './nextjs-preview.js';
import {
  autoDetectDevPort,
  type PortDetectionResult,
} from './dev-port-detector.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DevServerType = 'vite' | 'nextjs' | 'legacy';

export interface DevServerPreviewState {
  /** Which preview mechanism is active. */
  serverType: DevServerType;
  /** Whether the dev server is online. */
  serverOnline: boolean;
  /** The URL for the preview. */
  previewUrl: string;
  /** The detected port. */
  port: number;
  /** Whether the preview is loading. */
  loading: boolean;
  /** Last error message. */
  error: string | null;
  /** Project type string from detection. */
  projectType: string;
  /** Whether a restart is needed (Next.js specific). */
  restartNeeded?: boolean;
}

export interface DevServerPreviewOptions {
  /** Project ID. */
  projectId: string;
  /** Project type (auto-detected if not provided). */
  projectType?: string;
  /** Override dev port. */
  port?: number;
  /** Daemon base URL. */
  daemonBaseUrl?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PORTS: Record<string, number> = {
  'tauri-react': 5173,
  'vite-react': 5173,
  'vite-vue': 5173,
  'nextjs-standalone': 3000,
  'nextjs-pages': 3000,
  'nextjs': 3000,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Unified dev server preview hook.
 *
 * Automatically selects the appropriate preview mechanism based on
 * project type and provides a consistent interface.
 */
export function useDevServerPreview(options: DevServerPreviewOptions): DevServerPreviewState {
  const { projectId, projectType: initialProjectType, port: initialPort, daemonBaseUrl } = options;

  const [projectType, setProjectType] = useState(initialProjectType ?? 'vite-react');
  const [detectedPort, setDetectedPort] = useState(initialPort ?? 5173);

  // Auto-detect project type and port on mount
  useEffect(() => {
    if (initialProjectType && initialPort) return;

    async function detect() {
      try {
        // Try daemon API first
        const base = daemonBaseUrl ?? '';
        const typeResp = await fetch(
          `${base}/api/projects/${encodeURIComponent(projectId)}/detect-type`,
          { method: 'POST' },
        );
        if (typeResp.ok) {
          const typeData = await typeResp.json();
          if (typeData.projectType) {
            setProjectType(typeData.projectType);
          }
        }

        const portResp = await fetch(
          `${base}/api/projects/${encodeURIComponent(projectId)}/detect-dev-port`,
          { method: 'POST' },
        );
        if (portResp.ok) {
          const portData = await portResp.json();
          if (portData.devPort) {
            setDetectedPort(portData.devPort);
          }
        }
      } catch {
        // Fall back to defaults
        setDetectedPort(DEFAULT_PORTS[projectType] ?? 5173);
      }
    }

    detect();
  }, [projectId, initialProjectType, initialPort, daemonBaseUrl, projectType]);

  // Determine server type from project type
  const isNextjs = projectType.startsWith('nextjs');

  // Use the appropriate sub-provider for each type
  const viteState = useVitePreview(projectId, {
    enabled: !isNextjs,
  });

  const nextjsState = useNextjsPreview({
    projectId,
    port: isNextjs ? detectedPort : undefined,
    daemonBaseUrl,
  });

  // Build unified state based on project type
  if (isNextjs) {
    return {
      serverType: 'nextjs',
      serverOnline: nextjsState.serverOnline,
      previewUrl: nextjsState.previewUrl,
      port: nextjsState.port,
      loading: nextjsState.loading,
      error: nextjsState.error,
      projectType,
      restartNeeded: nextjsState.restartNeeded,
    };
  }

  // Vite / Tauri projects — delegate to useVitePreview for health checking
  return {
    serverType: 'vite',
    serverOnline: viteState.serverOnline,
    previewUrl: viteState.previewUrl,
    port: viteState.port,
    loading: viteState.loading,
    error: viteState.error,
    projectType,
  };
}

/**
 * Determine the default port for a project type.
 */
export function getDefaultPort(projectType: string): number {
  return DEFAULT_PORTS[projectType] ?? 5173;
}

/**
 * Determine the dev server type for a project type.
 */
export function getDevServerType(projectType: string): DevServerType {
  if (projectType.startsWith('nextjs')) return 'nextjs';
  return 'vite';
}
