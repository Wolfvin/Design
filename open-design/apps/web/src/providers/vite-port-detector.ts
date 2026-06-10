/**
 * Vite dev server port detection utilities.
 *
 * Inspects project configuration files to auto-detect the Vite dev server
 * port. Separated from the main provider for testability and reuse.
 *
 * Detection priority:
 *   1. `vite.config.*` → `server.port` field
 *   2. `package.json` scripts → `--port` flag
 *   3. `tauri.conf.json` → `build.devUrl` port
 *   4. Fallback → 5173 (Vite default)
 *
 * File reads go through the daemon's project file API so we can access
 * config files inside the project directory regardless of whether the
 * project is managed (.od/projects/) or folder-imported.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of port auto-detection. */
export interface PortDetectionResult {
  /** The detected port number. */
  port: number;
  /** Which source the port was read from. */
  source: 'vite-config' | 'package-json' | 'tauri-config' | 'default';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Vite's default dev server port. */
export const VITE_DEFAULT_PORT = 5173;

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

// ---------------------------------------------------------------------------
// Internal: file content fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a project file's text content via the daemon API.
 * Returns `undefined` on any error (404, network, parse).
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

/**
 * Try to parse JSON, returning undefined on failure.
 */
function tryParseJson(text: string | undefined): Record<string, unknown> | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Detect a Vite port from a `vite.config.*` file content.
 *
 * Matches `port: <number>` or `port: "<number>"` inside a server block.
 * The regex is intentionally broad to handle both JS object literals and
 * TypeScript with type annotations.
 */
function extractPortFromViteConfig(content: string | undefined): number | null {
  if (!content) return null;

  // Match `port: <number>` or `port: "<number>"` — handles both JS and TS
  const portMatch = content.match(/server\s*:\s*\{[^}]*port\s*:\s*(\d+)/s);
  if (portMatch?.[1]) {
    const port = parseInt(portMatch[1], 10);
    if (port > 0 && port < 65536) return port;
  }

  // Broader fallback: any `port: <digits>` in the file (less precise but
  // catches port definitions outside a server block, e.g. computed values)
  const fallbackMatch = content.match(/port\s*:\s*(\d+)/);
  if (fallbackMatch?.[1]) {
    const port = parseInt(fallbackMatch[1], 10);
    if (port > 0 && port < 65536) return port;
  }

  return null;
}

/**
 * Detect a Vite port from `package.json` scripts.
 *
 * Matches `--port <number>` or `--port=<number>` in any script value.
 */
function extractPortFromPackageJson(
  pkgJson: Record<string, unknown> | undefined,
): number | null {
  if (!pkgJson) return null;
  const scripts = pkgJson['scripts'] as Record<string, string> | undefined;
  if (!scripts) return null;

  for (const scriptBody of Object.values(scripts)) {
    if (typeof scriptBody !== 'string') continue;
    // Match `--port <number>` or `--port=<number>`
    const portMatch = scriptBody.match(/--port[=\s]+(\d+)/);
    if (portMatch?.[1]) {
      const port = parseInt(portMatch[1], 10);
      if (port > 0 && port < 65536) return port;
    }
  }
  return null;
}

/**
 * Detect a Vite port from `tauri.conf.json`.
 *
 * Checks `build.devUrl` for a port number, then falls back to
 * `build.beforeDevCommand` for a `--port` flag.
 */
function extractPortFromTauriConfig(
  tauriConf: Record<string, unknown> | undefined,
): number | null {
  if (!tauriConf) return null;

  const build = tauriConf['build'] as Record<string, unknown> | undefined;
  if (!build) return null;

  // Check devUrl for a port (Tauri v2)
  const devUrl = build['devUrl'] as string | undefined;
  if (devUrl) {
    try {
      const url = new URL(devUrl);
      const port = parseInt(url.port, 10);
      if (port > 0 && port < 65536) return port;
    } catch {
      // Not a valid URL — ignore
    }
  }

  // Check beforeDevCommand for a vite --port flag
  const beforeDevCommand = build['beforeDevCommand'] as string | undefined;
  if (typeof beforeDevCommand === 'string') {
    const portMatch = beforeDevCommand.match(/--port[=\s]+(\d+)/);
    if (portMatch?.[1]) {
      const port = parseInt(portMatch[1], 10);
      if (port > 0 && port < 65536) return port;
    }
  }

  // Check devPath for a localhost URL (Tauri v1)
  const devPath = build['devPath'] as string | undefined;
  if (typeof devPath === 'string') {
    try {
      const url = new URL(devPath);
      const port = parseInt(url.port, 10);
      if (port > 0 && port < 65536) return port;
    } catch {
      // Not a valid URL — ignore
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the Vite port from a `vite.config.*` file in the project.
 *
 * @param projectId - The OD project ID to read config from.
 * @returns The detected port number, or null if not found.
 */
export async function detectPortFromViteConfig(
  projectId: string,
): Promise<number | null> {
  for (const candidate of VITE_CONFIG_CANDIDATES) {
    const content = await fetchProjectFileText(projectId, candidate);
    const port = extractPortFromViteConfig(content);
    if (port !== null) return port;
  }
  return null;
}

/**
 * Detect the Vite port from `package.json` scripts in the project.
 *
 * @param projectId - The OD project ID to read package.json from.
 * @returns The detected port number, or null if not found.
 */
export async function detectPortFromPackageJson(
  projectId: string,
): Promise<number | null> {
  const content = await fetchProjectFileText(projectId, 'package.json');
  const pkgJson = tryParseJson(content);
  return extractPortFromPackageJson(pkgJson);
}

/**
 * Detect the Vite port from `tauri.conf.json` in the project.
 *
 * @param projectId - The OD project ID to read tauri.conf.json from.
 * @returns The detected port number, or null if not found.
 */
export async function detectPortFromTauriConfig(
  projectId: string,
): Promise<number | null> {
  const content = await fetchProjectFileText(
    projectId,
    'src-tauri/tauri.conf.json',
  );
  const tauriConf = tryParseJson(content);
  return extractPortFromTauriConfig(tauriConf);
}

/**
 * Check whether a Vite dev server is online at the given port.
 *
 * Uses `fetch` with a short `AbortController` timeout. Returns `true`
 * if the server responds with any status (including redirects), `false`
 * if the request fails or times out.
 *
 * @param port - The port to check.
 * @param timeoutMs - Timeout in milliseconds (default: 2000).
 * @returns Whether the Vite server appears to be running.
 */
export async function checkViteServerOnline(
  port: number,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`http://localhost:${port}`, {
      signal: controller.signal,
      mode: 'no-cors', // Vite may not send CORS headers
      cache: 'no-store',
    });
    // `no-cors` mode returns opaque responses (status 0) for cross-origin
    // requests. Any response (even opaque) means the server is running.
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Auto-detect the Vite dev server port from project configuration files.
 *
 * Checks sources in priority order:
 *   1. `vite.config.*` → `server.port`
 *   2. `package.json` scripts → `--port` flag
 *   3. `tauri.conf.json` → `build.devUrl` port
 *   4. Fallback → 5173 (Vite default)
 *
 * @param projectId - The OD project ID to read config from.
 * @returns A `PortDetectionResult` with the port and its source.
 */
export async function autoDetectVitePort(
  projectId: string,
): Promise<PortDetectionResult> {
  // 1. Check vite.config.* for server.port
  const vitePort = await detectPortFromViteConfig(projectId);
  if (vitePort !== null) {
    return { port: vitePort, source: 'vite-config' };
  }

  // 2. Check package.json scripts for --port flag
  const pkgPort = await detectPortFromPackageJson(projectId);
  if (pkgPort !== null) {
    return { port: pkgPort, source: 'package-json' };
  }

  // 3. Check tauri.conf.json for devUrl port
  const tauriPort = await detectPortFromTauriConfig(projectId);
  if (tauriPort !== null) {
    return { port: tauriPort, source: 'tauri-config' };
  }

  // 4. Fallback to Vite default
  return { port: VITE_DEFAULT_PORT, source: 'default' };
}
