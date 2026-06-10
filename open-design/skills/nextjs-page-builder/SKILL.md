---
name: nextjs-page-builder
description: |
  Create Next.js App Router pages and layouts with proper file conventions.
  Builds page.tsx, layout.tsx, loading.tsx, error.tsx files following
  Next.js 16 App Router patterns with React Server Components. Supports
  both server and client components with proper "use client" directives.
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

<!-- MIGRATED: new Next.js skill for App Developer migration (Phase 5) -->

# Next.js Page Builder

You are building pages and layouts for a Next.js App Router project.
Pages are the top-level entry points that users navigate to, and
layouts wrap pages to provide shared UI like navigation and footers.

## Next.js App Router Structure

The App Router uses a file-system based routing convention. Every
directory under `app/` can contain special files that map to UI:

| File | Purpose | Required |
|------|---------|----------|
| `page.tsx` | The page UI (route entry point) | Yes |
| `layout.tsx` | Shared layout wrapping pages | No (root required) |
| `loading.tsx` | Loading state (Suspense fallback) | No |
| `error.tsx` | Error boundary (client component) | No |
| `not-found.tsx` | 404 UI for this segment | No |
| `template.tsx` | Re-rendered layout (no state preserved) | No |
| `default.tsx` | Fallback for parallel routes | No |

## Server vs Client Components

**Default = Server Component** (no `"use client"` directive). Server
Components render on the server and send HTML to the client. They
cannot use useState, useEffect, or event handlers.

Use `"use client"` only when you need:
- `useState`, `useEffect`, `useContext`, `useReducer`
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser APIs (`localStorage`, `window`, `document`)
- React hooks that require client-side rendering
- Third-party libraries that need client-side lifecycle

**Pattern**: Keep server components at the page level for data fetching,
and extract interactive parts into client components.

```typescript
// app/dashboard/page.tsx — Server Component (default)
import { prisma } from '@/lib/prisma';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  const stats = await prisma.dashboardStats.findFirst();
  return <DashboardClient initialStats={stats} />;
}
```

```typescript
// app/dashboard/dashboard-client.tsx — Client Component
'use client';

import { useState } from 'react';

export function DashboardClient({ initialStats }: { initialStats: any }) {
  const [filter, setFilter] = useState('all');
  // Interactive logic here
}
```

## Data Fetching in Server Components

Server Components can be `async` and directly `await` data:

```typescript
export default async function UsersPage() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}
```

## Layout Patterns

Root layout must include `<html>` and `<body>` tags:

```typescript
// app/layout.tsx
import '@/styles/tokens.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My App',
  description: 'Built with Open Design',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg)] text-[var(--fg)]">
        {children}
      </body>
    </html>
  );
}
```

Nested layouts wrap their child segments:

```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <nav className="w-64 border-r border-[var(--border)]">
        {/* Sidebar navigation */}
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

## Output Format

Use `<file-edit>` blocks for every file:

```xml
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
- Always add `export const metadata: Metadata = {}` for SEO
- Loading states should use Skeleton components for perceived performance
