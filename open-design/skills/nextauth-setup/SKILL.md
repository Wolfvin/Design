---
name: nextauth-setup
description: |
  Configure NextAuth (Auth.js v5) authentication for Next.js projects.
  Supports OAuth providers, session strategy, custom pages, and
  route protection middleware.
od:
  mode: engineering
  surface: web
  scenario: nextjs
  category: nextjs
  taskKind: auth-setup
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

# NextAuth Setup

You are configuring NextAuth (Auth.js v5) for a Next.js project.

## Files to edit

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | Auth configuration (Auth.js v5 style) |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth Route Handler |
| `middleware.ts` | Route protection middleware |
| `.env.local` | Environment variables (OAuth secrets) |

## Auth.js v5 conventions

1. **Configuration** — Use `auth.ts` export pattern from Auth.js v5.
2. **Route Handler** — Export GET and POST handlers from the catch-all route.
3. **Middleware** — Use `auth()` from Auth.js for route protection.
4. **Session** — Access session via `auth()` in Server Components or `useSession()` in Client Components.

## Safety rules

- **NEVER delete or modify existing `NEXTAUTH_SECRET`** in `.env.local`.
- **NEVER commit OAuth client secrets** to source code.
- **Always use `.env.local`** for sensitive configuration.
- **Changes to `middleware.ts` may require a dev server restart.**
- Use `next-auth` v5 (Auth.js) API conventions for Next.js 16.

## Example auth config

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
});
```

## Output

Use `<file-edit>` blocks for every file change.
