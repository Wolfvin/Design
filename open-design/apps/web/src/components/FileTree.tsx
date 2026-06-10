import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { fetchProjectFiles } from '../providers/registry';
import type { ProjectFile } from '../types';
import styles from './FileTree.module.css';

// ─── Public types ──────────────────────────────────────────────

/** Props for the FileTree component. */
export interface FileTreeProps {
  /** Project id used to fetch files from the daemon. */
  projectId: string;
  /** Called when a file is selected (click or Enter). */
  onFileSelect: (path: string) => void;
  /** Called when a file is renamed via the context menu. */
  onFileRename?: (path: string, newName: string) => void;
  /** Called when a file is deleted via the context menu. */
  onFileDelete?: (path: string) => void;
  /** Path of the currently active file (highlighted). */
  activeFilePath?: string | null;
  /** Paths of recently edited files (shown with green dot). */
  recentlyEditedPaths?: string[];
  /** Additional CSS class name for the root element. */
  className?: string;
}

// ─── Internal tree data structure ──────────────────────────────

/** A single node in the tree — either a folder or a file. */
interface TreeNode {
  /** Relative path from the project root (e.g. "src/components/App.tsx"). */
  path: string;
  /** Display name — the last segment of the path. */
  name: string;
  /** Whether this is a directory. */
  isDir: boolean;
  /** Child nodes, sorted (folders first, then files, alphabetical). */
  children: TreeNode[];
  /** Original ProjectFile data (only for file nodes). */
  file?: ProjectFile;
  /** Whether the directory is currently expanded. */
  expanded?: boolean;
  /** Whether children have been loaded (for lazy loading). */
  loaded?: boolean;
}

// ─── File-type icon mapping ────────────────────────────────────

/** Maps a file extension to an emoji icon and a CSS class name. */
function fileIcon(path: string): { emoji: string; className: string } {
  const ext = path.lastIndexOf('.') >= 0 ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
  switch (ext) {
    case 'tsx':
    case 'ts':
      return { emoji: '📄', className: styles.iconTs };
    case 'jsx':
    case 'js':
    case 'mjs':
    case 'cjs':
      return { emoji: '📄', className: styles.iconTs };
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return { emoji: '🎨', className: styles.iconCss };
    case 'json':
    case 'jsonc':
      return { emoji: '⚙️', className: styles.iconJson };
    case 'rs':
      return { emoji: '🦀', className: styles.iconRust };
    case 'html':
    case 'htm':
      return { emoji: '📄', className: styles.iconHtml };
    case 'md':
    case 'mdx':
      return { emoji: '📝', className: styles.iconMd };
    case 'toml':
    case 'yaml':
    case 'yml':
      return { emoji: '⚙️', className: styles.iconJson };
    case 'py':
      return { emoji: '🐍', className: styles.iconDefault };
    case 'go':
      return { emoji: '📄', className: styles.iconDefault };
    case 'svg':
      return { emoji: '🎨', className: styles.iconCss };
    case 'sql':
      return { emoji: '🗃️', className: styles.iconDefault };
    case 'sh':
    case 'bash':
    case 'zsh':
      return { emoji: '⚡', className: styles.iconDefault };
    case 'lock':
      return { emoji: '🔒', className: styles.iconDefault };
    case 'env':
    case 'gitignore':
    case 'eslintrc':
    case 'prettierrc':
      return { emoji: '⚙️', className: styles.iconJson };
    default:
      return { emoji: '📄', className: styles.iconDefault };
  }
}

// ─── Tree builder ──────────────────────────────────────────────

/**
 * Builds a tree structure from a flat list of ProjectFile objects.
 * Files are sorted: folders first, then files, both alphabetically.
 */
function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  // First pass: collect all unique directory paths
  const dirPaths = new Set<string>();
  for (const f of files) {
    const parts = f.name.split('/');
    for (let i = 1; i < parts.length; i++) {
      dirPaths.add(parts.slice(0, i).join('/'));
    }
  }

  // Create directory nodes
  const nodeMap = new Map<string, TreeNode>();
  for (const dirPath of [...dirPaths].sort()) {
    const parts = dirPath.split('/');
    const name = parts[parts.length - 1]!;
    const node: TreeNode = {
      path: dirPath,
      name,
      isDir: true,
      children: [],
      expanded: false,
      loaded: true,
    };
    nodeMap.set(dirPath, node);
  }

  // Create file nodes and attach to parents
  for (const f of files) {
    const parts = f.name.split('/');
    const name = parts[parts.length - 1]!;
    const node: TreeNode = {
      path: f.name,
      name,
      isDir: false,
      children: [],
      file: f,
    };
    nodeMap.set(f.name, node);
  }

  // Build parent-child relationships
  for (const [path, node] of nodeMap) {
    const parts = path.split('/');
    if (parts.length <= 1) {
      // Top-level node
      root.push(node);
    } else {
      const parentPath = parts.slice(0, parts.length - 1).join('/');
      const parent = nodeMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent missing — push to root
        root.push(node);
      }
    }
  }

  // Sort: folders first, then files, both alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    const sorted = [...nodes].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of sorted) {
      if (node.isDir) {
        node.children = sortNodes(node.children);
      }
    }
    return sorted;
  };

  return sortNodes(root);
}

// ─── Tree flattener (for keyboard navigation) ──────────────────

/** A visible row in the tree, with its depth. */
interface FlatNode {
  node: TreeNode;
  depth: number;
  parentPath: string;
}

/**
 * Flattens the tree into a list of visible nodes based on expanded state.
 * Used for keyboard navigation and rendering.
 */
function flattenTree(
  nodes: TreeNode[],
  expandedPaths: Set<string>,
  depth = 0,
  parentPath = '',
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    result.push({ node, depth, parentPath });
    if (node.isDir && expandedPaths.has(node.path)) {
      result.push(...flattenTree(node.children, expandedPaths, depth + 1, node.path));
    }
  }
  return result;
}

// ─── Context menu types ────────────────────────────────────────

interface ContextMenuState {
  path: string;
  isDir: boolean;
  x: number;
  y: number;
}

// ─── FileTree component ────────────────────────────────────────

/**
 * Collapsible file tree that replaces DesignFilesPanel.
 *
 * Features:
 * - Collapsible tree with folder expand/collapse
 * - File type icons (emoji-based)
 * - Click file → onFileSelect(path)
 * - Right-click context menu (Open, Rename, Delete, Copy Path)
 * - Keyboard navigation (arrow keys, Enter, Space)
 * - Green dot for recently edited files
 * - Search/filter input at top
 * - Sort: folders first, then files alphabetically
 * - Lazy loading support (fetch children on expand)
 * - Active file highlighting
 * - Drag handle for workspace integration
 */
export function FileTree({
  projectId,
  onFileSelect,
  onFileRename,
  onFileDelete,
  activeFilePath = null,
  recentlyEditedPaths = [],
  className,
}: FileTreeProps) {
  // ── State ────────────────────────────────────────────────
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState<{ path: string; draft: string } | null>(null);
  const [dragPath, setDragPath] = useState<string | null>(null);

  // ── Refs ─────────────────────────────────────────────────
  const treeRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch files on mount / project change ────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchProjectFiles(projectId).then((result) => {
      if (!cancelled) {
        setFiles(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ── Build tree ───────────────────────────────────────────
  const tree = useMemo(() => buildTree(files), [files]);

  // ── Filter tree by search query ──────────────────────────
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;

    const query = searchQuery.toLowerCase().trim();

    /** Recursively filter a list of nodes, keeping dirs that have matching descendants. */
    function filterNodes(nodes: TreeNode[]): TreeNode[] {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        if (node.isDir) {
          const filteredChildren = filterNodes(node.children);
          if (filteredChildren.length > 0) {
            result.push({ ...node, children: filteredChildren });
          }
          // Also match directory name itself
          if (node.name.toLowerCase().includes(query)) {
            const alreadyAdded = result.some((r) => r.path === node.path);
            if (!alreadyAdded) {
              result.push({ ...node, children: filterNodes(node.children) });
            }
          }
        } else {
          if (node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)) {
            result.push(node);
          }
        }
      }
      // Re-sort
      return result.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }

    return filterNodes(tree);
  }, [tree, searchQuery]);

  // When searching, auto-expand all directories so filtered results are visible
  const effectiveExpandedPaths = useMemo(() => {
    if (!searchQuery.trim()) return expandedPaths;
    // Expand everything during search
    const allDirs = new Set<string>();
    function collectDirs(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.isDir) {
          allDirs.add(node.path);
          collectDirs(node.children);
        }
      }
    }
    collectDirs(filteredTree);
    return allDirs;
  }, [searchQuery, filteredTree, expandedPaths]);

  // ── Flatten tree for rendering / keyboard nav ────────────
  const flatNodes = useMemo(
    () => flattenTree(filteredTree, effectiveExpandedPaths),
    [filteredTree, effectiveExpandedPaths],
  );

  // ── Recently edited set ──────────────────────────────────
  const editedSet = useMemo(
    () => new Set(recentlyEditedPaths),
    [recentlyEditedPaths],
  );

  // ── Toggle directory expand/collapse ─────────────────────
  const toggleDir = useCallback((dirPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  }, []);

  // ── Expand directory (used by keyboard nav) ──────────────
  const expandDir = useCallback((dirPath: string) => {
    setExpandedPaths((prev) => {
      if (prev.has(dirPath)) return prev;
      const next = new Set(prev);
      next.add(dirPath);
      return next;
    });
  }, []);

  // ── Collapse directory (used by keyboard nav) ────────────
  const collapseDir = useCallback((dirPath: string) => {
    setExpandedPaths((prev) => {
      if (!prev.has(dirPath)) return prev;
      const next = new Set(prev);
      next.delete(dirPath);
      return next;
    });
  }, []);

  // ── Handle file click ────────────────────────────────────
  const handleFileClick = useCallback(
    (path: string) => {
      onFileSelect(path);
    },
    [onFileSelect],
  );

  // ── Handle directory click ───────────────────────────────
  const handleDirClick = useCallback(
    (dirPath: string) => {
      toggleDir(dirPath);
    },
    [toggleDir],
  );

  // ── Context menu ─────────────────────────────────────────
  const handleContextMenu = useCallback(
    (e: ReactMouseEvent, path: string, isDir: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ path, isDir, x: e.clientX, y: e.clientY });
    },
    [],
  );

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  // ── Context menu actions ─────────────────────────────────
  const handleContextOpen = useCallback(() => {
    setContextMenu(null);
    if (contextMenu) {
      if (contextMenu.isDir) {
        expandDir(contextMenu.path);
      } else {
        onFileSelect(contextMenu.path);
      }
    }
  }, [contextMenu, expandDir, onFileSelect]);

  const handleContextRename = useCallback(() => {
    setContextMenu(null);
    if (contextMenu) {
      const parts = contextMenu.path.split('/');
      const basename = parts[parts.length - 1]!;
      setRenaming({ path: contextMenu.path, draft: basename });
      // Focus rename input after render
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [contextMenu]);

  const handleContextDelete = useCallback(() => {
    setContextMenu(null);
    if (contextMenu) {
      onFileDelete?.(contextMenu.path);
    }
  }, [contextMenu, onFileDelete]);

  const handleContextCopyPath = useCallback(async () => {
    setContextMenu(null);
    if (contextMenu) {
      try {
        await navigator.clipboard.writeText(contextMenu.path);
      } catch {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = contextMenu.path;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    }
  }, [contextMenu]);

  // ── Commit rename ────────────────────────────────────────
  const commitRename = useCallback(() => {
    if (!renaming) return;
    const { path, draft } = renaming;
    const trimmed = draft.trim();
    setRenaming(null);
    if (!trimmed) return;
    const parts = path.split('/');
    const oldBasename = parts[parts.length - 1]!;
    if (trimmed === oldBasename) return;
    onFileRename?.(path, trimmed);
  }, [renaming, onFileRename]);

  const cancelRename = useCallback(() => {
    setRenaming(null);
  }, []);

  // ── Keyboard navigation ──────────────────────────────────
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      // If renaming, let the rename input handle its own keys
      if (renaming) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, flatNodes.length - 1));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < flatNodes.length) {
            const { node } = flatNodes[focusedIndex]!;
            if (node.isDir) {
              expandDir(node.path);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < flatNodes.length) {
            const { node } = flatNodes[focusedIndex]!;
            if (node.isDir && effectiveExpandedPaths.has(node.path)) {
              collapseDir(node.path);
            }
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < flatNodes.length) {
            const { node } = flatNodes[focusedIndex]!;
            if (node.isDir) {
              toggleDir(node.path);
            } else {
              onFileSelect(node.path);
            }
          }
          break;
        }
        case ' ': {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < flatNodes.length) {
            const { node } = flatNodes[focusedIndex]!;
            if (node.isDir) {
              toggleDir(node.path);
            }
          }
          break;
        }
        case 'Delete': {
          if (focusedIndex >= 0 && focusedIndex < flatNodes.length) {
            const { node } = flatNodes[focusedIndex]!;
            if (!node.isDir && onFileDelete) {
              onFileDelete(node.path);
            }
          }
          break;
        }
        case 'F2': {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < flatNodes.length) {
            const { node } = flatNodes[focusedIndex]!;
            if (!node.isDir && onFileRename) {
              setRenaming({ path: node.path, draft: node.name });
              requestAnimationFrame(() => {
                renameInputRef.current?.focus();
                renameInputRef.current?.select();
              });
            }
          }
          break;
        }
      }
    },
    [flatNodes, focusedIndex, renaming, effectiveExpandedPaths, expandDir, collapseDir, toggleDir, onFileSelect, onFileDelete, onFileRename],
  );

  // ── Scroll focused row into view ─────────────────────────
  useEffect(() => {
    if (focusedIndex < 0) return;
    const container = treeRef.current;
    if (!container) return;
    const rows = container.querySelectorAll<HTMLElement>(`[data-tree-index]`);
    const target = rows[focusedIndex];
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focusedIndex]);

  // ── Reset focus index when tree changes ──────────────────
  useEffect(() => {
    setFocusedIndex(-1);
  }, [projectId]);

  // ── Drag and drop ────────────────────────────────────────
  const handleDragStart = useCallback(
    (e: ReactDragEvent, path: string) => {
      setDragPath(path);
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', path);
      e.dataTransfer.setData('application/x-file-tree-path', path);
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDragPath(null);
  }, []);

  // ── Render context menu ──────────────────────────────────
  const contextMenuPortal = contextMenu
    ? createPortal(
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label="File actions"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={handleContextOpen}
          >
            <span>{contextMenu.isDir ? '📂 Open' : '📄 Open'}</span>
            <span className={styles.contextMenuShortcut}>Enter</span>
          </button>
          {!contextMenu.isDir && onFileRename ? (
            <button
              type="button"
              className={styles.contextMenuItem}
              role="menuitem"
              onClick={handleContextRename}
            >
              <span>✏️ Rename</span>
              <span className={styles.contextMenuShortcut}>F2</span>
            </button>
          ) : null}
          {!contextMenu.isDir && onFileDelete ? (
            <button
              type="button"
              className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`}
              role="menuitem"
              onClick={handleContextDelete}
            >
              <span>🗑️ Delete</span>
              <span className={styles.contextMenuShortcut}>Del</span>
            </button>
          ) : null}
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => void handleContextCopyPath()}
          >
            <span>📋 Copy Path</span>
          </button>
        </div>,
        document.body,
      )
    : null;

  // ── Render a single tree row ─────────────────────────────
  function renderRow(flat: FlatNode, index: number) {
    const { node, depth } = flat;
    const isActive = !node.isDir && activeFilePath === node.path;
    const isFocused = focusedIndex === index;
    const isEdited = !node.isDir && editedSet.has(node.path);
    const isRenaming = renaming?.path === node.path;
    const isDragging = dragPath === node.path;

    // Indent guides
    const indentGuides = [];
    for (let i = 0; i < depth; i++) {
      indentGuides.push(
        <span key={i} className={styles.indentGuide}>
          <span className={styles.indentGuideLine} />
        </span>,
      );
    }

    // Chevron for directories
    const isExpanded = node.isDir && effectiveExpandedPaths.has(node.path);
    const chevron = node.isDir ? (
      <span
        className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}
        aria-hidden
      >
        ▶
      </span>
    ) : (
      <span className={`${styles.chevron} ${styles.chevronHidden}`} aria-hidden>
        ▶
      </span>
    );

    // Icon
    const iconInfo = node.isDir
      ? { emoji: isExpanded ? '📂' : '📁', className: styles.iconFolder }
      : fileIcon(node.path);

    // Row classes
    const rowClasses = [
      styles.row,
      isActive ? styles.rowActive : '',
      isFocused ? styles.rowFocused : '',
      isDragging ? styles.rowDragging : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        key={node.path}
        className={rowClasses}
        data-tree-index={index}
        data-path={node.path}
        role="treeitem"
        aria-expanded={node.isDir ? isExpanded : undefined}
        aria-selected={isActive || undefined}
        tabIndex={isFocused ? 0 : -1}
        onClick={() => {
          if (node.isDir) {
            handleDirClick(node.path);
          } else {
            handleFileClick(node.path);
          }
        }}
        onContextMenu={(e) => handleContextMenu(e, node.path, node.isDir)}
        onDragStart={(e) => handleDragStart(e, node.path)}
        onDragEnd={handleDragEnd}
        draggable={!node.isDir}
      >
        {/* Drag handle */}
        {!node.isDir ? (
          <span className={styles.dragHandle} aria-hidden title="Drag to workspace">
            ⋮⋮
          </span>
        ) : (
          <span style={{ flex: '0 0 14px' }} />
        )}

        {/* Indent guides */}
        {indentGuides}

        {/* Chevron */}
        {chevron}

        {/* Icon */}
        <span className={`${styles.icon} ${iconInfo.className}`} aria-hidden>
          {iconInfo.emoji}
        </span>

        {/* Name */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className={styles.renameInput}
            value={renaming.draft}
            onChange={(e) => setRenaming({ ...renaming, draft: e.target.value })}
            onBlur={() => commitRename()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelRename();
              }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`${styles.name} ${node.isDir ? styles.nameFolder : ''}`}>
            {node.name}
          </span>
        )}

        {/* Recently edited indicator */}
        <span
          className={`${styles.editIndicator} ${isEdited ? '' : styles.editIndicatorHidden}`}
          title="Recently edited"
          aria-hidden
        />
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────
  const emptyState = (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>📁</div>
      <div>{loading ? 'Loading files…' : 'No files found'}</div>
    </div>
  );

  // ── Main render ──────────────────────────────────────────
  return (
    <div
      className={`${styles.root} ${className ?? ''}`}
      role="tree"
      aria-label="Project files"
    >
      {/* Search bar */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Filter files…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Filter files"
        />
        {searchQuery ? (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => setSearchQuery('')}
            aria-label="Clear filter"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* Tree body */}
      <div
        ref={treeRef}
        className={styles.treeBody}
        onKeyDown={handleKeyDown}
        role="group"
      >
        {flatNodes.length === 0 ? emptyState : flatNodes.map((flat, index) => renderRow(flat, index))}
      </div>

      {/* Context menu portal */}
      {contextMenuPortal}
    </div>
  );
}

// ─── Re-export buildTree for testing / external use ─────────────
export { buildTree, flattenTree };
export type { TreeNode, FlatNode };
