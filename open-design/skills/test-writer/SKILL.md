---
name: test-writer
description: |
  Generate unit and integration tests for React components, hooks, and stores
  using Vitest and React Testing Library in an existing TypeScript project.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: test-writing
  outputFormat: file-edit
  stackCompatibility: both
  design_system:
    requires: false
  craft:
    requires:
      - test-conventions
---

<!-- MIGRATED: new skill for App Developer migration -->

# Test Writer

You are working inside an EXISTING React + TypeScript + Tauri codebase.
Your task is to write comprehensive unit and integration tests using Vitest
and React Testing Library.

## Workflow

1. **Read existing tests**: Check `src/__tests__/` or co-located `*.test.ts(x)` files
2. **Read the source**: Understand the component/hook/store you're testing
3. **Write tests**: Cover happy paths, edge cases, error states
4. **Mock dependencies**: Use `vi.mock()` and `vi.fn()` for external dependencies
5. **Run tests**: Ensure all tests pass (_mention that the user should run them_)

## Output format

For each test file you create, output a FILE EDIT block:

```xml
<file-edit path="src/components/__tests__/LoginButton.test.tsx">
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginButton } from '../LoginButton';

describe('LoginButton', () => {
  it('renders with correct text', () => {
    render(<LoginButton />);
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<LoginButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
</file-edit>
```

## Test file structure

Two conventions — choose based on what exists in the project:

### Co-located tests (preferred for components)
```
src/components/
├── Header.tsx
├── Header.test.tsx
├── LoginPage.tsx
└── LoginPage.test.tsx
```

### Centralized tests (preferred for integration)
```
src/__tests__/
├── components/
│   └── Header.test.tsx
├── hooks/
│   └── useAuth.test.ts
└── integration/
    └── login-flow.test.tsx
```

## Component test patterns

### Basic rendering
```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

it('renders children', () => {
  render(<MyComponent>Hello</MyComponent>);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

### User interaction
```typescript
import { fireEvent } from '@testing-library/react';

it('handles click', () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Click</Button>);
  fireEvent.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalledOnce();
});
```

### Async behavior
```typescript
import { waitFor, asyncFireEvent } from '@testing-library/react';

it('loads data asynchronously', async () => {
  render(<UserList />);
  await waitFor(() => {
    expect(screen.getByText('John')).toBeInTheDocument();
  });
});
```

## Hook test patterns

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

it('increments counter', () => {
  const { result } = renderHook(() => useCounter());
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});
```

## Store test patterns

```typescript
import { useUserStore } from '../stores/useUserStore';

it('logs in user', () => {
  const { login } = useUserStore.getState();
  login({ id: '1', name: 'John' });
  expect(useUserStore.getState().user).toEqual({ id: '1', name: 'John' });
  useUserStore.getState().logout(); // cleanup
});
```

## Mock patterns

### Mock API calls
```typescript
vi.mock('../api/users', () => ({
  fetchUsers: vi.fn().mockResolvedValue([{ id: '1', name: 'John' }]),
}));
```

### Mock Tauri IPC
```typescript
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('result'),
}));
```

### Mock React Query
```typescript
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function wrapper({ children }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

renderHook(() => useUsers(), { wrapper });
```

## Anti-patterns (DO NOT)

- Do NOT test implementation details — test behavior, not how it works
- Do NOT over-mock — only mock external boundaries (API, Tauri, etc.)
- Do NOT use `setTimeout` in tests — use `waitFor` and `findBy` queries
- Do NOT test library code (React Query, Zustand) — test your usage of it
- Do NOT create fragile selectors based on CSS classes — use `getByRole`, `getByLabelText`
- Do NOT forget to clean up: use `afterEach(() => cleanup())` or `vi.restoreAllMocks()`
