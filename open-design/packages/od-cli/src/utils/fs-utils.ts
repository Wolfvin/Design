/**
 * File system utilities for design system generation
 */

import { mkdir, writeFile, readFile, readdir, stat, copyFile } from 'node:fs/promises';
import { dirname, join, relative, extname } from 'node:path';

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function writeIfChanged(filePath: string, content: string): Promise<boolean> {
  try {
    const existing = await readFile(filePath, 'utf-8');
    if (existing === content) return false; // no change
  } catch {
    // File doesn't exist, will create
  }
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
  return true;
}

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function writeJsonFile(filePath: string, data: unknown, pretty = true): Promise<void> {
  await ensureDir(dirname(filePath));
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await writeFile(filePath, content, 'utf-8');
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function listFiles(dir: string, extension?: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile())
      .map(e => e.name)
      .filter(name => !extension || name.endsWith(extension));
  } catch {
    return [];
  }
}

export async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => e.name);
  } catch {
    return [];
  }
}

/**
 * Find the main CSS entry file in a project
 */
export async function findProjectCssEntry(projectPath: string): Promise<string | null> {
  const candidates = [
    'src/app/globals.css',
    'src/app/global.css',
    'src/app.css',
    'src/styles/globals.css',
    'src/styles/global.css',
    'src/styles/main.css',
    'src/globals.css',
    'src/global.css',
    'src/main.css',
    'src/index.css',
    'styles/globals.css',
    'styles/global.css',
    'app/globals.css',
    'app/global.css',
  ];

  for (const candidate of candidates) {
    const fullPath = join(projectPath, candidate);
    if (await fileExists(fullPath)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Detect project stack for CSS strategy
 */
export type CssStrategy = 'custom-properties' | 'tailwind-theme' | 'css-modules' | 'js-tokens';
export type ProjectStack = 'react-tailwind' | 'react-css-modules' | 'react-css-in-js' | 'nextjs' | 'vue' | 'vanilla';

export interface StackDetectionResult {
  stack: ProjectStack;
  cssStrategy: CssStrategy;
  cssEntry: string | null;
}

export async function detectProjectStack(projectPath: string): Promise<StackDetectionResult> {
  const hasTailwind = await fileExists(join(projectPath, 'tailwind.config.ts')) ||
                      await fileExists(join(projectPath, 'tailwind.config.js')) ||
                      await fileExists(join(projectPath, 'tailwind.config.mjs'));

  const hasPostcss = await fileExists(join(projectPath, 'postcss.config.js')) ||
                     await fileExists(join(projectPath, 'postcss.config.mjs')) ||
                     await fileExists(join(projectPath, 'postcss.config.ts'));

  const cssEntry = await findProjectCssEntry(projectPath);

  // Check for CSS Modules
  let hasCssModules = false;
  try {
    const { execSync } = await import('node:child_process');
    const result = execSync(`find "${projectPath}/src" -name "*.module.css" -o -name "*.module.scss" 2>/dev/null | head -1`, { encoding: 'utf-8' });
    hasCssModules = result.trim().length > 0;
  } catch {
    // find command not available or no matches
  }

  // Check for CSS-in-JS
  let hasCssInJs = false;
  try {
    const pkg = await readJsonFile<Record<string, unknown>>(join(projectPath, 'package.json'));
    const deps = { ...pkg.dependencies as Record<string, string>, ...pkg.devDependencies as Record<string, string> };
    hasCssInJs = 'styled-components' in deps || '@emotion/styled' in deps || '@emotion/react' in deps;
  } catch {
    // no package.json
  }

  // Strategy detection priority
  if (hasTailwind && hasPostcss) {
    return { stack: 'react-tailwind', cssStrategy: 'tailwind-theme', cssEntry };
  }
  if (hasCssModules) {
    return { stack: 'react-css-modules', cssStrategy: 'css-modules', cssEntry };
  }
  if (hasCssInJs) {
    return { stack: 'react-css-in-js', cssStrategy: 'js-tokens', cssEntry };
  }
  if (await fileExists(join(projectPath, 'next.config.ts')) || await fileExists(join(projectPath, 'next.config.js'))) {
    return { stack: 'nextjs', cssStrategy: 'custom-properties', cssEntry };
  }
  if (await fileExists(join(projectPath, 'vite.config.ts')) || await fileExists(join(projectPath, 'vite.config.js'))) {
    return { stack: 'vue', cssStrategy: 'custom-properties', cssEntry };
  }
  return { stack: 'vanilla', cssStrategy: 'custom-properties', cssEntry };
}
