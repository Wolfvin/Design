# od-preview

Web-based preview for Open Design systems — Render → Accept → Execute flow.

## Setup

This is a Next.js 16 app that runs alongside the od-cli. It provides a visual interface for:

1. **Browse** 150 design systems from the `design-systems/` directory
2. **Preview** tokens (colors, spacing, typography, shadows, motion, layout) and components
3. **Apply** a design system to a project via the CLI backend

## Architecture

```
┌───────────────────────────────────────────────┐
│  Browser                                       │
│  ┌─────────────┐  ┌──────────────────────────┐│
│  │ DS Picker    │  │ Preview Panel            ││
│  │ - Search     │  │ - Color swatches         ││
│  │ - Categories │  │ - Typography samples     ││
│  │ - 150 DS     │  │ - Spacing bars           ││
│  └─────────────┘  │ - Shadow previews         ││
│                    │ - Motion tokens           ││
│                    │ - Component iframe        ││
│                    └──────────────────────────┘│
└──────────────────┬────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  Next.js API       │
         │  /api/sources      │ → List DS packages
         │  /api/preview/[n]  │ → Get DS preview data
         │  /api/apply        │ → Trigger od-cli init
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  od-cli (Node.js)  │
         │  design init       │ → Generate design/
         │  design update     │ → Smart sync
         └────────────────────┘
```

## Environment Variables

- `OD_REPO_ROOT` — Path to the open-design repo root (default: `/home/z/my-project/Design/open-design`)
- `OD_CLI_PATH` — Path to the od-cli package (default: `${OD_REPO_ROOT}/packages/od-cli`)

## API Endpoints

### GET /api/sources
List all available design system packages.

Query params:
- `category` — Filter by category

Response:
```json
{
  "total": 150,
  "packages": [...],
  "byCategory": {...}
}
```

### GET /api/preview/[name]
Get full preview data for a design system.

Response includes:
- Tokens grouped by category (colors, spacing, typography, shadows, motion, layout)
- Component groups with selectors
- Raw tokens.css and components.html

### POST /api/apply
Apply a design system to a project (triggers od-cli).

Body:
```json
{
  "source": "apple",
  "projectPath": "/path/to/project",
  "strategy": "custom-properties",
  "force": true
}
```

Response:
```json
{
  "success": true,
  "source": "apple",
  "manifest": {...},
  "contract": {...}
}
```

## CSS Strategies

The Apply dialog supports 5 strategies:
1. **Auto-detect** — Detects project stack automatically
2. **Custom Properties** — `:root` custom properties (default)
3. **Tailwind v4** — `@theme` block for Tailwind
4. **CSS Modules** — Global tokens + scoped `.module.css`
5. **JS Tokens** — ES exports + TypeScript types

## Phase Status

| Phase | Status |
|-------|--------|
| Phase 0 Foundation | ✅ RUNTIME |
| Phase 1 Smart Update + Rollback | ✅ RUNTIME |
| Phase 2 Multi-Strategy | ✅ RUNTIME |
| **Phase 3 Render → Accept** | **✅ RUNTIME** |
| Phase 4 Multi-Vibe Composition | 📋 SPEC |
| Phase 5 CLI Interface | ✅ FULL RUNTIME |
