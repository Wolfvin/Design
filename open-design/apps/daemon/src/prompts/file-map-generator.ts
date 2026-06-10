/**
 * Project file map generator.
 *
 * Walks the project directory tree and produces a compact tree representation
 * suitable for inclusion in the App Developer system prompt. Skips common
 * non-essential directories (node_modules, .git, dist, etc.) and binary
 * files (images, fonts, etc.).
 *
 * Example output:
 *
 *   src/
 *   ├── components/
 *   │   ├── Header.tsx
 *   │   ├── LoginPage.tsx
 *   │   └── Sidebar.tsx
 *   ├── styles/
 *   │   ├── tokens.css
 *   │   └── tailwind-theme.css
 *   ├── App.tsx
 *   └── main.tsx
 *   src-tauri/
 *   └── ...
 */

import { readdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Directories to always skip when walking the tree. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  '.next',
  '.nuxt',
  'out',
  'build',
  '.output',
  'target',
  '__pycache__',
  '.cache',
  '.turbo',
  '.vercel',
  '.terraform',
  'coverage',
  '.nyc_output',
  '.DS_Store',
  '.idea',
  '.vscode',
  '.od',
  '.open-design',
]);

/** File extensions that are binary and should be skipped. */
const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.avif', '.tiff', '.tif',
  // Fonts
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  // Audio/Video
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.mov', '.avi', '.mkv', '.webm',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Compiled / binary
  '.wasm', '.so', '.dll', '.dylib', '.exe', '.bin', '.dat',
  // Lockfiles (large, not useful for context)
  '.lock',
  // SQLite
  '.db', '.sqlite', '.sqlite3',
]);

/** Filenames that should be skipped (lockfiles, large generated files). */
const SKIP_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
  '.pnp.cjs',
  '.pnp.loader.mjs',
  'tsconfig.tsbuildinfo',
]);

/** Default maximum directory depth. */
const DEFAULT_MAX_DEPTH = 4;

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

interface TreeNode {
  name: string;
  isDir: boolean;
  children: TreeNode[];
}

async function buildTree(
  dirPath: string,
  maxDepth: number,
  currentDepth: number,
): Promise<TreeNode[]> {
  if (currentDepth >= maxDepth) return [];

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    // Permission denied or other FS error — skip silently
    return [];
  }

  // Sort: directories first, then files; alphabetical within each group
  const sorted = entries
    .filter((entry) => {
      if (SKIP_DIRS.has(entry.name)) return false;
      if (!entry.isDirectory() && SKIP_FILES.has(entry.name)) return false;
      if (!entry.isDirectory() && BINARY_EXTENSIONS.has(extname(entry.name).toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const nodes: TreeNode[] = [];

  for (const entry of sorted) {
    if (entry.isDirectory()) {
      const childPath = join(dirPath, entry.name);
      const children = await buildTree(childPath, maxDepth, currentDepth + 1);
      nodes.push({
        name: entry.name,
        isDir: true,
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        isDir: false,
        children: [],
      });
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Tree rendering
// ---------------------------------------------------------------------------

function renderTree(nodes: TreeNode[], prefix: string): string {
  const lines: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const isLast = i === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    if (node.isDir) {
      lines.push(`${prefix}${connector}${node.name}/`);
      if (node.children.length > 0) {
        lines.push(renderTree(node.children, prefix + childPrefix));
      } else if (node.children.length === 0) {
        // Show empty dir as-is (no children lines)
      }
    } else {
      lines.push(`${prefix}${connector}${node.name}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a compact tree representation of the project's file structure.
 *
 * @param baseDir  - Absolute path to the project root.
 * @param maxDepth - Maximum directory depth to traverse (default 4).
 * @returns A string containing the tree representation, suitable for
 *          inclusion in a system prompt.
 */
export async function generateProjectFileMap(
  baseDir: string,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): Promise<string> {
  // Verify the directory exists
  let dirStat;
  try {
    dirStat = await stat(baseDir);
  } catch {
    return `(project directory not found: ${baseDir})`;
  }
  if (!dirStat.isDirectory()) {
    return `(project path is not a directory: ${baseDir})`;
  }

  const children = await buildTree(baseDir, maxDepth, 0);

  if (children.length === 0) {
    return '(empty project directory)';
  }

  // Render the top-level entries without a prefix — each top-level entry
  // starts at column 0, its children are indented with tree connectors.
  const lines: string[] = [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!;
    const isLast = i === children.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    if (node.isDir) {
      lines.push(`${connector}${node.name}/`);
      if (node.children.length > 0) {
        lines.push(renderTree(node.children, childPrefix));
      }
    } else {
      lines.push(`${connector}${node.name}`);
    }
  }

  return lines.join('\n');
}
