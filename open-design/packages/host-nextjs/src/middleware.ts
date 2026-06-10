/**
 * Next.js middleware injection helper for the host bridge.
 *
 * When running in Next.js mode, the OD daemon may need to inject
 * middleware into the user's Next.js project to:
 * - Install the `window.__od__` bridge script on every page
 * - Provide auth session context to the OD bridge
 * - Rewrite API requests to the daemon when appropriate
 *
 * This module provides utilities to detect, validate, and (with user
 * consent) modify the project's `middleware.ts` file.
 *
 * IMPORTANT: Middleware injection is opt-in and always requires user
 * confirmation. OD never silently modifies the user's middleware.
 */

import type { NextjsPlatform } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of scanning a Next.js project for existing middleware. */
export interface MiddlewareScanResult {
  /** Whether a middleware.ts/js file exists at the project root. */
  exists: boolean;
  /** The file extension found ('.ts', '.js', '.mjs', or null). */
  extension: '.ts' | '.js' | '.mjs' | null;
  /** Whether the OD bridge import is already present. */
  hasOdBridgeImport: boolean;
  /** Whether the OD matcher config is already present. */
  hasOdMatcher: boolean;
}

/** Options for injecting the OD middleware snippet. */
export interface MiddlewareInjectionOptions {
  /** The daemon base URL (e.g., "http://localhost:3847"). */
  daemonBaseUrl: string;
  /** The project root directory. */
  projectRoot: string;
  /** Whether to create middleware.ts if it doesn't exist. */
  createIfMissing?: boolean;
  /** The detected platform (affects path separators). */
  platform?: NextjsPlatform;
}

/** Result of a middleware injection attempt. */
export interface MiddlewareInjectionResult {
  /** Whether the injection was successful. */
  ok: boolean;
  /** Human-readable description of what happened. */
  message: string;
  /** The file path that was created or modified. */
  filePath: string | null;
  /** Whether a backup was created before modification. */
  backupCreated: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Marker comment used to identify OD-injected middleware code. */
const OD_MIDDLEWARE_MARKER = '/* @od-bridge-inject */';

/** The OD middleware snippet template. */
const OD_MIDDLEWARE_SNIPPET = `${OD_MIDDLEWARE_MARKER}
import { installNextjsHostBridge } from '@open-design/host-nextjs';
// Initialize the OD host bridge so window.__od__ is available in the browser.
// This runs once when the middleware module is loaded.
if (typeof globalThis !== 'undefined' && !globalThis.__od) {
  installNextjsHostBridge(process.env.OD_DAEMON_URL || 'http://localhost:3847');
}`;

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

/**
 * Scan a Next.js project directory for existing middleware.
 *
 * Checks for `middleware.ts`, `middleware.js`, and `middleware.mjs`
 * at the project root (or `src/` if using the src directory layout).
 */
export function scanMiddlewareFiles(files: string[]): MiddlewareScanResult {
  const middlewareFiles = ['middleware.ts', 'middleware.js', 'middleware.mjs'];
  const srcMiddlewareFiles = ['src/middleware.ts', 'src/middleware.js', 'src/middleware.mjs'];

  const allCandidates = [...middlewareFiles, ...srcMiddlewareFiles];

  let found: string | null = null;
  for (const candidate of allCandidates) {
    if (files.some((f) => f === candidate)) {
      found = candidate;
      break;
    }
  }

  if (!found) {
    return {
      exists: false,
      extension: null,
      hasOdBridgeImport: false,
      hasOdMatcher: false,
    };
  }

  const ext = found.endsWith('.ts')
    ? '.ts' as const
    : found.endsWith('.mjs')
      ? '.mjs' as const
      : '.js' as const;

  return {
    exists: true,
    extension: ext,
    hasOdBridgeImport: false,
    hasOdMatcher: false,
  };
}

// ---------------------------------------------------------------------------
// Template generation
// ---------------------------------------------------------------------------

/**
 * Generate the middleware file content for a Next.js project that
 * doesn't already have one.
 */
export function generateMiddlewareTemplate(daemonBaseUrl: string): string {
  return `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

${OD_MIDDLEWARE_SNIPPET.replace('http://localhost:3847', daemonBaseUrl)}

export function middleware(request: NextRequest) {
  // OD does not intercept any requests — all routes pass through.
  // The middleware file exists solely to initialize window.__od__
  // when the Next.js server process starts.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // OD bridge: inject on all page routes (does not block API routes)
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
`;
}

/**
 * Generate the import snippet to inject into an existing middleware file.
 */
export function generateBridgeImportSnippet(daemonBaseUrl: string): string {
  return OD_MIDDLEWARE_SNIPPET.replace('http://localhost:3847', daemonBaseUrl);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check whether a middleware file content already contains the OD bridge.
 */
export function middlewareHasOdBridge(content: string): boolean {
  return content.includes(OD_MIDDLEWARE_MARKER) ||
    content.includes('@open-design/host-nextjs') ||
    content.includes('installNextjsHostBridge');
}

/**
 * Validate that a middleware file is safe to modify.
 */
export function isMiddlewareSafeToModify(content: string): boolean {
  if (middlewareHasOdBridge(content)) return true;
  if (content.includes('NextResponse.next()') && !content.includes('rewrite') && !content.includes('redirect')) {
    return true;
  }
  return false;
}
