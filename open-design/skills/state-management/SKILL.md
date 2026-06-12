---
name: state-management
description: |
  Add or modify Zustand stores in an existing React + TypeScript project.
  Creates type-safe stores with proper slice patterns and React hooks.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: state-management
  outputFormat: file-edit
  stackCompatibility: both
  design_system:
    requires: false
  craft:
    requires:
      - store-conventions
skill-tree:
  type: leaf
  parent: twig-component

---

<!-- MIGRATED: new skill for App Developer migration -->

# State Management

You are working inside an EXISTING React + TypeScript + Tauri codebase.
Your task is to add or modify Zustand stores for application state management.

## Workflow

1. **Read existing stores**: Check `src/stores/` for existing store files
2. **Define state shape**: Create TypeScript interfaces for the store state and actions
3. **Create store**: Use `create()` from Zustand with proper TypeScript typing
4. **Add middleware**: Apply `persist`, `devtools`, or `immer` middleware as needed
5. **Create selectors**: Export typed selector hooks for components
6. **Export**: Ensure store and selectors are properly exported from `src/stores/index.ts`

## Output format

For each file you create or modify, output a FILE EDIT block:

```xml
<file-edit path="src/stores/userStore.ts">
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        login: (user) => set({ user, isAuthenticated: true }),
        logout: () => set({ user: null, isAuthenticated: false }),
      }),
      { name: 'user-store' }
    )
  )
);
</file-edit>
```

## Store patterns

### Basic store
```typescript
import { create } from 'zustand';

interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useCounterStore = create<CounterState>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));
```

### Slice pattern (for large stores)
```typescript
// src/stores/slices/userSlice.ts
export interface UserSlice {
  user: User | null;
  setUser: (user: User) => void;
}

export const createUserSlice: StateCreator<AppState, [], [], UserSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
});
```

### Persist middleware
```typescript
import { persist } from 'zustand/middleware';

export const useUserStore = create(
  persist(
    (set) => ({ user: null, setUser: (user) => set({ user }) }),
    { name: 'user-store', partialize: (state) => ({ user: state.user }) }
  )
);
```

## File structure

```
src/stores/
├── index.ts              # Re-exports all stores
├── useUserStore.ts       # User/auth store
├── useCartStore.ts       # Shopping cart store
├── useAppStore.ts        # Global app state
└── slices/               # Optional slice pattern
    ├── userSlice.ts
    └── cartSlice.ts
```

## Selector patterns

- Use selectors to prevent unnecessary re-renders:
  ```typescript
  const user = useUserStore((state) => state.user);
  // NOT: const { user } = useUserStore();
  ```
- Create memoized selectors for derived state:
  ```typescript
  const selectUserFullName = (state: UserState) =>
    `${state.user?.firstName} ${state.user?.lastName}`;
  ```

## Anti-patterns (DO NOT)

- Do NOT use `useEffect` to sync store state with props — use store directly
- Do NOT store derived state — compute it via selectors
- Do NOT prop-drill store values — use hooks directly in components
- Do NOT mutate state directly — always use `set()` with a new object
- Do NOT create stores for local component state — use `useState` instead
