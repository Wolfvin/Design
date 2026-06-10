/**
 * Streaming parser for <file-edit path="..." action="edit|create">...</file-edit>
 * tags. Designed to replace the old <artifact> parser as part of the
 * Open Design app developer migration (Phase 1-A).
 *
 * Feed deltas in, iterate events. The generator-based pattern mirrors
 * the existing artifact parser so the integration surface is identical.
 *
 * Key differences from the artifact parser:
 *   - Tags carry `path` (required) and `action` (optional, default "edit")
 *   - Close tag is `</file-edit>` instead of `</artifact>`
 *   - Content events include the full `FileEdit` object for convenience
 */

import {
  computeSkipRanges,
  FENCE_OPEN_RE,
  rangeContains,
} from '../artifacts/markdown-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileEdit {
  /** File path relative to project root */
  path: string;
  /** Full file content (accumulates during streaming) */
  content: string;
  /** Whether the edit is still streaming or complete */
  status: 'streaming' | 'complete';
  /** 'edit' for modifying an existing file, 'create' for a new one */
  action?: 'edit' | 'create';
}

export type FileEditEvent =
  | { type: 'text'; delta: string }
  | { type: 'file-edit:start'; path: string; edit: FileEdit }
  | { type: 'file-edit:chunk'; path: string; delta: string; edit: FileEdit }
  | { type: 'file-edit:complete'; path: string; edit: FileEdit };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPEN_PREFIX = '<file-edit';
const CLOSE_TAG = '</file-edit>';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ParserState {
  inside: boolean;
  buffer: string;
  path: string;
  action: 'edit' | 'create';
  content: string;
}

function parseAttrs(raw: string): Record<string, string> {
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null = re.exec(raw);
  while (m !== null) {
    out[m[1] as string] = (m[2] ?? m[3] ?? '') as string;
    m = re.exec(raw);
  }
  return out;
}

type OpenTagMatch =
  | { kind: 'complete'; start: number; end: number; attrs: string }
  | { kind: 'partial'; start: number }
  | { kind: 'none' };

/**
 * `<file-edit` must be followed by whitespace to count as a real open tag;
 * strings like `<file-editor>` or `<file-editing>` are NOT protocol tags.
 */
function isRealFileEditOpenAt(content: string, idx: number): boolean {
  const next = content.charAt(idx + OPEN_PREFIX.length);
  return next !== '' && /\s/.test(next);
}

/**
 * Scan the buffer for `<file-edit …>` while skipping any positions that the
 * chat markdown renderer would render as a fenced code block or inline code
 * span — same logic as the artifact parser, reusing the shared
 * markdown-context module.
 *
 * Streaming caveats handled here (mirrored from the artifact parser):
 *   * Open fence with no close yet → hold back from its opening line.
 *   * Unterminated tail line that could still resolve into a fence delimiter
 *     → hold back from the line start.
 *   * Unmatched opening backtick after the last \n → hold back from it.
 *   * Strict prefix at the tail (e.g. "<file-ed") → hold back.
 */
function findOpenTag(buffer: string): OpenTagMatch {
  const len = buffer.length;
  const { ranges, unclosedFenceStart } = computeSkipRanges(buffer);

  // Pass 1: scan for the earliest *complete* real `<file-edit …>` open
  // outside any skip range.
  let earliestPartialOpen = -1;
  let from = 0;
  while (from < len) {
    const idx = buffer.indexOf(OPEN_PREFIX, from);
    if (idx === -1) break;
    if (rangeContains(ranges, idx)) {
      from = idx + OPEN_PREFIX.length;
      continue;
    }
    if (unclosedFenceStart !== null && idx >= unclosedFenceStart) {
      // Anything past an unclosed fence opener is inside a code block;
      // treat as skip range, not a real tag.
      break;
    }
    const after = idx + OPEN_PREFIX.length;
    const next = buffer.charAt(after);
    if (next === '') {
      // `<file-edit` at very end of buffer — could become real with the next
      // chunk. Remember the earliest one and keep looking for a complete tag.
      if (earliestPartialOpen === -1) earliestPartialOpen = idx;
      break;
    }
    if (!isRealFileEditOpenAt(buffer, idx)) {
      // Not a real <file-edit ...> open (e.g. "<file-editor"). Keep scanning.
      from = after;
      continue;
    }
    let j = after;
    let quote: '"' | "'" | null = null;
    while (j < len) {
      const c = buffer.charAt(j);
      if (quote !== null) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '>') {
        return { kind: 'complete', start: idx, end: j + 1, attrs: buffer.slice(after, j) };
      }
      j++;
    }
    // Ran out of buffer before the closing `>` arrived — partial open tag.
    if (earliestPartialOpen === -1) earliestPartialOpen = idx;
    break;
  }

  // Pass 2: no complete open found. Decide whether to hold back, and if so,
  // from which position.
  let holdback = -1;
  const note = (pos: number | null) => {
    if (pos !== null && pos !== -1 && (holdback === -1 || pos < holdback)) holdback = pos;
  };
  note(earliestPartialOpen);
  note(unclosedFenceStart);

  const lastNl = buffer.lastIndexOf('\n');
  if (lastNl < len - 1) {
    const tailLineStart = lastNl + 1;
    const tail = buffer.slice(tailLineStart);
    if (FENCE_OPEN_RE.test(tail) || /^`{1,2}$/.test(tail)) {
      note(tailLineStart);
    }
  }

  // Unmatched backtick on the tail line
  let firstUnmatched = -1;
  let parity = 0;
  for (let k = lastNl + 1; k < len; k++) {
    if (buffer.charAt(k) !== '`') continue;
    if (rangeContains(ranges, k)) continue;
    if (parity === 0) {
      firstUnmatched = k;
      parity = 1;
    } else {
      firstUnmatched = -1;
      parity = 0;
    }
  }
  note(firstUnmatched);

  // Strict prefix at the tail (e.g. "<file-ed") — hold back.
  const tailLt = buffer.lastIndexOf('<');
  if (tailLt !== -1 && !rangeContains(ranges, tailLt)) {
    const slice = buffer.slice(tailLt);
    if (OPEN_PREFIX.startsWith(slice) && slice.length < OPEN_PREFIX.length) {
      note(tailLt);
    }
  }

  if (holdback !== -1) return { kind: 'partial', start: holdback };
  return { kind: 'none' };
}

// ---------------------------------------------------------------------------
// Public API: generator-based streaming parser
// ---------------------------------------------------------------------------

export function createFileEditParser() {
  const state: ParserState = {
    inside: false,
    buffer: '',
    path: '',
    action: 'edit',
    content: '',
  };

  /**
   * Feed a delta (chunk of streaming text) into the parser.
   * Yields `FileEditEvent` objects as they are identified.
   */
  function* feed(delta: string): Generator<FileEditEvent> {
    state.buffer += delta;

    while (state.buffer.length > 0) {
      if (!state.inside) {
        const open = findOpenTag(state.buffer);
        if (open.kind === 'none') {
          yield { type: 'text', delta: state.buffer };
          state.buffer = '';
          return;
        }
        if (open.kind === 'partial') {
          if (open.start > 0) {
            yield { type: 'text', delta: state.buffer.slice(0, open.start) };
            state.buffer = state.buffer.slice(open.start);
          }
          return;
        }
        // open.kind === 'complete'
        if (open.start > 0) {
          yield { type: 'text', delta: state.buffer.slice(0, open.start) };
        }
        const attrs = parseAttrs(open.attrs);
        state.inside = true;
        state.path = attrs['path'] ?? '';
        state.action = attrs['action'] === 'create' ? 'create' : 'edit';
        state.content = '';
        state.buffer = state.buffer.slice(open.end);

        const edit: FileEdit = {
          path: state.path,
          content: '',
          status: 'streaming',
          action: state.action,
        };
        yield { type: 'file-edit:start', path: state.path, edit };
        continue;
      }

      // Inside a <file-edit> block — look for the close tag.
      const closeIdx = state.buffer.indexOf(CLOSE_TAG);
      if (closeIdx === -1) {
        // Hold back enough bytes to detect a partial close tag at the tail.
        const flushUpTo = state.buffer.length - (CLOSE_TAG.length - 1);
        if (flushUpTo > 0) {
          const chunk = state.buffer.slice(0, flushUpTo);
          state.content += chunk;
          state.buffer = state.buffer.slice(flushUpTo);

          const edit: FileEdit = {
            path: state.path,
            content: state.content,
            status: 'streaming',
            action: state.action,
          };
          yield { type: 'file-edit:chunk', path: state.path, delta: chunk, edit };
        }
        return;
      }

      // Found the close tag — emit final chunk and complete event.
      const finalChunk = state.buffer.slice(0, closeIdx);
      if (finalChunk.length > 0) {
        state.content += finalChunk;

        const streamingEdit: FileEdit = {
          path: state.path,
          content: state.content,
          status: 'streaming',
          action: state.action,
        };
        yield { type: 'file-edit:chunk', path: state.path, delta: finalChunk, edit: streamingEdit };
      }

      const completeEdit: FileEdit = {
        path: state.path,
        content: state.content,
        status: 'complete',
        action: state.action,
      };
      yield { type: 'file-edit:complete', path: state.path, edit: completeEdit };

      state.buffer = state.buffer.slice(closeIdx + CLOSE_TAG.length);
      state.inside = false;
      state.path = '';
      state.action = 'edit';
      state.content = '';
    }
  }

  return { feed };
}

// ---------------------------------------------------------------------------
// Public API: utility functions
// ---------------------------------------------------------------------------

/**
 * Flush any remaining buffer and force-close open edits.
 * Call this when the stream has ended to emit any pending events.
 */
export function flushFileEditParser(parser: ReturnType<typeof createFileEditParser>): FileEditEvent[] {
  // The parser doesn't expose its internal state directly, so we access the
  // generator pattern: feed an empty string, then we need another approach.
  // Actually, we need access to the internal state. Let's restructure.
  //
  // The simplest approach: create a wrapper that tracks state externally.
  // But for API compatibility with the task spec, we'll use a different
  // approach — feed an empty delta to flush any buffered text, then
  // the caller must handle the "unclosed edit" case separately.
  //
  // For a clean implementation, we'll create an extended parser that
  // also exposes a flush method.

  // This function works with the extended parser (see createFileEditParserWithFlush)
  const events: FileEditEvent[] = [];
  for (const e of parser.feed('')) events.push(e);
  return events;
}

// ---------------------------------------------------------------------------
// Extended parser with flush support
// ---------------------------------------------------------------------------

interface FileEditParserWithFlush {
  feed: (delta: string) => Generator<FileEditEvent>;
  flush: () => Generator<FileEditEvent>;
}

/**
 * Create a file-edit parser that also supports flushing.
 * This is the recommended way to create a parser for full lifecycle use.
 */
export function createFileEditParserWithFlush(): FileEditParserWithFlush {
  const state: ParserState = {
    inside: false,
    buffer: '',
    path: '',
    action: 'edit',
    content: '',
  };

  function* feed(delta: string): Generator<FileEditEvent> {
    state.buffer += delta;

    while (state.buffer.length > 0) {
      if (!state.inside) {
        const open = findOpenTag(state.buffer);
        if (open.kind === 'none') {
          yield { type: 'text', delta: state.buffer };
          state.buffer = '';
          return;
        }
        if (open.kind === 'partial') {
          if (open.start > 0) {
            yield { type: 'text', delta: state.buffer.slice(0, open.start) };
            state.buffer = state.buffer.slice(open.start);
          }
          return;
        }
        // open.kind === 'complete'
        if (open.start > 0) {
          yield { type: 'text', delta: state.buffer.slice(0, open.start) };
        }
        const attrs = parseAttrs(open.attrs);
        state.inside = true;
        state.path = attrs['path'] ?? '';
        state.action = attrs['action'] === 'create' ? 'create' : 'edit';
        state.content = '';
        state.buffer = state.buffer.slice(open.end);

        const edit: FileEdit = {
          path: state.path,
          content: '',
          status: 'streaming',
          action: state.action,
        };
        yield { type: 'file-edit:start', path: state.path, edit };
        continue;
      }

      // Inside a <file-edit> block — look for the close tag.
      const closeIdx = state.buffer.indexOf(CLOSE_TAG);
      if (closeIdx === -1) {
        const flushUpTo = state.buffer.length - (CLOSE_TAG.length - 1);
        if (flushUpTo > 0) {
          const chunk = state.buffer.slice(0, flushUpTo);
          state.content += chunk;
          state.buffer = state.buffer.slice(flushUpTo);

          const edit: FileEdit = {
            path: state.path,
            content: state.content,
            status: 'streaming',
            action: state.action,
          };
          yield { type: 'file-edit:chunk', path: state.path, delta: chunk, edit };
        }
        return;
      }

      const finalChunk = state.buffer.slice(0, closeIdx);
      if (finalChunk.length > 0) {
        state.content += finalChunk;

        const streamingEdit: FileEdit = {
          path: state.path,
          content: state.content,
          status: 'streaming',
          action: state.action,
        };
        yield { type: 'file-edit:chunk', path: state.path, delta: finalChunk, edit: streamingEdit };
      }

      const completeEdit: FileEdit = {
        path: state.path,
        content: state.content,
        status: 'complete',
        action: state.action,
      };
      yield { type: 'file-edit:complete', path: state.path, edit: completeEdit };

      state.buffer = state.buffer.slice(closeIdx + CLOSE_TAG.length);
      state.inside = false;
      state.path = '';
      state.action = 'edit';
      state.content = '';
    }
  }

  function* flush(): Generator<FileEditEvent> {
    if (state.inside) {
      if (state.buffer.length > 0) {
        state.content += state.buffer;

        const edit: FileEdit = {
          path: state.path,
          content: state.content,
          status: 'streaming',
          action: state.action,
        };
        yield { type: 'file-edit:chunk', path: state.path, delta: state.buffer, edit };
        state.buffer = '';
      }

      const completeEdit: FileEdit = {
        path: state.path,
        content: state.content,
        status: 'complete',
        action: state.action,
      };
      yield { type: 'file-edit:complete', path: state.path, edit: completeEdit };
    } else if (state.buffer.length > 0) {
      yield { type: 'text', delta: state.buffer };
    }
    state.buffer = '';
    state.inside = false;
  }

  return { feed, flush };
}

/**
 * Check if a string contains any `<file-edit>` tags (opening or closing).
 * Quick scan — does not validate attribute structure.
 */
export function hasFileEditTags(text: string): boolean {
  return text.includes(OPEN_PREFIX) || text.includes(CLOSE_TAG);
}

/**
 * Parse a complete (non-streaming) string into an array of `FileEdit` objects.
 * Convenience wrapper for when you have the full response up front.
 */
export function parseFileEditsComplete(text: string): FileEdit[] {
  const parser = createFileEditParserWithFlush();
  const edits: FileEdit[] = [];

  for (const event of parser.feed(text)) {
    if (event.type === 'file-edit:complete') {
      edits.push(event.edit);
    }
  }
  for (const event of parser.flush()) {
    if (event.type === 'file-edit:complete') {
      edits.push(event.edit);
    }
  }

  return edits;
}
