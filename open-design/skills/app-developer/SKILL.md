---
name: app-developer
description: |
  Edit source code in an existing React + Tauri + TypeScript project.
  Works directly on project files with Vite HMR for instant preview.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: code-edit
  outputFormat: file-edit
  stackCompatibility: both
  design_system:
    requires: true
  craft:
    requires:
      - file-conventions
      - editing-rules
---

# App Developer Skill

You are working inside an **existing** React + Tauri + TypeScript codebase.
You do **not** create new projects from scratch — you edit, extend, and
refactor files that already exist on disk. Vite HMR provides instant
preview, so every file you save is immediately reflected in the running
app.

## Core Principles

1. **Read before edit.** Always read the target file before modifying it.
   Understand existing patterns, imports, and naming conventions.
2. **Surgical edits.** Only change what is necessary. Do not rewrite
   entire files when a targeted change suffices.
3. **Preserve existing code.** Never delete code you don't understand.
   Comment it out with a `// TODO: remove if unused after <date>` note
   if you must suppress it.
4. **Hot reload awareness.** Every `<file-edit>` you emit triggers
   Vite HMR. Plan your edits so the app never enters a broken
   intermediate state — save dependent files in a logical order.

## Output Format

All output uses `<file-edit>` tags instead of `<artifact>`. The format:

```
<file-edit path="src/components/Header.tsx">
import React from 'react';

export function Header({ title }: { title: string }) {
  return <header className="text-lg font-semibold">{title}</header>;
}
</file-edit>
```

### Multiple files

Emit one `<file-edit>` per file, in dependency order (types first, then
components, then pages, then routes):

```
<file-edit path="src/types/user.ts">
export interface User {
  id: string;
  name: string;
  email: string;
}
</file-edit>

<file-edit path="src/components/UserCard.tsx">
import { User } from '@/types/user';

export function UserCard({ user }: { user: User }) {
  return <div className="p-4 rounded-lg border">{user.name}</div>;
}
</file-edit>
```

### New files

When creating a file that doesn't yet exist, use the same `<file-edit>`
tag. The runtime will create the file and any missing intermediate
directories.

```
<file-edit path="src/hooks/useAuth.ts">
import { useState, useEffect } from 'react';
// ... implementation
</file-edit>
```

### Partial edits

When only a portion of a file needs to change, include enough surrounding
context to uniquely identify the edit location:

```
<file-edit path="src/App.tsx">
// ... existing code above ...

export function App() {
  // CHANGED: added dark mode class
  return <div className="min-h-screen bg-white dark:bg-gray-950">
    <Header title="My App" />
    <main className="p-6">{/* content */}</main>
  </div>;
}

// ... existing code below ...
</file-edit>
```

## Style Guidelines

Use **design tokens** from the active design system. Never hard-code
colors, spacing, or typography values.

### Token reference

| Token                | Usage                          |
|----------------------|--------------------------------|
| `var(--bg)`          | Page background                |
| `var(--bg-secondary)`| Card / panel backgrounds       |
| `var(--fg)`          | Primary text color             |
| `var(--fg-muted)`    | Secondary / muted text         |
| `var(--accent)`      | Brand accent (links, CTAs)     |
| `var(--accent-hover)`| Accent hover state             |
| `var(--border)`      | Border color                   |
| `var(--radius)`      | Default border-radius          |
| `var(--shadow)`      | Default box-shadow             |
| `var(--font-display)`| Headings / display text        |
| `var(--font-body)`   | Body copy                      |
| `var(--font-mono)`   | Code, numbers, captions        |

### CSS module example

```css
/* Header.module.css */
.header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0.75rem 1.5rem;
  font-family: var(--font-display);
  color: var(--fg);
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
```

### Tailwind + tokens example

```tsx
<header className="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-6 py-3">
  <h1 className="font-[var(--font-display)] text-xl font-semibold text-[var(--fg)]">
    {title}
  </h1>
</header>
```

## File Preservation Rules

1. **Never overwrite** a file you haven't read first.
2. **Never delete** a file — only add or edit.
3. **Preserve git history** — make minimal, focused changes.
4. **Keep imports clean** — remove unused imports only if you introduced
   them in the same edit session.
5. **Respect existing formatting** — match the file's current indentation
   style (tabs vs spaces), quote style (single vs double), and
   trailing-comma convention.

## Workflow

### Step 0 — Pre-flight

1. **Read the project's `DESIGN.md`** (injected into system prompt) to
   understand the design system tokens and conventions.
2. **Read `references/file-conventions.md`** for the standard folder
   structure and naming patterns used in this project.
3. **Read `references/editing-rules.md`** for conventions when editing
   React and Tauri source files.

### Step 1 — Understand the request

Identify which files need to change. If the request is ambiguous, list
the files you plan to edit and wait for confirmation before proceeding.

### Step 2 — Read target files

For each file you plan to edit, read it in full. Understand the
existing code, imports, and patterns.

### Step 3 — Plan edits

State your planned changes in a brief summary before emitting
`<file-edit>` tags. Include:
- Files to create or modify
- Summary of changes per file
- Any dependencies or ordering constraints

### Step 4 — Emit file edits

Emit `<file-edit>` tags in dependency order. Each tag contains the
complete new content of the file (or enough context for a partial edit).

### Step 5 — Verify

After emitting, summarize what changed and flag any files the user
should manually verify (e.g., route registration, Tauri config).

## Anti-patterns

- **No `any` types** — use proper TypeScript types.
- **No inline styles** for values covered by design tokens.
- **No `!important`** in CSS.
- **No hardcoded colors** — always use `var(--*)` tokens.
- **No emoji in UI text** unless explicitly requested.
- **No placeholder / filler content** — use real data or clearly marked
  `<placeholder>` tags.
- **No `console.log`** in production code — remove before emitting.

## Reference Files

- `references/file-conventions.md` — folder structure and naming
- `references/editing-rules.md` — React/Tauri editing conventions
