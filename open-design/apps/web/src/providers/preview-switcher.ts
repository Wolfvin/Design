/**
 * Preview Switcher — Vite HMR / Next.js Fast Refresh / Legacy iframe preview.
 *
 * Provides a `usePreview()` hook that automatically switches between
 * the Vite HMR live preview, Next.js Fast Refresh preview, and the
 * legacy iframe srcdoc preview, based on the active skill's
 * frontmatter configuration and the project type.
 *
 * Mode selection logic:
 *   - `od.mode: design` or `od.outputFormat: artifact` → legacy mode
 *     (design-centric skills that produce HTML artifacts)
 *   - `od.outputFormat: file-edit` or no active skill → auto-detect
 *     based on project type: Next.js projects → nextjs mode,
 *     Vite/Tauri projects → vite mode
 *
 * Mode preference is persisted to localStorage so it survives page reloads.
 * The user can also manually override the mode via `switchToVite()` /
 * `switchToNextjs()` / `switchToLegacy()`.
 *
 * Part of the Open Design App Developer migration (Phase 5 — Next.js mode).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useVitePreview,
  type VitePreviewState,
} from './vite-preview';
import {
  useNextjsPreview,
  type NextjsPreviewState,
} from './nextjs-preview';
import {
  autoDetectDevPort,
  type PortDetectionResult,
} from './dev-port-detector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Preview mode — extended with 'nextjs' for Next.js Fast Refresh. */
export type PreviewMode = 'vite' | 'nextjs' | 'legacy';

/** Skill frontmatter shape used for mode auto-detection. */
export interface SkillFrontmatter {
  od?: {
    mode?: string;
    outputFormat?: string;
    stackCompat?: string[];
  };
}

/** State returned by `usePreview`. */
export interface PreviewSwitcherState {
  /** Current preview mode. */
  mode: PreviewMode;
  /** Vite preview state (non-null when mode is 'vite'). */
  viteState: VitePreviewState | null;
  /** Next.js preview state (non-null when mode is 'nextjs'). */
  nextjsState: NextjsPreviewState | null;
  /** Legacy preview URL (non-null when mode is 'legacy'). */
  legacyPreviewUrl: string | null;
  /** Switch to Vite HMR mode. */
  switchToVite: () => void;
  /** Switch to Next.js Fast Refresh mode. */
  switchToNextjs: () => void;
  /** Switch to legacy iframe mode. */
  switchToLegacy: () => void;
  /** Auto-detect the best mode based on the active skill's frontmatter and project type. */
  autoDetect: (skillFrontmatter?: SkillFrontmatter, projectType?: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'open-design:preview-mode:';

/**
 * Build the localStorage key for a project's preview mode preference.
 */
function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

/**
 * Read the persisted mode preference from localStorage.
 */
function readPersistedMode(projectId: string): PreviewMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (raw === 'vite' || raw === 'nextjs' || raw === 'legacy') return raw;
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.)
  }
  return null;
}

/**
 * Persist the mode preference to localStorage.
 */
function persistMode(projectId: string, mode: PreviewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(projectId), mode);
  } catch {
    // Ignore quota / private mode failures
  }
}

/**
 * Determine the appropriate preview mode from a skill's frontmatter
 * and the project type.
 *
 * Returns 'legacy' for design/artifact skills, 'nextjs' for Next.js
 * file-edit skills, and 'vite' for Vite/Tauri file-edit skills.
 */
function detectModeFromFrontmatter(
  fm?: SkillFrontmatter,
  projectType?: string,
): PreviewMode {
  if (!fm?.od) {
    // No skill frontmatter — choose based on project type
    return projectType?.startsWith('nextjs') ? 'nextjs' : 'vite';
  }

  const { mode, outputFormat, stackCompat } = fm.od;

  // Design mode → always legacy (produces HTML artifacts)
  if (mode === 'design') return 'legacy';

  // Artifact output format → legacy
  if (outputFormat === 'artifact') return 'legacy';

  // File-edit output format → choose based on project type
  if (outputFormat === 'file-edit') {
    return projectType?.startsWith('nextjs') ? 'nextjs' : 'vite';
  }

  // Stack compatibility hint
  if (Array.isArray(stackCompat)) {
    if (stackCompat.some((s) => s.startsWith('nextjs'))) return 'nextjs';
    if (stackCompat.some((s) => s.startsWith('tauri'))) return 'vite';
  }

  // Default: auto-detect from project type
  return projectType?.startsWith('nextjs') ? 'nextjs' : 'vite';
}

// ---------------------------------------------------------------------------
// Legacy preview URL builder
// ---------------------------------------------------------------------------

/**
 * Build the legacy preview URL for a project.
 */
function buildLegacyPreviewUrl(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/preview`;
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

/**
 * Switch between Vite HMR, Next.js Fast Refresh, and legacy iframe preview.
 *
 * Auto-detects the appropriate mode from the active skill's frontmatter
 * and project type, and persists the user's manual preference to localStorage.
 *
 * @param projectId - The OD project ID.
 * @param options - Optional configuration (daemonBaseUrl, etc.)
 * @returns A `PreviewSwitcherState` object for driving the preview UI.
 */
export function usePreview(
  projectId: string,
  options?: { daemonBaseUrl?: string },
): PreviewSwitcherState {
  const { daemonBaseUrl } = options ?? {};

  // ---- Mode state ----
  const [mode, setMode] = useState<PreviewMode>(() => {
    const persisted = readPersistedMode(projectId);
    return persisted ?? 'vite';
  });

  // Track whether the user has manually overridden the mode
  const manuallyOverriddenRef = useRef(false);

  // ---- Vite preview state ----
  const viteState: VitePreviewState = useVitePreview(projectId, {
    enabled: mode === 'vite',
  });

  // ---- Next.js preview state ----
  const nextjsState: NextjsPreviewState = useNextjsPreview({
    projectId,
    daemonBaseUrl,
  });

  // ---- Legacy preview URL ----
  const legacyPreviewUrl = mode === 'legacy'
    ? buildLegacyPreviewUrl(projectId)
    : null;

  // ---- Persist mode changes ----
  useEffect(() => {
    persistMode(projectId, mode);
  }, [projectId, mode]);

  // ---- Re-read persisted mode on projectId change ----
  useEffect(() => {
    const persisted = readPersistedMode(projectId);
    if (persisted) {
      setMode(persisted);
    } else {
      setMode('vite');
    }
    manuallyOverriddenRef.current = false;
  }, [projectId]);

  // ---- Actions ----

  const switchToVite = useCallback(() => {
    manuallyOverriddenRef.current = true;
    setMode('vite');
  }, []);

  const switchToNextjs = useCallback(() => {
    manuallyOverriddenRef.current = true;
    setMode('nextjs');
  }, []);

  const switchToLegacy = useCallback(() => {
    manuallyOverriddenRef.current = true;
    setMode('legacy');
  }, []);

  const autoDetect = useCallback(
    (skillFrontmatter?: SkillFrontmatter, projectType?: string) => {
      // Don't override a manual user preference
      if (manuallyOverriddenRef.current) return;

      const detected = detectModeFromFrontmatter(skillFrontmatter, projectType);
      setMode(detected);
    },
    [],
  );

  return {
    mode,
    viteState: mode === 'vite' ? viteState : null,
    nextjsState: mode === 'nextjs' ? nextjsState : null,
    legacyPreviewUrl,
    switchToVite,
    switchToNextjs,
    switchToLegacy,
    autoDetect,
  };
}
