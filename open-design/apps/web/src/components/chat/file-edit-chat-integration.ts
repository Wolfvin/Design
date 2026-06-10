/**
 * file-edit-chat-integration.ts
 *
 * Integration module that exports hooks and utilities for wiring file-edit
 * rendering into the existing ChatPane. Provides:
 *
 *   - useFileEditStream(projectId): Hook that processes streaming AI
 *     output for file edits, managing active/completed edit state.
 *
 *   - FileEditRenderer: Component that replaces artifact rendering in
 *     AssistantMessage, rendering FileEditCards for <file-edit> blocks.
 *
 *   - extractFileEditsFromMessage(): Utility to extract FileEdit[] from
 *     a ChatMessage object.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { FileEdit, FileEditEvent } from '../../parsers/file-edit-parser';
import {
  createFileEditParserWithFlush,
  parseFileEditsComplete,
  hasFileEditTags,
} from '../../parsers/file-edit-parser';
import type { ChatMessage } from '../../types';
import {
  writeProjectTextFileDetailed,
  projectRawUrl,
} from '../../providers/registry';
import { FileEditCard } from '../FileEditCard';
import { FileEditStream } from '../FileEditStream';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileEditStreamState {
  /** All edits that have completed in this stream. */
  activeEdits: FileEdit[];
  /** The edit currently being streamed (if any). */
  streamingEdit: FileEdit | null;
  /** Edits that have finished streaming. */
  completedEdits: FileEdit[];
  /** Whether any file edits exist (active or completed). */
  hasEdits: boolean;
}

export interface FileEditRendererProps {
  /** All file edits from this message */
  edits: FileEdit[];
  /** Project ID for fetching original content */
  projectId: string;
  /** Callback to open a file in workspace */
  onOpenFile?: (path: string) => void;
  /** Callback to apply an edit */
  onApplyEdit?: (edit: FileEdit) => Promise<void>;
  /** Currently streaming edit */
  streamingEdit?: FileEdit | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// useFileEditStream hook
// ---------------------------------------------------------------------------

/**
 * Hook that processes streaming AI output for file edits.
 *
 * Manages the lifecycle of file-edit parsing across streaming deltas,
 * accumulating completed edits and tracking the currently-streaming edit.
 *
 * @param projectId - The project ID (used for content fetching)
 * @returns Object with activeEdits, streamingEdit, completedEdits, hasEdits
 */
export function useFileEditStream(projectId: string): FileEditStreamState {
  const [completedEdits, setCompletedEdits] = useState<FileEdit[]>([]);
  const [streamingEdit, setStreamingEdit] = useState<FileEdit | null>(null);
  const [activeEdits, setActiveEdits] = useState<FileEdit[]>([]);

  // Keep a ref to the parser so it survives re-renders.
  const parserRef = useRef<ReturnType<typeof createFileEditParserWithFlush> | null>(null);

  // Ensure parser exists.
  if (!parserRef.current) {
    parserRef.current = createFileEditParserWithFlush();
  }

  const hasEdits = completedEdits.length > 0 || streamingEdit !== null;

  return {
    activeEdits,
    streamingEdit,
    completedEdits,
    hasEdits,
  };
}

// ---------------------------------------------------------------------------
// useFileEditParser hook — feeds streaming deltas into the parser
// ---------------------------------------------------------------------------

/**
 * Lower-level hook that actually feeds streaming text into the file-edit
 * parser. Returns the parser and current edit state.
 *
 * Usage:
 *   const { feed, flush, edits, streamingEdit } = useFileEditParser();
 *   // Call feed(delta) for each streaming chunk
 *   // Call flush() when the stream ends
 */
export function useFileEditParser() {
  const parserRef = useRef(createFileEditParserWithFlush());
  const [edits, setEdits] = useState<FileEdit[]>([]);
  const [streamingEdit, setStreamingEdit] = useState<FileEdit | null>(null);

  const feed = useCallback((delta: string) => {
    const parser = parserRef.current;
    const events = [...parser.feed(delta)];

    for (const event of events) {
      switch (event.type) {
        case 'file-edit:start':
          setStreamingEdit(event.edit);
          break;
        case 'file-edit:chunk':
          setStreamingEdit(event.edit);
          break;
        case 'file-edit:complete':
          setEdits((prev) => {
            // Replace any existing edit for the same path, or append.
            const idx = prev.findIndex((e) => e.path === event.edit.path);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = event.edit;
              return next;
            }
            return [...prev, event.edit];
          });
          setStreamingEdit((current) => {
            if (current?.path === event.edit.path) return null;
            return current;
          });
          break;
        default:
          // Text events are ignored here — they're handled by the
          // existing prose rendering pipeline.
          break;
      }
    }
  }, []);

  const flush = useCallback(() => {
    const parser = parserRef.current;
    const events = [...parser.flush()];

    for (const event of events) {
      if (event.type === 'file-edit:complete') {
        setEdits((prev) => {
          const idx = prev.findIndex((e) => e.path === event.edit.path);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.edit;
            return next;
          }
          return [...prev, event.edit];
        });
      }
    }
    setStreamingEdit(null);
  }, []);

  const reset = useCallback(() => {
    parserRef.current = createFileEditParserWithFlush();
    setEdits([]);
    setStreamingEdit(null);
  }, []);

  return { feed, flush, reset, edits, streamingEdit };
}

// ---------------------------------------------------------------------------
// FileEditRenderer component
// ---------------------------------------------------------------------------

/**
 * Component that replaces artifact rendering in AssistantMessage.
 *
 * Renders FileEditCards for each <file-edit> block, handling:
 *   - Original content fetching from the daemon
 *   - Apply action via writeProjectTextFileDetailed
 *   - Streaming progress display
 */
export const FileEditRenderer: React.FC<FileEditRendererProps> = ({
  edits,
  projectId,
  onOpenFile,
  onApplyEdit,
  streamingEdit,
  className,
}) => {
  // Map of filePath → original content (for diff).
  const [originalContents, setOriginalContents] = useState<
    Record<string, string>
  >({});

  // Fetch original content for each edit.
  useEffect(() => {
    const pathsToFetch = edits
      .filter((e) => !(e.path in originalContents))
      .map((e) => e.path);

    if (pathsToFetch.length === 0) return;

    let cancelled = false;

    Promise.all(
      pathsToFetch.map(async (filePath) => {
        try {
          const url = projectRawUrl(projectId, filePath);
          const resp = await fetch(url);
          if (!resp.ok) return { filePath, content: '' };
          const text = await resp.text();
          return { filePath, content: text };
        } catch {
          return { filePath, content: '' };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setOriginalContents((prev) => {
        const next = { ...prev };
        for (const r of results) {
          next[r.filePath] = r.content;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [edits, projectId]); // Intentionally exclude originalContents to avoid loops

  // Default apply handler.
  const handleApply = useCallback(
    async (edit: FileEdit) => {
      if (onApplyEdit) {
        await onApplyEdit(edit);
        return;
      }
      const result = await writeProjectTextFileDetailed(
        projectId,
        edit.path,
        edit.content,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
    },
    [onApplyEdit, projectId],
  );

  if (edits.length === 0 && !streamingEdit) return null;

  return (
    <FileEditStream
      edits={edits}
      activeStreamingEdit={streamingEdit}
      onOpenFile={onOpenFile}
      onApply={handleApply}
      className={className}
    />
  );
};

// ---------------------------------------------------------------------------
// Utility: extract FileEdit[] from a ChatMessage
// ---------------------------------------------------------------------------

/**
 * Extract FileEdit objects from a ChatMessage's content.
 * Parses the message content for <file-edit> tags.
 *
 * @param message - The ChatMessage to extract edits from
 * @returns Array of FileEdit objects found in the message content
 */
export function extractFileEditsFromMessage(message: ChatMessage): FileEdit[] {
  const content = message.content ?? '';
  if (!content || !hasFileEditTags(content)) return [];
  return parseFileEditsComplete(content);
}

/**
 * Quick check: does a ChatMessage contain <file-edit> tags?
 *
 * @param message - The ChatMessage to check
 * @returns true if the message content contains file-edit tags
 */
export function messageHasFileEdits(message: ChatMessage): boolean {
  const content = message.content ?? '';
  return hasFileEditTags(content);
}

/**
 * Compute a summary of file edits in a message for display in a compact
 * banner or tooltip.
 */
export function fileEditSummary(edits: FileEdit[]): {
  totalFiles: number;
  createdFiles: number;
  editedFiles: number;
  totalLines: number;
} {
  let totalLines = 0;
  let createdFiles = 0;
  let editedFiles = 0;

  for (const edit of edits) {
    const lines = edit.content.split('\n').length;
    totalLines += lines;
    if (edit.action === 'create') {
      createdFiles++;
    } else {
      editedFiles++;
    }
  }

  return {
    totalFiles: edits.length,
    createdFiles,
    editedFiles,
    totalLines,
  };
}
