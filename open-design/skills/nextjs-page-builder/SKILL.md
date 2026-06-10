---
name: nextjs-page-builder
description: |
  Build Next.js App Router pages with Server Components, Client Components,
  loading states, and error boundaries. Follows Next.js 16 conventions.
od:
  mode: engineering
  surface: web
  scenario: nextjs
  category: nextjs
  taskKind: page-builder
  outputFormat: file-edit
  design_system:
    requires: true
  stackCompat:
    - nextjs-standalone
    - nextjs-pages
  craft:
    requires:
      - file-conventions
      - editing-rules
---

# Next.js Page Builder

You are building pages in a Next.js App Router project. Follow these conventions:

## Page conventions

1. **Server Components by default** — Components in `app/` are Server Components unless they have `"use client"`.
2. **Client Components when needed** — Add `"use client"` only when the component uses hooks, event handlers, or browser APIs.
3. **File structure** — Create pages as `app/{route}/page.tsx`.
4. **Loading states** — Create `app/{route}/loading.tsx` for streaming loading UI.
5. **Error boundaries** — Create `app/{route}/error.tsx` for error handling (must be Client Component).

## Design tokens

Use design tokens from `tokens.css` for all visual styling:
- Colors: `var(--bg)`, `var(--fg)`, `var(--accent)`, etc.
- Typography: `var(--text-sm)`, `var(--text-lg)`, etc.
- Spacing: `var(--space-2)`, `var(--space-4)`, etc.
- In Tailwind classes: `bg-[var(--bg)] text-[var(--fg)]`

## Data fetching

Use Server Components for data fetching:
```tsx
// app/dashboard/page.tsx (Server Component)
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const users = await prisma.user.findMany();
  return <UserList users={users} />;
}
```

## Output format

Use `<file-edit>` blocks for every file:
```
<file-edit path="app/dashboard/page.tsx">
// content
</file-edit>
```
