/**
 * Next.js Host Bridge — type definitions.
 *
 * These types extend the generic host bridge types with Next.js-specific
 * options and results. Unlike the Tauri bridge (which uses native IPC),
 * the Next.js bridge communicates via daemon API routes and Web APIs.
 */

/** Options for browser data clearing in a Next.js context. */
export interface NextjsBrowserClearDataOptions {
  /** Clear the Cache Storage API entries used by the preview iframe. */
  cache?: boolean;
  /** Clear service worker registrations for the preview origin. */
  serviceWorkers?: boolean;
  /** Clear localStorage for the preview origin. */
  localStorage?: boolean;
}

/** Options for page capture (screenshot) via the Next.js bridge. */
export interface NextjsPdfPrintOptions {
  /** URL to capture. Defaults to the project preview URL. */
  url?: string;
  /** Output format. */
  format?: 'png' | 'pdf';
  /** Viewport width in pixels. */
  width?: number;
  /** Viewport height in pixels. */
  height?: number;
}

/** Result of a page capture operation. */
export interface NextjsCaptureResult {
  /** Base64-encoded image/png data. */
  base64: string;
  /** MIME type of the captured data. */
  mimeType: string;
  /** Width of the captured image in pixels. */
  width: number;
  /** Height of the captured image in pixels. */
  height: number;
}

/** Result of a Prisma schema validation. */
export interface PrismaValidationResult {
  /** Whether the schema is valid. */
  valid: boolean;
  /** Error messages if invalid. */
  errors: string[];
  /** Warning messages. */
  warnings: string[];
}

/** Result of a Prisma migration operation. */
export interface PrismaMigrationResult {
  /** Whether the migration succeeded. */
  success: boolean;
  /** SQL that was applied (or would be applied in dry-run). */
  sql?: string;
  /** Error message if the migration failed. */
  error?: string;
}

/** Next.js dev server status. */
export interface NextjsDevServerStatus {
  /** Whether the dev server is running and reachable. */
  running: boolean;
  /** The port the dev server is listening on. */
  port: number;
  /** URL of the dev server. */
  url: string;
  /** Whether the dev server requires a restart (after middleware/config change). */
  requiresRestart: boolean;
}
