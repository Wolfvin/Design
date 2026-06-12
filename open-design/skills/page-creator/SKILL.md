---
name: page-creator
description: |
  Create new pages and routes in an existing React + Tauri + TypeScript project.
  Outputs page component file and route registration using <file-edit> format
  for Vite HMR instant preview.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: page-create
  outputFormat: file-edit
  stackCompatibility: both
  design_system:
    requires: true
  craft:
    requires:
      - file-conventions
      - editing-rules
skill-tree:
  type: leaf
  parent: twig-backend

---

# Page Creator Skill

You are creating **new pages and routes** in an existing React + Tauri +
TypeScript codebase. Pages are top-level views that users navigate to.
Each page composes components into a meaningful layout and handles
routing, data loading, and page-level state.

## When to Use

- User requests a new page or screen (settings, profile, dashboard, etc.)
- User wants to add a new route to the app
- User asks to create a standalone view

## When NOT to Use

- Building a reusable component → use `component-builder` skill
- Editing an existing page → use `app-developer` skill
- Implementing Tauri IPC → use `tauri-bridge` skill

## Output Format

Emit `<file-edit>` tags for each file in this order:

### 1. Types file (if the page has complex state or params)

```
<file-edit path="src/types/settings.ts">
export interface SettingsPageParams {
  tab?: 'general' | 'account' | 'appearance';
}

export interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
}
</file-edit>
```

### 2. Page component file

```
<file-edit path="src/app/settings/page.tsx">
import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import type { SettingsState } from '@/types/settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    theme: 'system',
    language: 'en',
    notifications: true,
  });

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header title="Settings" />
      <main className="max-w-4xl mx-auto p-6">
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
        />
      </main>
    </div>
  );
}
</file-edit>
```

### 3. Route registration (if needed)

If the project uses explicit route registration (e.g., React Router config),
emit the route file edit:

```
<file-edit path="src/app/routes.ts">
// ... existing imports ...
import { SettingsPage } from './settings/page';

// ... existing routes ...
{
  path: '/settings',
  element: <SettingsPage />,
},
</file-edit>
```

If the project uses file-based routing (Next.js App Router style), the
page file at `src/app/{slug}/page.tsx` is automatically registered — no
separate route file needed.

## Page Anatomy

Every page must include:

1. **Layout wrapper** — uses the app's standard layout or a custom one.
2. **Semantic HTML** — `<main>`, `<section>`, `<article>`, `<header>`.
3. **Page title** — via `<title>` or the app's head management.
4. **Loading state** — show a skeleton or spinner while data loads.
5. **Error boundary** — graceful error display, never a blank screen.
6. **Responsive layout** — works on mobile (375px) through desktop.

## Folder Structure

```
src/app/
├── layout.tsx          # Root layout (always exists)
├── page.tsx            # Home page (/)
├── settings/
│   ├── page.tsx        # /settings
│   └── layout.tsx      # Optional nested layout
├── profile/
│   ├── page.tsx        # /profile
│   └── [id]/
│       └── page.tsx    # /profile/:id (dynamic route)
└── not-found.tsx       # 404 page
```

## Pre-flight

1. **Read the project's `DESIGN.md`** for design tokens.
2. **Check existing pages** in `src/app/` — don't duplicate.
3. **Read the root layout** (`src/app/layout.tsx`) to understand the
   page shell (header, sidebar, footer).
4. **Read `references/file-conventions.md`** from `app-developer` skill.

## Page Composition Pattern

```tsx
import React from 'react';
import { Header } from '@/components/layout/Header';
import { Spinner } from '@/components/feedback/Spinner';

export default function MyPage() {
  const { data, isLoading, error } = useMyData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-[var(--fg-muted)]">Failed to load data.</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header title="My Page" />
      <main className="max-w-6xl mx-auto p-6">
        {/* Page content using design tokens */}
      </main>
    </div>
  );
}
```

## Style Rules

- Use design tokens for all visual properties.
- Pages should not contain complex CSS — delegate to components.
- Page-level CSS should only define layout (grid, max-width, padding).
- Responsive breakpoints: `sm:640px`, `md:768px`, `lg:1024px`,
  `xl:1280px`.

## Anti-patterns

- No inline business logic — extract to hooks.
- No direct API calls in page components — use TanStack Query hooks.
- No hardcoded colors or spacing.
- No `any` types.
- No default exports for non-page files (pages may use default export
  for file-based routing convention).
