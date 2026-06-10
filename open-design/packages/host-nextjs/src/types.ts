/**
 * Next.js (browser) specific types for the host bridge.
 *
 * These types describe the request/response shapes that flow through
 * the daemon REST API when running in browser/Next.js mode.
 */

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export type NextjsPlatform = 'windows' | 'macos' | 'linux' | 'unknown';

// ---------------------------------------------------------------------------
// Project commands (via daemon REST API)
// ---------------------------------------------------------------------------

/** Init options for importing a project via the daemon API. */
export type NextjsProjectImportInit = {
  designSystemId?: string | null;
  name?: string;
  skillId?: string | null;
};

/** Successful response from daemon project import. */
export type NextjsProjectImportSuccess = {
  conversationId: string;
  entryFile: string | null;
  projectId: string;
};

/** Full result from project import — success, cancel, or error. */
export type NextjsProjectImportResult =
  | ({ ok: true } & NextjsProjectImportSuccess)
  | { canceled: true; ok: false }
  | { ok: false; reason: string; details?: unknown };

/** Successful response from replace working dir. */
export type NextjsReplaceWorkingDirSuccess = {
  baseDir: string;
  entryFile: string | null;
};

/** Full result from replace working dir. */
export type NextjsReplaceWorkingDirResult =
  | ({ ok: true } & NextjsReplaceWorkingDirSuccess)
  | { canceled: true; ok: false }
  | { ok: false; reason: string; details?: unknown };

// ---------------------------------------------------------------------------
// Capture (via daemon API)
// ---------------------------------------------------------------------------

/** Options for screenshot capture via daemon API. */
export type NextjsCaptureOptions = {
  url?: string;
  clip?: { x: number; y: number; width: number; height: number };
};

/** Capture result — base64 encoded image. */
export type NextjsCaptureResult = {
  dataUrl: string;
  h: number;
  ok: true;
  w: number;
} | { ok: false; reason: string; details?: unknown };

// ---------------------------------------------------------------------------
// Browser data management
// ---------------------------------------------------------------------------

/** Options for clearing browser data via the host bridge. */
export type NextjsBrowserClearDataOptions = {
  /** Clear Cache API data. */
  cache?: boolean;
  /** Clear localStorage data. */
  localStorage?: boolean;
  /** Clear sessionStorage data. */
  sessionStorage?: boolean;
  /** Clear service workers. */
  serviceWorkers?: boolean;
  /** Clear IndexedDB databases. */
  indexedDB?: boolean;
  /** Clear all data (overrides individual flags). */
  all?: boolean;
};

// ---------------------------------------------------------------------------
// PDF printing
// ---------------------------------------------------------------------------

/** Options for PDF printing in browser/Next.js context. */
export type NextjsPdfPrintOptions = {
  /** The URL to print. */
  url: string;
  /** Paper size (e.g., 'A4', 'Letter'). */
  paperSize?: 'A4' | 'Letter' | 'Legal' | 'Tabloid';
  /** Whether to print in landscape orientation. */
  landscape?: boolean;
  /** Whether to include background graphics. */
  printBackground?: boolean;
  /** Margin in mm (top, right, bottom, left). */
  margins?: { top: number; right: number; bottom: number; left: number };
};
