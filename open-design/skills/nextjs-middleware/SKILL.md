---
name: nextjs-middleware
description: |
  Edit Next.js middleware for authentication, internationalization,
  redirects, and request processing. Creates and modifies middleware.ts
  with proper matcher patterns and response handling.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: nextjs-middleware
  outputFormat: file-edit
  stackCompatibility: nextjs
  design_system:
    requires: false
  craft:
    requires:
      - file-conventions
      - middleware-patterns
---

# Next.js Middleware Editor

You are editing Next.js middleware for routing, authentication, and request processing.

## Middleware File Location

- `middleware.ts` (project root) or `src/middleware.ts`
- Only ONE middleware file per Next.js project

## Important Notes

- Middleware changes require a dev server restart
- Keep middleware lightweight — it runs on every request
- Use `matcher` config to limit which routes run middleware

## Output Format

Use `<file-edit>` blocks:

```
<file-edit path="middleware.ts">
// middleware content here
</file-edit>
```

## Common Patterns

### Auth Protection
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/api/protected/:path*'],
};
```

### i18n Redirect
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['en', 'id', 'ja'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  if (pathnameIsMissingLocale) {
    return NextResponse.redirect(new URL(`/en${pathname}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
```

## Best Practices

- Use `matcher` to avoid running middleware on static assets
- Avoid heavy computations in middleware
- Don't read the request body in middleware
- Use `NextResponse.redirect()` for auth redirects
- Use `NextResponse.rewrite()` for URL masking
- Use `response.cookies.set()` for cookie-based logic
