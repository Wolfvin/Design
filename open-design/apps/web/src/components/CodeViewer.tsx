import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { highlightCode } from '../runtime/shiki';
import styles from './CodeViewer.module.css';

// ─── Public types ──────────────────────────────────────────────

/** Props for the CodeViewer component. */
export interface CodeViewerProps {
  /** Path of the file being viewed (used for language detection and breadcrumb). */
  filePath: string;
  /** Source code content to display. */
  content: string;
  /** Language override; auto-detected from filePath if not provided. */
  language?: string;
  /** Whether the viewer is in read-only mode (default: true). */
  readOnly?: boolean;
  /** Callback when content changes in edit mode. */
  onContentChange?: (content: string) => void;
  /** 1-based line numbers to highlight (e.g. changed lines). */
  highlightedLines?: number[];
  /** If provided, show diff view comparing content (current) against diffContent (old). */
  diffContent?: string;
  /** Diff display mode: inline (default) or side-by-side. */
  diffMode?: 'inline' | 'side-by-side';
  /** Scroll to a specific 1-based line number on mount or change. */
  scrollToLine?: number;
  /** Callback when a line number is clicked. */
  onLineClick?: (line: number) => void;
  /** Additional CSS class name for the root element. */
  className?: string;
}

// ─── Language auto-detection ───────────────────────────────────

/**
 * Maps a file extension to a Shiki language identifier.
 * Returns 'text' if the extension is unrecognized.
 */
function detectLanguage(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) return 'text';
  const ext = filePath.slice(dot + 1).toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    css: 'css',
    scss: 'css',
    sass: 'css',
    less: 'css',
    html: 'html',
    htm: 'html',
    json: 'json',
    jsonc: 'json',
    md: 'markdown',
    mdx: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    rs: 'rust',
    go: 'go',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    swift: 'swift',
    rb: 'ruby',
    php: 'php',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    diff: 'diff',
    patch: 'diff',
    svg: 'xml',
  };
  // Special filenames
  const basename = filePath.slice(filePath.lastIndexOf('/') + 1).toLowerCase();
  if (basename === 'dockerfile' || basename.startsWith('dockerfile.')) return 'dockerfile';
  if (basename === '.gitignore' || basename === '.env') return 'shell';
  if (basename === 'makefile') return 'shell';
  return map[ext] ?? 'text';
}

// ─── Diff computation ──────────────────────────────────────────

/** A single line in a diff, with its type. */
interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Simple line-based diff: compares old and new content line by line.
 * Uses a longest common subsequence (LCS) approach for accurate diffs.
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to produce the diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  let oldLineNum = m;
  let newLineNum = n;

  // Collect in reverse order
  const stack: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({
        type: 'unchanged',
        content: oldLines[i - 1]!,
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      stack.push({
        type: 'added',
        content: newLines[j - 1]!,
        newLineNumber: j,
      });
      j--;
    } else {
      stack.push({
        type: 'removed',
        content: oldLines[i - 1]!,
        oldLineNumber: i,
      });
      i--;
    }
  }

  // Reverse to get correct order and renumber
  stack.reverse();

  // Re-assign line numbers in order for display
  let oldNum = 1;
  let newNum = 1;
  for (const line of stack) {
    if (line.type === 'unchanged') {
      line.oldLineNumber = oldNum++;
      line.newLineNumber = newNum++;
    } else if (line.type === 'removed') {
      line.oldLineNumber = oldNum++;
      line.newLineNumber = undefined;
    } else {
      line.oldLineNumber = undefined;
      line.newLineNumber = newNum++;
    }
    result.push(line);
  }

  return result;
}

// ─── Breadcrumb builder ────────────────────────────────────────

/** Split a file path into breadcrumb segments. */
function buildBreadcrumbs(filePath: string): string[] {
  return filePath.split('/').filter(Boolean);
}

// ─── HTML escaping for raw code display ────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── CodeViewer component ──────────────────────────────────────

/**
 * Syntax-highlighted code viewer replacing the artifact HTML viewer.
 *
 * Features:
 * - Syntax highlighting using Shiki (github-dark / github-light themes)
 * - Line numbers with click-to-line
 * - Language auto-detection from file extension
 * - Read-only mode by default, optional edit mode
 * - Line highlighting for changed lines
 * - Diff mode: side-by-side or inline
 * - Scroll to line
 * - CSS-based minimap
 * - Copy button
 * - File path breadcrumb
 * - Theme sync (light/dark via CSS custom properties)
 * - Tab size detection (default 2)
 */
export function CodeViewer({
  filePath,
  content,
  language,
  readOnly = true,
  onContentChange,
  highlightedLines = [],
  diffContent,
  diffMode = 'inline',
  scrollToLine,
  onLineClick,
  className,
}: CodeViewerProps) {
  // ── State ────────────────────────────────────────────────
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [diffHighlightedOld, setDiffHighlightedOld] = useState<string | null>(null);
  const [diffHighlightedNew, setDiffHighlightedNew] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [copied, setCopied] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  // ── Refs ─────────────────────────────────────────────────
  const codeViewRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const lineRefMap = useRef<Map<number, HTMLSpanElement>>(new Map());

  // ── Resolved language ────────────────────────────────────
  const resolvedLanguage = useMemo(
    () => language ?? detectLanguage(filePath),
    [language, filePath],
  );

  // ── Breadcrumbs ──────────────────────────────────────────
  const breadcrumbs = useMemo(() => buildBreadcrumbs(filePath), [filePath]);

  // ── Highlighted lines set ────────────────────────────────
  const highlightedSet = useMemo(
    () => new Set(highlightedLines),
    [highlightedLines],
  );

  // ── Content lines ────────────────────────────────────────
  const lines = useMemo(() => content.split('\n'), [content]);

  // ── Highlight code with Shiki ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (isEditing) return;

    void highlightCode(content, resolvedLanguage).then((html) => {
      if (!cancelled) {
        setHighlightedHtml(html || null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [content, resolvedLanguage, isEditing]);

  // ── Highlight diff content with Shiki ────────────────────
  useEffect(() => {
    if (diffContent === undefined) {
      setDiffHighlightedOld(null);
      setDiffHighlightedNew(null);
      return;
    }

    let cancelled = false;

    void Promise.all([
      highlightCode(diffContent, resolvedLanguage),
      highlightCode(content, resolvedLanguage),
    ]).then(([oldHtml, newHtml]) => {
      if (!cancelled) {
        setDiffHighlightedOld(oldHtml || null);
        setDiffHighlightedNew(newHtml || null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [diffContent, content, resolvedLanguage]);

  // ── Scroll to line ───────────────────────────────────────
  useEffect(() => {
    if (scrollToLine == null || scrollToLine < 1) return;
    const el = lineRefMap.current.get(scrollToLine);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [scrollToLine, highlightedHtml]);

  // ── Sync edit content when prop changes ──────────────────
  useEffect(() => {
    setEditContent(content);
  }, [content]);

  // ── Copy to clipboard ────────────────────────────────────
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = content;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  // ── Toggle edit mode ─────────────────────────────────────
  const handleToggleEdit = useCallback(() => {
    if (!readOnly && onContentChange) {
      setIsEditing((prev) => !prev);
    }
  }, [readOnly, onContentChange]);

  // ── Handle edit content change ───────────────────────────
  const handleContentChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setEditContent(value);
      onContentChange?.(value);
    },
    [onContentChange],
  );

  // ── Handle line click ────────────────────────────────────
  const handleLineClick = useCallback(
    (lineNumber: number) => {
      onLineClick?.(lineNumber);
    },
    [onLineClick],
  );

  // ── Scroll sync between line numbers and code ────────────
  const handleCodeScroll = useCallback(() => {
    if (codeViewRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = codeViewRef.current.scrollTop;
    }
  }, []);

  // ── Parse Shiki HTML into line-by-line array ─────────────
  const highlightedLinesHtml = useMemo(() => {
    if (!highlightedHtml) return null;
    // Shiki wraps the code in <pre><code>...lines...</code></pre>
    // Split on newlines inside the code element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = highlightedHtml;
    const codeEl = tempDiv.querySelector('code') || tempDiv.querySelector('pre');
    if (!codeEl) return null;

    // Get the inner HTML split by newlines
    const innerHtml = codeEl.innerHTML;
    const htmlLines = innerHtml.split('\n');
    return htmlLines;
  }, [highlightedHtml]);

  // ── Diff lines ───────────────────────────────────────────
  const diffLines = useMemo(() => {
    if (diffContent === undefined) return null;
    return computeDiff(diffContent, content);
  }, [diffContent, content]);

  // ── Render line numbers ──────────────────────────────────
  function renderLineNumbers(
    count: number,
    options?: {
      diffType?: 'added' | 'removed' | 'unchanged';
      lineNumbers?: (number | undefined)[];
    },
  ) {
    const nums: React.ReactNode[] = [];
    for (let i = 0; i < count; i++) {
      const lineNum = i + 1;
      const isHighlighted = highlightedSet.has(lineNum);
      const displayNum = options?.lineNumbers?.[i];
      const diffClass =
        options?.diffType === 'added'
          ? styles.diffLineNumberAdded
          : options?.diffType === 'removed'
            ? styles.diffLineNumberRemoved
            : '';

      nums.push(
        <span
          key={i}
          className={`${styles.lineNumber} ${isHighlighted ? styles.lineNumberHighlighted : ''} ${diffClass}`}
          onClick={() => handleLineClick(lineNum)}
          ref={(el) => {
            if (el) lineRefMap.current.set(lineNum, el);
          }}
        >
          {displayNum ?? lineNum}
        </span>,
      );
    }
    return nums;
  }

  // ── Render breadcrumb ────────────────────────────────────
  function renderBreadcrumb() {
    return (
      <div className={styles.breadcrumb} aria-label="File path">
        {breadcrumbs.map((segment, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <span key={idx} className={styles.breadcrumbSegment}>
              {idx > 0 ? <span className={styles.breadcrumbSep}>/</span> : null}
              {isLast ? (
                <span className={styles.breadcrumbLast}>{segment}</span>
              ) : (
                <span>{segment}</span>
              )}
            </span>
          );
        })}
      </div>
    );
  }

  // ── Render header actions ────────────────────────────────
  function renderHeaderActions() {
    return (
      <div className={styles.headerActions}>
        <span className={styles.langBadge}>{resolvedLanguage}</span>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={() => void handleCopy()}
          title="Copy to clipboard"
        >
          {copied ? (
            <span className={styles.copiedLabel}>✓ Copied</span>
          ) : (
            '📋 Copy'
          )}
        </button>
        {!readOnly && onContentChange ? (
          <button
            type="button"
            className={`${styles.actionBtn} ${isEditing ? styles.actionBtnActive : ''}`}
            onClick={handleToggleEdit}
            title={isEditing ? 'View mode' : 'Edit mode'}
          >
            {isEditing ? '👁️ View' : '✏️ Edit'}
          </button>
        ) : null}
        <button
          type="button"
          className={`${styles.actionBtn} ${showMinimap ? styles.actionBtnActive : ''}`}
          onClick={() => setShowMinimap((prev) => !prev)}
          title="Toggle minimap"
        >
          🗺️
        </button>
      </div>
    );
  }

  // ── Render single code view (non-diff) ───────────────────
  function renderCodeView() {
    if (isEditing) {
      return (
        <div className={styles.body}>
          <div className={styles.lineNumbers}>
            {renderLineNumbers(editContent.split('\n').length)}
          </div>
          <textarea
            className={styles.editArea}
            value={editContent}
            onChange={handleContentChange}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
      );
    }

    return (
      <div className={styles.body}>
        {/* Line numbers */}
        <div className={styles.lineNumbers} ref={lineNumbersRef}>
          {renderLineNumbers(lines.length)}
        </div>

        {/* Code content */}
        <div
          className={styles.codeView}
          ref={codeViewRef}
          onScroll={handleCodeScroll}
        >
          <div className={styles.codeContent} style={{ position: 'relative' }}>
            {highlightedHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                style={{ position: 'relative', zIndex: 1 }}
              />
            ) : (
              <pre>
                <code>
                  {lines.map((line, i) => (
                    <div key={i}>
                      {escapeHtml(line)}
                    </div>
                  ))}
                </code>
              </pre>
            )}

            {/* Line highlight overlays */}
            {highlightedSet.size > 0 && highlightedLinesHtml
              ? Array.from(highlightedSet).map((lineNum) => {
                  if (lineNum < 1 || lineNum > lines.length) return null;
                  // Use CSS variable values with safe defaults for line height calculation
                  const fontSize = 13; // --code-font-size default
                  const lineHeight = 1.65; // --code-line-height default
                  const topOffset = (lineNum - 1) * fontSize * lineHeight;
                  return (
                    <div
                      key={`hl-${lineNum}`}
                      className={`${styles.lineHighlight} ${styles.lineHighlightAccent}`}
                      style={{ top: `${topOffset}px` }}
                    />
                  );
                })
              : null}
          </div>
        </div>

        {/* Minimap */}
        {showMinimap ? renderMinimap() : null}
      </div>
    );
  }

  // ── Render minimap ───────────────────────────────────────
  function renderMinimap() {
    // CSS-based minimap: render a scaled-down version of the code
    const minimapScale = 0.15;
    const lineHeight = 2; // pixels per line in minimap
    const totalHeight = lines.length * lineHeight;

    return (
      <div className={styles.minimap} title="Minimap">
        <div
          className={styles.minimapCanvas}
          style={{
            height: `${totalHeight}px`,
            fontSize: `${2}px`,
            lineHeight: `${lineHeight}px`,
            fontFamily: 'var(--mono)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            color: 'var(--cv-text-soft)',
            opacity: 0.4,
            transform: `scaleX(${minimapScale})`,
            transformOrigin: 'left top',
            pointerEvents: 'none',
          }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                height: `${lineHeight}px`,
                overflow: 'hidden',
                background: highlightedSet.has(i + 1) ? 'var(--cv-selected-soft)' : undefined,
              }}
            >
              {line.slice(0, 80)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render inline diff ───────────────────────────────────
  function renderInlineDiff() {
    if (!diffLines) return null;

    return (
      <div className={styles.body}>
        <div className={styles.diffInline}>
          {/* Line numbers column */}
          <div className={styles.lineNumbers}>
            {diffLines.map((line, i) => {
              const num = line.type === 'removed' ? line.oldLineNumber : line.newLineNumber;
              const diffClass =
                line.type === 'added'
                  ? styles.diffLineNumberAdded
                  : line.type === 'removed'
                    ? styles.diffLineNumberRemoved
                    : '';
              return (
                <span
                  key={i}
                  className={`${styles.lineNumber} ${diffClass}`}
                  onClick={() => {
                    if (num != null) handleLineClick(num);
                  }}
                >
                  {num ?? ''}
                </span>
              );
            })}
          </div>

          {/* Diff content */}
          <div className={styles.codeContent}>
            {diffLines.map((line, i) => {
              const lineClass =
                line.type === 'added'
                  ? styles.lineAdded
                  : line.type === 'removed'
                    ? styles.lineRemoved
                    : '';

              return (
                <div key={i} className={lineClass} style={{ display: 'flex', alignItems: 'stretch' }}>
                  {line.type === 'added' ? (
                    <span className={styles.lineAddedMarker} />
                  ) : line.type === 'removed' ? (
                    <span className={styles.lineRemovedMarker} />
                  ) : null}
                  <span style={{ flex: '1 1 auto' }}>
                    {escapeHtml(line.content)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Render side-by-side diff ─────────────────────────────
  function renderSideBySideDiff() {
    if (!diffLines) return null;

    const oldLines = diffLines.filter((l) => l.type === 'removed' || l.type === 'unchanged');
    const newLines = diffLines.filter((l) => l.type === 'added' || l.type === 'unchanged');

    return (
      <div className={styles.body}>
        <div className={styles.diffSideBySide}>
          {/* Old content (left pane) */}
          <div className={styles.diffPane}>
            <div className={styles.diffPaneHeader}>Old</div>
            <div className={styles.diffPaneBody}>
              {oldLines.map((line, i) => {
                const lineClass = line.type === 'removed' ? styles.lineRemoved : '';
                return (
                  <div key={i} className={lineClass} style={{ display: 'flex' }}>
                    {line.type === 'removed' && <span className={styles.lineRemovedMarker} />}
                    <span style={{ flex: '1 1 auto' }}>{escapeHtml(line.content)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* New content (right pane) */}
          <div className={styles.diffPane}>
            <div className={styles.diffPaneHeader}>New</div>
            <div className={styles.diffPaneBody}>
              {newLines.map((line, i) => {
                const lineClass = line.type === 'added' ? styles.lineAdded : '';
                return (
                  <div key={i} className={lineClass} style={{ display: 'flex' }}>
                    {line.type === 'added' && <span className={styles.lineAddedMarker} />}
                    <span style={{ flex: '1 1 auto' }}>{escapeHtml(line.content)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────
  const isDiffMode = diffContent !== undefined;

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {/* Header */}
      <div className={styles.header}>
        {renderBreadcrumb()}
        {renderHeaderActions()}
      </div>

      {/* Body */}
      {isDiffMode
        ? diffMode === 'side-by-side'
          ? renderSideBySideDiff()
          : renderInlineDiff()
        : renderCodeView()}
    </div>
  );
}

// ─── Re-export utilities for testing / external use ────────────
export { detectLanguage, computeDiff, buildBreadcrumbs, escapeHtml };
export type { DiffLine };
