---
name: component-builder
description: |
  Build new React components for an existing React + Tauri + TypeScript project.
  Outputs component file, optional CSS module, and optional types file using
  <file-edit> format for Vite HMR instant preview.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: component-create
  outputFormat: file-edit
  stackCompatibility: both
  design_system:
    requires: true
  craft:
    requires:
      - file-conventions
      - editing-rules
---

# Component Builder Skill

You are building **new** React components in an existing React + Tauri +
TypeScript codebase. Components are the atomic building blocks of the
UI — they must be self-contained, typed, styled with design tokens, and
immediately usable by pages and other components.

## When to Use

- User requests a new UI component (button variant, card, modal, etc.)
- User asks to extract a reusable piece from an existing page
- User wants to implement a design spec as a component

## When NOT to Use

- Creating a new page or route → use `page-creator` skill
- Implementing Tauri IPC commands → use `tauri-bridge` skill
- Editing an existing component → use `app-developer` skill

## Output Format

Emit `<file-edit>` tags for each file in this order:

### 1. Types file (if the component has complex props)

```
<file-edit path="src/types/DatePicker.ts">
export interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  label: string;
}
</file-edit>
```

### 2. CSS module (always, unless the component uses only Tailwind)

```
<file-edit path="src/components/ui/DatePicker.module.css">
.wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.label {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--fg-muted);
}

.input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  color: var(--fg);
  font-family: var(--font-body);
}

.input:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</file-edit>
```

### 3. Component file (always)

```
<file-edit path="src/components/ui/DatePicker.tsx">
import React, { useState } from 'react';
import type { DatePickerProps } from '@/types/DatePicker';
import styles from './DatePicker.module.css';

export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  label,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>{label}</label>
      <input
        type="date"
        className={styles.input}
        value={value?.toISOString().slice(0, 10) ?? ''}
        min={minDate?.toISOString().slice(0, 10)}
        max={maxDate?.toISOString().slice(0, 10)}
        disabled={disabled}
        onChange={(e) => onChange(new Date(e.target.value))}
      />
    </div>
  );
}
</file-edit>
```

## Component Anatomy

Every component must include:

1. **Named export** — no default exports.
2. **Props interface** — typed, with optional props marked `?` and given
   defaults via destructuring.
3. **Design tokens** — no hardcoded colors, spacing, or fonts.
4. **Accessible markup** — proper ARIA attributes, keyboard support.
5. **States** — default, hover, focus, active, disabled, error, loading.

## Folder Placement

| Component Type   | Location                | Example                        |
|------------------|-------------------------|--------------------------------|
| Primitive UI     | `src/components/ui/`    | `Button.tsx`, `Input.tsx`      |
| Layout           | `src/components/layout/`| `Header.tsx`, `Sidebar.tsx`    |
| Feedback         | `src/components/feedback/`| `Toast.tsx`, `Spinner.tsx`   |
| Domain-specific  | `src/components/{domain}/`| `UserCard.tsx`              |

## Pre-flight

1. **Read the project's `DESIGN.md`** for design tokens.
2. **Check existing components** in the target directory — don't
   duplicate an existing component under a different name.
3. **Read `references/file-conventions.md`** from the `app-developer`
   skill for folder structure.

## Style Rules

- Use CSS modules by default. Tailwind is acceptable for utility-only
  components.
- Design tokens only: `var(--bg)`, `var(--accent)`, `var(--border)`,
  etc.
- Mobile-first responsive: design for small screens, enhance for large.
- Minimum 44px touch targets for interactive elements.

## Anti-patterns

- No `any` types.
- No inline styles for token-covered values.
- No `!important` in CSS.
- No emoji in component text.
- No `console.log` in production code.
- No default exports.
