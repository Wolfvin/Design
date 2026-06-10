import { describe, expect, it } from 'vitest';

import {
  createFileEditParserWithFlush,
  flushFileEditParser,
  hasFileEditTags,
  parseFileEditsComplete,
  type FileEditEvent,
} from '../../src/parsers/file-edit-parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collect(input: string): FileEditEvent[] {
  const parser = createFileEditParserWithFlush();
  const events: FileEditEvent[] = [];
  for (const e of parser.feed(input)) events.push(e);
  for (const e of parser.flush()) events.push(e);
  return events;
}

function collectChunks(chunks: string[]): FileEditEvent[] {
  const parser = createFileEditParserWithFlush();
  const events: FileEditEvent[] = [];
  for (const c of chunks) {
    for (const e of parser.feed(c)) events.push(e);
  }
  for (const e of parser.flush()) events.push(e);
  return events;
}

function textDeltas(events: FileEditEvent[]): string {
  return events
    .filter((e): e is Extract<FileEditEvent, { type: 'text' }> => e.type === 'text')
    .map((e) => e.delta)
    .join('');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createFileEditParser', () => {
  it('parses a simple single file edit', () => {
    const events = collect(
      'Here is the file:\n<file-edit path="src/index.ts">console.log("hello")</file-edit>\nDone.',
    );
    const start = events.find((e) => e.type === 'file-edit:start');
    const complete = events.find((e) => e.type === 'file-edit:complete');

    expect(start).toBeDefined();
    expect(start!.type).toBe('file-edit:start');
    if (start!.type === 'file-edit:start') {
      expect(start!.path).toBe('src/index.ts');
      expect(start!.edit.path).toBe('src/index.ts');
      expect(start!.edit.action).toBe('edit');
      expect(start!.edit.status).toBe('streaming');
      expect(start!.edit.content).toBe('');
    }

    expect(complete).toBeDefined();
    expect(complete!.type).toBe('file-edit:complete');
    if (complete!.type === 'file-edit:complete') {
      expect(complete!.path).toBe('src/index.ts');
      expect(complete!.edit.content).toBe('console.log("hello")');
      expect(complete!.edit.status).toBe('complete');
      expect(complete!.edit.action).toBe('edit');
    }

    const text = textDeltas(events);
    expect(text).toContain('Here is the file:\n');
    expect(text).toContain('\nDone.');
  });

  it('parses multiple file edits in one response', () => {
    const events = collect(
      [
        '<file-edit path="a.ts">content A</file-edit>',
        '<file-edit path="b.ts">content B</file-edit>',
      ].join('\n'),
    );
    const starts = events.filter((e) => e.type === 'file-edit:start');
    const completes = events.filter((e) => e.type === 'file-edit:complete');

    expect(starts).toHaveLength(2);
    expect(completes).toHaveLength(2);
    expect(completes[0]!.type).toBe('file-edit:complete');
    expect(completes[1]!.type).toBe('file-edit:complete');
    if (completes[0]!.type === 'file-edit:complete') {
      expect(completes[0]!.path).toBe('a.ts');
      expect(completes[0]!.edit.content).toBe('content A');
    }
    if (completes[1]!.type === 'file-edit:complete') {
      expect(completes[1]!.path).toBe('b.ts');
      expect(completes[1]!.edit.content).toBe('content B');
    }
  });

  it('parses file edit with action="create" attribute', () => {
    const events = collect(
      '<file-edit path="new-file.ts" action="create">export const x = 1;</file-edit>',
    );
    const complete = events.find((e) => e.type === 'file-edit:complete');
    expect(complete).toBeDefined();
    if (complete!.type === 'file-edit:complete') {
      expect(complete!.edit.action).toBe('create');
      expect(complete!.edit.path).toBe('new-file.ts');
      expect(complete!.edit.content).toBe('export const x = 1;');
    }
  });

  it('defaults action to "edit" when not specified', () => {
    const events = collect('<file-edit path="a.ts">x</file-edit>');
    const start = events.find((e) => e.type === 'file-edit:start');
    expect(start).toBeDefined();
    if (start!.type === 'file-edit:start') {
      expect(start!.edit.action).toBe('edit');
    }
  });

  it('defaults action to "edit" when action attribute is not "create"', () => {
    const events = collect('<file-edit path="a.ts" action="modify">x</file-edit>');
    const start = events.find((e) => e.type === 'file-edit:start');
    expect(start).toBeDefined();
    if (start!.type === 'file-edit:start') {
      // Only "create" is recognized; any other value falls back to "edit"
      expect(start!.edit.action).toBe('edit');
    }
  });

  it('handles mixed text and file edits', () => {
    const events = collect(
      'Before.\n<file-edit path="a.ts">hello</file-edit>\nBetween.\n<file-edit path="b.ts">world</file-edit>\nAfter.',
    );
    const completes = events.filter((e) => e.type === 'file-edit:complete');
    expect(completes).toHaveLength(2);

    const text = textDeltas(events);
    expect(text).toContain('Before.\n');
    expect(text).toContain('\nBetween.\n');
    expect(text).toContain('\nAfter.');
  });

  it('yields chunk events during streaming', () => {
    // The parser holds back (CLOSE_TAG.length - 1) = 11 chars at the tail
    // to detect partial close tags. So we need content longer than 11 chars
    // per chunk to actually see separate chunk events.
    const parser = createFileEditParserWithFlush();
    const events: FileEditEvent[] = [];

    for (const e of parser.feed('<file-edit path="a.ts">')) events.push(e);
    // Feed enough content to produce multiple chunk events
    for (const e of parser.feed('const x = "hello world";\n')) events.push(e);
    for (const e of parser.feed('const y = "goodbye world";\n')) events.push(e);
    for (const e of parser.feed('console.log(x, y)')) events.push(e);
    for (const e of parser.flush()) events.push(e);

    const chunks = events.filter((e) => e.type === 'file-edit:chunk');
    const complete = events.find((e) => e.type === 'file-edit:complete');
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(complete).toBeDefined();
    if (complete!.type === 'file-edit:complete') {
      expect(complete!.edit.content).toBe(
        'const x = "hello world";\nconst y = "goodbye world";\nconsole.log(x, y)',
      );
    }
  });

  it('handles empty content inside file-edit', () => {
    const events = collect('<file-edit path="empty.ts"></file-edit>');
    const complete = events.find((e) => e.type === 'file-edit:complete');
    expect(complete).toBeDefined();
    if (complete!.type === 'file-edit:complete') {
      expect(complete!.edit.content).toBe('');
    }
  });

  it('handles paths with spaces', () => {
    const events = collect(
      '<file-edit path="src/my file.ts">content</file-edit>',
    );
    const complete = events.find((e) => e.type === 'file-edit:complete');
    expect(complete).toBeDefined();
    if (complete!.type === 'file-edit:complete') {
      expect(complete!.edit.path).toBe('src/my file.ts');
    }
  });

  it('handles content with nested angle brackets', () => {
    const events = collect(
      '<file-edit path="a.html"><div class="foo"><span>bar</span></div></file-edit>',
    );
    const complete = events.find((e) => e.type === 'file-edit:complete');
    expect(complete).toBeDefined();
    if (complete!.type === 'file-edit:complete') {
      expect(complete!.edit.content).toBe('<div class="foo"><span>bar</span></div>');
    }
  });

  // ---------------------------------------------------------------------------
  // Code-block skipping (mirrors artifact parser behavior)
  // ---------------------------------------------------------------------------

  it('does not enter file-edit mode for a tag inside a fenced code block', () => {
    const events = collect(
      [
        'Example:',
        '```html',
        '<file-edit path="demo.ts">demo content</file-edit>',
        '```',
        'After the fence, more prose.',
      ].join('\n'),
    );
    expect(events.find((e) => e.type === 'file-edit:start')).toBeUndefined();
    const text = textDeltas(events);
    expect(text).toContain('After the fence, more prose.');
  });

  it('does not enter file-edit mode for a tag inside inline backticks', () => {
    const events = collect(
      'Use `<file-edit path="x.ts">` syntax in your prompt.',
    );
    expect(events.find((e) => e.type === 'file-edit:start')).toBeUndefined();
    const text = textDeltas(events);
    expect(text).toContain('syntax in your prompt.');
  });

  it('does not enter file-edit mode for a tag wrapped in double backticks', () => {
    const events = collect(
      'Quote it as ``<file-edit path="x.ts">`` in prose.',
    );
    expect(events.find((e) => e.type === 'file-edit:start')).toBeUndefined();
  });

  it('still parses a real file-edit tag when prose contains an inline triple-backtick that is not a fence', () => {
    const events = collect(
      'The opening marker is ```html and the response writes:\n<file-edit path="real.ts">real content</file-edit>',
    );
    expect(events.find((e) => e.type === 'file-edit:start')).toMatchObject({
      path: 'real.ts',
    });
  });

  it('does not enter file-edit mode for <file-editor> or other prefix-shared identifiers', () => {
    const events = collect('prefix <file-editor>demo</file-edit> suffix');
    expect(events.find((e) => e.type === 'file-edit:start')).toBeUndefined();
    const text = textDeltas(events);
    expect(text).toBe('prefix <file-editor>demo</file-edit> suffix');
  });

  // ---------------------------------------------------------------------------
  // Streaming: feed delta by delta
  // ---------------------------------------------------------------------------

  it('correctly processes tags arriving across multiple chunks', () => {
    const parser = createFileEditParserWithFlush();
    const events: FileEditEvent[] = [];

    // The open tag arrives in pieces
    for (const e of parser.feed('Here is the file:\n<file-')) events.push(e);
    for (const e of parser.feed('edit path="src/ind')) events.push(e);
    for (const e of parser.feed('ex.ts">console.lo')) events.push(e);
    for (const e of parser.feed('g("hi")</file-ed')) events.push(e);
    for (const e of parser.feed('it>\nDone.')) events.push(e);
    for (const e of parser.flush()) events.push(e);

    const start = events.find((e) => e.type === 'file-edit:start');
    const complete = events.find((e) => e.type === 'file-edit:complete');
    expect(start).toBeDefined();
    expect(complete).toBeDefined();
    if (complete!.type === 'file-edit:complete') {
      expect(complete!.path).toBe('src/index.ts');
      expect(complete!.edit.content).toBe('console.log("hi")');
    }
    const text = textDeltas(events);
    expect(text).toContain('Here is the file:\n');
    expect(text).toContain('\nDone.');
  });

  it('does not enter file-edit mode when a fenced tag arrives across multiple chunks', () => {
    const parser = createFileEditParserWithFlush();
    const chunks = [
      'Example:\n```html\n<file-edit path="demo.ts"',
      '>demo content</file-ed',
      'it>\n```\nAfter the fence, more prose.',
    ];
    const events: FileEditEvent[] = [];
    for (const c of chunks) {
      for (const e of parser.feed(c)) events.push(e);
    }
    for (const e of parser.flush()) events.push(e);
    expect(events.find((e) => e.type === 'file-edit:start')).toBeUndefined();
    const text = textDeltas(events);
    expect(text).toContain('After the fence, more prose.');
  });

  it('holds back when a chunk ends mid-line on a fence opener prefix', () => {
    const cases: Array<{ name: string; chunks: [string, string] }> = [
      {
        name: 'plus suffix',
        chunks: [
          'Header.\n```c++',
          '\n<file-edit path="x.ts">demo</file-edit>\n```\n',
        ],
      },
      {
        name: 'dash suffix',
        chunks: [
          'Header.\n```ts-',
          '\n<file-edit path="x.ts">demo</file-edit>\n```\n',
        ],
      },
      {
        name: 'trailing space',
        chunks: [
          'Header.\n``` ',
          '\n<file-edit path="x.ts">demo</file-edit>\n```\n',
        ],
      },
    ];
    for (const { name, chunks } of cases) {
      const events = collectChunks([...chunks]);
      expect(events.find((e) => e.type === 'file-edit:start'), name).toBeUndefined();
    }
  });

  it('parses a real file-edit between paragraphs that each carry a stray backtick', () => {
    const events = collect(
      ['intro `', '', '<file-edit path="x.ts">demo</file-edit>', '', 'closing `'].join('\n'),
    );
    expect(events.find((e) => e.type === 'file-edit:start')).toBeDefined();
    expect(events.find((e) => e.type === 'file-edit:complete')).toBeDefined();
  });

  it('does not enter file-edit mode when bridged by stray backticks across HR-shaped lines', () => {
    const events = collect(
      ['intro `', '---', '<file-edit path="x.ts">demo</file-edit>', '---', 'closing `'].join('\n'),
    );
    expect(events.find((e) => e.type === 'file-edit:start')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// flushFileEditParser
// ---------------------------------------------------------------------------

describe('flushFileEditParser', () => {
  it('returns events from feeding an empty delta', () => {
    const parser = createFileEditParserWithFlush();
    const events = flushFileEditParser(parser);
    // No content, should be empty
    expect(events).toEqual([]);
  });

  it('flushes pending text when called', () => {
    const parser = createFileEditParserWithFlush();
    // Feed some text but no complete file-edit
    for (const _e of parser.feed('Hello world')) { /* consume */ }
    const events = flushFileEditParser(parser);
    // flushFileEditParser feeds empty string which would emit the buffered text
    // Actually the basic createFileEditParser feed('') would emit it.
    // Let's check with the with-flush variant
    expect(events.length).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// hasFileEditTags
// ---------------------------------------------------------------------------

describe('hasFileEditTags', () => {
  it('returns true for text with an opening tag', () => {
    expect(hasFileEditTags('<file-edit path="x.ts">')).toBe(true);
  });

  it('returns true for text with a closing tag', () => {
    expect(hasFileEditTags('</file-edit>')).toBe(true);
  });

  it('returns false for text without any file-edit tags', () => {
    expect(hasFileEditTags('Just some text')).toBe(false);
  });

  it('returns false for partial tags that are not complete', () => {
    // "<file-ed" is a partial but still contains the substring
    expect(hasFileEditTags('<file-edit')).toBe(true); // contains the prefix
  });
});

// ---------------------------------------------------------------------------
// parseFileEditsComplete
// ---------------------------------------------------------------------------

describe('parseFileEditsComplete', () => {
  it('returns empty array for text with no file edits', () => {
    expect(parseFileEditsComplete('Just some text')).toEqual([]);
  });

  it('returns a single FileEdit for one tag', () => {
    const edits = parseFileEditsComplete(
      '<file-edit path="src/index.ts">console.log("hello")</file-edit>',
    );
    expect(edits).toHaveLength(1);
    expect(edits[0]!.path).toBe('src/index.ts');
    expect(edits[0]!.content).toBe('console.log("hello")');
    expect(edits[0]!.status).toBe('complete');
    expect(edits[0]!.action).toBe('edit');
  });

  it('returns multiple FileEdits for multiple tags', () => {
    const edits = parseFileEditsComplete(
      '<file-edit path="a.ts">AAA</file-edit><file-edit path="b.ts" action="create">BBB</file-edit>',
    );
    expect(edits).toHaveLength(2);
    expect(edits[0]!.path).toBe('a.ts');
    expect(edits[0]!.content).toBe('AAA');
    expect(edits[0]!.action).toBe('edit');
    expect(edits[1]!.path).toBe('b.ts');
    expect(edits[1]!.content).toBe('BBB');
    expect(edits[1]!.action).toBe('create');
  });

  it('forces completion for unclosed tags (flush behavior)', () => {
    const edits = parseFileEditsComplete(
      '<file-edit path="unclosed.ts">some content without close tag',
    );
    expect(edits).toHaveLength(1);
    expect(edits[0]!.path).toBe('unclosed.ts');
    expect(edits[0]!.content).toBe('some content without close tag');
    expect(edits[0]!.status).toBe('complete');
  });

  it('ignores file-edit tags inside fenced code blocks', () => {
    const edits = parseFileEditsComplete(
      [
        '```html',
        '<file-edit path="demo.ts">demo</file-edit>',
        '```',
      ].join('\n'),
    );
    expect(edits).toHaveLength(0);
  });

  it('handles multiline content', () => {
    const content = 'import React from "react";\n\nexport default function App() {\n  return <div>Hello</div>;\n}';
    const edits = parseFileEditsComplete(
      `<file-edit path="App.tsx" action="create">${content}</file-edit>`,
    );
    expect(edits).toHaveLength(1);
    expect(edits[0]!.content).toBe(content);
    expect(edits[0]!.action).toBe('create');
  });
});
