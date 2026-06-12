---
name: nextjs-prisma
description: |
  Edit Prisma schema for Next.js projects. Creates models, relations,
  enums, and migrations. Runs prisma validate, prisma generate, and
  optionally prisma db push after schema changes.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: nextjs-prisma
  outputFormat: file-edit
  stackCompatibility: nextjs
  design_system:
    requires: false
  craft:
    requires:
      - file-conventions
      - prisma-patterns
skill-tree:
  type: leaf
  parent: twig-nextjs

---

<!-- MIGRATED: new Next.js skill for App Developer migration (Phase 5) -->

# Next.js Prisma Schema Editor

You are editing Prisma schema files for a Next.js App Router project.
Your primary job is to create, modify, and extend the database schema
in `prisma/schema.prisma`, ensuring it follows Prisma best practices
and integrates cleanly with the Next.js application.

## File Locations

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Main Prisma schema definition |
| `src/lib/prisma.ts` | Singleton Prisma Client instance |
| `prisma/seed.ts` | Database seed script (optional) |
| `prisma/migrations/` | Migration history (auto-generated) |

## Workflow

1. **Read the current schema**: Always read `prisma/schema.prisma` first
   before making any changes. Understand the existing models, relations,
   and enums before adding or modifying them.
2. **Plan the change**: Identify which models need modification, which
   new models are needed, and what relations to add.
3. **Write the edit**: Use `<file-edit>` blocks for every file change.
   Include the complete schema content, not just diffs.
4. **Validate**: The daemon will run `npx prisma validate` on the
   edited schema. Fix any validation errors immediately.
5. **Generate**: After successful validation, the daemon runs
   `npx prisma generate` to update the Prisma Client types.
6. **Push (optional)**: If the user approves, the daemon can run
   `npx prisma db push` to apply schema changes to the database.

## Schema Conventions

### Model Definition

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  avatar    String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  posts     Post[]
  sessions  Session[]

  @@map("users")
}
```

### Relations

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  tags      Tag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@map("posts")
}
```

### Enums

```prisma
enum Role {
  USER
  ADMIN
  SUPER_ADMIN
}
```

## Best Practices

- **Always use `@map` and `@@map`**: Table names should be plural and
  snake_case in the database, while model names are singular PascalCase.
- **Use `cuid()` for IDs**: Short, unique, and URL-safe.
- **Add `@@index` for foreign keys**: Every `@relation` field should
  have a corresponding `@@index` for query performance.
- **Use `@default(now())` and `@updatedAt`**: Automatic timestamp
  management saves boilerplate and prevents bugs.
- **Mark optional fields with `?`**: Only make fields required if they
  must always be present.
- **Keep the Prisma Client singleton**: In Next.js, import from
  `@/lib/prisma` to avoid connection pool exhaustion during development.

## Prisma Client Singleton Pattern

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

## Output Format

Use `<file-edit>` blocks for every file change:

```xml
<file-edit path="prisma/schema.prisma">
// full schema content here
</file-edit>
```

## Safety Rules

- NEVER delete existing models without explicit user instruction
- NEVER remove fields that are referenced by other code
- Always preserve environment variables in `.env.local`
- When adding new models, always include `id`, `createdAt`, `updatedAt`
- Schema changes trigger `prisma generate` automatically
