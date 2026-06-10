/**
 * FileEditCard — compact card shown in chat for each <file-edit> block.
 *
 * Displays:
 *   - File path with extension-based icon
 *   - Action type (edit/create) badge
 *   - Line count badge
 *   - Streaming status with animated indicator
 *   - Expandable diff view (click header to expand)
 *   - "Open" and "Apply" action buttons (when complete)
 *   - Error state for problematic edits
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { FileEdit } from '../parsers/file-edit-parser';
import { FileEditDiffView } from './FileEditDiffView';
import styles from './FileEditCard.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileEditCardProps {
  /** The file edit from the parser */
  edit: FileEdit;
  /** Original content for diff (fetched from daemon) */
  originalContent?: string;
  /** Callback to open the file in the editor */
  onOpenFile?: (path: string) => void;
  /** Callback to apply the edit (write to disk) */
  onApply?: (edit: FileEdit) => void;
  /** Whether the edit is currently being streamed */
  isStreaming?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// File extension → icon glyph mapping
// ---------------------------------------------------------------------------

function fileIconGlyph(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'TS',
    tsx: 'TX',
    js: 'JS',
    jsx: 'JX',
    css: '##',
    scss: 'SC',
    html: '<>',
    json: '{}',
    md: 'MD',
    yaml: 'YL',
    yml: 'YL',
    toml: 'TM',
    rs: 'RS',
    py: 'PY',
    rb: 'RB',
    go: 'GO',
    sql: 'DB',
    sh: '>_',
    bash: '>_',
  };
  return map[ext] ?? '📄';
}

// ---------------------------------------------------------------------------
// Line count helper
// ---------------------------------------------------------------------------

function lineCount(content: string): number {
  if (!content) return 0;
  // Split on newlines; a trailing newline adds one empty line we ignore.
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    return lines.length - 1;
  }
  return lines.length;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FileEditCard: React.FC<FileEditCardProps> = ({
  edit,
  originalContent,
  onOpenFile,
  onApply,
  isStreaming = false,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const lines = useMemo(() => lineCount(edit.content), [edit.content]);
  const action = edit.action ?? 'edit';
  const isStreamingEdit = isStreaming || edit.status === 'streaming';

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleOpen = useCallback(() => {
    onOpenFile?.(edit.path);
  }, [onOpenFile, edit.path]);

  const handleApply = useCallback(async () => {
    if (applying) return;
    setApplyError(null);
    setApplying(true);
    try {
      await onApply?.(edit);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  }, [applying, onApply, edit]);

  // Determine status attribute for styling.
  const statusAttr = isStreamingEdit ? 'streaming' : applyError ? 'error' : 'complete';

  return (
    <div
      className={`${styles.root} ${className ?? ''}`}
      data-status={statusAttr}
      data-testid={`file-edit-card-${edit.path}`}
    >
      {/* Header row */}
      <div
        className={styles.header}
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} diff for ${edit.path}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpand();
          }
        }}
      >
        {/* File icon */}
        <div className={styles.fileIcon} data-action={action} aria-hidden>
          {fileIconGlyph(edit.path)}
        </div>

        {/* File path */}
        <span className={styles.filePath} title={edit.path}>
          {edit.path}
        </span>

        {/* Action badge */}
        <span className={styles.actionBadge} data-action={action}>
          {action}
        </span>

        {/* Line count */}
        {lines > 0 && (
          <span className={styles.lineCountBadge}>
            {lines}L
          </span>
        )}

        {/* Streaming indicator */}
        {isStreamingEdit && (
          <span className={styles.streamingDot} aria-label="Streaming" />
        )}

        {/* Expand chevron */}
        <span className={styles.chevron} data-expanded={expanded} aria-hidden>
          ▸
        </span>
      </div>

      {/* Streaming progress bar */}
      {isStreamingEdit && (
        <div className={styles.streamProgress} aria-hidden>
          <div className={styles.streamProgressFill} />
        </div>
      )}

      {/* Streaming preview (partial content while streaming) */}
      {isStreamingEdit && !expanded && edit.content && (
        <div className={styles.streamPreview}>
          {edit.content.slice(-200)}
        </div>
      )}

      {/* Expanded diff view */}
      {expanded && !isStreamingEdit && (
        <div className={styles.diffArea}>
          <FileEditDiffView
            oldContent={originalContent ?? ''}
            newContent={edit.content}
            filePath={edit.path}
          />
        </div>
      )}

      {/* Expanded streaming content (no diff while streaming) */}
      {expanded && isStreamingEdit && edit.content && (
        <div className={styles.streamPreview}>
          {edit.content}
        </div>
      )}

      {/* Error message */}
      {applyError && (
        <div className={styles.errorMsg} role="alert">
          {applyError}
        </div>
      )}

      {/* Action buttons */}
      {!isStreamingEdit && (
        <div className={styles.actions}>
          {onOpenFile && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleOpen}
              title={`Open ${edit.path} in editor`}
            >
              Open
            </button>
          )}
          {onApply && (
            <button
              type="button"
              className={styles.applyBtn}
              onClick={handleApply}
              disabled={applying}
              title={applying ? 'Applying...' : `Apply changes to ${edit.path}`}
            >
              {applying ? 'Applying...' : 'Apply'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FileEditCard;
