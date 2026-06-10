/**
 * Project type detector.
 *
 * Inspects the project directory for configuration files to determine
 * the project type (tauri-react, nextjs-standalone, nextjs-pages, nextjs,
 * vite-react, vite-vue, etc.) and auto-detect the dev server port.
 *
 * Next.js sub-types:
 *   - `nextjs-standalone` – App Router (app/ or src/app/ directory)
 *   - `nextjs-pages`      – Pages Router (pages/ or src/pages/ directory)
 *
 * Dev server type (`devServerType`) is also detected:
 *   - `vite`   for Vite / Tauri projects
 *   - `nextjs` for Next.js projects
 *   - `custom` for anything else
 *
 * Detection priority:
 *   1. `src-tauri/tauri.conf.json` → tauri-react
 *   2. `next.config.*` → nextjs-standalone or nextjs-pages
 *   3. `vite.config.*` + `package.json` deps → vite-react or vite-vue
 *   4. Fallback → unknown
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectTypeDetection {
  type: 'tauri-react' | 'nextjs-standalone' | 'nextjs-pages' | 'nextjs' | 'vite-react' | 'vite-vue' | 'unknown';
  techStack: string;
  /** Dev server port (auto-detected). For Vite: 5173, for Next.js: 3000. */
  devPort?: number | undefined;
  /** Dev server type: vite for Vite/Tauri projects, nextjs for Next.js projects. */
  devServerType?: 'vite' | 'nextjs' | 'custom' | undefined;
  /** @deprecated Use devPort instead. Kept for backward compatibility. */
  vitePort?: number | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether a file exists (returns false on any error). */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

/** Read a text file, returning undefined on any error. */
async function readTextFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

/** Try to parse JSON, returning undefined on failure. */
function tryParseJson(text: string | undefined): Record<string, unknown> | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Extract a Vite port from a vite.config file (ts or js). */
function extractVitePortFromConfig(content: string | undefined): number | undefined {
  if (!content) return undefined;

  // Match `port: <number>` or `port: "<number>"` inside a server block
  const portMatch = content.match(/port\s*:\s*(\d+)/);
  if (portMatch?.[1]) {
    const port = parseInt(portMatch[1], 10);
    if (port > 0 && port < 65536) return port;
  }
  return undefined;
}

/** Extract a Vite port from package.json scripts. */
function extractVitePortFromScripts(
  pkgJson: Record<string, unknown> | undefined,
): number | undefined {
  if (!pkgJson) return undefined;
  const scripts = pkgJson['scripts'] as Record<string, string> | undefined;
  if (!scripts) return undefined;

  for (const scriptBody of Object.values(scripts)) {
    if (typeof scriptBody !== 'string') continue;
    // Match `--port <number>` or `--port=<number>`
    const portMatch = scriptBody.match(/--port[=\s]+(\d+)/);
    if (portMatch?.[1]) {
      const port = parseInt(portMatch[1], 10);
      if (port > 0 && port < 65536) return port;
    }
  }
  return undefined;
}

/** Extract the dev server port from tauri.conf.json. */
function extractPortFromTauriConf(
  tauriConf: Record<string, unknown> | undefined,
): number | undefined {
  if (!tauriConf) return undefined;

  // tauri.conf.json v2 structure: build.devUrl or build.beforeDevCommand
  // tauri.conf.json v1 structure: build.devPath
  const build = tauriConf['build'] as Record<string, unknown> | undefined;
  if (!build) return undefined;

  // Check devUrl for a port
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
  if (beforeDevCommand) {
    const portMatch = beforeDevCommand.match(/--port[=\s]+(\d+)/);
    if (portMatch?.[1]) {
      const port = parseInt(portMatch[1], 10);
      if (port > 0 && port < 65536) return port;
    }
  }

  return undefined;
}

/** Detect whether a package.json has react or vue deps. */
function detectFrameworkFromPkg(
  pkgJson: Record<string, unknown> | undefined,
): 'react' | 'vue' | 'unknown' {
  if (!pkgJson) return 'unknown';

  const deps = {
    ...(pkgJson['dependencies'] as Record<string, string> | undefined ?? {}),
    ...(pkgJson['devDependencies'] as Record<string, string> | undefined ?? {}),
  };

  const hasReact = 'react' in deps || 'react-dom' in deps || '@types/react' in deps;
  const hasVue = 'vue' in deps || '@vue/compiler-sfc' in deps || 'nuxt' in deps;

  if (hasReact && !hasVue) return 'react';
  if (hasVue && !hasReact) return 'vue';
  // If both or neither, prefer react if react exists
  if (hasReact) return 'react';
  if (hasVue) return 'vue';
  return 'unknown';
}

/** Build a human-readable tech stack string. */
function buildTechStack(
  type: ProjectTypeDetection['type'],
  framework: 'react' | 'vue' | 'unknown',
  pkgJson: Record<string, unknown> | undefined,
): string {
  const parts: string[] = [];

  const deps = {
    ...(pkgJson?.['dependencies'] as Record<string, string> | undefined ?? {}),
    ...(pkgJson?.['devDependencies'] as Record<string, string> | undefined ?? {}),
  };

  // Framework
  if (framework === 'react') {
    const reactVer = deps['react'] ?? '';
    parts.push(reactVer ? `React ${reactVer.replace(/^[^0-9]*/, '')}` : 'React');
    parts.push('TypeScript');
  } else if (framework === 'vue') {
    const vueVer = deps['vue'] ?? '';
    parts.push(vueVer ? `Vue ${vueVer.replace(/^[^0-9]*/, '')}` : 'Vue');
    parts.push('TypeScript');
  } else {
    parts.push('TypeScript');
  }

  // Tauri
  if (type === 'tauri-react') {
    parts.push('Tauri');
  }

  // CSS
  if ('tailwindcss' in deps || '@tailwindcss/vite' in deps) {
    parts.push('Tailwind CSS v4');
  } else if ('tailwindcss' in deps) {
    parts.push('Tailwind CSS');
  }

  // Build tool
  if (type === 'nextjs-standalone' || type === 'nextjs-pages' || type === 'nextjs') {
    parts.push('Next.js');
  } else if ('vite' in deps) {
    parts.push('Vite');
  }

  // Next.js ecosystem (only for nextjs types)
  if (type === 'nextjs-standalone' || type === 'nextjs-pages' || type === 'nextjs') {
    if ('next-auth' in deps || '@auth/core' in deps) parts.push('NextAuth');
    if ('next-intl' in deps) parts.push('next-intl');
    if ('@prisma/client' in deps) parts.push('Prisma');
    if ('@radix-ui/react-slot' in deps || '@radix-ui/react-dialog' in deps) parts.push('Radix UI');
    if ('class-variance-authority' in deps) parts.push('CVA');
    if ('zod' in deps) parts.push('Zod');
  }

  // Router
  if ('react-router' in deps || 'react-router-dom' in deps) {
    parts.push('React Router');
  } else if ('vue-router' in deps) {
    parts.push('Vue Router');
  } else if ('next' in deps) {
    // Next.js includes its own router — already mentioned
  }

  // State
  if ('zustand' in deps) parts.push('Zustand');
  if ('@tanstack/react-query' in deps) parts.push('TanStack Query');
  if ('pinia' in deps) parts.push('Pinia');

  return parts.join(' + ') || 'Unknown stack';
}

// ---------------------------------------------------------------------------
// Vite config file search
// ---------------------------------------------------------------------------

const VITE_CONFIG_CANDIDATES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.js',
  'vite.config.mjs',
];

const NEXT_CONFIG_CANDIDATES = [
  'next.config.ts',
  'next.config.mts',
  'next.config.js',
  'next.config.mjs',
];

// ---------------------------------------------------------------------------
// Main detection function
// ---------------------------------------------------------------------------

/**
 * Detect the project type by inspecting configuration files.
 *
 * @param baseDir - Absolute path to the project root.
 * @returns A `ProjectTypeDetection` object with type, techStack, and
 *          optionally the auto-detected Vite port.
 */
export async function detectProjectType(baseDir: string): Promise<ProjectTypeDetection> {
  // Read package.json once
  const pkgContent = await readTextFile(join(baseDir, 'package.json'));
  const pkgJson = tryParseJson(pkgContent);

  // --- Tauri ---
  const tauriConfPath = join(baseDir, 'src-tauri', 'tauri.conf.json');
  if (await fileExists(tauriConfPath)) {
    const tauriConf = tryParseJson(await readTextFile(tauriConfPath));
    const framework = detectFrameworkFromPkg(pkgJson);
    const type: ProjectTypeDetection['type'] =
      framework === 'vue' ? 'vite-vue' : 'tauri-react'; // tauri-vue not in union yet; fall back

    const vitePort =
      extractPortFromTauriConf(tauriConf) ??
      extractVitePortFromScripts(pkgJson) ??
      (await detectVitePort(baseDir));

    return {
      type: framework === 'vue' ? 'unknown' : 'tauri-react',
      techStack: buildTechStack('tauri-react', framework, pkgJson),
      devPort: vitePort,
      devServerType: 'vite',
      vitePort,
    };
  }

  // --- Next.js ---
  for (const candidate of NEXT_CONFIG_CANDIDATES) {
    if (await fileExists(join(baseDir, candidate))) {
      // Detect App Router vs Pages Router
      const hasAppDir = await fileExists(join(baseDir, 'app'));
      const hasPagesDir = await fileExists(join(baseDir, 'pages'));
      const hasSrcAppDir = await fileExists(join(baseDir, 'src', 'app'));
      const hasSrcPagesDir = await fileExists(join(baseDir, 'src', 'pages'));

      let nextjsType: 'nextjs-standalone' | 'nextjs-pages';
      if (hasAppDir || hasSrcAppDir) {
        nextjsType = 'nextjs-standalone'; // App Router (default for Next.js 16)
      } else if (hasPagesDir || hasSrcPagesDir) {
        nextjsType = 'nextjs-pages'; // Pages Router
      } else {
        nextjsType = 'nextjs-standalone'; // Default to App Router for modern Next.js
      }

      // Detect Next.js dev server port
      const nextjsPort = await detectNextjsPort(baseDir, pkgJson);

      return {
        type: nextjsType,
        techStack: buildTechStack(nextjsType, 'react', pkgJson),
        devPort: nextjsPort,
        devServerType: 'nextjs',
        vitePort: undefined, // Not a Vite project
      };
    }
  }

  // --- Vite ---
  for (const candidate of VITE_CONFIG_CANDIDATES) {
    const configPath = join(baseDir, candidate);
    if (await fileExists(configPath)) {
      const framework = detectFrameworkFromPkg(pkgJson);
      const vitePort = await detectVitePort(baseDir);

      const type: ProjectTypeDetection['type'] =
        framework === 'vue' ? 'vite-vue'
        : framework === 'react' ? 'vite-react'
        : 'unknown';

      return {
        type,
        techStack: buildTechStack(type, framework, pkgJson),
        devPort: vitePort,
        devServerType: 'vite',
        vitePort,
      };
    }
  }

  // --- Fallback ---
  const framework = detectFrameworkFromPkg(pkgJson);
  return {
    type: 'unknown',
    techStack: buildTechStack('unknown', framework, pkgJson),
    devServerType: undefined,
  };
}

/**
 * Try to detect the Next.js dev server port from config files and package.json.
 */
async function detectNextjsPort(baseDir: string, pkgJson: Record<string, unknown> | undefined): Promise<number> {
  // 1. Check next.config.* for devServer.port
  for (const candidate of NEXT_CONFIG_CANDIDATES) {
    const configPath = join(baseDir, candidate);
    const content = await readTextFile(configPath);
    if (content) {
      const portMatch = content.match(/devServer\s*:\s*\{[^}]*port\s*:\s*(\d+)/);
      if (portMatch?.[1]) {
        const port = parseInt(portMatch[1], 10);
        if (port > 0 && port < 65536) return port;
      }
    }
  }

  // 2. Check package.json scripts for --port or -p flag
  if (pkgJson) {
    const scripts = pkgJson['scripts'] as Record<string, string> | undefined;
    if (scripts) {
      for (const scriptBody of Object.values(scripts)) {
        if (typeof scriptBody !== 'string') continue;
        // Match --port <number> or -p <number>
        const portMatch = scriptBody.match(/--port[=\s]+(\d+)/);
        if (portMatch?.[1]) {
          const port = parseInt(portMatch[1], 10);
          if (port > 0 && port < 65536) return port;
        }
        const pMatch = scriptBody.match(/-p\s+(\d+)/);
        if (pMatch?.[1]) {
          const port = parseInt(pMatch[1], 10);
          if (port > 0 && port < 65536) return port;
        }
      }
    }
  }

  // 3. Fallback to 3000 (Next.js default)
  return 3000;
}

/**
 * Try to detect the Vite dev server port from config files and package.json.
 */
async function detectVitePort(baseDir: string): Promise<number | undefined> {
  const pkgContent = await readTextFile(join(baseDir, 'package.json'));
  const pkgJson = tryParseJson(pkgContent);

  // 1. Check vite.config.* for port
  for (const candidate of VITE_CONFIG_CANDIDATES) {
    const configPath = join(baseDir, candidate);
    const content = await readTextFile(configPath);
    const port = extractVitePortFromConfig(content);
    if (port !== undefined) return port;
  }

  // 2. Check package.json scripts
  return extractVitePortFromScripts(pkgJson);
}
