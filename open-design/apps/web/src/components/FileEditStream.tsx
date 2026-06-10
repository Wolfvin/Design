/**
 * FileEditStream — renders the real-time streaming of file edits as they
 * come in from the AI.
 *
 * Shows:
 *   - All completed edits as compact FileEditCards
 *   - The active streaming edit with a live-updating preview
 *   - A summary header showing total edits count
 */

import React, { useMemo } from 'react';
import type { FileEdit } from '../parsers/file-edit-parser';
import { FileEditCard } from './FileEditCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileEditStreamProps {
  /** Current file edit events from the parser */
  edits: FileEdit[];
  /** Currently streaming edit (if any) */
  activeStreamingEdit?: FileEdit | null;
  /** Callback to open a file */
  onOpenFile?: (path: string) => void;
  /** Callback to apply an edit */
  onApply?: (edit: FileEdit) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Summary header
// ---------------------------------------------------------------------------

function StreamSummary({
  completedCount,
  streamingCount,
}: {
  completedCount: number;
  streamingCount: number;
}) {
  const total = completedCount + streamingCount;

  if (total === 0) return null;

  const label = streamingCount > 0
    ? `${completedCount} file${completedCount !== 1 ? 's' : ''} edited · ${streamingCount} streaming`
    : `${total} file${total !== 1 ? 's' : ''} edited`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 0',
        fontFamily: 'var(--sans)',
        fontSize: 12,
        color: 'var(--text-muted)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-fill-secondary)',
          color: 'var(--text-muted)',
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        {total}
      </span>
      <span>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FileEditStream: React.FC<FileEditStreamProps> = ({
  edits,
  activeStreamingEdit,
  onOpenFile,
  onApply,
  className,
}) => {
  // Separate completed edits from the list (some may still be streaming).
  const completedEdits = useMemo(
    () => edits.filter((e) => e.status === 'complete'),
    [edits],
  );

  const streamingEdits = useMemo(
    () => edits.filter((e) => e.status === 'streaming'),
    [edits],
  );

  // If there's an active streaming edit not already in the edits list, include it.
  const allStreamingEdits = useMemo(() => {
    if (!activeStreamingEdit) return streamingEdits;
    const alreadyPresent = streamingEdits.some(
      (e) => e.path === activeStreamingEdit.path,
    );
    if (alreadyPresent) return streamingEdits;
    return [...streamingEdits, activeStreamingEdit];
  }, [activeStreamingEdit, streamingEdits]);

  const hasEdits = completedEdits.length > 0 || allStreamingEdits.length > 0;

  if (!hasEdits) return null;

  return (
    <div className={className} data-testid="file-edit-stream">
      {/* Summary */}
      <StreamSummary
        completedCount={completedEdits.length}
        streamingCount={allStreamingEdits.length}
      />

      {/* Completed edits */}
      {completedEdits.map((edit) => (
        <FileEditCard
          key={`complete-${edit.path}`}
          edit={edit}
          onOpenFile={onOpenFile}
          onApply={onApply}
          isStreaming={false}
        />
      ))}

      {/* Streaming edits */}
      {allStreamingEdits.map((edit) => (
        <FileEditCard
          key={`streaming-${edit.path}`}
          edit={edit}
          onOpenFile={onOpenFile}
          onApply={onApply}
          isStreaming={true}
        />
      ))}
    </div>
  );
};

export default FileEditStream;
