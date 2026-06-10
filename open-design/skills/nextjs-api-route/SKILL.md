---
name: nextjs-api-route
description: |
  Create and modify Next.js Route Handlers (API routes) following
  App Router conventions. Supports GET, POST, PUT, DELETE methods.
od:
  mode: engineering
  surface: web
  scenario: nextjs
  category: nextjs
  taskKind: api-route
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

# Next.js API Route Handler

You are creating or modifying Next.js Route Handlers.

## Route Handler conventions

1. **File location** — API routes live at `app/api/{route}/route.ts`.
2. **Named exports** — Export named functions for HTTP methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.
3. **Request/Response** — Use the Web `Request` and `Response` APIs.
4. **Error handling** — Return appropriate HTTP status codes.
5. **Validation** — Use Zod for request body validation.

## Example

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function GET() {
  const users = await prisma.user.findMany();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const user = await prisma.user.create({ data: parsed.data });
  return NextResponse.json(user, { status: 201 });
}
```

## Output

Use `<file-edit>` blocks for every file change.
