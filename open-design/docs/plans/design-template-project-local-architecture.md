# Design System: Project-Local Architecture

**Date**: 2026-06-13 (v2 — revised with consumer feedback)
**Status**: Phase 0-5 COMPLETE — All phases have runtime.
**Author**: Wolfvin + Open Design Agent
**Consumer Review**: Agent self-assessment as primary consumer (7/10 → revised)

---

## 1. Problem Statement

### Current State

```
Repo:     design-systems/ → 152 packages (data + tokens + components)
Runtime:  .od/design-systems/ → copy dari repo, hidden dari project
Project:  TIDAK PUNYA design system sendiri
          → Agent generate on-the-fly tiap session
          → Tidak ada persistence, tidak ada portability
          → Design decisions hidden di .od/ yang tidak version-controlled
```

**Pain points**:
1. **Invisible** — `.od/` hidden, developer tidak bisa lihat design system mereka
2. **Non-portable** — clone project tanpa open-design = tanpa design system
3. **Non-editable** — developer tidak bisa customize tanpa break update flow
4. **Non-trackable** — tidak ada diff, tidak ada pin, tidak ada lockfile
5. **Session-bound** — setiap session baru, agent harus re-generate dari nol

### Target State

```
Repo:     design-systems/ → 152 packages = REFERENSI LIBRARY (read-only source)
Repo:     skills/ → agent instructions = CARA apply/extend/customize
Project:  design/ → GENERATED + OWNED oleh project = LIVING ASSET
```

**`design/` itu MILIK PROJECT, bukan milik open-design.**
Open-design = supplier, Project = consumer.
Seperti `node_modules` tapi version-controlled dan editable.

### Why `design/` not `design-template/`

> **Consumer feedback**: "design-template" implies something you copy, not
> something you live-edit. "template" = disposable starting point.
> "design/" = living system you maintain and evolve.
> Also avoids confusion with `design-templates/` (the rendering templates
> already in the repo). Shorter, cleaner, more accurate.

---

## 2. Architecture Overview

### 2.1 Data Flow: Render → Accept → Execute

```
┌──────────────────────────────────────────────────────────────────┐
│  RENDER PHASE (Frontend)                                        │
│                                                                  │
│  1. User selects DS from picker (e.g. "apple")                  │
│  2. Frontend renders preview of design/ using source DS tokens   │
│  3. User SEE the result BEFORE any files are written             │
│  4. User clicks ACCEPT → design/ + execution-plan.json generated │
│                                                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ User ACCEPTED
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  EXECUTE PHASE (Agent)                                          │
│                                                                  │
│  5. Agent reads execution-plan.json                              │
│  6. Agent reads contract.json (tokens, naming, scope)            │
│  7. Agent executes plan — NO ANALYSIS NEEDED, just follow steps  │
│  8. Agent updates src/ files per plan (replace hardcoded values) │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key insight from consumer**: Without render-then-accept, I have to
make design decisions AND execute them simultaneously. With this flow,
the user already confirmed the design visually. I just need to EXECUTE.
This eliminates 80% of my cognitive load.

### 2.2 System Relationship Map

```
┌─────────────────────────┐
│  open-design repo       │
│  ┌───────────────────┐  │
│  │ design-systems/   │──│── READ-ONLY reference library (152 DS packages)
│  │  ├── apple/       │  │    Source of truth for tokens, components, philosophy
│  │  ├── brutalism/   │  │    Agent reads but NEVER writes here
│  │  └── ...          │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ skills/           │──│── Generator instructions (agent reads these)
│  │  ├── design-sync/ │  │    MASTER orchestrator
│  │  ├── token-       │  │    Split tokens.css → individual files
│  │  │  extractor/    │  │
│  │  ├── component-   │  │    Extract component CSS
│  │  │  forge/        │  │
│  │  └── creative-    │  │    Generate motion CSS
│  │     motion/       │  │
│  └───────────────────┘  │
└──────────┬──────────────┘
           │ agent reads skills + DS as reference
           │ agent WRITES to target project
           ▼
┌─────────────────────────┐
│  target project         │
│  kedai-frontend/        │
│  ┌───────────────────┐  │
│  │ design/           │──│── OWNED by project, version-controlled, editable
│  │  ├── manifest.json│  │    Single format (JSON, matches repo)
│  │  ├── contract.json│  │    Machine-readable tokens, naming, scope
│  │  ├── execution-   │  │    Step-by-step file changes (agent follows this)
│  │  │  plan.json     │  │
│  │  ├── index.css    │  │    AUTO-GENERATED single entry point
│  │  ├── tokens/      │  │
│  │  ├── components/  │  │
│  │  ├── motion/      │  │
│  │  └── layout/      │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ src/              │  │
│  │  └── globals.css  │──│── @import "../design/index.css";
│  └───────────────────┘  │
└─────────────────────────┘
```

### 2.3 Key Principles

| Principle | Description |
|-----------|-------------|
| **Project Ownership** | `design/` lives IN the project, version-controlled with the project |
| **Portability** | Clone project = clone design system. No external dependency required |
| **Editability** | Developer can modify any file. `manifest.json` tracks modifications |
| **Upgradeability** | Smart sync from source DS without losing customizations |
| **Render Before Execute** | User sees preview before any files are written |
| **Contract-Driven** | Agent reads `contract.json`, never guesses naming or conventions |
| **Execution Plan** | Agent follows `execution-plan.json`, never improvises file changes |
| **Rollback Safe** | Every update is reversible. Execution plan is idempotent |
| **Format Consistency** | JSON everywhere — same format as repo `manifest.json` |

---

## 3. Target File Structure

### 3.1 Project-Local `design/`

```
{project-root}/
├── design/
│   ├── manifest.json            ← lockfile: source, hash, extensions, rollback
│   ├── contract.json            ← machine-readable: tokens, naming, scope, conventions
│   ├── execution-plan.json      ← step-by-step file changes for agent to execute
│   ├── index.css                ← AUTO-GENERATED single entry point
│   ├── tokens/
│   │   ├── colors.css           ← --color-primary-500, --color-neutral-200, etc.
│   │   ├── spacing.css          ← --spacing-xs, --spacing-md, etc.
│   │   ├── typography.css       ← --font-sans, --text-sm, etc.
│   │   └── shadows.css          ← --shadow-sm, --shadow-lg, etc.
│   ├── components/
│   │   ├── button.css
│   │   ├── card.css
│   │   ├── sidebar.css
│   │   ├── modal.css
│   │   ├── input.css
│   │   └── ...                  ← based on DS components + skill additions
│   ├── motion/
│   │   ├── transitions.css      ← transition timing, easing
│   │   └── animations.css       ← keyframe animations
│   └── layout/
│       ├── grid.css             ← grid system, containers
│       └── breakpoints.css      ← responsive breakpoints
├── src/
│   ├── app/
│   │   └── globals.css          ← @import "../design/index.css";
│   ├── components/
│   │   └── Button.tsx
│   └── ...
└── package.json
```

### 3.2 manifest.json Schema

> **Consumer feedback v1**: Used YAML. But repo uses `manifest.json` (typed,
> validated, schema-enforced). Dual format = dual maintenance = bugs.
> **Revised**: Single format. JSON everywhere. Same schema patterns as repo.

```jsonc
{
  // design/manifest.json
  // LOCKFILE for the project's design system.
  // Analogous to package-lock.json — tracks source, versions, and modifications.

  "schemaVersion": "od-design-local/v1",
  "version": 1,

  // ── Source Tracking ──────────────────────────────────────────
  "source": {
    "designSystem": "apple",       // slug dari repo design-systems/apple/
    "skill": "creative-motion",    // skill yang dipakai saat generate
    "repoHash": "a3f7b2c",        // content hash dari source DS di repo
    "generatedAt": "2026-06-13T10:00:00Z",
    "generatedBy": "open-design-agent"
  },

  // ── Extensions Tracking ─────────────────────────────────────
  // Track files that differ from source. Used by smart-update.
  "extensions": [
    {
      "type": "override",           // file exists in source, but was modified
      "file": "tokens/colors.css",
      "originalHash": "b4c5d6e",   // hash saat pertama kali di-generate
      "currentHash": "f7g8h9i"     // hash saat ini (kalau beda = user modified)
    },
    {
      "type": "add",               // file does not exist in source, was added
      "file": "components/sidebar.css",
      "addedBy": "agent",          // atau "user"
      "addedAt": "2026-06-13T12:00:00Z"
    }
  ],

  // ── Compatibility ───────────────────────────────────────────
  "stack": "react-tailwind",        // react-tailwind | react-css | vue | svelte | vanilla
  "cssStrategy": "custom-properties", // custom-properties | tailwind-theme | utility-classes | hybrid

  // ── Import Strategy ─────────────────────────────────────────
  "import": {
    "strategy": "index",            // index | direct | tailwind
    "entry": "index.css"           // the auto-generated entry point
  },

  // ── Rollback ────────────────────────────────────────────────
  // Every update stores the previous state hash for rollback
  "rollback": {
    "lastStableHash": "c4d5e6f",   // hash of design/ before last update
    "lastStableAt": "2026-06-12T10:00:00Z",
    "history": [
      {
        "hash": "a1b2c3d",
        "date": "2026-06-10T08:00:00Z",
        "source": "apple",
        "repoHash": "x9y8z7a"
      }
    ]
  }
}
```

### 3.3 contract.json — The Machine-Readable Convention

> **Consumer feedback**: manifest.yaml tells me WHERE the design comes from,
> but NOT how to write code that uses it. I need a CONTRACT that specifies
> exactly what tokens exist, what naming convention to follow, and what
> CSS scope the project uses. Without this, I have to open files one by one.

```jsonc
{
  // design/contract.json
  // Machine-readable convention contract for the project's design system.
  // Agent reads this BEFORE writing any code. No guessing.

  "schemaVersion": "od-design-contract/v1",

  // ── Token Registry ──────────────────────────────────────────
  // Every token that MUST exist. Agent can reference these without reading CSS.
  "tokens": {
    "colors": [
      "--color-primary-50", "--color-primary-100", "--color-primary-200",
      "--color-primary-500", "--color-primary-700", "--color-primary-900",
      "--color-neutral-0", "--color-neutral-50", "--color-neutral-900",
      "--color-success-500", "--color-warning-500", "--color-error-500"
    ],
    "spacing": [
      "--spacing-xs", "--spacing-sm", "--spacing-md", "--spacing-lg", "--spacing-xl"
    ],
    "typography": [
      "--font-sans", "--font-mono",
      "--text-xs", "--text-sm", "--text-base", "--text-lg", "--text-xl", "--text-2xl",
      "--leading-tight", "--leading-normal", "--leading-relaxed"
    ],
    "shadows": [
      "--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg"
    ],
    "motion": [
      "--duration-fast", "--duration-normal", "--duration-slow",
      "--ease-default", "--ease-in", "--ease-out", "--ease-in-out"
    ],
    "layout": [
      "--radius-sm", "--radius-md", "--radius-lg",
      "--breakpoint-sm", "--breakpoint-md", "--breakpoint-lg", "--breakpoint-xl"
    ]
  },

  // ── Naming Conventions ──────────────────────────────────────
  "naming": {
    "componentSelector": "kebab-case",  // .btn-primary, .card-body, .modal-overlay
    "tokenPrefix": "",                   // empty = --color-*, "apple" = --apple-color-*
    "fileNaming": "kebab-case",         // button.css, card.css, not Button.css
    "bemEnabled": false                  // if true, use .block__element--modifier
  },

  // ── CSS Scope ───────────────────────────────────────────────
  "scope": {
    "type": "global",                   // global | modules | scoped | css-in-js
    "customPropertiesRoot": ":root",    // where tokens are declared
    "componentPrefix": ""               // e.g. "ods-" for namespacing
  },

  // ── Component Registry ──────────────────────────────────────
  // What components exist and their CSS class names
  "components": [
    {
      "name": "button",
      "file": "components/button.css",
      "selectors": [".btn", ".btn-primary", ".btn-secondary", ".btn-ghost", ".btn-sm", ".btn-lg"]
    },
    {
      "name": "card",
      "file": "components/card.css",
      "selectors": [".card", ".card-header", ".card-body", ".card-footer"]
    },
    {
      "name": "sidebar",
      "file": "components/sidebar.css",
      "selectors": [".sidebar", ".sidebar-item", ".sidebar-active"]
    }
  ],

  // ── Strategy-Specific Config ────────────────────────────────
  "strategyConfig": {
    // Only relevant when cssStrategy = "tailwind-theme"
    "tailwind": {
      "themeFile": "tailwind.css",
      "tokenMapping": "custom-properties-to-theme"  // how tokens map to @theme
    },
    // Only relevant when cssStrategy = "custom-properties"
    "customProperties": {
      "rootSelector": ":root",
      "fallbackValues": true  // generate fallback values for older browsers
    }
  }
}
```

### 3.4 execution-plan.json — The Agent's Step-by-Step

> **Consumer feedback**: "I need not just a recipe, but a step-by-step
> execution plan. When user clicks accept, I should just EXECUTE, not ANALYZE."

```jsonc
{
  // design/execution-plan.json
  // Auto-generated when user ACCEPTS a design system.
  // Agent reads and executes each step. No analysis needed.

  "schemaVersion": "od-execution-plan/v1",
  "generatedAt": "2026-06-13T10:00:00Z",
  "sourceDesignSystem": "apple",
  "status": "pending",             // pending | in-progress | completed | failed

  // ── Phase 1: Design Directory Setup ─────────────────────────
  "phase1": {
    "description": "Generate design/ directory with tokens, components, motion",
    "steps": [
      {
        "id": "p1-1",
        "action": "create-directory",
        "path": "design/"
      },
      {
        "id": "p1-2",
        "action": "write-file",
        "path": "design/tokens/colors.css",
        "source": "design-systems/apple/tokens.css",
        "transform": "extract-colors"
      },
      {
        "id": "p1-3",
        "action": "write-file",
        "path": "design/tokens/spacing.css",
        "source": "design-systems/apple/tokens.css",
        "transform": "extract-spacing"
      },
      {
        "id": "p1-4",
        "action": "write-file",
        "path": "design/manifest.json",
        "source": "generated",
        "template": "manifest-template.json"
      },
      {
        "id": "p1-5",
        "action": "write-file",
        "path": "design/contract.json",
        "source": "generated",
        "template": "contract-template.json"
      },
      {
        "id": "p1-6",
        "action": "write-file",
        "path": "design/index.css",
        "source": "generated",
        "template": "index-template.css"
      }
    ]
  },

  // ── Phase 2: Project Integration ────────────────────────────
  "phase2": {
    "description": "Update project source files to use design system",
    "steps": [
      {
        "id": "p2-1",
        "action": "prepend-to-file",
        "path": "src/app/globals.css",
        "content": "@import \"../design/index.css\";",
        "idempotent": true  // safe to run multiple times (check if already present)
      },
      {
        "id": "p2-2",
        "action": "replace-in-file",
        "path": "src/components/Button.tsx",
        "find": "backgroundColor: \"#3B82F6\"",
        "replace": "backgroundColor: \"var(--color-primary-500)\"",
        "required": false  // skip if pattern not found
      },
      {
        "id": "p2-3",
        "action": "add-motion",
        "path": "src/components/Card.tsx",
        "content": "style={{ transition: \"var(--duration-normal) var(--ease-default)\" }}",
        "required": false
      },
      {
        "id": "p2-4",
        "action": "skip",
        "path": "src/components/Navbar.module.css",
        "reason": "Uses CSS Modules — not compatible with global custom properties without :root import"
      }
    ]
  },

  // ── Rollback Info ───────────────────────────────────────────
  "rollback": {
    "snapshotBefore": "c4d5e6f",   // hash of project state before execution
    "filesToBackup": [
      "src/app/globals.css"
    ],
    "idempotent": true             // entire plan is safe to re-run
  }
}
```

### 3.5 index.css (Auto-Generated)

```css
/* design/index.css — AUTO-GENERATED */
/* Design System: apple | Generated: 2026-06-13 | DO NOT EDIT */
/* Source: design-systems/apple (hash: a3f7b2c) */
/* To regenerate: agent reads design-sync skill */
/* Contract: design/contract.json — read this before writing code */

/* ── Tokens ─────────────────────────────── */
@import "./tokens/colors.css";
@import "./tokens/spacing.css";
@import "./tokens/typography.css";
@import "./tokens/shadows.css";

/* ── Layout ─────────────────────────────── */
@import "./layout/grid.css";
@import "./layout/breakpoints.css";

/* ── Components ─────────────────────────── */
@import "./components/button.css";
@import "./components/card.css";
@import "./components/sidebar.css";
@import "./components/modal.css";
@import "./components/input.css";

/* ── Motion ─────────────────────────────── */
@import "./motion/transitions.css";
@import "./motion/animations.css";
```

---

## 4. Import Strategies — Multi-Strategy Support

> **Consumer feedback v1**: Assumed `custom-properties` as default. But
> Tailwind v4 uses `@theme`, CSS Modules can't share `:root`, CSS-in-JS
> needs JS objects. One strategy doesn't fit all.
> **Revised**: Strategy is auto-detected and explicitly stored in manifest.

### 4.1 Strategy Matrix

| Stack | CSS Strategy | Token Format | Import Method |
|-------|-------------|--------------|---------------|
| React + Tailwind v4 | `tailwind-theme` | `@theme { --color-*: ... }` | `@import "../design/tailwind.css"` |
| React + CSS | `custom-properties` | `:root { --color-*: ... }` | `@import "../design/index.css"` |
| React + CSS Modules | `custom-properties` | `:root { --color-*: ... }` in globals + `var()` in modules | Split: globals imports tokens, modules use `var()` |
| Vue | `custom-properties` | `:root { --color-*: ... }` | `@import "../design/index.css"` |
| Svelte | `custom-properties` | `:root { --color-*: ... }` | `@import "../design/index.css"` |
| Vanilla | `custom-properties` | `:root { --color-*: ... }` | `@import "../design/index.css"` |
| CSS-in-JS | `js-tokens` | `export const tokens = { ... }` | `import { tokens } from "../design/tokens.js"` |

### 4.2 Strategy A: Index CSS (Default — Non-Tailwind)

```css
/* src/app/globals.css */
@import "../design/index.css";

/* Project-specific overrides below */
:root {
  --app-accent: var(--color-primary-500);
}
```

### 4.3 Strategy B: Tailwind v4 Theme

```css
/* design/tailwind.css — generated from DS tokens */
@theme {
  --color-primary-50: oklch(0.97 0.01 260);
  --color-primary-500: oklch(0.55 0.2 260);
  --color-primary-900: oklch(0.25 0.1 260);
  --font-sans: "Inter", system-ui, sans-serif;
  --spacing-unit: 0.25rem;
}
```

```css
/* src/app/globals.css */
@import "../design/tailwind.css";
```

This leverages existing `tailwind-v4.css` from DS packages but makes it project-local.

### 4.4 Strategy C: CSS Modules Hybrid

```css
/* src/app/globals.css — tokens only (global scope) */
@import "../design/tokens/colors.css";
@import "../design/tokens/spacing.css";
@import "../design/tokens/typography.css";
```

```css
/* src/components/Button.module.css — uses var() from globals */
.btn {
  background: var(--color-primary-500);
  padding: var(--spacing-sm) var(--spacing-md);
  transition: background var(--duration-fast) var(--ease-default);
}
```

Components CSS stays global in `design/components/` but tokens are importable per-file.

### 4.5 Strategy Detection Logic

```
1. User explicit preference → use that
2. Auto-detect:
   a. tailwind.config.* exists + @theme in CSS → strategy: tailwind-theme
   b. *.module.css exists → strategy: custom-properties (modules hybrid)
   c. styled-components/emotion in package.json → strategy: js-tokens
   d. No framework detected → strategy: custom-properties (index)
3. Store strategy in manifest.json → cssStrategy field
4. Generate contract.json with strategy-specific config
```

---

## 5. Skill Architecture — Generator Engine

### 5.1 Skill Hierarchy

```
design-sync/              ← MASTER orchestrator (P0)
├── Reads: target project path, DS name, options
├── Calls: token-extractor, component-forge, motion-generator
├── Generates: manifest.json, contract.json, execution-plan.json
├── Generates: index.css (or tailwind.css for Tailwind projects)
└── Updates: src/app/globals.css with import

token-extractor/         ← Split tokens.css into individual files (P0)
├── Reads: design-systems/{name}/tokens.css OR design-tokens.json
├── Classifies: by REGEX rules (see Decision Tree below)
└── Writes: tokens/colors.css, spacing.css, typography.css, shadows.css

component-forge/         ← Convert DS components to individual CSS (P0)
├── Reads: design-systems/{name}/components.html + components.manifest.json
├── Extracts: per-component CSS (using manifest selectors)
├── Generates: contract.json component registry
└── Writes: components/button.css, card.css, etc.
```

### 5.2 design-sync SKILL.md (Master Orchestrator)

```markdown
---
name: design-sync
type: leaf
parent: twig-design-system
---

# Design Sync

## Purpose
Generate or update a `design/` directory inside a target project,
using a design-system from the repo's `design-systems/` library as source.

## When to Activate
- User says: "setup design system", "init design system", "apply design system"
- User says: "update design system", "sync design system"
- User says: "switch vibe", "change design system"
- User accepts a design system preview in the UI (render → accept flow)

## Prerequisites
- Target project path must exist
- Source design system must exist in `design-systems/`
- Agent must have write access to target project

## CRITICAL: Read contract.json BEFORE writing any code

Before modifying ANY source file in the project, read `design/contract.json`.
This file tells you:
- What tokens are available (never hardcode a value that exists as a token)
- What naming convention to use (kebab-case, BEM, etc.)
- What CSS scope the project uses (global, modules, scoped)
- What component selectors exist (never invent your own class names)

If contract.json doesn't exist yet (first init), generate it from the
source DS manifest.json + tokens.css + components.manifest.json.

## CRITICAL: Follow execution-plan.json when integrating

When user ACCEPTS a design system, an execution-plan.json is generated.
Follow it step by step. Do NOT improvise additional changes.
If a step has `"required": false` and the pattern is not found, SKIP it.
If a step has `"idempotent": true`, it's safe to re-run.

## Init Flow (first time)

1. **Validate source**
   - Read `design-systems/{name}/manifest.json`
   - Verify `files.design`, `files.tokens`, `files.components` exist
   - Read `DESIGN.md` to understand design philosophy

2. **Detect project stack**
   - Check for tailwind.config.* → cssStrategy: tailwind-theme
   - Check for *.module.css → cssStrategy: custom-properties (modules)
   - Check for styled-components in package.json → cssStrategy: js-tokens
   - Fallback → cssStrategy: custom-properties

3. **Generate design/ directory**
   a. Token extraction (see token-extractor skill)
   b. Component extraction (see component-forge skill)
   c. Layout generation (from spacing/breakpoint tokens)
   d. Motion generation (if creative-motion skill active)

4. **Generate manifest.json**
   - Source DS name, skill, hash
   - Extensions: [] (empty on first gen)
   - Stack, strategy, rollback info

5. **Generate contract.json**
   - Token registry: list all available tokens by category
   - Naming conventions: kebab-case selectors, file naming
   - CSS scope: global/modules/scoped
   - Component registry: name, file, selectors
   - Strategy-specific config

6. **Generate execution-plan.json**
   - Phase 1: design/ directory creation steps
   - Phase 2: project integration steps (replace hardcoded values, add imports)
   - Mark each step with idempotent/required flags
   - Include rollback info

7. **Generate entry point CSS**
   - If tailwind-theme → generate `design/tailwind.css` with @theme
   - If custom-properties → generate `design/index.css` with @import chain
   - If js-tokens → generate `design/tokens.js` with JS exports

8. **Update project entry CSS**
   - Add @import to globals.css (idempotent — check if already present)

## Update Flow (existing design/)

1. **Read manifest.json** → source.designSystem, source.repoHash, extensions[]
2. **Read contract.json** → understand current conventions
3. **Hash current repo DS** → compare with manifest.repoHash
4. **If no changes** → "Design system is up to date"
5. **If changes exist**:
   a. Smart update (default):
      - BACKUP: store current hash in rollback.history
      - For each file in design/:
        - IF in extensions[] with type: override → SKIP (preserve)
        - ELSE → REGENERATE from source
      - Update manifest.json: source.repoHash = new hash
      - Regenerate contract.json (tokens may have changed)
      - Regenerate execution-plan.json (new integration steps)
      - Regenerate index.css
   b. Full reset (user explicitly requests):
      - Store current state in rollback
      - Delete design/ contents (keep manifest for rollback)
      - Re-run init flow

## Switch Vibe Flow

1. User: "switch to brutalism"
2. Read current manifest.json → note extensions + rollback
3. Ask: "Keep your customizations?" → merge or reset
4. Re-generate design/ from new source DS
5. Re-generate contract.json (new naming conventions, tokens)
6. Re-generate execution-plan.json (new integration steps)
7. Update manifest.json with new source

## Rollback Flow

1. User: "rollback design system"
2. Read manifest.json → rollback.lastStableHash
3. Verify hash matches a previous state
4. Restore design/ files from backup (if backup exists)
5. If no backup → re-generate from rollback.history source info
6. Update manifest.json with restored state
```

### 5.3 token-extractor SKILL.md

```markdown
---
name: token-extractor
type: leaf
parent: twig-design-system
---

# Token Extractor

## Purpose
Split a design system's `tokens.css` into individual categorized CSS files.

## Input
- Source: `design-systems/{name}/tokens.css` path
- Fallback: `design-systems/{name}/design-tokens.json`
- Output: `{project}/design/tokens/`

## Token Classification Decision Tree

> CRITICAL: Follow these rules EXACTLY. No guessing.
> If a property doesn't match any rule, put it in custom.css.

| Pattern | Category File | Examples |
|---------|--------------|----------|
| `--color-*` | colors.css | --color-primary-500, --color-neutral-200 |
| `--gradient-*` | colors.css | --gradient-sunset, --gradient-ocean |
| `--opacity-*` | colors.css | --opacity-disabled, --opacity-hover |
| `--spacing-*` | spacing.css | --spacing-xs, --spacing-md, --spacing-xl |
| `--radius-*` | spacing.css | --radius-sm, --radius-md, --radius-full |
| `--gap-*` | spacing.css | --gap-sm, --gap-md |
| `--font-*` | typography.css | --font-sans, --font-mono, --font-display |
| `--text-*` | typography.css | --text-xs, --text-sm, --text-base, --text-2xl |
| `--leading-*` | typography.css | --leading-tight, --leading-normal |
| `--tracking-*` | typography.css | --tracking-tight, --tracking-wide |
| `--weight-*` | typography.css | --weight-normal, --weight-bold |
| `--shadow-*` | shadows.css | --shadow-sm, --shadow-md, --shadow-lg |
| `--duration-*` | motion/transitions.css | --duration-fast, --duration-normal |
| `--ease-*` | motion/transitions.css | --ease-default, --ease-in-out |
| `--transition-*` | motion/transitions.css | --transition-colors, --transition-transform |
| `--animate-*` | motion/animations.css | --animate-spin, --animate-pulse |
| `--breakpoint-*` | layout/breakpoints.css | --breakpoint-sm, --breakpoint-md |
| `--container-*` | layout/grid.css | --container-sm, --container-max |
| `--z-*` | layout/grid.css | --z-dropdown, --z-modal, --z-tooltip |
| NO MATCH | tokens/custom.css | (anything else) |

## Processing Order

1. If `tokens.css` exists → parse CSS custom properties
2. If `design-tokens.json` exists → parse JSON, generate CSS from it
3. If both exist → tokens.css takes priority, design-tokens.json as supplement
4. If neither exists → skip with warning, generate empty placeholder files

## Output Format

Each `tokens/{category}.css`:
```css
/* Token Category: colors | Source: design-systems/apple */
/* Generated by token-extractor — safe to customize */

:root {
  --color-primary-50: oklch(0.97 0.01 260);
  --color-primary-500: oklch(0.55 0.2 260);
  --color-primary-900: oklch(0.25 0.1 260);
  /* ... */
}
```

## Special: Tailwind v4 Projects

If `cssStrategy = "tailwind-theme"` in manifest:
- DO NOT generate `:root` custom properties
- INSTEAD generate `@theme { }` block in `design/tailwind.css`
- Map: `--color-primary-500` → `--color-primary-500: oklch(...)` inside @theme
- Still generate individual token CSS files for reference/fallback
```

### 5.4 component-forge SKILL.md

```markdown
---
name: component-forge
type: leaf
parent: twig-design-system
---

# Component Forge

## Purpose
Extract individual component CSS from a design system's `components.html`
and generate a machine-readable component registry for contract.json.

## Input
- Source: `design-systems/{name}/components.html`
- Manifest: `design-systems/{name}/components.manifest.json`
- Output: `{project}/design/components/`

## Extraction Decision Tree

```
1. Read components.manifest.json?
   ├─ YES → Use manifest as source of truth
   │   └─ For each entry in manifest:
   │       ├─ Find matching CSS rules in components.html
   │       ├─ Extract → write {component-name}.css
   │       └─ Record selectors in contract.json component registry
   │
   └─ NO → Heuristic extraction
       ├─ Parse components.html <style> blocks
       ├─ Identify component boundaries by:
       │   ├─ CSS comment markers: /* Component: button */
       │   ├─ Selector prefixes: .btn-*, .card-*, .modal-*
       │   └─ Rule clustering (adjacent rules with shared prefix)
       ├─ Extract each cluster → {prefix}.css
       └─ Warn: "No components.manifest.json — extraction may be incomplete"

2. components.html doesn't exist?
   ├─ Read DESIGN.md → extract component descriptions
   ├─ Generate minimal CSS from descriptions (placeholder quality)
   └─ Warn: "Generated from prose, not from source CSS"

3. Component has 0 CSS rules?
   ├─ Write placeholder: /* Component: {name} — no CSS rules found */
   └─ Skip in contract.json component registry
```

## Output Format

Each `components/{name}.css`:
```css
/* Component: button | Source: design-systems/apple */
/* Generated by component-forge — safe to customize */
/* Selectors: .btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-sm, .btn-lg */

.btn {
  display: inline-flex;
  align-items: center;
  /* ... */
}

.btn-primary {
  background: var(--color-primary-500);
  /* ... */
}
```

## contract.json Generation

For each component extracted, add to contract.json:
```json
{
  "name": "button",
  "file": "components/button.css",
  "selectors": [".btn", ".btn-primary", ".btn-secondary", ".btn-ghost", ".btn-sm", ".btn-lg"]
}
```

This is CRITICAL — agent reads contract.json to know what selectors exist.
Never invent class names. If you need a variant that doesn't exist,
add it to the component CSS AND update contract.json.
```

---

## 6. Render → Accept → Execute Flow

### 6.1 Full Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. RENDER                                                       │
│                                                                  │
│ User selects "apple" in design system picker                    │
│ Frontend reads design-systems/apple/manifest.json               │
│ Frontend renders preview using tokens.css + components.html     │
│ User SEES: colors, typography, components, spacing              │
│ User can switch: "no, try brutalism" → re-render                │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ 2. ACCEPT                                                       │
│                                                                  │
│ User clicks "Apply to project"                                   │
│ Backend generates:                                               │
│   - design/ directory (tokens, components, motion, layout)      │
│   - manifest.json (source tracking, rollback)                   │
│   - contract.json (token registry, naming, scope)               │
│   - execution-plan.json (step-by-step project integration)      │
│   - index.css or tailwind.css (entry point)                     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ 3. EXECUTE                                                      │
│                                                                  │
│ Agent reads execution-plan.json                                  │
│ Agent reads contract.json (knows tokens, naming, scope)         │
│ Agent executes each step:                                        │
│   - Prepend @import to globals.css                               │
│   - Replace hardcoded colors with var(--color-*)                 │
│   - Add motion to components                                     │
│   - Skip CSS Modules / incompatible files                        │
│ Agent does NOT improvise — follows plan exactly                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ 4. ROLLBACK (if needed)                                         │
│                                                                  │
│ If something breaks:                                             │
│   Agent reads manifest.json → rollback.lastStableHash            │
│   Restore from backup or re-generate from history                │
│   execution-plan.json is idempotent — safe to re-run             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Why Render → Accept Matters (Consumer Perspective)

Without this flow:
```
Me: *read 152 manifests, extract tokens, generate 20 files,
     modify globals.css, update 15 component files*
User: "eh kurang cocok, ganti ke brutalism"
Me: ... *rollback everything manually, start over*
```

With this flow:
```
Frontend: *renders preview*
User: *clicks accept*
Me: *reads execution-plan.json, follows steps, done*
```

**This eliminates uncertainty. I don't decide what looks good — the user does.
I just execute. Cognitive load drops from 80% to 20%.**

---

## 7. Smart Update & Rollback

### 7.1 Smart Update Algorithm

```
INPUT: target project with existing design/manifest.json
       + repo design-systems/{name}/ with updated content

1. Read manifest.json → source.designSystem, source.repoHash, extensions[]
2. Read contract.json → current conventions
3. Hash current repo DS content → newHash

4. IF newHash == source.repoHash:
     RETURN "Already up to date"

5. BACKUP: store current state hash in manifest.rollback.history

6. FOR each file in design/ (excluding manifest.json, contract.json):
     IF file is in extensions[] with type: override:
       SKIP — preserve user modification
       ADD to update report as "skipped (user modified)"
     ELSE IF file is in extensions[] with type: add:
       SKIP — preserve agent/user addition
     ELSE:
       REGENERATE from source DS

7. Regenerate:
   - contract.json (tokens may have changed)
   - execution-plan.json (new integration steps)
   - index.css (file list may have changed)

8. Update manifest.json:
   - source.repoHash = newHash
   - source.generatedAt = now
   - rollback.lastStableHash = previous hash
   - Keep extensions[] as-is

9. RETURN update report
```

### 7.2 Rollback Mechanism

> **Consumer feedback v1**: No rollback at all. If I update 50 files and
> something breaks, I'm stuck. **Revised**: Every update stores previous
> state hash. Execution plan is idempotent. Can always re-run or restore.

```jsonc
// In manifest.json
{
  "rollback": {
    "lastStableHash": "c4d5e6f",
    "lastStableAt": "2026-06-12T10:00:00Z",
    "history": [
      {
        "hash": "a1b2c3d",          // state hash
        "date": "2026-06-10T08:00:00Z",
        "source": "apple",           // which DS
        "repoHash": "x9y8z7a"        // which DS version
      },
      {
        "hash": "b2c3d4e",
        "date": "2026-06-11T08:00:00Z",
        "source": "apple",
        "repoHash": "a3f7b2c"
      }
    ]
  }
}
```

Rollback flow:
1. User: "rollback design system"
2. Agent reads `rollback.lastStableHash`
3. If backup exists → restore from backup
4. If no backup → re-generate from `rollback.history[0]` source info
5. Re-generate execution-plan.json
6. Re-execute integration steps (idempotent — safe)

### 7.3 Idempotent Execution

Every step in execution-plan.json has an `idempotent` flag:
- `true` → safe to run multiple times (e.g., prepend import that checks if already present)
- If step already applied → skip silently
- If step partially applied → complete it

This means: if update fails at step 7 of 20, agent can re-run the plan.
Steps 1-6 are idempotent → they'll just skip. Step 7+ will execute fresh.

### 7.4 Update Report Format

```markdown
## Design System Update Report

**Source**: apple (hash: a3f7b2c → x9y8z7)
**Updated**: 2026-06-14T10:00:00Z

### Updated (3 files)
- tokens/spacing.css (source changed)
- components/button.css (source changed)
- components/card.css (source changed)

### Skipped — User Modified (2 files)
- tokens/colors.css (override detected, preserving)
- components/sidebar.css (added by agent, preserving)

### Added (1 file)
- components/dropdown.css (new in source DS)

### Removed (0 files)
(none)

### Contract Changes
- New tokens: --color-primary-950, --spacing-2xl
- Removed tokens: (none)
- New components: dropdown
- Changed selectors: .btn now includes .btn-icon

### Rollback Available
- Previous state hash: c4d5e6f
- To rollback: "rollback design system"
```

---

## 8. Multi-Vibe Composition (P2 — COMPLETE)

> **Updated**: Now implemented as `od design compose` command.
> Composition works via layer-based extraction with last-wins-per-layer conflict resolution.
> Cross-layer is orthogonal (no conflict).

Composition schema in manifest.json:

```jsonc
// In manifest.json
{
  "composition": [
    { "source": "apple", "layers": ["tokens", "layout"], "hash": "38af9eb", "repoHash": "e3b0c44" },
    { "source": "brutalism", "layers": ["components"], "hash": "6319d7a", "repoHash": "e3b0c44" },
    { "source": "creative", "layers": ["motion"], "hash": "22c9784", "repoHash": "e3b0c44" }
  ]
}
```

Usage:
```bash
od design compose --sources apple:tokens,layout brutalism:components creative:motion --force
```

CSS files get per-layer source attribution:
```css
/* Token Category: Colors | Source: design-systems/apple */
/* Component: buttons | Source: design-systems/brutalism */
/* Token Category: Motion Transitions | Source: design-systems/creative */
```

---

## 9. Integration with Existing Repo Systems

### 9.1 Relationship: design-systems/ (repo) → design/ (project)

```
design-systems/ (repo, READ-ONLY)       design/ (project, READ-WRITE)
─────────────────────────────────       ──────────────────────────────────
apple/                                  tokens/
├── DESIGN.md           ──inspire──→    (agent reads philosophy, applies)
├── tokens.css          ──extract──→    colors.css, spacing.css, typography.css
├── components.html     ──extract──→    button.css, card.css, ...
├── components.         ──read────→    contract.json component registry
│   manifest.json
├── tailwind-v4.css     ──copy────→    tailwind.css (if stack = tailwind)
├── manifest.json       ──reference→   manifest.json source field
└── preview/            ──skip────→    (not needed in project)

creative-motion/SKILL.md ──apply──→    motion/transitions.css, animations.css
```

### 9.2 Relationship: skills/ (repo) → design/ (project)

```
Skills are GENERATOR ENGINE — they produce design/ content.

skill: design-sync       → orchestrates the whole generation + writes execution plan
skill: token-extractor   → produces tokens/*.css + updates contract.json
skill: component-forge   → produces components/*.css + updates contract.json
skill: creative-motion   → produces motion/*.css
```

### 9.3 Relationship: .od/ → design/

```
BEFORE: .od/design-systems/ = runtime copy of repo DS
AFTER:  .od/ = daemon internal state only
        design/ = project-local, version-controlled

Migration:
- .od/design-systems/ still used by daemon for UI picker
- Agent reads DS from repo design-systems/ directly
- Agent writes to project design/ directly
- .od/ no longer stores design system data for agent use
```

### 9.4 Relationship: SKILL-TREE.yaml → design/ skills

```
SKILL-TREE.yaml maps skills (generators) into navigation tree.
Design-sync skills live under:
  branch: visual → twig: twig-design-systems
    → leaf: design-sync
    → leaf: token-extractor
    → leaf: component-forge
```

### 9.5 Format Consistency: JSON Everywhere

```
Repo design-systems/apple/manifest.json  ← od-design-system-project/v1
Project design/manifest.json             ← od-design-local/v1
Project design/contract.json             ← od-design-contract/v1
Project design/execution-plan.json       ← od-execution-plan/v1

All JSON. All schema-versioned. All validated.
No YAML. No dual format. No inconsistency.
```

---

## 10. Implementation Phases

### Phase 0: Foundation (P0) — COMPLETE

**Goal**: Agent can generate `design/` in any target project from a DS source.
Includes contract.json and execution-plan.json generation.

**Status**: All 3 skills created, SKILL-TREE updated, token classification validated against 150 DS packages (0 unclassified).

| Step | Task | Deliverable |
|------|------|-------------|
| 0.1 | Create `design-sync/SKILL.md` | Master orchestrator skill with full decision trees |
| 0.2 | Create `token-extractor/SKILL.md` | Token splitting skill with classification rules |
| 0.3 | Create `component-forge/SKILL.md` | Component extraction skill with fallback strategies |
| 0.4 | Add all 3 skills to SKILL-TREE.yaml | Navigation integration |
| 0.5 | Test: agent generates design/ from `apple` DS | End-to-end validation with contract + execution plan |

**Success Criteria**:
- Running the skill produces a valid `design/` with manifest.json, contract.json, execution-plan.json, index.css, tokens/, components/
- contract.json lists all available tokens and component selectors
- execution-plan.json includes step-by-step integration instructions
- Project's globals.css updated with @import

### Phase 1: Smart Update + Rollback (P1) — COMPLETE

**Goal**: Agent can update design/ without losing user customizations.
Rollback is always available.

**Status**: All algorithms documented in design-sync/SKILL.md — hash computation, extension detection, smart merge, rollback, update reports.

| Step | Task | Deliverable |
|------|------|-------------|
| 1.1 | Implement hash-based change detection | Compare repo DS vs manifest.repoHash |
| 1.2 | Implement extension tracking | manifest.json extensions[] with override/add types |
| 1.3 | Implement smart merge | Skip override files, regenerate non-overridden |
| 1.4 | Implement rollback mechanism | rollback history + idempotent execution |
| 1.5 | Generate update reports | Markdown diff with contract changes |
| 1.6 | Add `layout-generator` logic to design-sync | Layout generation (merged into design-sync) |

**Success Criteria**:
- Update preserves user-modified files
- Update report shows what changed / was skipped / contract changes
- Rollback restores previous state
- Execution plan is idempotent (safe to re-run)

### Phase 2: Multi-Strategy + Tailwind (P1) — COMPLETE

**Goal**: Support Tailwind v4, CSS Modules, and other CSS strategies.

**Status**: All 4 strategies documented — custom-properties, tailwind-theme, CSS Modules hybrid, js-tokens. Auto-detection algorithm in design-sync. Token extraction in token-extractor. Component generation in component-forge.

| Step | Task | Deliverable |
|------|------|-------------|
| 2.1 | Implement Tailwind v4 @theme generation | From tokens.css → @theme block |
| 2.2 | Implement CSS Modules hybrid strategy | Global tokens + scoped component styles |
| 2.3 | Auto-detect project stack | Tailwind / CSS Modules / vanilla detection |
| 2.4 | Implement js-tokens strategy | For CSS-in-JS projects |
| 2.5 | Add motion generation | motion/*.css from creative-motion |

**Success Criteria**:
- Tailwind projects get @theme-based tokens (not `:root` custom properties)
- CSS Modules projects get hybrid global+scoped approach
- Strategy stored in manifest.json, reflected in contract.json

### Phase 3: Render → Accept Flow (P2) — COMPLETE

**Goal**: Frontend renders design system preview before applying to project.

**Status**: Full web app built with Next.js 16 — DS picker, token preview (colors/spacing/typography/shadows/motion/layout), component iframe, and Apply dialog that triggers od-cli. All 150 DS packages load and render correctly.

| Step | Task | Deliverable |
|------|------|-------------|
| 3.1 | Frontend renders DS preview | Using tokens.css + components.html |
| 3.2 | User can switch DS and re-render | Live preview switching |
| 3.3 | Accept button triggers generation | design/ + execution-plan.json created |
| 3.4 | Agent auto-executes plan on accept | Seamless flow |

**Success Criteria**:
- User sees visual preview before any files are written
- Switching DS re-renders preview without writing files
- Accept triggers full generation + integration

### Phase 4: Multi-Vibe Composition (P2) — COMPLETE

**Goal**: Compose design/ from multiple DS sources.

**Status**: Full runtime — `od design compose` CLI command, composition schema in manifest.json, layer-based extraction, conflict resolution (last-wins-per-layer), per-layer source attribution in CSS headers, web UI Multi-Vibe Composer tab.

| Step | Task | Deliverable |
|------|------|-------------|
| 4.1 | Implement composition schema | manifest.json composition[] |
| 4.2 | Implement layer-based extraction | Per-layer generation from different sources |
| 4.3 | Implement conflict resolution | Last-wins-per-layer |
| 4.4 | Test: Apple tokens + Brutalism components | End-to-end composition |

**Success Criteria**:
- manifest.json records composition sources
- Tokens from Source A, components from Source B coexist
- contract.json reflects merged conventions
- index.css generated from all layers

### Phase 5: CLI Interface (P3) — COMPLETE

**Goal**: CLI commands for design/ management without agent.

**Status**: All 9 commands implemented and tested — init, update, add component, switch, diff, sources, rollback, status, compose.

| Step | Task | Deliverable |
|------|------|-------------|
| 5.1 | `od design init --from {name}` | Init design/ |
| 5.2 | `od design update` | Smart sync from source |
| 5.3 | `od design add component {name}` | Add component from DS |
| 5.4 | `od design switch --from {name}` | Switch vibe |
| 5.5 | `od design diff` | Show pending changes |
| 5.6 | `od design sources` | List available DS packages |
| 5.7 | `od design rollback` | Restore previous state |

**Success Criteria**:
- All commands work without agent (headless mode)
- CLI outputs match agent-generated results

---

## 11. Consumer Assessment (Self-Review)

### What Changed From v1 → v2

| Aspect | v1 | v2 (Revised) | Why |
|--------|----|----|-----|
| Directory name | `design-template/` | `design/` | "template" implies disposable. "design" = living |
| Manifest format | YAML | JSON | Single format with repo. No dual maintenance |
| Contract | None | `contract.json` | Agent needs machine-readable conventions, not just source tracking |
| Execution plan | None | `execution-plan.json` | Agent needs step-by-step, not just "recipe" |
| Rollback | None | Hash-based + idempotent | 50-file update without rollback = dangerous |
| Token classification | Vague | Decision tree with regex | Ambiguous rules = inconsistent output across sessions |
| Component extraction | "extract" | Decision tree with manifest-first, fallback | HTML extraction is messy, need clear strategy |
| CSS strategy | custom-properties only | Multi-strategy (tailwind, modules, js-tokens) | One strategy doesn't fit all |
| Multi-vibe | P0 | P2 (deferred) | Premature. Solve single DS first |
| Render → Accept | Not mentioned | Core flow | User confirms visually before agent works |

### Remaining Risks

| Risk | Mitigation |
|------|-----------|
| contract.json drift — developer modifies tokens without updating contract | Add comment in CSS: "Update contract.json if you add/remove tokens" |
| execution-plan.json becomes stale after manual edits | Plan is re-generated on every update. Old plans are one-shot |
| HTML component extraction is unreliable | Use components.manifest.json as source of truth. HTML is fallback |
| Large project integration (50+ files) is scary | Idempotent execution + rollback + update report. Agent can re-run safely |

---

## 12. Killer Feature: Project Imports from design/

```css
/* src/app/globals.css */
@import "../design/index.css";
```

One line. That's it. And now your project has:
- Consistent tokens (colors, spacing, typography)
- Ready-made components (button, card, sidebar)
- Motion system (transitions, animations)
- Layout system (grid, breakpoints)
- Machine-readable contract (agent never guesses)
- Step-by-step execution plan (agent never improvises)
- Rollback safety (agent never breaks without recovery)
- All version-controlled with the project
- All editable without breaking updates
- All upgradeable from the source DS library

**This is why `design/` lives in the project, not in `.od/`.**
**This is why it has a contract, not just a manifest.**
**This is why it has an execution plan, not just a recipe.**
**This is the killer feature.**
