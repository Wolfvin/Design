---
name: coretax-console-dna
description: >
  The complete DNA of the CoretaxConsole — a dark cinematic React login/console UI with
  red-gold accent palette, canvas-driven ambient effects (aurora, perspective grid, particles, mouse trail),
  custom cursor system, staggered CSS keyframe reveals, glassmorphic wizard carousel, Web Audio micro-feedback,
  and a 4-panel sign-up flow (Google OAuth → Account Type → Identity Verification → Confirmation).
  Use this skill whenever you need to build or replicate any part of this aesthetic: dark-cyberpunk consoles,
  government/tax portal UIs, cinematic login screens, red-gold design systems, canvas-heavy ambient backgrounds,
  custom cursor interactions, wizard-style auth flows, or any React component that needs this exact visual DNA.
  Also use it when the user mentions "coretax", "fought", "DJP", "tax console", "dark login", "cinematic UI",
  "red gold dark theme", or wants to reproduce the CoretaxConsole look and feel.
---

# CoretaxConsole DNA Skill

This skill encapsulates every visual, structural, and behavioral pattern from the CoretaxConsole JSX component — a premium dark-cinematic login console for a tax platform Chrome Extension. It serves as a complete blueprint for recreating or extending this design system.

## When to Use This Skill

- Building dark-themed console/dashboard/login UIs with cinematic aesthetics
- Creating red + gold accent color systems on ultra-dark backgrounds
- Implementing canvas-based ambient effects (aurora blobs, perspective grids, particles, mouse trails)
- Building custom cursor systems with ring followers and crosshairs
- Creating wizard/stepper flows with carousel transitions
- Adding Web Audio micro-feedback to UI interactions
- Replicating the "CoretaxConsole" look for any government, fintech, or enterprise portal
- Any request involving "coretax", "DJP", "fought", tax console UI, or cinematic dark UI

## Architecture Overview

The component follows a layered rendering architecture:

```
┌──────────────────────────────────────────────┐
│  Layer 0: Backgrounds                        │
│  └─ Grain overlay, Scanlines, Mesh gradients │
│  └─ Aurora canvas (mouse-reactive blobs)     │
│  └─ Perspective grid canvas                  │
│  └─ Vignette                                 │
│  └─ SVG Mesh lines                           │
├──────────────────────────────────────────────┤
│  Layer 1: Structural                         │
│  └─ Slash panel (clip-path angled bg)        │
│  └─ Edge light (vertical glow + sparks)      │
│  └─ Glows (red BL, red TR, gold BR)          │
│  └─ Geo lines (5 skewed decorative lines)    │
├──────────────────────────────────────────────┤
│  Layer 2: UI                                 │
│  └─ Left: Hero section (title + stats)       │
│  └─ Right: Login card + wizard carousel      │
│  └─ Corner brackets, Status indicator         │
│  └─ Version badge, Mute button               │
├──────────────────────────────────────────────┤
│  Layer 3: Dynamic                            │
│  └─ Mouse light (lerp-followed radial glow)  │
│  └─ Particle canvas (floating red/gold/white) │
│  └─ Mouse trail canvas                       │
│  └─ Custom cursor (dot + ring + crosshair)    │
├──────────────────────────────────────────────┤
│  Layer 4: Overlays                           │
│  └─ Loading overlay (dual spinning rings)    │
│  └─ Success overlay (check draw + redirect)  │
└──────────────────────────────────────────────┘
```

## Reference Files

For deep implementation details, read these reference files:

| File | Content |
|------|---------|
| `references/design-system.md` | Color palette, CSS variables, typography, spacing, border language |
| `references/visual-effects.md` | Grain, scanlines, vignette, glows, mesh, geo lines, edge light, sparks |
| `references/canvas-animations.md` | Aurora blobs, perspective grid, particles, mouse trail — all canvas logic |
| `references/cursor-system.md` | Custom cursor dot, ring follower, crosshair, mouse light |
| `references/ui-components.md` | Login card, wizard carousel, type cards, terms, buttons, overlays |
| `references/animation-patterns.md` | All keyframe animations, easing curves, staggered reveals, transitions |
| `references/audio-system.md` | Web Audio API tone generation, sound mapping, mute control |
| `references/react-patterns.md` | State management, refs, callbacks, effect cleanup, height sync |

## Quick Implementation Guide

### 1. CSS Injection Pattern

The entire 577-line CSS is injected once via a `useEffect` that creates a `<style>` element with id `ctx-styles`. This ensures styles are scoped with the `.ctx-root` prefix and cleaned up on unmount. All class names use the `ctx-` namespace to avoid collisions.

### 2. Split Layout

The page is divided into a left hero zone (46%) and a right login zone (54%). The right panel uses `clip-path: polygon()` to create an angled slash edge. On mobile, it switches to a stacked layout with the hero on top and panel sliding up from bottom.

### 3. Canvas Animation Loop

Each canvas effect runs its own `requestAnimationFrame` loop inside a `useEffect` with proper cleanup. All canvases use `ResizeObserver` or `window.resize` to stay responsive. The aurora canvas reacts to mouse position for a living background effect.

### 4. Wizard Carousel

The multi-step wizard uses a flex-based carousel: panels are `min-width: 100%` and the container translates via `translateX(-${index * 100}%)`. Card height dynamically adjusts by cloning the target panel off-screen, measuring its `scrollHeight`, and animating the transition.

### 5. Audio Feedback

Web Audio API generates sine-wave tones for different interactions: tick (1200+900Hz), check (880+1320Hz), verified (660+880+1100Hz), success (C5+E5+G5+C6 arpeggio). A global mute toggle controls all sounds.

## Key Design Principles

1. **Ultra-thin borders**: Every border is 0.5px — never 1px. This creates a refined, surgical aesthetic.
2. **Layered opacity**: Colors are built from multiple overlapping low-opacity layers rather than single solid values.
3. **Staggered reveals**: Every element enters with a delay-based animation, creating a cinematic sequence.
4. **Mouse as spotlight**: The cursor system (dot + ring + crosshair + light) makes the mouse an active participant in the visual composition.
5. **Sound as texture**: Audio feedback is not decoration — it's structural. Each interaction has a distinct sonic signature.
6. **Red = action, Gold = verification**: The color system encodes meaning: red for primary actions/branding, gold for verified/success states.
7. **Angled geometry**: The 8-degree skew angle appears in panel edges, geo lines, and the overall slash composition.

## Complete Color Token Map

```
Background:  #02020A (bg), #07070F (surface)
Red accent:  #C91C1C (base), #FF2828 (bright), #8B0F0F (dark)
Gold accent: #C4963A (base), #E8B84B (bright), #8A6520 (dark)
Text:        #F0EFED (white), rgba(240,239,237,0.36) (muted), rgba(240,239,237,0.18) (muted2)
```

## Typography Stack

| Role | Font | Weight | Letter-spacing | Case |
|------|------|--------|----------------|------|
| Display/Title | Bebas Neue | 400 | 0.015-0.05em | Uppercase |
| Body/Button | Barlow Condensed | 300-700 | 0.1-0.18em | Uppercase |
| Label/Meta | DM Mono | 300-400 | 0.08-0.45em | Uppercase |

## Component Hierarchy

```
CoretaxConsole (root)
├── Backgrounds
│   ├── Grain overlay (SVG feTurbulence)
│   ├── Scan lines (repeating-linear-gradient)
│   ├── Mesh (5-layer radial-gradient)
│   ├── Aurora canvas (mouse-reactive blobs)
│   ├── Grid canvas (perspective scrolling grid)
│   ├── Vignette (radial-gradient + breathing)
│   └── Mesh lines (7 SVG lines)
├── Structure
│   ├── Slash panel (clip-path polygon)
│   ├── Edge light (3-layer glow + 2 sparks)
│   ├── Red glow BL, Red glow TR, Gold glow BR
│   └── 5 Geo lines (3 white, 1 red, 1 gold)
├── Chrome
│   ├── Corner brackets (TL + BR with dots)
│   ├── Status indicator (dot + text)
│   ├── Version badge
│   └── Mute button (SVG speaker icons)
├── Hero (left 46%)
│   ├── Eyebrow (with animated rule)
│   ├── Title (3-line staggered reveal)
│   ├── Rule line (animated width)
│   ├── Subtitle
│   ├── Extension badge (icon + meta)
│   └── Stats row (3 metrics + dividers)
├── Login Card (right 54%)
│   ├── Card clip (shimmer + corner accent)
│   ├── Wizard header (shown when wizActive)
│   ├── Carousel (4 panels)
│   │   ├── Panel 0: Sign In (Google btn + info rows)
│   │   ├── Panel 1: Account Type (2 type cards + 2 terms)
│   │   ├── Panel 2: Verify Identity (Google login + verified state)
│   │   └── Panel 3: Confirm (summary rows + enter button)
│   └── Step dots (3 dots)
├── Dynamic
│   ├── Mouse light (lerp-followed radial)
│   ├── Particle canvas (52 particles)
│   ├── Trail canvas (44-point trail)
│   └── Cursor (dot + ring + H/V crosshair)
└── Overlays
    ├── Loading (dual spinning rings + message)
    └── Success (check draw + pulse + redirect bar)
```

## Wizard State Machine

```
Panel 0 (Sign In)
  └─ [Google Login click] → openWizard() → Panel 1

Panel 1 (Account Type)
  ├─ Validate: userType selected + both terms checked
  ├─ [Lanjutkan] → goStep2() → Panel 2
  └─ Error: "Pilih tipe akun" or "Setujui semua ketentuan"

Panel 2 (Verify Identity)
  ├─ [Masuk dengan Google] → simulated Google auth (2.5s)
  │   └─ Sets: googleVerified, gvEmail, gvName, statusGold
  ├─ [Lanjut] → goStep3() → Panel 3 (if googleVerified)
  ├─ [Kembali] → goBackStep1() → Panel 1
  └─ Error: "Selesaikan login Google terlebih dahulu"

Panel 3 (Confirm)
  ├─ Summary: Name, Email, Account Type, Platform, Terms, Verification
  ├─ [Masuk ke Aplikasi] → doEnterApp()
  │   └─ 5 sequential loading messages (650ms each)
  │   └─ Success overlay + typewriter email + redirect bar
  ├─ [Kembali] → goBackStep2() → Panel 2
  └─ Processing state: border-pulse animation, gold color shift
```

## Mobile Responsive Breakpoint

At `max-width: 768px`:
- Custom cursor elements hidden, native cursor restored
- Hero becomes full-width, auto-height, top-positioned
- Stats row hidden
- Panel becomes full-width, bottom-positioned, 65% height
- Right wrap becomes full-width, bottom-positioned, max 72vh scrollable
- Login card stretches to full width
