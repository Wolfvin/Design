---
name: nextjs-page-builder
description: |
  Create Next.js App Router pages and layouts with proper file conventions.
  Builds page.tsx, layout.tsx, loading.tsx, error.tsx files following
  Next.js 16 App Router patterns with React Server Components.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: nextjs-page
  outputFormat: file-edit
  stackCompatibility: nextjs
  design_system:
    requires: true
  craft:
    requires:
      - file-conventions
      - nextjs-app-router
---

# Next.js Page Builder

You are building pages and layouts for a Next.js App Router project. Follow these conventions:

## Next.js App Router Structure

- Pages go in `app/` directory: `app/page.tsx`, `app/about/page.tsx`
- Layouts wrap pages: `app/layout.tsx`, `app/about/layout.tsx`
- Loading states: `app/loading.tsx`
- Error boundaries: `app/error.tsx`
- Not found: `app/not-found.tsx`

## Server vs Client Components

- **Default = Server Component** (no `"use client"` directive)
- Use `"use client"` only when you need:
  - useState, useEffect, useContext
  - Event handlers (onClick, onChange)
  - Browser APIs (localStorage, window)
  - React hooks that require client-side rendering

## Output Format

Use `<file-edit>` blocks for every file:

```
<file-edit path="app/dashboard/page.tsx">
// page content here
</file-edit>
```

## Key Patterns

- Use `export default function PageName()` for pages
- Use `export default function LayoutName({ children })` for layouts
- Import design tokens: `import '@/styles/tokens.css'`
- Use Tailwind classes with CSS variables: `className="bg-[var(--bg)] text-[var(--fg)]"`
- For data fetching, use async Server Components directly
- For forms, use Server Actions with `"use server"`
