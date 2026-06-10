/**
 * AppDeveloperWorkspace — Developer-focused three-panel workspace layout.
 *
 * Replaces the artifact-centric FileWorkspace with a VS Code-style layout:
 *   FileTree (left) | Content (center) | VitePreview (right)
 *
 * Imports from new components (FileTree, CodeViewer, VitePreview) that are
 * being created by other parallel agents — uses their expected interfaces.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ProjectStatusBarProps } from './workspace/ProjectStatusBar';
import { ProjectStatusBar } from './workspace/ProjectStatusBar';
import { useAppDeveloper } from '../providers/app-developer-provider';
import styles from './AppDeveloperWorkspace.module.css';

// ---------------------------------------------------------------------------
// Expected interfaces for parallel-agent components (not yet created)
// ---------------------------------------------------------------------------

/** FileTree component — expected interface from other agent */
interface FileTreeProps {
  projectId: string;
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  className?: string;
}

/** CodeViewer component — expected interface from other agent */
interface CodeViewerProps {
  filePath: string;
  projectId: string;
  className?: string;
}

/** VitePreview component — expected interface from other agent */
interface VitePreviewProps {
  projectId: string;
  vitePort: number | null;
  className?: string;
}

/** TerminalViewer — reuses the existing component */
interface TerminalViewerProps {
  projectId: string;
  terminalId: string;
  className?: string;
}

// Lazy / optional imports — these components are being built by other agents.
// We reference them dynamically so the workspace compiles even when they
// haven't been created yet. Once they exist the imports resolve normally.
let FileTree: React.FC<FileTreeProps> | null = null;
let CodeViewer: React.FC<CodeViewerProps> | null = null;
let VitePreview: React.FC<VitePreviewProps> | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ft = require('./FileTree');
  FileTree = ft?.FileTree ?? ft?.default ?? null;
} catch { /* not yet created */ }

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cv = require('./CodeViewer');
  CodeViewer = cv?.CodeViewer ?? cv?.default ?? null;
} catch { /* not yet created */ }

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vp = require('./VitePreview');
  VitePreview = vp?.VitePreview ?? vp?.default ?? null;
} catch { /* not yet created */ }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Kind of content shown in the center panel */
export type ContentKind = 'file' | 'terminal' | 'preview' | 'diff';

/** A single open tab in the workspace */
export interface WorkspaceTab {
  /** Unique tab id (e.g. file path, terminal:<id>, etc.) */
  id: string;
  /** Human-readable label */
  label: string;
  /** What kind of content this tab holds */
  kind: ContentKind;
  /** Optional icon name for the tab */
  icon?: string;
  /** Closeable — most tabs can be closed; some (like a welcome tab) can't */
  closeable?: boolean;
}

/** Props for the AppDeveloperWorkspace component */
export interface AppDeveloperWorkspaceProps {
  /** Currently active project id */
  projectId: string;
  /** Currently active file path */
  activeFilePath: string | null;
  /** Active tab type */
  activeTabKind: ContentKind;
  /** Callback when file is selected from tree */
  onFileSelect: (path: string) => void;
  /** Callback to open settings */
  onOpenSettings?: () => void;
  /** Optional terminal id if a terminal tab is active */
  activeTerminalId?: string | null;
  /** Optional diff file paths (original → modified) */
  diffPaths?: { original: string; modified: string } | null;
  /** Additional CSS class */
  className?: string;
}

// ---------------------------------------------------------------------------
// Panel resize hook
// ---------------------------------------------------------------------------

interface PanelSizes {
  fileTree: number;
  preview: number;
}

const DEFAULT_PANEL_SIZES: PanelSizes = {
  fileTree: 220,
  preview: 400,
};

const MIN_FILE_TREE = 140;
const MAX_FILE_TREE = 400;
const MIN_PREVIEW = 200;
const MAX_PREVIEW = 800;

function usePanelResize(initial?: Partial<PanelSizes>) {
  const [sizes, setSizes] = useState<PanelSizes>({
    fileTree: initial?.fileTree ?? DEFAULT_PANEL_SIZES.fileTree,
    preview: initial?.preview ?? DEFAULT_PANEL_SIZES.preview,
  });

  const handleFileTreeResize = useCallback((delta: number) => {
    setSizes((prev) => ({
      ...prev,
      fileTree: Math.min(MAX_FILE_TREE, Math.max(MIN_FILE_TREE, prev.fileTree + delta)),
    }));
  }, []);

  const handlePreviewResize = useCallback((delta: number) => {
    setSizes((prev) => ({
      ...prev,
      preview: Math.min(MAX_PREVIEW, Math.max(MIN_PREVIEW, prev.preview + delta)),
    }));
  }, []);

  return { sizes, handleFileTreeResize, handlePreviewResize, setSizes };
}

// ---------------------------------------------------------------------------
// Resize drag handler
// ---------------------------------------------------------------------------

function useResizeDrag(
  onDelta: (delta: number) => void,
) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  const rafId = useRef<number>(0);

  const start = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastX.current = e.clientX;
      const onMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - lastX.current;
        lastX.current = ev.clientX;
        cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => onDelta(delta));
      };
      const onUp = () => {
        dragging.current = false;
        cancelAnimationFrame(rafId.current);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onDelta],
  );

  return { startDrag: start };
}

// ---------------------------------------------------------------------------
// Breadcrumb helper
// ---------------------------------------------------------------------------

function pathToBreadcrumbSegments(filePath: string): string[] {
  return filePath.split('/').filter(Boolean);
}

// ---------------------------------------------------------------------------
// File extension → language label
// ---------------------------------------------------------------------------

const EXT_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript React',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript React',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.html': 'HTML',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.rs': 'Rust',
  '.py': 'Python',
  '.sql': 'SQL',
  '.graphql': 'GraphQL',
  '.svg': 'SVG',
};

function languageFromPath(filePath: string | null): string | undefined {
  if (!filePath) return undefined;
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) return undefined;
  return EXT_LANGUAGE_MAP[filePath.slice(dot)] ?? undefined;
}

// ---------------------------------------------------------------------------
// SVG icon helpers (inline, no external dependency)
// ---------------------------------------------------------------------------

function FolderIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flex: '0 0 auto' }}>
      <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5V5.5A1.5 1.5 0 0 0 14.5 4H7.707l-1.854-1.854A.5.5 0 0 0 5.5 2H1.5z" />
    </svg>
  );
}

function FileIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flex: '0 0 auto' }}>
      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.414A2 2 0 0 0 13.414 3L11 .586A2 2 0 0 0 9.586 0H4zm0 1h5.586a1 1 0 0 1 .707.293L12.707 3.5a1 1 0 0 1 .293.707V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function TerminalIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flex: '0 0 auto' }}>
      <path d="M6 9L3 12l3 3m5-6h3M2 2h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DiffIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flex: '0 0 auto' }}>
      <path d="M1 3h14v10H1V3zm1 1v8h12V4H2zm3 2h2v1H5V6zm4 0h2v1H9V6zM5 9h6v1H5V9z" />
    </svg>
  );
}

function PanelToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="currentColor" style={{ flex: '0 0 auto', transform: collapsed ? 'scaleX(-1)' : undefined }}>
      <path d="M11 2L5 8l6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="currentColor">
      <path d="M2.5 2.5l7 7m0-7l-7 7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flex: '0 0 auto' }}>
      <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Placeholder components (used when the real ones aren't available yet)
// ---------------------------------------------------------------------------

const PlaceholderFileTree: React.FC<FileTreeProps> = ({ projectId, activeFilePath, onFileSelect }) => (
  <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
    <div style={{ fontWeight: 600, marginBottom: 8 }}>Project: {projectId}</div>
    <div style={{ opacity: 0.6, fontStyle: 'italic' }}>FileTree component loading…</div>
    {activeFilePath && (
      <div style={{ marginTop: 8, color: 'var(--accent)', fontSize: '11px' }}>
        Active: {activeFilePath}
      </div>
    )}
  </div>
);

const PlaceholderCodeViewer: React.FC<CodeViewerProps> = ({ filePath }) => (
  <div style={{
    display: 'grid',
    placeItems: 'center',
    height: '100%',
    color: 'var(--text-faint)',
    fontSize: '13px',
  }}>
    CodeViewer — {filePath}
  </div>
);

const PlaceholderVitePreview: React.FC<VitePreviewProps> = ({ vitePort }) => (
  <div style={{
    display: 'grid',
    placeItems: 'center',
    height: '100%',
    gap: '8px',
    color: 'var(--text-faint)',
    fontSize: '13px',
  }}>
    <div>Vite Preview</div>
    {vitePort && <div style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>:{vitePort}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AppDeveloperWorkspace: React.FC<AppDeveloperWorkspaceProps> = ({
  projectId,
  activeFilePath,
  activeTabKind,
  onFileSelect,
  onOpenSettings,
  activeTerminalId,
  diffPaths,
  className,
}) => {
  const devState = useAppDeveloper();

  // Panel visibility
  const [showFileTree, setShowFileTree] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  // Panel sizes (resizable)
  const { sizes, handleFileTreeResize, handlePreviewResize } = usePanelResize({
    fileTree: 220,
    preview: 400,
  });

  // Resize drag handlers
  const fileTreeDrag = useResizeDrag(handleFileTreeResize);
  const previewDrag = useResizeDrag(handlePreviewResize);

  // Open tabs (derived from state)
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // When activeFilePath changes, add/switch to the tab
  useEffect(() => {
    if (!activeFilePath) return;
    const tabId = `file:${activeFilePath}`;
    setActiveTabId(tabId);
    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      const fileName = activeFilePath.split('/').pop() ?? activeFilePath;
      return [
        ...prev,
        {
          id: tabId,
          label: fileName,
          kind: 'file' as ContentKind,
          icon: fileName,
          closeable: true,
        },
      ];
    });
  }, [activeFilePath]);

  // When terminal id changes, add/switch to the tab
  useEffect(() => {
    if (!activeTerminalId) return;
    const tabId = `terminal:${activeTerminalId}`;
    setActiveTabId(tabId);
    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      return [
        ...prev,
        {
          id: tabId,
          label: `Terminal ${activeTerminalId.slice(0, 6)}`,
          kind: 'terminal' as ContentKind,
          icon: 'terminal',
          closeable: true,
        },
      ];
    });
  }, [activeTerminalId]);

  // Close tab handler
  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      // If closing the active tab, switch to the previous one
      if (tabId === activeTabId && next.length > 0) {
        const newIdx = Math.min(idx, next.length - 1);
        setActiveTabId(next[newIdx]?.id ?? null);
      } else if (next.length === 0) {
        setActiveTabId(null);
      }
      return next;
    });
  }, [activeTabId]);

  // Determine the currently active tab
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );

  // Breadcrumb segments from file path
  const breadcrumbSegments = useMemo(
    () => activeFilePath ? pathToBreadcrumbSegments(activeFilePath) : [],
    [activeFilePath],
  );

  // Language from path
  const language = useMemo(
    () => languageFromPath(activeFilePath),
    [activeFilePath],
  );

  // Resolve components (use real ones if available, placeholders otherwise)
  const FileTreeComponent = FileTree ?? PlaceholderFileTree;
  const CodeViewerComponent = CodeViewer ?? PlaceholderCodeViewer;
  const VitePreviewComponent = VitePreview ?? PlaceholderVitePreview;

  // Vite status for the status bar
  const viteStatus: 'online' | 'offline' | 'detecting' = devState.vitePort
    ? 'online'
    : 'offline';

  // Keyboard shortcut: Cmd+B to toggle file tree, Cmd+J to toggle preview
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setShowFileTree((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setShowPreview((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Render tab icon based on kind
  const renderTabIcon = (tab: WorkspaceTab) => {
    switch (tab.kind) {
      case 'terminal':
        return <TerminalIcon size={12} />;
      case 'diff':
        return <DiffIcon size={12} />;
      case 'preview':
        return <PanelToggleIcon collapsed={false} />;
      case 'file':
      default:
        return <FileIcon size={12} />;
    }
  };

  // Render center content based on active tab kind
  const renderContent = () => {
    if (!activeTab) {
      return (
        <div className={styles.contentEmpty}>
          <div>
            <div style={{ fontSize: '16px', marginBottom: 8 }}>Open a file to start editing</div>
            <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
              Select a file from the tree or use Cmd+P to search
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab.kind) {
      case 'file':
        return activeFilePath ? (
          <CodeViewerComponent
            filePath={activeFilePath}
            projectId={projectId}
          />
        ) : (
          <div className={styles.contentEmpty}>No file selected</div>
        );

      case 'terminal':
        return activeTerminalId ? (
          <div className={styles.contentBody} style={{ height: '100%' }}>
            {/* TerminalViewer from existing workspace — fallback to placeholder */}
            <div style={{
              display: 'grid',
              placeItems: 'center',
              height: '100%',
              fontFamily: 'var(--mono)',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}>
              Terminal: {activeTerminalId}
            </div>
          </div>
        ) : (
          <div className={styles.contentEmpty}>No terminal session</div>
        );

      case 'diff':
        return diffPaths ? (
          <div className={styles.contentBody} style={{
            display: 'grid',
            placeItems: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}>
            Diff: {diffPaths.original} → {diffPaths.modified}
          </div>
        ) : (
          <div className={styles.contentEmpty}>No diff selected</div>
        );

      case 'preview':
        return (
          <VitePreviewComponent
            projectId={projectId}
            vitePort={devState.vitePort}
          />
        );

      default:
        return <div className={styles.contentEmpty}>Unknown tab kind</div>;
    }
  };

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {/* ---- Top toolbar ---- */}
      <div className={styles.toolbar}>
        <button
          className={`${styles.toolbarButton} ${showFileTree ? styles.toolbarButtonActive : ''}`}
          onClick={() => setShowFileTree((v) => !v)}
          title="Toggle file tree (Cmd+B)"
          aria-label="Toggle file tree"
          aria-pressed={showFileTree}
        >
          <FolderIcon size={13} />
          <span>Explorer</span>
        </button>

        <button
          className={`${styles.toolbarButton} ${showPreview ? styles.toolbarButtonActive : ''}`}
          onClick={() => setShowPreview((v) => !v)}
          title="Toggle preview (Cmd+J)"
          aria-label="Toggle preview"
          aria-pressed={showPreview}
        >
          <PanelToggleIcon collapsed={!showPreview} />
          <span>Preview</span>
        </button>

        <div className={styles.toolbarSpacer} />

        <span className={styles.toolbarProjectName}>
          {projectId}
        </span>

        <div className={styles.toolbarSpacer} />

        {onOpenSettings && (
          <button
            className={styles.toolbarButton}
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Open settings"
          >
            <SettingsIcon size={13} />
          </button>
        )}
      </div>

      {/* ---- Three-panel body ---- */}
      <div className={styles.body}>
        {/* FileTree panel */}
        <div
          className={`${styles.fileTreePanel} ${!showFileTree ? styles.fileTreePanelHidden : ''}`}
          style={showFileTree ? { flex: `0 0 ${sizes.fileTree}px` } : undefined}
        >
          <div className={styles.fileTreeHeader}>
            <FolderIcon size={12} />
            <span>Files</span>
            <div className={styles.fileTreeHeaderActions}>
              {/* Future: new file / new folder buttons */}
            </div>
          </div>
          <div className={styles.fileTreeBody}>
            <FileTreeComponent
              projectId={projectId}
              activeFilePath={activeFilePath}
              onFileSelect={onFileSelect}
            />
          </div>
        </div>

        {/* Resize handle: file tree ↔ content */}
        {showFileTree && (
          <div
            className={styles.resizeHandle}
            onPointerDown={fileTreeDrag.startDrag}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize file tree panel"
          />
        )}

        {/* Content panel (center) */}
        <div className={styles.contentPanel}>
          {/* Tab bar */}
          <div className={styles.tabBar} role="tablist">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`${styles.tabItem} ${tab.id === activeTabId ? styles.tabItemActive : ''}`}
                role="tab"
                aria-selected={tab.id === activeTabId}
                tabIndex={tab.id === activeTabId ? 0 : -1}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span className={styles.tabItemIcon}>
                  {renderTabIcon(tab)}
                </span>
                <span>{tab.label}</span>
                {tab.closeable && (
                  <button
                    className={styles.tabItemClose}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    aria-label={`Close ${tab.label}`}
                    title="Close tab"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Breadcrumb */}
          {breadcrumbSegments.length > 0 && (
            <nav className={styles.breadcrumb} aria-label="File breadcrumb">
              {breadcrumbSegments.map((segment, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className={styles.breadcrumbSep}>/</span>}
                  {i < breadcrumbSegments.length - 1 ? (
                    <button
                      className={styles.breadcrumbSegment}
                      onClick={() => {
                        const partialPath = breadcrumbSegments.slice(0, i + 1).join('/');
                        onFileSelect(partialPath);
                      }}
                    >
                      {segment}
                    </button>
                  ) : (
                    <span className={styles.breadcrumbCurrent}>{segment}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Content body */}
          {renderContent()}
        </div>

        {/* Resize handle: content ↔ preview */}
        {showPreview && (
          <div
            className={styles.resizeHandle}
            onPointerDown={previewDrag.startDrag}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview panel"
          />
        )}

        {/* Preview panel */}
        <div
          className={`${styles.previewPanel} ${!showPreview ? styles.previewPanelHidden : ''}`}
          style={showPreview ? { flex: `0 0 ${sizes.preview}px` } : undefined}
        >
          <div className={styles.previewHeader}>
            <span className={styles.previewHeaderTitle}>Preview</span>
            {devState.vitePort && (
              <span className={styles.previewUrl}>
                http://localhost:{devState.vitePort}
              </span>
            )}
          </div>
          <div className={styles.previewBody}>
            <VitePreviewComponent
              projectId={projectId}
              vitePort={devState.vitePort}
            />
          </div>
        </div>
      </div>

      {/* ---- Status bar ---- */}
      <div className={styles.statusBarSlot}>
        <ProjectStatusBar
          projectId={projectId}
          activeFilePath={activeFilePath}
          language={language}
          viteStatus={viteStatus}
        />
      </div>
    </div>
  );
};

export default AppDeveloperWorkspace;
