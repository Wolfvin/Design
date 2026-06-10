/**
 * Preview Switcher — Vite HMR vs Legacy iframe preview mode.
 *
 * Provides a `usePreview()` hook that automatically switches between the
 * Vite HMR live preview and the legacy iframe srcdoc preview, based on
 * the active skill's frontmatter configuration.
 *
 * Mode selection logic:
 *   - `od.mode: design` or `od.outputFormat: artifact` → legacy mode
 *     (design-centric skills that produce HTML artifacts)
 *   - `od.outputFormat: file-edit` or no active skill → Vite mode
 *     (app developer skills that write files to disk)
 *
 * Mode preference is persisted to localStorage so it survives page reloads.
 * The user can also manually override the mode via `switchToVite()` /
 * `switchToLegacy()`.
 *
 * Part of the Open Design App Developer migration (Phase 7.3, GAP 4).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useVitePreview,
  type VitePreviewState,
} from './vite-preview';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Skill frontmatter shape used for mode auto-detection. */
export interface SkillFrontmatter {
  od?: {
    mode?: string;
    outputFormat?: string;
  };
}

/** State returned by `usePreview`. */
export interface PreviewSwitcherState {
  /** Current preview mode. */
  mode: 'vite' | 'legacy';
  /** Vite preview state (non-null when mode is 'vite'). */
  viteState: VitePreviewState | null;
  /** Legacy preview URL (non-null when mode is 'legacy'). */
  legacyPreviewUrl: string | null;
  /** Switch to Vite HMR mode. */
  switchToVite: () => void;
  /** Switch to legacy iframe mode. */
  switchToLegacy: () => void;
  /** Auto-detect the best mode based on the active skill's frontmatter. */
  autoDetect: (skillFrontmatter?: SkillFrontmatter) => void;
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
function readPersistedMode(projectId: string): 'vite' | 'legacy' | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (raw === 'vite' || raw === 'legacy') return raw;
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.)
  }
  return null;
}

/**
 * Persist the mode preference to localStorage.
 */
function persistMode(projectId: string, mode: 'vite' | 'legacy'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(projectId), mode);
  } catch {
    // Ignore quota / private mode failures
  }
}

/**
 * Determine the appropriate preview mode from a skill's frontmatter.
 *
 * Returns 'legacy' for design/artifact skills, 'vite' for file-edit / no skill.
 */
function detectModeFromFrontmatter(fm?: SkillFrontmatter): 'vite' | 'legacy' {
  if (!fm?.od) return 'vite';

  const { mode, outputFormat } = fm.od;

  // Design mode → always legacy (produces HTML artifacts)
  if (mode === 'design') return 'legacy';

  // Artifact output format → legacy
  if (outputFormat === 'artifact') return 'legacy';

  // File-edit output format → Vite
  if (outputFormat === 'file-edit') return 'vite';

  // Default to Vite for app developer mode
  return 'vite';
}

// ---------------------------------------------------------------------------
// Legacy preview URL builder
// ---------------------------------------------------------------------------

/**
 * Build the legacy preview URL for a project.
 *
 * The legacy preview uses the daemon's existing artifact preview endpoint,
 * which renders the project's current artifact via iframe srcdoc.
 */
function buildLegacyPreviewUrl(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/preview`;
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

/**
 * Switch between Vite HMR preview and legacy iframe preview.
 *
 * Auto-detects the appropriate mode from the active skill's frontmatter
 * and persists the user's manual preference to localStorage.
 *
 * @param projectId - The OD project ID.
 * @returns A `PreviewSwitcherState` object for driving the preview UI.
 *
 * @example
 * ```tsx
 * function MyPreviewArea({ projectId, activeSkill }) {
 *   const { mode, viteState, legacyPreviewUrl, switchToVite, switchToLegacy } = usePreview(projectId);
 *
 *   // Auto-detect when skill changes
 *   useEffect(() => {
 *     autoDetect(activeSkill?.frontmatter);
 *   }, [activeSkill]);
 *
 *   if (mode === 'vite' && viteState?.serverOnline) {
 *     return <iframe src={viteState.previewUrl} />;
 *   }
 *   if (mode === 'legacy' && legacyPreviewUrl) {
 *     return <iframe src={legacyPreviewUrl} />;
 *   }
 *   return <div>No preview available</div>;
 * }
 * ```
 */
export function usePreview(projectId: string): PreviewSwitcherState {
  // ---- Mode state ----
  const [mode, setMode] = useState<'vite' | 'legacy'>(() => {
    const persisted = readPersistedMode(projectId);
    return persisted ?? 'vite';
  });

  // Track whether the user has manually overridden the mode
  const manuallyOverriddenRef = useRef(false);

  // ---- Vite preview state ----
  const viteState: VitePreviewState = useVitePreview(projectId, {
    enabled: mode === 'vite',
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

  const switchToLegacy = useCallback(() => {
    manuallyOverriddenRef.current = true;
    setMode('legacy');
  }, []);

  const autoDetect = useCallback((skillFrontmatter?: SkillFrontmatter) => {
    // Don't override a manual user preference
    if (manuallyOverriddenRef.current) return;

    const detected = detectModeFromFrontmatter(skillFrontmatter);
    setMode(detected);
  }, []);

  // ---- Smooth transition ----
  // When switching modes, we need to ensure no layout shift occurs.
  // The consumer is responsible for using the same container dimensions
  // for both Vite and legacy iframes. We provide a stable interface
  // so the consumer can use `key={mode}` to force a clean remount
  // without flicker.

  return {
    mode,
    viteState: mode === 'vite' ? viteState : null,
    legacyPreviewUrl,
    switchToVite,
    switchToLegacy,
    autoDetect,
  };
}
