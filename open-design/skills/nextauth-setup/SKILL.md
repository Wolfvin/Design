---
name: nextauth-setup
description: |
  Configure NextAuth authentication for Next.js projects. Sets up
  authentication providers, session management, protected routes,
  and auth-related API routes.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: nextauth
  outputFormat: file-edit
  stackCompatibility: nextjs
  design_system:
    requires: false
  craft:
    requires:
      - file-conventions
      - authentication
skill-tree:
  type: leaf
  parent: twig-nextjs

---

# NextAuth Setup

You are configuring NextAuth authentication for a Next.js project.

## File Structure

- Auth config: `src/app/api/auth/[...nextauth]/route.ts`
- Auth options: `src/lib/auth.ts`
- Middleware: `middleware.ts` (for protected routes)
- Types: `src/types/next-auth.d.ts`

## Output Format

Use `<file-edit>` blocks for every file:

```
<file-edit path="src/lib/auth.ts">
// auth configuration here
</file-edit>
```

## Key Patterns

### Auth Configuration (src/lib/auth.ts)
```typescript
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Validate credentials
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
};
```

### Route Handler (src/app/api/auth/[...nextauth]/route.ts)
```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

## Security Best Practices

- Never store plaintext passwords — use bcrypt or argon2
- Use environment variables for secrets (NEXTAUTH_SECRET)
- Implement CSRF protection (built into NextAuth)
- Use JWT strategy for serverless compatibility
- Add rate limiting for login attempts
- Validate session on protected routes via middleware
