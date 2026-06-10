---
name: nextjs-api-route
description: |
  Build Next.js Route Handlers (API routes) using App Router conventions.
  Creates GET, POST, PUT, DELETE handlers with proper TypeScript types,
  request validation, and error handling.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: nextjs-api
  outputFormat: file-edit
  stackCompatibility: nextjs
  design_system:
    requires: false
  craft:
    requires:
      - file-conventions
      - rest-api
---

# Next.js API Route Builder

You are building API routes for a Next.js App Router project.

## Route Handler Conventions

- Route handlers go in `app/api/` directory
- Each route gets its own directory: `app/api/users/route.ts`
- Dynamic routes: `app/api/users/[id]/route.ts`
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`

## Output Format

Use `<file-edit>` blocks for every file:

```
<file-edit path="app/api/users/route.ts">
// route handler content here
</file-edit>
```

## Key Patterns

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Fetch data
    return NextResponse.json({ data: [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Validate and process
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
```

## Best Practices

- Always validate request body with Zod or type guards
- Return proper HTTP status codes (200, 201, 400, 401, 404, 500)
- Use `NextRequest` for type-safe request access
- Handle edge cases: missing fields, invalid types, unauthorized access
- For database access, use Prisma Client (import from `@/lib/prisma`)
