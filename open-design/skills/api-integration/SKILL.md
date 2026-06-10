---
name: api-integration
description: |
  Integrate REST or GraphQL APIs with React Query in an existing React + TypeScript project.
  Creates type-safe API client functions, React Query hooks, and error handling patterns.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: api-integration
  outputFormat: file-edit
  design_system:
    requires: false
  craft:
    requires:
      - api-conventions
---

<!-- MIGRATED: new skill for App Developer migration -->

# API Integration

You are working inside an EXISTING React + TypeScript + Tauri codebase.
Your task is to integrate external APIs (REST or GraphQL) with proper type safety,
error handling, and caching via React Query.

## Workflow

1. **Read existing code**: Check `src/api/` for existing client setup, `src/hooks/` for existing query hooks
2. **Define types**: Create TypeScript interfaces for API request/response payloads
3. **Create API client**: Build fetch/axios wrapper functions in `src/api/`
4. **Create React Query hooks**: Wrap API calls with `useQuery`/`useMutation` in `src/hooks/`
5. **Handle errors**: Implement consistent error handling with React Query's `onError`
6. **Export**: Ensure all new functions and types are properly exported

## Output format

For each file you create or modify, output a FILE EDIT block:

```xml
<file-edit path="src/api/users.ts">
import { apiClient } from './client';
import type { User, CreateUserRequest } from '../types/api';

export async function fetchUsers(): Promise<User[]> {
  const response = await apiClient.get('/users');
  return response.data;
}
</file-edit>
```

```xml
<file-edit path="src/hooks/useUsers.ts">
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, createUser } from '../api/users';
import type { CreateUserRequest } from '../types/api';

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: fetchUsers });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserRequest) => createUser(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
</file-edit>
```

## API client patterns

### REST with fetch
```typescript
// src/api/client.ts
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  },
  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  },
};
```

### React Query hooks
- Use `useQuery` for GET requests (automatic caching + refetching)
- Use `useMutation` for POST/PUT/DELETE (manual trigger)
- Use `queryKey` arrays for cache invalidation: `['users', userId]`
- Use `invalidateQueries` in `onSuccess` to refresh related data

## Type safety rules

1. **Never use `any`** — always define proper request/response types
2. **Use branded types** for IDs: `type UserId = string & { __brand: 'UserId' }`
3. **Discriminated unions** for API responses: `{ status: 'success'; data: T } | { status: 'error'; error: E }`
4. **Zod validation** for runtime type checking at API boundaries (optional but recommended)

## Error handling

- Create a custom `ApiError` class with status code + message
- Use React Query's `error` field in hooks for UI error display
- Global error handler via `QueryClient` config
- Never silently swallow errors — always surface them

## Anti-patterns (DO NOT)

- Do NOT call fetch/axios directly in components — always use hooks
- Do NOT use `any` types — define proper interfaces
- Do NOT hardcode API URLs — use environment variables
- Do NOT ignore error states in UI
- Do NOT create duplicate query keys
