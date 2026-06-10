---
name: tauri-bridge
description: |
  Implement Tauri IPC commands and their TypeScript frontend bindings.
  Outputs Rust command file and TypeScript binding file using <file-edit>
  format for instant compilation and HMR preview.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: ipc-bridge
  outputFormat: file-edit
  stackCompatibility: tauri
  design_system:
    requires: false
  craft:
    requires:
      - file-conventions
      - editing-rules
---

# Tauri Bridge Skill

You are implementing **Tauri IPC bridges** — Rust command handlers on the
backend and their TypeScript bindings on the frontend. This skill creates
the communication layer between the Tauri (Rust) backend and the React
(TypeScript) frontend.

## When to Use

- User requests a new Tauri command (file operations, system info, etc.)
- User wants to call native OS APIs from the frontend
- User needs to persist data via Rust (SQLite, filesystem, etc.)
- User asks to bridge a Rust library to the UI

## When NOT to Use

- Building UI components → use `component-builder` skill
- Creating pages → use `page-creator` skill
- Editing existing code → use `app-developer` skill

## Output Format

Emit `<file-edit>` tags for each file in this order:

### 1. Rust types (if needed)

```
<file-edit path="src-tauri/src/models/user.rs">
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub name: String,
    pub email: String,
}
</file-edit>
```

### 2. Rust command handler

```
<file-edit path="src-tauri/src/commands/users.rs">
use crate::models::user::{CreateUserRequest, User};
use crate::error::AppError;

#[tauri::command]
pub fn get_user(id: String) -> Result<User, String> {
    // Implementation: fetch user from store
    let user = User {
        id,
        name: "Jane Doe".into(),
        email: "jane@example.com".into(),
        created_at: "2025-01-01".into(),
    };
    Ok(user)
}

#[tauri::command]
pub fn create_user(request: CreateUserRequest) -> Result<User, String> {
    // Implementation: create and persist user
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        name: request.name,
        email: request.email,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    Ok(user)
}
</file-edit>
```

### 3. Rust module registration

```
<file-edit path="src-tauri/src/commands/mod.rs">
pub mod users;
// ... existing modules ...
</file-edit>
```

### 4. Command registration in main.rs

```
<file-edit path="src-tauri/src/main.rs">
// ... existing code ...

.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    commands::users::get_user,
    commands::users::create_user,
])

// ... existing code ...
</file-edit>
```

### 5. TypeScript types

```
<file-edit path="src/types/tauri.d.ts">
// ... existing declarations ...

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
}
</file-edit>
```

### 6. TypeScript binding

```
<file-edit path="src/lib/tauri/users.ts">
import { invoke } from '@tauri-apps/api/core';
import type { User, CreateUserRequest } from '@/types/tauri';

/**
 * Fetch a user by ID.
 */
export async function getUser(id: string): Promise<User> {
  return invoke<User>('get_user', { id });
}

/**
 * Create a new user.
 */
export async function createUser(request: CreateUserRequest): Promise<User> {
  return invoke<User>('create_user', { request });
}
</file-edit>
```

## Rust Command Rules

1. **Return `Result<T, String>`** — never panic. Convert all errors to
   user-friendly strings.
2. **Use `serde` for serialization** — all command params and return
   types must derive `Serialize` / `Deserialize`.
3. **Snake_case names** — Rust command names are `snake_case`. Tauri
   automatically converts to `camelCase` on the JS side.
4. **State management** — use `tauri::State` for shared state, not
   global mutable statics.
5. **Async commands** — use `#[tauri::command]` with `async` for I/O
   operations. Add `.invoke_handler(generate_handler![...])` as usual;
   Tauri handles the async dispatch.

```rust
#[tauri::command]
pub async fn fetch_remote_data(url: String) -> Result<String, String> {
    reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())
}
```

## TypeScript Binding Rules

1. **Always type the return value** — `invoke<T>()` with a proper
   TypeScript interface.
2. **Wrap in a named function** — never call `invoke()` directly from
   components.
3. **Error handling** — the binding function should NOT catch errors;
   let the caller decide. Document which errors can be thrown.
4. **Naming convention** — Rust `get_user` → TypeScript `getUser`.
5. **Parameter naming** — Rust `request: CreateUserRequest` → TypeScript
   `{ request }` (matches the Tauri IPC naming).

```typescript
// ✅ Correct
export async function getUser(id: string): Promise<User> {
  return invoke<User>('get_user', { id });
}

// ❌ Wrong — no type, direct invoke
export function getUser(id: string) {
  return invoke('get_user', { id });
}
```

## Pre-flight

1. **Read `src-tauri/src/main.rs`** to see how commands are currently
   registered.
2. **Read `src-tauri/src/commands/mod.rs`** to see the module list.
3. **Read `src-tauri/Cargo.toml`** for available Rust dependencies.
4. **Read `src/lib/tauri/`** for existing TypeScript bindings — match
   the established patterns.
5. **Read `references/file-conventions.md`** from `app-developer` skill
   for folder structure.

## Error Handling Pattern

### Rust side

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("User not found: {0}")]
    NotFound(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

impl From<AppError> for String {
    fn from(error: AppError) -> String {
        error.to_string()
    }
}
```

### TypeScript side

```typescript
import { getUser } from '@/lib/tauri/users';

try {
  const user = await getUser(id);
  // use user
} catch (error) {
  // error is a string from Rust
  if (error.includes('not found')) {
    // handle not found
  } else {
    // show generic error toast
  }
}
```

## Anti-patterns

- No `unwrap()` in Rust commands — always handle errors.
- No raw `invoke()` calls in React components — use binding functions.
- No `any` types in TypeScript bindings.
- No hardcoded file paths in Rust — use `app_data_dir()` from Tauri.
- No blocking I/O in async commands — use `.await`.
- No `println!` in production — use the `log` crate.
