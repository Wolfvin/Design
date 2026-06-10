---
name: style-refactor
description: |
  Refactor inline styles and hardcoded values to use the design token system.
  Converts hardcoded colors, spacing, and typography to CSS custom properties
  and Tailwind CSS with design token variables.
od:
  mode: prototype
  surface: web
  scenario: engineering
  category: app-development
  taskKind: style-refactor
  outputFormat: file-edit
  design_system:
    requires: true
  craft:
    requires:
      - design-tokens
---

<!-- MIGRATED: new skill for App Developer migration -->

# Style Refactor

You are working inside an EXISTING React + TypeScript + Tauri codebase.
Your task is to refactor inline styles, hardcoded colors, and ad-hoc spacing
to use the project's design token system (CSS custom properties).

## Workflow

1. **Read the token system**: Check `src/styles/tokens.css` for available tokens
2. **Identify violations**: Find hardcoded hex colors, inline styles, magic numbers
3. **Map to tokens**: Replace with appropriate `var(--token)` references
4. **Create CSS modules**: If needed, create `.module.css` files for component styles
5. **Update components**: Refactor components to use tokens via Tailwind or CSS modules
6. **Verify**: Ensure visual appearance is preserved after refactoring

## Output format

For each file you create or modify, output a FILE EDIT block:

```xml
<file-edit path="src/components/Header.tsx">
import styles from './Header.module.css';
import '../styles/tokens.css';

export function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>App</h1>
    </header>
  );
}
</file-edit>
```

```xml
<file-edit path="src/components/Header.module.css">
.header {
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  padding: var(--space-4) var(--space-6);
}

.title {
  color: var(--text);
  font-family: var(--sans);
  font-size: var(--text-lg);
}
</file-edit>
```

## Token reference

When refactoring, map hardcoded values to these token categories:

| Category | Token Pattern | Examples |
|---|---|---|
| **Backgrounds** | `var(--bg*)` | `--bg`, `--bg-panel`, `--bg-elevated`, `--bg-fill-tertiary` |
| **Text** | `var(--text*)` | `--text`, `--text-muted`, `--text-inverse` |
| **Accent** | `var(--accent*)` | `--accent`, `--accent-soft`, `--accent-strong` |
| **Border** | `var(--border*)` | `--border`, `--border-subtle`, `--border-strong` |
| **Spacing** | `var(--space-*)` | `--space-1` (4px) through `--space-12` (48px) |
| **Radius** | `var(--radius-*)` | `--radius-xs` (4px), `--radius-sm` (6px), `--radius-md` (8px) |
| **Typography** | `var(--text-*)` | `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl` |
| **Motion** | `var(--dur-*)` | `--dur-quick`, `--dur-enter`, `--dur-exit` |
| **Elevation** | `var(--elev-*)` | `--elev-1`, `--elev-2`, `--elev-3` |

## Tailwind + Design Tokens

When using Tailwind CSS, reference tokens via arbitrary values:

```tsx
// Instead of: className="bg-gray-900 text-white"
// Use:
<div className="bg-[var(--bg)] text-[var(--text)] border-[var(--border)]">

// Instead of: style={{ padding: '16px' }}
// Use:
<div className="p-[var(--space-4)]">
```

## CSS Module patterns

```css
/* Component.module.css */
.container {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.container:hover {
  border-color: var(--accent);
}
```

## Common refactor patterns

### Hardcoded color → token
```tsx
// Before: <div style={{ color: '#e8e8ed' }}>
// After:  <div style={{ color: 'var(--text)' }}>
// Or:     <div className="text-[var(--text)]">
```

### Inline style → CSS module
```tsx
// Before: <div style={{ padding: '12px 24px', borderRadius: '8px' }}>
// After:  <div className={styles.card}>
//         .card { padding: var(--space-3) var(--space-6); border-radius: var(--radius-md); }
```

### Magic number → spacing token
```tsx
// Before: gap: 16px
// After:  gap: var(--space-4)
```

## Anti-patterns (DO NOT)

- Do NOT use `!important` — fix specificity properly
- Do NOT leave hardcoded hex values — always map to tokens
- Do NOT use inline `style={{ }}` for token values — use CSS classes
- Do NOT create one-off CSS custom properties for single-use values
- Do NOT override token values in component CSS — override in tokens.css
