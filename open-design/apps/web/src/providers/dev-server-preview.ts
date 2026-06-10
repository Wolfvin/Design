/**
 * Unified Dev Server Preview — supports Vite HMR and Next.js Fast Refresh.
 *
 * This is the main preview hook that automatically selects the correct
 * preview mechanism based on the project type:
 *   - Tauri/Vite projects → Vite HMR via useVitePreview()
 *   - Next.js projects → Next.js Fast Refresh via useNextjsPreview()
 *
 * The hook also falls back to the legacy iframe preview for design
 * mode skills.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVitePreview, type VitePreviewState } from './vite-preview';
import {
  useDevPortDetector,
  devServerTypeFromProjectType,
  type DevServerType,
} from './dev-port-detector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreviewMode = 'vite' | 'nextjs' | 'legacy';

export interface DevServerPreviewState {
  /** Current preview mode. */
  mode: PreviewMode;
  /** Preview URL (Vite HMR or Next.js Fast Refresh). */
  previewUrl: string | null;
  /** Whether the dev server is online and reachable. */
  serverOnline: boolean;
  /** Dev server type. */
  serverType: DevServerType;
  /** Detected dev port. */
  devPort: number;
  /** Vite preview state (when mode is 'vite'). */
  viteState: VitePreviewState | null;
  /** Whether the server is being checked. */
  checking: boolean;
  /** Refresh the server status check. */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Unified dev server preview hook.
 *
 * Automatically detects the project type and selects the appropriate
 * preview mechanism (Vite HMR or Next.js Fast Refresh).
 */
export function useDevServerPreview(
  projectId: string,
  projectType?: string,
): DevServerPreviewState {
  const serverType = devServerTypeFromProjectType(projectType);
  const mode: PreviewMode = serverType === 'nextjs' ? 'nextjs' : 'vite';

  // Port detection
  const { port: devPort, detect: redetectPort } = useDevPortDetector(
    projectId,
    projectType,
  );

  // Vite preview (for Tauri/Vite projects)
  const viteState: VitePreviewState = useVitePreview(projectId, {
    enabled: mode === 'vite',
  });

  // Next.js preview state
  const [nextjsOnline, setNextjsOnline] = useState(false);
  const [nextjsChecking, setNextjsChecking] = useState(false);

  // Check Next.js dev server reachability
  const checkNextjsServer = useCallback(async () => {
    if (mode !== 'nextjs') return;
    setNextjsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`http://localhost:${devPort}`, {
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setNextjsOnline(true);
    } catch {
      setNextjsOnline(false);
    } finally {
      setNextjsChecking(false);
    }
  }, [mode, devPort]);

  useEffect(() => {
    if (mode === 'nextjs') {
      checkNextjsServer();
      // Re-check every 5 seconds
      const interval = setInterval(checkNextjsServer, 5000);
      return () => clearInterval(interval);
    }
  }, [mode, checkNextjsServer]);

  // Build preview URL
  const previewUrl = useMemo(() => {
    if (mode === 'nextjs' && nextjsOnline) {
      return `http://localhost:${devPort}`;
    }
    if (mode === 'vite' && viteState.serverOnline) {
      return viteState.previewUrl;
    }
    return null;
  }, [mode, devPort, nextjsOnline, viteState.serverOnline, viteState.previewUrl]);

  // Refresh function
  const refresh = useCallback(() => {
    redetectPort();
    if (mode === 'nextjs') {
      checkNextjsServer();
    }
  }, [mode, redetectPort, checkNextjsServer]);

  return {
    mode,
    previewUrl,
    serverOnline: mode === 'nextjs' ? nextjsOnline : viteState.serverOnline,
    serverType,
    devPort,
    viteState: mode === 'vite' ? viteState : null,
    checking: mode === 'nextjs' ? nextjsChecking : viteState.checking,
    refresh,
  };
}
