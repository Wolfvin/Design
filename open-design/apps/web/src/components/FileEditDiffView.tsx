/**
 * FileEditDiffView — Inline diff component for file edits.
 *
 * Renders a line-based diff between old and new file content, with:
 *   - Color-coded added (green) / removed (red) / unchanged (neutral) lines
 *   - Line numbers on both sides (old + new in inline mode, per-panel in side-by-side)
 *   - Collapsible unchanged sections ("N lines unchanged")
 *   - Toggle between inline and side-by-side display modes
 *   - Copy button for the new content
 *
 * The diff algorithm is a self-contained LCS-based approach (no external
 * dependency) that produces an edit script of added/removed/unchanged lines.
 */

import React, { useState, useMemo, useCallback } from 'react';
import styles from './FileEditDiffView.module.css';
import { copyToClipboard } from '../lib/copy-to-clipboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single line in the diff output. */
interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  /** Line number in the old file (1-based), or undefined for added lines. */
  oldLine?: number;
  /** Line number in the new file (1-based), or undefined for removed lines. */
  newLine?: number;
}

/** A contiguous run of unchanged lines that can be collapsed. */
interface UnchangedSection {
  type: 'unchanged-section';
  count: number;
  startOldLine: number;
  startNewLine: number;
  lines: DiffLine[];
}

/** A single diff row that is either a DiffLine or an UnchangedSection. */
type DiffRow =
  | DiffLine
  | UnchangedSection;

export interface FileEditDiffViewProps {
  /** Original content (before edit). Empty string for new files. */
  oldContent: string;
  /** New content (after edit) */
  newContent: string;
  /** File path for language detection */
  filePath: string;
  /** Diff display mode */
  mode?: 'inline' | 'side-by-side';
  /** Maximum number of unchanged lines to show before collapsing */
  maxLines?: number;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Callback when a line is clicked */
  onLineClick?: (line: number, side: 'old' | 'new') => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// LCS-based diff algorithm
// ---------------------------------------------------------------------------

/**
 * Compute the Longest Common Subsequence table for two string arrays.
 * Returns a 2D table where table[i][j] is the LCS length of oldLines[0..i-1]
 * and newLines[0..j-1].
 */
function lcsTable(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;

  // Optimise: for very large files, use a rolling array to reduce memory.
  // For now, straightforward 2D table is fine for typical code files.
  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

/**
 * Backtrack through the LCS table to produce the edit script.
 * Returns an array of DiffLine entries in order.
 */
function backtrackLcs(
  table: number[][],
  oldLines: string[],
  newLines: string[],
): DiffLine[] {
  const result: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  // Walk backwards through the table, emitting lines in reverse order.
  const reversed: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Unchanged line — part of the LCS.
      reversed.push({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLine: i,
        newLine: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      // Added line (present in new, not in old at this position).
      reversed.push({
        type: 'added',
        content: newLines[j - 1],
        newLine: j,
      });
      j--;
    } else if (i > 0) {
      // Removed line (present in old, not in new at this position).
      reversed.push({
        type: 'removed',
        content: oldLines[i - 1],
        oldLine: i,
      });
      i--;
    }
  }

  // Reverse to get the correct order.
  for (let k = reversed.length - 1; k >= 0; k--) {
    result.push(reversed[k]);
  }

  return result;
}

/**
 * Compute the diff between old and new content strings.
 * Returns an array of DiffLine entries.
 */
function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Handle the common case where one side is empty.
  if (oldLines.length === 1 && oldLines[0] === '') {
    // All lines are added (new file).
    return newLines.map((line, idx) => ({
      type: 'added' as const,
      content: line,
      newLine: idx + 1,
    }));
  }

  if (newLines.length === 1 && newLines[0] === '') {
    // All lines are removed (file deleted).
    return oldLines.map((line, idx) => ({
      type: 'removed' as const,
      content: line,
      oldLine: idx + 1,
    }));
  }

  const table = lcsTable(oldLines, newLines);
  return backtrackLcs(table, oldLines, newLines);
}

/**
 * Collapse consecutive runs of unchanged lines into UnchangedSection
 * entries, preserving a small context window around changes.
 *
 * @param lines The flat diff lines.
 * @param contextLines Number of unchanged lines to keep visible around changes.
 * @returns Array of DiffRow entries (DiffLine or UnchangedSection).
 */
function collapseUnchanged(
  lines: DiffLine[],
  contextLines: number = 3,
): DiffRow[] {
  if (lines.length === 0) return [];

  const rows: DiffRow[] = [];

  // First pass: identify which unchanged lines are near a change.
  const nearChange = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== 'unchanged') {
      // Mark surrounding context lines.
      for (
        let c = Math.max(0, i - contextLines);
        c <= Math.min(lines.length - 1, i + contextLines);
        c++
      ) {
        if (lines[c].type === 'unchanged') {
          nearChange.add(c);
        }
      }
    }
  }

  // Second pass: build the row list, collapsing consecutive non-near unchanged lines.
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type !== 'unchanged' || nearChange.has(i)) {
      rows.push(lines[i]);
      i++;
      continue;
    }

    // Start of a collapsible section — collect consecutive non-near unchanged lines.
    const sectionStart = i;
    const sectionLines: DiffLine[] = [];
    while (i < lines.length && lines[i].type === 'unchanged' && !nearChange.has(i)) {
      sectionLines.push(lines[i]);
      i++;
    }

    if (sectionLines.length > 0) {
      rows.push({
        type: 'unchanged-section',
        count: sectionLines.length,
        startOldLine: sectionLines[0].oldLine!,
        startNewLine: sectionLines[0].newLine!,
        lines: sectionLines,
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// File extension → language label mapping
// ---------------------------------------------------------------------------

function languageLabel(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    css: 'CSS',
    scss: 'SCSS',
    html: 'HTML',
    json: 'JSON',
    md: 'Markdown',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    rs: 'Rust',
    py: 'Python',
    rb: 'Ruby',
    go: 'Go',
    sql: 'SQL',
    sh: 'Shell',
    bash: 'Bash',
  };
  return map[ext] ?? ext.toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FileEditDiffView: React.FC<FileEditDiffViewProps> = ({
  oldContent,
  newContent,
  filePath,
  mode: initialMode = 'inline',
  maxLines = 3,
  showLineNumbers = true,
  onLineClick,
  className,
}) => {
  const [mode, setMode] = useState<'inline' | 'side-by-side'>(initialMode);
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Compute the diff once.
  const diffLines = useMemo(
    () => computeDiff(oldContent, newContent),
    [oldContent, newContent],
  );

  // Collapse unchanged sections.
  const rows = useMemo(
    () => collapseUnchanged(diffLines, maxLines),
    [diffLines, maxLines],
  );

  const toggleSection = useCallback((idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(newContent);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }, [newContent]);

  // Count changes for the summary.
  const addedCount = diffLines.filter((l) => l.type === 'added').length;
  const removedCount = diffLines.filter((l) => l.type === 'removed').length;

  // No changes at all?
  if (addedCount === 0 && removedCount === 0) {
    return (
      <div className={`${styles.root} ${className ?? ''}`}>
        <div className={styles.toolbar}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
            {languageLabel(filePath)}
          </span>
        </div>
        <div className={styles.noChanges}>No changes detected</div>
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontFamily: 'var(--sans)',
          }}
        >
          {languageLabel(filePath)}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            fontFamily: 'var(--sans)',
            marginLeft: 6,
          }}
        >
          +{addedCount} / −{removedCount}
        </span>
        <div className={styles.toolbarSpacer} />
        <button
          type="button"
          className={`${styles.modeToggle} ${mode === 'inline' ? styles.modeToggleActive : ''}`}
          data-active={mode === 'inline'}
          onClick={() => setMode('inline')}
          title="Inline diff"
        >
          Inline
        </button>
        <button
          type="button"
          className={`${styles.modeToggle} ${mode === 'side-by-side' ? styles.modeToggleActive : ''}`}
          data-active={mode === 'side-by-side'}
          onClick={() => setMode('side-by-side')}
          title="Side-by-side diff"
        >
          Split
        </button>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy new content'}
          aria-label="Copy new content to clipboard"
        >
          {copied ? '✓' : '⎘'}
        </button>
      </div>

      {/* Diff body */}
      <div className={styles.body}>
        {mode === 'inline'
          ? renderInlineDiff(rows, expandedSections, toggleSection, showLineNumbers, onLineClick)
          : renderSideBySideDiff(rows, expandedSections, toggleSection, showLineNumbers, onLineClick)}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inline mode renderer
// ---------------------------------------------------------------------------

function renderInlineDiff(
  rows: DiffRow[],
  expandedSections: Set<number>,
  toggleSection: (idx: number) => void,
  showLineNumbers: boolean,
  onLineClick?: (line: number, side: 'old' | 'new') => void,
): React.ReactNode {
  let rowIndex = 0;

  return rows.map((row, idx) => {
    if (row.type === 'unchanged-section') {
      const section = row as UnchangedSection;
      const isExpanded = expandedSections.has(idx);

      if (isExpanded) {
        // Render the expanded lines.
        return (
          <React.Fragment key={`section-${idx}`}>
            {section.lines.map((line, li) => (
              <div
                key={`s-${idx}-${li}`}
                className={styles.inlineRow}
                data-type={line.type}
              >
                {showLineNumbers && (
                  <div className={styles.lineNumCell}>
                    {line.oldLine ?? ''}
                  </div>
                )}
                {showLineNumbers && (
                  <div className={styles.lineNumCell}>
                    {line.newLine ?? ''}
                  </div>
                )}
                <div className={styles.inlineContent}>
                  <Sign type={line.type} />
                  {line.content}
                </div>
              </div>
            ))}
          </React.Fragment>
        );
      }

      return (
        <button
          key={`collapse-${idx}`}
          type="button"
          className={styles.collapseRow}
          onClick={() => toggleSection(idx)}
          aria-label={`Expand ${section.count} unchanged lines`}
          title={`Click to expand ${section.count} unchanged lines (lines ${section.startOldLine}–${section.startOldLine + section.count - 1})`}
        >
          ⋯ {section.count} lines unchanged ⋯
        </button>
      );
    }

    const line = row as DiffLine;
    const key = `line-${rowIndex++}`;

    return (
      <div
        key={key}
        className={styles.inlineRow}
        data-type={line.type}
        onClick={
          onLineClick
            ? () => {
                if (line.oldLine !== undefined) onLineClick(line.oldLine, 'old');
                if (line.newLine !== undefined) onLineClick(line.newLine, 'new');
              }
            : undefined
        }
        style={onLineClick ? { cursor: 'pointer' } : undefined}
      >
        {showLineNumbers && (
          <div className={styles.lineNumCell}>{line.oldLine ?? ''}</div>
        )}
        {showLineNumbers && (
          <div className={styles.lineNumCell}>{line.newLine ?? ''}</div>
        )}
        <div className={styles.inlineContent}>
          <Sign type={line.type} />
          {line.content}
        </div>
      </div>
    );
  });
}

// ---------------------------------------------------------------------------
// Side-by-side mode renderer
// ---------------------------------------------------------------------------

function renderSideBySideDiff(
  rows: DiffRow[],
  expandedSections: Set<number>,
  toggleSection: (idx: number) => void,
  showLineNumbers: boolean,
  onLineClick?: (line: number, side: 'old' | 'new') => void,
): React.ReactNode {
  // For side-by-side, we need to pair added and removed lines.
  // We walk the flat diffLines and pair consecutive removed→added.
  const pairedLines = pairDiffLines(rows);

  return pairedLines.map((pair, idx) => {
    if (pair.type === 'collapse') {
      const section = pair.section!;
      const isExpanded = expandedSections.has(pair.sectionIndex!);

      if (isExpanded && section) {
        return (
          <React.Fragment key={`section-${idx}`}>
            {section.lines.map((line, li) => (
              <div
                key={`s-${idx}-${li}`}
                className={styles.sideBySideRow}
                data-type="unchanged"
              >
                <div className={styles.sidePanel} data-side="old">
                  {showLineNumbers && (
                    <div className={styles.sideLineNum}>{line.oldLine ?? ''}</div>
                  )}
                  <div className={styles.sideContent}>{line.content}</div>
                </div>
                <div className={styles.sidePanel} data-side="new">
                  {showLineNumbers && (
                    <div className={styles.sideLineNum}>{line.newLine ?? ''}</div>
                  )}
                  <div className={styles.sideContent}>{line.content}</div>
                </div>
              </div>
            ))}
          </React.Fragment>
        );
      }

      return (
        <button
          key={`collapse-${idx}`}
          type="button"
          className={styles.collapseRow}
          onClick={() => toggleSection(pair.sectionIndex!)}
          aria-label={`Expand ${section?.count ?? 0} unchanged lines`}
        >
          ⋯ {section?.count ?? 0} lines unchanged ⋯
        </button>
      );
    }

    return (
      <div
        key={`pair-${idx}`}
        className={styles.sideBySideRow}
        data-type={pair.type}
      >
        <div
          className={styles.sidePanel}
          data-side="old"
          data-empty={pair.type === 'added' ? 'true' : undefined}
        >
          {showLineNumbers && (
            <div className={styles.sideLineNum}>{pair.oldLine ?? ''}</div>
          )}
          <div className={styles.sideContent}>
            {pair.type !== 'added' ? (
              <>
                <Sign type={pair.type === 'removed' ? 'removed' : 'unchanged'} />
                {pair.oldContent ?? ''}
              </>
            ) : null}
          </div>
        </div>
        <div
          className={styles.sidePanel}
          data-side="new"
          data-empty={pair.type === 'removed' ? 'true' : undefined}
        >
          {showLineNumbers && (
            <div className={styles.sideLineNum}>{pair.newLine ?? ''}</div>
          )}
          <div className={styles.sideContent}>
            {pair.type !== 'removed' ? (
              <>
                <Sign type={pair.type === 'added' ? 'added' : 'unchanged'} />
                {pair.newContent ?? ''}
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  });
}

// ---------------------------------------------------------------------------
// Pair diff lines for side-by-side rendering
// ---------------------------------------------------------------------------

interface SideBySidePair {
  type: 'added' | 'removed' | 'unchanged' | 'collapse';
  oldContent?: string;
  newContent?: string;
  oldLine?: number;
  newLine?: number;
  section?: UnchangedSection;
  sectionIndex?: number;
}

function pairDiffLines(rows: DiffRow[]): SideBySidePair[] {
  const pairs: SideBySidePair[] = [];

  // Flatten rows into a simple line array for pairing.
  const flatLines: DiffLine[] = [];
  const sectionMap = new Map<number, UnchangedSection>();
  const lineToSectionIdx = new Map<number, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.type === 'unchanged-section') {
      const section = row as UnchangedSection;
      for (const line of section.lines) {
        sectionMap.set(flatLines.length, section);
        lineToSectionIdx.set(flatLines.length, i);
        flatLines.push(line);
      }
    } else if (row.type !== 'unchanged-section') {
      flatLines.push(row as DiffLine);
    }
  }

  // Walk lines and pair removed→added.
  let i = 0;
  while (i < flatLines.length) {
    const line = flatLines[i];

    // Check if this line belongs to a collapsed section.
    const sectionIdx = lineToSectionIdx.get(i);
    if (sectionIdx !== undefined) {
      const section = sectionMap.get(i)!;
      // Find how many lines belong to this section.
      const sectionStart = i;
      let sectionEnd = i;
      while (
        sectionEnd < flatLines.length &&
        lineToSectionIdx.get(sectionEnd) === sectionIdx
      ) {
        sectionEnd++;
      }
      // Emit a single collapse entry for the whole section.
      pairs.push({
        type: 'collapse',
        section,
        sectionIndex: sectionIdx,
      });
      i = sectionEnd;
      continue;
    }

    if (line.type === 'unchanged') {
      pairs.push({
        type: 'unchanged',
        oldContent: line.content,
        newContent: line.content,
        oldLine: line.oldLine,
        newLine: line.newLine,
      });
      i++;
    } else if (line.type === 'removed') {
      // Look ahead for a matching added line.
      const nextLine = flatLines[i + 1];
      if (nextLine && nextLine.type === 'added') {
        // Paired change.
        pairs.push({
          type: 'removed',
          oldContent: line.content,
          oldLine: line.oldLine,
        });
        pairs.push({
          type: 'added',
          newContent: nextLine.content,
          newLine: nextLine.newLine,
        });
        i += 2;
      } else {
        // Removed without a paired add.
        pairs.push({
          type: 'removed',
          oldContent: line.content,
          oldLine: line.oldLine,
        });
        i++;
      }
    } else {
      // Added line.
      pairs.push({
        type: 'added',
        newContent: line.content,
        newLine: line.newLine,
      });
      i++;
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Sign indicator (+/-/ )
// ---------------------------------------------------------------------------

function Sign({ type }: { type: DiffLine['type'] }) {
  if (type === 'added') {
    return <span className={`${styles.sign} ${styles.signAdded}`}>+</span>;
  }
  if (type === 'removed') {
    return <span className={`${styles.sign} ${styles.signRemoved}`}>−</span>;
  }
  return <span className={styles.sign}> </span>;
}

export default FileEditDiffView;
