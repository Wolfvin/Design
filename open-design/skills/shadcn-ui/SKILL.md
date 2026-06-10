---
name: shadcn-ui
description: |
  Build UI components with shadcn/ui. Pairs with the Stitch design loop to ship structured, accessible components quickly.
triggers:
  - "shadcn"
  - "shadcn ui"
  - "shadcn components"
  - "accessible components"
od:
  mode: design-system
  category: design-systems
  outputFormat: file-edit
  upstream: "https://github.com/google-labs-code/skills"
---

<!-- MIGRATED: output changed from <artifact> to <file-edit> -->

# shadcn-ui

> Curated from Google Labs (Stitch).

## What it does

Build UI components with shadcn/ui. Pairs with the Stitch design loop to ship structured, accessible components quickly.

## Source

- Upstream: https://github.com/google-labs-code/skills
- Category: `design-systems`

## How to use

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To run the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/google-labs-code/skills
```

Then ask the agent to invoke this skill by name (`shadcn-ui`) or with
one of the trigger phrases listed in this skill's frontmatter.

## Output format

When generating shadcn/ui components, emit `<file-edit>` tags for each
file instead of `<artifact>`:

```
<file-edit path="src/components/ui/card.tsx">
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
)
Card.displayName = "Card"

export { Card }
</file-edit>
```

Do not wrap output in `<artifact>` tags. Use `<file-edit>` with explicit
file paths so the component files are written directly to the project and
Vite HMR picks up changes instantly.
