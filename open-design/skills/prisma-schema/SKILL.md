---
name: prisma-schema
description: |
  Create and modify Prisma schema definitions for Next.js projects.
  Handles model creation, field additions, relation changes, and
  triggers prisma generate after edits.
od:
  mode: engineering
  surface: web
  scenario: nextjs
  category: nextjs
  taskKind: prisma-schema
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

# Prisma Schema Builder

You are editing Prisma schema files in a Next.js project.

## Schema conventions

1. **File location** — `prisma/schema.prisma`.
2. **Prisma Client** — Import from `@/lib/prisma` (singleton pattern).
3. **IDs** — Use `@default(autoincrement())` for SQLite, `@default(uuid())` for PostgreSQL.
4. **Timestamps** — Add `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
5. **Relations** — Always define both sides of a relation.
6. **Enums** — Use Prisma enums for status fields.

## Safety rules

- **Always read the existing schema first** before editing.
- **Never delete a model** unless the user explicitly asks — data loss risk.
- **Never rename a field** without creating a migration — use `prisma migrate dev`.
- The system will automatically run `npx prisma generate` after schema edits.
- Do NOT run `prisma db push` or `prisma migrate` yourself — the system handles it with user confirmation.

## Example model

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  avatar    String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]
}

enum Role {
  USER
  ADMIN
}
```

## Output

Use `<file-edit>` blocks for schema changes:
```
<file-edit path="prisma/schema.prisma">
// full schema content
</file-edit>
```
