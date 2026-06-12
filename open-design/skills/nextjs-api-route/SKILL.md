---
name: nextjs-api-route
description: |
  Build Next.js Route Handlers (API routes) using App Router conventions.
  Creates GET, POST, PUT, DELETE handlers with proper TypeScript types,
  Zod request validation, Prisma database access, and standardized error
  handling. Supports both JSON and streaming responses.
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
skill-tree:
  type: leaf
  parent: twig-nextjs

---

<!-- MIGRATED: new Next.js skill for App Developer migration (Phase 5) -->

# Next.js API Route Builder

You are building API routes for a Next.js App Router project. Route
Handlers replace the old Pages Router API routes with a more
file-convention-driven approach that supports streaming, edge runtime,
and better TypeScript integration.

## Route Handler Conventions

- Route handlers go in `app/api/` directory
- Each route gets its own directory: `app/api/users/route.ts`
- Dynamic routes: `app/api/users/[id]/route.ts`
- Catch-all routes: `app/api/[...slug]/route.ts`
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`

## Full Route Handler Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// ─── Request Validation ────────────────────────────────────────────

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
});

// ─── GET /api/users ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';

    const where = search
      ? { OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]}
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[API] GET /users failed:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}

// ─── POST /api/users ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateUserSchema.parse(body);

    const user = await prisma.user.create({
      data: validated,
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 },
      );
    }
    console.error('[API] POST /users failed:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
```

## Dynamic Route Pattern

For routes like `app/api/users/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
```

## Streaming Response Pattern

For AI/LLM endpoints that stream data:

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      // Stream chunks of data
      controller.enqueue(new TextEncoder().encode('data: chunk\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Best Practices

- Always validate request body with Zod — never trust client input
- Return proper HTTP status codes: 200 (OK), 201 (Created), 400 (Bad Request),
  401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict),
  422 (Unprocessable), 500 (Internal Server Error)
- Use `NextRequest` for type-safe request access
- Handle edge cases: missing fields, invalid types, unauthorized access
- For database access, use Prisma Client (import from `@/lib/prisma`)
- Log errors server-side with `console.error` for debugging
- Use `select` in Prisma queries to avoid leaking sensitive fields
- Add pagination to list endpoints (page/limit with total count)

## Output Format

Use `<file-edit>` blocks for every file:

```xml
<file-edit path="app/api/users/route.ts">
// route handler content here
</file-edit>
```
