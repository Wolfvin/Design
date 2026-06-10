# File Conventions — Standard Folder Structure and Naming

The standard project layout for a React + Tauri + TypeScript application
using Vite as the build tool.

## Top-Level Structure

```
project-root/
├── src/                    # Frontend source (React + TypeScript)
├── src-tauri/              # Backend source (Rust / Tauri)
├── public/                 # Static assets served directly
├── DESIGN.md               # Active design system tokens and rules
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Node dependencies
├── Cargo.toml              # Rust dependencies (inside src-tauri/)
└── tauri.conf.json         # Tauri configuration (inside src-tauri/)
```

## Frontend (`src/`)

```
src/
├── app/                    # Route pages (file-based routing)
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page (/)
│   ├── globals.css         # Global styles and CSS variables
│   └── settings/
│       └── page.tsx        # /settings page
│
├── components/             # Shared UI components
│   ├── ui/                 # Primitive components (Button, Input, etc.)
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   ├── Input.tsx
│   │   └── Input.module.css
│   ├── layout/             # Layout components (Header, Sidebar, Footer)
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   └── feedback/           # Toast, Spinner, ErrorBoundary, etc.
│       ├── Toast.tsx
│       └── Spinner.tsx
│
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts
│   ├── useTheme.ts
│   └── useLocalStorage.ts
│
├── lib/                    # Non-React utilities and integrations
│   ├── tauri/              # Tauri IPC bindings
│   │   ├── users.ts
│   │   ├── files.ts
│   │   └── system.ts
│   ├── api/                # HTTP API client (if any)
│   │   └── client.ts
│   ├── store/              # Zustand stores
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   └── utils/              # Pure utility functions
│       ├── formatDate.ts
│       └── cn.ts           # className merge utility
│
├── types/                  # Shared TypeScript types and interfaces
│   ├── user.ts
│   ├── api.ts
│   └── tauri.d.ts          # Tauri-specific type declarations
│
└── styles/                 # Global styles
    ├── tokens.css           # Design token definitions
    └── reset.css            # CSS reset / normalize
```

## Backend (`src-tauri/`)

```
src-tauri/
├── src/
│   ├── main.rs             # Tauri entry point and command registration
│   ├── lib.rs              # Library root (re-exports modules)
│   ├── commands/           # Tauri IPC command handlers
│   │   ├── mod.rs
│   │   ├── users.rs
│   │   ├── files.rs
│   │   └── system.rs
│   ├── models/             # Data models / structs
│   │   ├── mod.rs
│   │   └── user.rs
│   └── error.rs            # Error types
│
├── Cargo.toml              # Rust dependencies
├── tauri.conf.json         # Tauri app configuration
└── icons/                  # App icons for various platforms
```

## Naming Conventions

| Entity               | Convention          | Example                   |
|----------------------|---------------------|---------------------------|
| React components     | PascalCase          | `UserCard.tsx`            |
| React hooks          | camelCase + use     | `useAuth.ts`              |
| CSS modules          | PascalCase + .module| `UserCard.module.css`     |
| TypeScript types     | PascalCase          | `User`, `AuthState`       |
| Type files           | camelCase           | `user.ts`, `api.ts`       |
| Utility files        | camelCase           | `formatDate.ts`           |
| Tauri commands       | snake_case          | `get_user.rs`             |
| Rust modules         | snake_case          | `user.rs`, `mod.rs`       |
| Route pages          | `page.tsx`          | `app/settings/page.tsx`   |
| Layout files         | `layout.tsx`        | `app/layout.tsx`          |

## File Sizing Guidelines

- **Components**: aim for 50–200 lines. Split if larger.
- **Hooks**: aim for 20–80 lines. Extract helpers if larger.
- **Tauri command files**: one concern per file (e.g., `users.rs`,
  `files.rs`).
- **Type files**: group related types. Split when a file exceeds 100
  lines.

## Import Path Aliases

The project uses the following TypeScript path aliases:

| Alias    | Resolves To       |
|----------|-------------------|
| `@/`     | `src/`            |
| `@ui/`   | `src/components/ui/` |
| `@hooks/`| `src/hooks/`      |
| `@lib/`  | `src/lib/`        |
| `@types/`| `src/types/`      |

Always use aliases instead of relative paths that traverse more than one
directory level up.

## New File Checklist

Before creating a new file, verify:

- [ ] The file doesn't already exist under a different name
- [ ] The file name follows the naming convention above
- [ ] The file is placed in the correct directory
- [ ] The file exports are named consistently with the project style
- [ ] Any new directory has an `index.ts` barrel if the directory will
  contain 3+ files
