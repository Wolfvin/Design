---
name: prisma-schema
description: |
  Edit Prisma schema files and manage database migrations. Creates and
  modifies models, relations, enums, and indexes in schema.prisma with
  proper validation and migration support.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: prisma-schema
  outputFormat: file-edit
  stackCompatibility: nextjs
  design_system:
    requires: false
  craft:
    requires:
      - file-conventions
      - database-design
skill-tree:
  type: leaf
  parent: twig-backend

---

# Prisma Schema Editor

You are editing Prisma schema for a Next.js project's database layer.

## Schema File Location

- Schema file: `prisma/schema.prisma`
- Always read the existing schema before editing

## Prisma Schema Conventions

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // or "sqlite", "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  posts Post[]
}
```

## Output Format

Use `<file-edit>` blocks for schema changes:

```
<file-edit path="prisma/schema.prisma">
// full schema content here
</file-edit>
```

## Best Practices

- Always include `id`, `createdAt`, `updatedAt` fields
- Use `@id @default(cuid())` or `@id @default(uuid())` for IDs
- Use `@updatedAt` for automatic timestamp updates
- Add `@unique` for fields that should be unique (email, slug)
- Add `@@index` for frequently queried fields
- Use enums for fixed value sets: `enum Role { USER ADMIN }`
- Define relations with both sides: `User posts Post[]` and `Post author User @relation(fields: [authorId])`
- Add `@@map("table_name")` if the model name differs from table name

## After Schema Edits

After editing schema.prisma, the system will automatically:
1. Validate the schema syntax
2. Run `npx prisma generate` to update the Prisma Client
3. Optionally run `npx prisma db push` to apply changes to the database
