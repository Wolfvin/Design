---
name: frontend-dev
description: |
  Full-stack frontend with cinematic animations, AI-generated media via MiniMax API, and generative art. Useful for hero pages and showcase sites.
triggers:
  - "frontend dev"
  - "cinematic frontend"
  - "generative web"
  - "hero page"
  - "showcase site"
od:
  mode: prototype
  category: web-artifacts
  outputFormat: file-edit
  upstream: "https://github.com/MiniMax-AI/skills"
  stackCompatibility: both
skill-tree:
  type: leaf
  parent: twig-ui-design

---

<!-- MIGRATED: output changed from <artifact> to <file-edit> -->

# frontend-dev

> Curated from the MiniMax AI team.

## What it does

Full-stack frontend with cinematic animations, AI-generated media via MiniMax API, and generative art. Useful for hero pages and showcase sites.

## Source

- Upstream: https://github.com/MiniMax-AI/skills
- Category: `web-artifacts`

## How to use

This catalogue entry advertises the skill in Open Design so the agent
discovers it during planning. To run the full upstream workflow with
its original assets, scripts, and references, install the upstream
bundle into your active agent's skills directory:

```bash
# Inspect the upstream README for exact paths
open https://github.com/MiniMax-AI/skills
```

Then ask the agent to invoke this skill by name (`frontend-dev`) or with
one of the trigger phrases listed in this skill's frontmatter.

## Output format

When generating frontend code, emit `<file-edit>` tags for each file:

```
<file-edit path="src/components/HeroSection.tsx">
import React from 'react';
// ... component code
</file-edit>

<file-edit path="src/components/HeroSection.module.css">
.hero {
  background: var(--bg);
  /* ... styles ... */
}
</file-edit>
```

Do not wrap output in `<artifact>` tags. Use `<file-edit>` with explicit
file paths so Vite HMR can apply changes instantly.
