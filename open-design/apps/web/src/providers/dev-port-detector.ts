/**
 * Unified dev server port detection utilities.
 *
 * Supports both Vite (Tauri/plain Vite projects) and Next.js dev servers.
 * This is the Next.js-aware replacement for the Vite-only port detector.
 *
 * Detection priority for Vite:
 *   1. `vite.config.*` → `server.port` field
 *   2. `package.json` scripts → `--port` flag
 *   3. `tauri.conf.json` → `build.devUrl` port
 *   4. Fallback → 5173 (Vite default)
 *
 * Detection priority for Next.js:
 *   1. `next.config.*` → `devServer.port` field
 *   2. `package.json` scripts → `--port` or `-p` flag
 *   3. Fallback → 3000 (Next.js default)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of port auto-detection. */
export interface PortDetectionResult {
  /** The detected port number. */
  port: number;
  /** Which source the port was read from. */
  source: 'vite-config' | 'nextjs-config' | 'package-json' | 'tauri-config' | 'default';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Vite's default dev server port. */
export const VITE_DEFAULT_PORT = 5173;

/** Next.js default dev server port. */
export const NEXTJS_DEFAULT_PORT = 3000;

/** Timeout for server health check requests (ms). */
export const HEALTH_CHECK_TIMEOUT_MS = 2000;

/** Interval between periodic health checks (ms). */
export const HEALTH_CHECK_INTERVAL_MS = 5000;

/** Config file candidates for Vite. */
const VITE_CONFIG_CANDIDATES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.js',
  'vite.config.mjs',
] as const;

/** Config file candidates for Next.js. */
const NEXTJS_CONFIG_CANDIDATES = [
  'next.config.ts',
  'next.config.mts',
  'next.config.js',
  'next.config.mjs',
] as const;

// ---------------------------------------------------------------------------
// Internal: file content fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a project file's text content via the daemon API.
 */
async function fetchProjectFileText(
  projectId: string,
  filePath: string,
): Promise<string | undefined> {
  try {
    const resp = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(filePath)}`,
    );
    if (!resp.ok) return undefined;
    return await resp.text();
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Internal: config parsers
// ---------------------------------------------------------------------------

function tryParseJson(text: string | undefined): Record<string, unknown> | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function extractPortFromViteConfig(content: string | undefined): number | null {
  if (!content) return null;
  const portMatch = content.match(/server\s*:\s*\{[^}]*port\s*:\s*(\d+)/s);
  if (portMatch?.[1]) {
    const port = parseInt(portMatch[1], 10);
    if (port > 0 && port < 65536) return port;
  }
  const fallbackMatch = content.match(/port\s*:\s*(\d+)/);
  if (fallbackMatch?.[1]) {
    const port = parseInt(fallbackMatch[1], 10);
    if (port > 0 && port < 65536) return port;
  }
  return null;
}

/**
 * Extract port from a Next.js config file.
 * Matches `devServer: { port: <number> }`.
 */
function extractPortFromNextjsConfig(content: string | undefined): number | null {
  if (!content) return null;
  const portMatch = content.match(/devServer\s*:\s*\{[^}]*port\s*:\s*(\d+)/s);
  if (portMatch?.[1]) {
    const port = parseInt(portMatch[1], 10);
    if (port > 0 && port < 65536) return port;
  }
  return null;
}

function extractPortFromPackageJson(
  pkgJson: Record<string, unknown> | undefined,
  isNextjs?: boolean,
): number | null {
  if (!pkgJson) return null;
  const scripts = pkgJson['scripts'] as Record<string, string> | undefined;
  if (!scripts) return null;

  for (const scriptBody of Object.values(scripts)) {
    if (typeof scriptBody !== 'string') continue;
    // Match --port <number> or --port=<number>
    const portMatch = scriptBody.match(/--port[=\s]+(\d+)/);
    if (portMatch?.[1]) {
      const port = parseInt(portMatch[1], 10);
      if (port > 0 && port < 65536) return port;
    }
    // Next.js also supports -p <number>
    if (isNextjs) {
      const pMatch = scriptBody.match(/-p\s+(\d+)/);
      if (pMatch?.[1]) {
        const port = parseInt(pMatch[1], 10);
        if (port > 0 && port < 65536) return port;
      }
    }
  }
  return null;
}

function extractPortFromTauriConfig(
  tauriConf: Record<string, unknown> | undefined,
): number | null {
  if (!tauriConf) return null;
  const build = tauriConf['build'] as Record<string, unknown> | undefined;
  if (!build) return null;

  const devUrl = build['devUrl'] as string | undefined;
  if (devUrl) {
    try {
      const url = new URL(devUrl);
      const port = parseInt(url.port, 10);
      if (port > 0 && port < 65536) return port;
    } catch { /* ignore */ }
  }

  const beforeDevCommand = build['beforeDevCommand'] as string | undefined;
  if (typeof beforeDevCommand === 'string') {
    const portMatch = beforeDevCommand.match(/--port[=\s]+(\d+)/);
    if (portMatch?.[1]) {
      const port = parseInt(portMatch[1], 10);
      if (port > 0 && port < 65536) return port;
    }
  }

  const devPath = build['devPath'] as string | undefined;
  if (typeof devPath === 'string') {
    try {
      const url = new URL(devPath);
      const port = parseInt(url.port, 10);
      if (port > 0 && port < 65536) return port;
    } catch { /* ignore */ }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Auto-detect the dev server port for a Next.js project.
 */
export async function autoDetectNextjsPort(projectId: string): Promise<PortDetectionResult> {
  // 1. Check next.config.* for devServer.port
  for (const candidate of NEXTJS_CONFIG_CANDIDATES) {
    const content = await fetchProjectFileText(projectId, candidate);
    const port = extractPortFromNextjsConfig(content);
    if (port !== null) {
      return { port, source: 'nextjs-config' };
    }
  }

  // 2. Check package.json scripts for --port / -p flag
  const pkgContent = await fetchProjectFileText(projectId, 'package.json');
  const pkgJson = tryParseJson(pkgContent);
  const pkgPort = extractPortFromPackageJson(pkgJson, true);
  if (pkgPort !== null) {
    return { port: pkgPort, source: 'package-json' };
  }

  // 3. Fallback to Next.js default
  return { port: NEXTJS_DEFAULT_PORT, source: 'default' };
}

/**
 * Auto-detect the Vite dev server port (backward-compatible).
 */
export async function autoDetectVitePort(projectId: string): Promise<PortDetectionResult> {
  // 1. Check vite.config.* for server.port
  for (const candidate of VITE_CONFIG_CANDIDATES) {
    const content = await fetchProjectFileText(projectId, candidate);
    const port = extractPortFromViteConfig(content);
    if (port !== null) {
      return { port, source: 'vite-config' };
    }
  }

  // 2. Check package.json scripts
  const pkgContent = await fetchProjectFileText(projectId, 'package.json');
  const pkgJson = tryParseJson(pkgContent);
  const pkgPort = extractPortFromPackageJson(pkgJson);
  if (pkgPort !== null) {
    return { port: pkgPort, source: 'package-json' };
  }

  // 3. Check tauri.conf.json
  const tauriContent = await fetchProjectFileText(projectId, 'src-tauri/tauri.conf.json');
  const tauriConf = tryParseJson(tauriContent);
  const tauriPort = extractPortFromTauriConfig(tauriConf);
  if (tauriPort !== null) {
    return { port: tauriPort, source: 'tauri-config' };
  }

  // 4. Fallback
  return { port: VITE_DEFAULT_PORT, source: 'default' };
}

/**
 * Unified auto-detect — selects Vite or Next.js detection based on project type.
 */
export async function autoDetectDevPort(
  projectId: string,
  projectType?: string,
): Promise<PortDetectionResult> {
  if (projectType?.startsWith('nextjs')) {
    return autoDetectNextjsPort(projectId);
  }
  return autoDetectVitePort(projectId);
}

/**
 * Check whether a dev server is online at the given port.
 */
export async function checkDevServerOnline(
  port: number,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(`http://localhost:${port}`, {
      signal: controller.signal,
      mode: 'no-cors',
      cache: 'no-store',
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Re-export Vite-specific functions for backward compatibility
export {
  detectPortFromViteConfig,
  detectPortFromPackageJson,
  detectPortFromTauriConfig,
  checkViteServerOnline,
} from './vite-port-detector.js';
