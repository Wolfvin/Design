---
name: nextjs-middleware
description: |
  Create and modify Next.js middleware for route protection,
  internationalization, and request interception. Follows Next.js 16
  middleware conventions.
od:
  mode: engineering
  surface: web
  scenario: nextjs
  category: nextjs
  taskKind: middleware
  outputFormat: file-edit
  design_system:
    requires: false
  stackCompat:
    - nextjs-standalone
    - nextjs-pages
  craft:
    requires:
      - file-conventions
---

# Next.js Middleware

You are creating or modifying Next.js middleware.

## Middleware conventions

1. **File location** — `middleware.ts` at the project root (or `src/middleware.ts`).
2. **Export** — Export a default function or named `middleware` function.
3. **Matcher** — Use `config.matcher` to limit which routes run the middleware.
4. **Edge Runtime** — Middleware runs on the Edge Runtime, not Node.js.
5. **Restart required** — Changes to middleware require a dev server restart.

## Common patterns

### Auth protection:
```typescript
// middleware.ts
import { auth } from '@/lib/auth';

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith('/dashboard')) {
    return Response.redirect(new URL('/login', req.url));
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
```

### i18n routing:
```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'id', 'ja'],
  defaultLocale: 'en',
});

export const config = {
  matcher: ['/', '/(en|id|ja)/:path*'],
};
```

## Important notes

- **Middleware runs on EVERY request** that matches the matcher — keep it fast.
- **No Node.js APIs** — Only Web APIs and Edge-compatible packages.
- **Notify user** that a dev server restart may be needed after middleware changes.

## Output

Use `<file-edit>` blocks for every file change.
