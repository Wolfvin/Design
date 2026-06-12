---
name: fecttral-cyberpunk-ui
description: |
  Builds futuristic cyberpunk/sci-fi UI layouts in HTML, CSS, and JavaScript — modeled after the FectTral design system. Use this skill when the user asks for: dark sci-fi UI, cyberpunk dashboard, neon blue interface, space/tech aesthetic, glitch effects, sidebar layout with topbar, futuristic admin panel, holographic UI, HUD-style design, dark mode with glow effects, animated background with grid or particles, terminal-style UI, retro-futurist design, sci-fi app layout, split-panel tool pages, web fetcher UI, form input with glow, cyberpunk filter checkboxes, toggle switches, terminal log output, result category expand/collapse, duplicate warning badge, review queue UI, card review with approve/reject actions, keyboard shortcut hints, thumbnail strip navigation, segmented progress bar, focus card with code preview, decision overlay animation, status ribbon, DNA report page, mood distribution bar chart, design stats grid, top elements list with star rating, canvas line chart/sparkline, recommendation cards, data visualization, animated strength bar, re-analyze overlay with log steps, hex identity card with spinning SVG, mini bar chart inside stat cells.
license: Apache-2.0
metadata:
  author: fecttral-design-system
  version: "3.0"
  tags: cyberpunk, sci-fi, dark-ui, neon, glitch, dashboard, sidebar, animation, split-panel, form, terminal-log, checkboxes, toggles, review-queue, approve-reject, keyboard-shortcuts, thumbnail-strip, progress-segments, dna-report, data-viz, canvas-chart, mood-chart, stat-grid, recommendation-cards
allowed-tools: Read Write
skill-tree:
  type: leaf
  parent: twig-design-system

---

# FectTral Cyberpunk UI Skill

## Overview

This skill produces **self-contained, single-file HTML** pages styled in a deep-space cyberpunk aesthetic. The design system uses a dark void background, electric blue neon glows, animated starfield, perspective grid floor, glitch text effects, floating hex particles, and a structured sidebar + topbar shell. All outputs are immediately browser-renderable with no build step.

Pages built with this skill follow a consistent **layout shell** (topbar 48px + sidebar 220px + content flex:1) and can host any inner page layout — dashboards, split-panel tools, form pages, terminal views, and more.

---

## When to Use This Skill

- User asks for a "cyberpunk", "sci-fi", "futuristic", or "holographic" UI
- User wants a "dark dashboard" with neon or glow effects
- User mentions glitch effects, CRT scanlines, or terminal aesthetics
- User wants an animated background (stars, grid, particles)
- User wants a sidebar layout with navigation and a topbar header
- User asks for a "space tech" or "HUD-style" interface
- User wants blue neon, electric glow, or deep dark UI design
- User asks for a split-panel tool page (input left / results right)
- User wants form inputs with glow, filter checkboxes, or toggle switches
- User wants a terminal-style log output area
- User wants category expand/collapse result groups
- User wants a **review/approval queue** with approve/reject/skip/rename actions *(v3.0)*
- User wants **keyboard shortcut** hints displayed in UI *(v3.0)*
- User wants a **thumbnail strip** for browsing items *(v3.0)*
- User wants a **segmented progress bar** (approved / rejected / pending) *(v3.0)*
- User wants a **card focus mode** — one item at a time with decision overlays *(v3.0)*
- User wants a **DNA report**, design profile, or **data analytics page** *(v3.0)*
- User wants a **mood/stat distribution bar chart** (animated fill-from-zero) *(v3.0)*
- User wants a **canvas sparkline / line chart** *(v3.0)*
- User wants **stat grid cells** with mini bar charts inside *(v3.0)*
- User wants **recommendation cards** (missing / explore / strength types) *(v3.0)*
- User wants a **re-analyze / re-run overlay** with step-by-step log *(v3.0)*

---

## Design System Reference

### Color Palette (CSS Variables)

```css
:root {
  /* Backgrounds — darkest to lightest */
  --bg-void:       #020408;   /* Page background — deepest space */
  --bg-deep:       #050912;   /* Secondary depth layer */
  --bg-panel:      #0a1428;   /* Sidebar and panel surfaces */
  --bg-card:       #0d1a32;   /* Card and widget backgrounds */

  /* Blue accent scale */
  --blue-core:     #00aaff;   /* Primary neon blue */
  --blue-bright:   #00d4ff;   /* Highlight / active state */
  --blue-electric: #0066ff;   /* Deep electric blue */
  --blue-dim:      #003a8c;   /* Muted / inactive */

  /* Glow effects (box-shadow / text-shadow values) */
  --glow-sm:   0 0 8px rgba(0,170,255,0.4);
  --glow-md:   0 0 16px rgba(0,170,255,0.5), 0 0 32px rgba(0,102,255,0.2);
  --glow-text: 0 0 10px rgba(0,212,255,0.8), 0 0 20px rgba(0,170,255,0.4);

  /* Borders */
  --border-dim:    rgba(0,140,255,0.10);
  --border-mid:    rgba(0,170,255,0.22);

  /* Text */
  --text-primary:  #e8f4ff;   /* Main readable text */
  --text-secondary:#8ab8d8;   /* Labels, subtitles */
  --text-muted:    #3a5a78;   /* Disabled / hint text */
  --text-dim:      #1a3050;   /* Almost invisible text */

  /* Typography */
  --font-display: 'Orbitron', monospace;    /* Headings, logo */
  --font-body:    'Exo 2', sans-serif;      /* Body text */
  --font-mono:    'JetBrains Mono', monospace; /* Terminal, code */

  /* Layout */
  --sidebar-w: 220px;
  --topbar-h:  48px;
}
```

### Google Fonts Import (always include)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&family=Exo+2:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## Step-by-Step Instructions

### Step 1 — Set Up the HTML Shell

Always start with this base structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Page Title]</title>
  <!-- Font import here -->
  <style>/* All CSS goes here */</style>
</head>
<body>
  <!-- Background layers first, always fixed/z-index:0 -->
  <div class="bg-root"> ... </div>

  <!-- Glitch bar overlay, z-index:999 -->
  <div id="glitchBars" class="glitch-bars"></div>

  <!-- Custom cursor elements -->
  <div id="cursor"></div>
  <div id="cursor-ring"></div>

  <!-- Main app wrapper, z-index:2 -->
  <div id="app" class="app">
    <header class="topbar"> ... </header>
    <div class="main-layout">
      <aside class="sidebar"> ... </aside>
      <main class="content"> ... </main>
    </div>
  </div>

  <script>/* All JS goes here */</script>
</body>
</html>
```

### Step 2 — Build the Background Layer System

Layer these inside `.bg-root` (position: fixed, inset: 0, z-index: 0):

**A. Space gradient base** (`.bg-space`):
```css
.bg-space {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 20% 80%, rgba(0,40,120,0.6) 0%, transparent 45%),
    radial-gradient(ellipse at 80% 10%, rgba(0,20,80,0.5) 0%, transparent 40%),
    radial-gradient(ellipse at 50% 50%, rgba(0,10,40,0.4) 0%, transparent 65%),
    #020408;
}
```

**B. Dot grid** (`.bg-grid`) — `radial-gradient` dots on 36px grid with `gridDrift` animation

**C. Perspective floor grid** (`.bg-floor`) — `perspective(500px) rotateX(65deg)` with `floorScroll` animation

**D. Giant hex wireframe** (`.bg-hex-giant`) — SVG nested hexagons, `slowRotate 150s`, opacity 0.035

**E. Ambient glow orbs** (`.orb-1`, `.orb-2`, `.orb-3`) — blurred circles, slow float

**F. Star canvas** (`<canvas id="starCanvas">`) — drawn via JS

**G. Data streams, hex particles, scan beam, CRT scanlines, vignette overlay**

HTML order inside `.bg-root`:
```html
<div class="bg-space"></div>
<canvas id="starCanvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
<div class="bg-grid"></div>
<div class="bg-floor"></div>
<div class="bg-hex-giant"><svg>...</svg></div>
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="orb orb-3"></div>
<div id="dataStreams"></div>
<div id="hexParticles"></div>
<div class="scan-beam"></div>
<div class="scanlines"></div>
<div class="vignette"></div>
```

### Step 3 — Build the Topbar

```css
.topbar {
  height: var(--topbar-h);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px 0 0;
  border-bottom: 1px solid var(--border-dim);
  background: linear-gradient(90deg, rgba(4,8,16,0.98) 0%, rgba(7,13,25,0.96) 100%);
  backdrop-filter: blur(30px); flex-shrink: 0; position: relative; overflow: hidden;
}
/* Animated bottom glow line */
.topbar::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(0,150,255,0.25) 25%, rgba(0,212,255,0.7) 50%, rgba(0,150,255,0.25) 75%, transparent 100%);
  animation: barGlow 5s ease-in-out infinite;
}
```

Key topbar elements:
- **`.topbar-logo`** — width: var(--sidebar-w), logo hex SVG + brand name in Orbitron + subtitle
- **`.topbar-center`** — breadcrumb (font-mono) + context pill with pulsing dot
- **`.topbar-right`** — AI status pill (green, with pulse dot) + icon buttons + user avatar

### Step 4 — Build the Sidebar

```css
.sidebar {
  width: var(--sidebar-w); flex-shrink: 0;
  display: flex; flex-direction: column;
  border-right: 1px solid var(--border-dim);
  background: linear-gradient(180deg, rgba(4,8,18,0.97) 0%, rgba(2,4,10,0.99) 100%);
  backdrop-filter: blur(40px); padding: 12px 0;
  overflow-y: auto; overflow-x: hidden; position: relative;
}
/* Animated right glow edge */
.sidebar::after {
  content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 1px;
  background: linear-gradient(180deg, transparent 0%, rgba(0,100,255,0.15) 25%, rgba(0,170,255,0.45) 50%, rgba(0,100,255,0.15) 75%, transparent 100%);
  animation: sideGlow 6s ease-in-out infinite;
}
```

Nav item pattern (always use `<a>` tags with `.nav-item`):
```css
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px; margin: 1px 8px; border-radius: 3px;
  cursor: pointer; font-size: 12px; font-weight: 500; letter-spacing: 0.04em;
  color: var(--text-muted); transition: all 0.25s; border: 1px solid transparent;
  text-decoration: none; overflow: hidden; position: relative;
}
/* Shimmer on hover */
.nav-item::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(0,140,255,0.07) 50%, transparent 100%);
  transform: translateX(-100%); transition: transform 0.5s ease;
}
.nav-item:hover::before { transform: translateX(100%); }
.nav-item.active {
  color: var(--blue-bright);
  background: linear-gradient(90deg, rgba(0,90,220,0.16) 0%, rgba(0,50,130,0.06) 100%);
  border-color: rgba(0,160,255,0.18); text-shadow: 0 0 8px rgba(0,170,255,0.5);
}
/* Active left accent bar */
.nav-item.active::after {
  content: ''; position: absolute; left: -8px; top: 50%; transform: translateY(-50%);
  width: 3px; height: 60%; background: var(--blue-bright); border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px var(--blue-bright);
}
```

Sidebar footer — always include at bottom:
```html
<div class="sidebar-footer">
  <div class="lib-stats"> <!-- stat numbers: Elements / Categories / Layers --> </div>
  <div class="provider-card"> <!-- AI Provider: OLLAMA LOCAL + model name --> </div>
</div>
```

### Step 5 — Content Inner Layouts

The `.content` area is `flex:1; overflow-y:auto`. Place inner page layouts inside it.

#### 5A — Dashboard / Card Layout (default)
Centered card with glitch title, stat row, terminal row. See Example 1.

#### 5B — Split Panel Tool Layout (v2.0)

For tool pages (web fetcher, AI generator, form+results), use:

```css
.fetch-page { display: flex; flex-direction: column; height: 100%; }
.fetch-topbar { /* page-level header bar with eyebrow + title + meta */ flex-shrink: 0; }
.fetch-panels { display: flex; flex: 1; overflow: hidden; }
.panel-left {
  width: 380px; flex-shrink: 0; display: flex; flex-direction: column;
  border-right: 1px solid var(--border-dim); overflow-y: auto;
  background: rgba(2,4,10,0.5);
}
.panel-right { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
```

Use `.panel-section` (with `.section-label` header) to group controls in the left panel.

#### 5C — Review Queue / Focus Card Layout (v3.0)

For item-by-item review pages (approve/reject queue, moderation, curation):

```
content
  └── .review-page (flex col, height 100%)
        ├── .review-header (sticky, page title + progress segments + batch toggle)
        └── .review-body (flex col, flex:1)
              ├── .nav-bar (counter "X of Y" + prev/next buttons)
              ├── .batch-bar (hidden by default; shown when batch mode ON)
              ├── .focus-area (flex row, flex:1)
              │     ├── .focus-main (flex:1 — element info + code block)
              │     └── .meta-panel (260px fixed — tags/compat/stats/similar)
              ├── .action-bar (approve / reject / rename / skip + shortcuts)
              └── .thumb-strip (horizontal scroll — all item thumbnails)
```

Key patterns:
- **Segmented progress bar**: 3 `flex` segments (approved/rejected/pending), each `transition:flex 0.6s`
- **Status ribbon**: 3px vertical strip on card right edge, color changes on decision
- **Decision overlay**: absolute over code block, `opacity:0→1` flash on approve/reject, auto-fade
- **Inline rename**: hidden `<input>` replaces name display; confirm/cancel buttons
- **Auto-advance**: `setTimeout(()=>next(), 600)` after decision to allow overlay to show

#### 5D — Data / Analytics / Report Layout (v3.0)

For data visualization and profile report pages:

```
content (overflow-y: auto — this page SCROLLS unlike others)
  └── .dna-page
        ├── .dna-page-header (sticky, position:sticky top:0 z-index:20)
        └── .dna-grid (CSS grid, grid-template-areas, gap:20px, padding:24px 28px)
              ├── card-identity  (grid-area: identity)
              ├── card-mood      (grid-area: mood)
              ├── card-stats     (grid-area: stats — spans full width)
              ├── card-elements  (grid-area: elements)
              ├── card-timeline  (grid-area: timeline)
              └── card-reco      (grid-area: reco — spans full width)
```

Grid definition example:
```css
.dna-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-areas:
    "identity  mood"
    "stats     stats"
    "elements  timeline"
    "reco      reco";
  gap: 20px;
  padding: 24px 28px;
}
```

All cards share `.dna-card` base (border, border-radius:6px, dark bg, `::before` top line, `::after` corner accent bracket).

### Step 6 — Form Components (v2.0)

#### URL / Text Input with Glow

```css
.url-input-wrap { position: relative; }
.url-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
.url-input {
  width: 100%; padding: 13px 14px 13px 36px;
  background: rgba(0,20,50,0.6); border: 1px solid var(--border-dim); border-radius: 4px;
  font-family: var(--font-mono); font-size: 11px; color: var(--text-primary); outline: none;
  transition: all 0.3s;
}
.url-input:focus { border-color: var(--blue-core); background: rgba(0,30,70,0.7); box-shadow: 0 0 0 2px rgba(0,150,255,0.12), var(--glow-sm); }
```

#### Toggle Switch (ON/OFF)

```html
<div class="toggle-track on" id="myToggle"><div class="toggle-knob"></div></div>
```
```css
.toggle-track {
  width: 40px; height: 22px; border-radius: 11px;
  background: rgba(0,40,100,0.4); border: 1px solid var(--border-dim); transition: all 0.3s; position: relative; cursor: pointer;
}
.toggle-track.on { background: rgba(0,120,255,0.25); border-color: var(--blue-core); box-shadow: 0 0 10px rgba(0,150,255,0.2); }
.toggle-knob {
  position: absolute; width: 16px; height: 16px; border-radius: 50%;
  background: var(--text-muted); top: 2px; left: 2px; transition: all 0.3s;
}
.toggle-track.on .toggle-knob { left: 20px; background: var(--blue-bright); box-shadow: 0 0 8px var(--blue-core); }
```
```javascript
document.getElementById('myToggle').addEventListener('click', function(){ this.classList.toggle('on'); });
```

#### Filter Checkboxes (Grid)

```html
<div class="filter-grid">
  <div class="filter-item checked" data-filter="animations">
    <div class="filter-check"><span class="filter-check-mark">✓</span></div>
    <span class="filter-icon">◎</span>
    <span class="filter-name">Animations</span>
  </div>
  <!-- repeat for each filter -->
</div>
```
```css
.filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.filter-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  border: 1px solid var(--border-dim); border-radius: 3px; cursor: pointer;
  background: rgba(0,15,40,0.4); transition: all 0.2s;
}
.filter-item.checked { border-color: rgba(0,150,255,0.3); background: rgba(0,50,120,0.2); }
.filter-check { width: 14px; height: 14px; border: 1px solid var(--text-dim); border-radius: 2px; display: flex; align-items: center; justify-content: center; }
.filter-item.checked .filter-check { background: var(--blue-core); border-color: var(--blue-bright); box-shadow: 0 0 6px rgba(0,150,255,0.4); }
.filter-check-mark { font-size: 9px; color: #000; display: none; }
.filter-item.checked .filter-check-mark { display: block; }
```
```javascript
document.querySelectorAll('.filter-item').forEach(item => item.addEventListener('click', () => item.classList.toggle('checked')));
```

#### Scan / Action Button with Loading State

```html
<button class="scan-btn" id="scanBtn">
  <div class="btn-shimmer"></div>
  <span class="btn-text">⬡ SCAN URL</span>
  <div class="btn-loading">
    <div class="spin-ring"></div>
    <span>SCANNING...</span>
  </div>
</button>
```
```css
.scan-btn {
  width: 100%; padding: 13px;
  background: linear-gradient(135deg, rgba(0,80,200,0.3) 0%, rgba(0,50,150,0.2) 100%);
  border: 1px solid var(--blue-core); border-radius: 4px;
  font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.18em;
  color: var(--blue-bright); cursor: pointer; transition: all 0.3s;
  position: relative; overflow: hidden;
}
.scan-btn:hover { box-shadow: var(--glow-md); transform: translateY(-1px); }
.scan-btn.scanning .btn-text { display: none; }
.scan-btn.scanning .btn-loading { display: flex; }
.btn-loading { display: none; align-items: center; justify-content: center; gap: 10px; }
.spin-ring {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(0,150,255,0.2); border-top-color: var(--blue-bright);
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.btn-shimmer {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%);
  transform: translateX(-100%); animation: shimmer 2.5s ease-in-out infinite;
}
@keyframes shimmer { 0%{transform:translateX(-100%);} 100%{transform:translateX(200%);} }
```
```javascript
document.getElementById('scanBtn').addEventListener('click', function() {
  this.classList.add('scanning');
  // ... do async work ...
  setTimeout(() => this.classList.remove('scanning'), 4500);
});
```

### Step 7 — Terminal Log Output (v2.0)

For animated terminal-style output in the results panel:

```html
<div class="terminal-log" id="terminalLog"></div>
```
```css
.terminal-log {
  padding: 14px 20px; background: rgba(1,3,8,0.7);
  border-bottom: 1px solid var(--border-dim); max-height: 120px; overflow-y: auto;
}
.log-line { display: flex; gap: 10px; padding: 2px 0; font-family: var(--font-mono); font-size: 10px; }
.log-time { color: var(--text-dim); }
.log-arrow { color: var(--blue-dim); }
.log-msg { color: var(--text-muted); }
.log-msg.ok { color: #00cc66; }
.log-msg.info { color: var(--blue-core); }
.log-msg.warn { color: #ffb800; }
```
```javascript
function addLogLine(msg, type='') {
  const log = document.getElementById('terminalLog');
  const time = new Date().toTimeString().slice(0,8);
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-time">[${time}]</span><span class="log-arrow">→</span><span class="log-msg ${type}">${msg}</span>`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
```

### Step 8 — Result Categories (Expand/Collapse)

```html
<div class="result-category">
  <div class="cat-header" data-cat="animations">
    <span class="cat-icon">◎</span>
    <span class="cat-name">ANIMATIONS</span>
    <span class="cat-count">3 found</span>
    <span class="cat-toggle">▾</span>
  </div>
  <div class="cat-body" id="cat-animations">
    <!-- .result-item elements here -->
  </div>
</div>
```
```javascript
cat.querySelector('.cat-header').addEventListener('click', function() {
  cat.querySelector('.cat-body').classList.toggle('hidden');
  this.classList.toggle('collapsed');
});
// CSS: .cat-toggle { transition: transform 0.3s; }
//      .cat-header.collapsed .cat-toggle { transform: rotate(-90deg); }
```

#### Result Item with Duplicate Warning Badge

```html
<div class="result-item" data-id="animations-0">
  <div class="item-select"><span class="item-check">✓</span></div>
  <div class="item-info">
    <div class="item-name">smooth-fade-up</div>
    <div class="item-preview">@keyframes fadeUp { ... }</div>
    <!-- Only if duplicate detected: -->
    <div class="dup-badge">
      <span class="dup-icon">⚠</span>
      <span class="dup-text">Similar to: <strong>pulse-border-glow</strong></span>
      <span class="dup-pct">87% match</span>
    </div>
  </div>
</div>
```
```css
.dup-badge {
  display: flex; align-items: center; gap: 5px; padding: 3px 8px;
  border: 1px solid rgba(255,60,60,0.35); border-radius: 2px; margin-top: 5px;
  background: rgba(80,0,0,0.25); width: fit-content;
}
.dup-text { font-family: var(--font-mono); font-size: 9px; color: #ff9090; }
.dup-pct { font-family: var(--font-display); font-size: 9px; color: #ff4040; font-weight: 700; }
```

### Step 9 — Status Badge (Results Header)

```html
<div class="status-badge idle" id="statusBadge">
  <span class="status-dot"></span>
  <span id="statusText">READY</span>
</div>
```
```css
.status-badge { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 2px; font-family: var(--font-mono); font-size: 10px; }
.status-badge.idle   { border: 1px solid var(--border-dim); color: var(--text-dim); background: rgba(0,10,30,0.4); }
.status-badge.scanning { border: 1px solid rgba(255,180,0,0.3); color: #ffb800; background: rgba(40,30,0,0.4); }
.status-badge.done   { border: 1px solid rgba(0,200,100,0.3); color: #00cc66; background: rgba(0,25,12,0.4); }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.status-badge.scanning .status-dot { animation: pDot 1s ease-in-out infinite; }
```
```javascript
// switch state:
document.getElementById('statusBadge').className = 'status-badge scanning';
document.getElementById('statusText').textContent = 'SCANNING';
```

### Step 10 — Add JavaScript: Stars, Particles, Glitch, Cursor, Nav

**Star canvas animation:**
```javascript
const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize(); window.addEventListener('resize', resize);
const stars = Array.from({length:220}, () => ({
  x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight,
  r: Math.random()*1.3, o: Math.random(),
  tw: Math.random()*Math.PI*2, sp: Math.random()*0.4+0.05,
}));
function drawStars() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  stars.forEach(s => {
    s.tw += s.sp * 0.018;
    const op = s.o * (0.35 + 0.65 * Math.abs(Math.sin(s.tw)));
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle = `rgba(160,215,255,${op})`; ctx.fill();
    if (s.r > 1.0) {
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r*3.5,0,Math.PI*2);
      ctx.fillStyle = `rgba(0,160,255,${op*0.12})`; ctx.fill();
    }
  });
  requestAnimationFrame(drawStars);
}
drawStars();
```

**Glitch engine:**
```javascript
function triggerGlitch(intensity = 'low') {
  const count = intensity === 'boot' ? 8 : Math.floor(Math.random()*4)+2;
  for (let i=0; i<count; i++) {
    const bar = document.createElement('div');
    bar.className = 'g-bar';
    const top=Math.random()*100, h=Math.random()*(intensity==='boot'?8:4)+1;
    const tx=(Math.random()-0.5)*(intensity==='boot'?30:14), dur=Math.random()*80+40;
    const isRGB = Math.random()>0.5;
    bar.style.cssText = `top:${top}%;height:${h}px;background:rgba(${isRGB?'0,210,255':'255,0,200'},${intensity==='boot'?0.12:0.07});transform:translateX(${tx}px);mix-blend-mode:screen;`;
    document.getElementById('glitchBars').appendChild(bar);
    let op=0,step=1/(dur/16),dir=1,frame;
    (function anim(){op+=step*dir;if(op>=1)dir=-1;if(op<=0&&dir===-1){bar.remove();return;}bar.style.opacity=op;frame=requestAnimationFrame(anim);})();
    setTimeout(()=>{cancelAnimationFrame(frame);bar.remove();},dur+60);
  }
  if(Math.random()>0.5||intensity==='boot'){
    appEl.style.animation=`screenShake ${60+Math.random()*80}ms ease both`;
    setTimeout(()=>{appEl.style.animation='';},200);
  }
}
window.addEventListener('load',()=>{ let n=0; const boot=()=>{if(n++>5)return;triggerGlitch('boot');setTimeout(boot,110);}; setTimeout(boot,500); });
(function sched(){setTimeout(()=>{triggerGlitch('low');sched();},Math.random()*9000+5000);})();
```

**Custom cursor:**
```javascript
const cursor=document.getElementById('cursor'), ring=document.getElementById('cursor-ring');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;cursor.style.left=mx+'px';cursor.style.top=my+'px';});
(function animRing(){rx+=(mx-rx)*0.1;ry+=(my-ry)*0.1;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(animRing);})();
document.querySelectorAll('a,button,.result-item,.filter-item,.cat-header,.recent-item').forEach(el=>{
  el.addEventListener('mouseenter',()=>{ring.style.width='36px';ring.style.height='36px';ring.style.borderColor='rgba(0,212,255,0.7)';cursor.style.transform='translate(-50%,-50%) scale(1.6)';});
  el.addEventListener('mouseleave',()=>{ring.style.width='26px';ring.style.height='26px';ring.style.borderColor='rgba(0,170,255,0.5)';cursor.style.transform='translate(-50%,-50%) scale(1)';});
});
```

### Step 11 — Glitch Text Effect (CSS)

```html
<div class="glitch-text" data-text="YOUR TEXT">YOUR TEXT</div>
```
```css
.glitch-text { position: relative; display: inline-block; }
.glitch-text::before, .glitch-text::after {
  content: attr(data-text); position: absolute; top:0; left:0;
  width:100%; height:100%; font-family:inherit; font-size:inherit; font-weight:inherit; letter-spacing:inherit;
}
.glitch-text::before { color: #00ffee; animation: gBefore 7s infinite; clip-path: polygon(0 20%,100% 20%,100% 40%,0 40%); }
.glitch-text::after  { color: #ff00cc; animation: gAfter 7s infinite;  clip-path: polygon(0 65%,100% 65%,100% 80%,0 80%); }
@keyframes gBefore { 0%,93%,100%{transform:translateX(0);opacity:0} 94%{transform:translateX(-4px);opacity:0.9} }
@keyframes gAfter  { 0%,92%,100%{transform:translateX(0);opacity:0} 93%{transform:translateX(4px);opacity:0.8} }
```

---

### Step 12 — Action Buttons: Approve / Reject / Rename / Skip (v3.0)

For review queues, use large glow action buttons with clear visual hierarchy:

```html
<div class="action-bar">
  <button class="action-btn btn-approve" id="btnApprove">
    <div class="btn-shimmer"></div>
    <span class="btn-icon">✓</span>
    <span>APPROVE</span>
  </button>
  <button class="action-btn btn-reject" id="btnReject">
    <div class="btn-shimmer"></div>
    <span class="btn-icon">✗</span>
    <span>REJECT</span>
  </button>
  <button class="action-btn btn-rename" id="btnRename">
    <span class="btn-icon">✎</span><span>RENAME</span>
  </button>
  <button class="action-btn btn-skip" id="btnSkip">
    <span class="btn-icon">→</span><span>SKIP</span>
  </button>
  <!-- keyboard shortcuts row, right-aligned -->
  <div class="shortcuts-row">
    <div class="shortcut-item"><kbd>Y</kbd><span>Approve</span></div>
    <div class="shortcut-item"><kbd>N</kbd><span>Reject</span></div>
    <div class="shortcut-item"><kbd>R</kbd><span>Rename</span></div>
    <div class="shortcut-item"><kbd>S</kbd><span>Skip</span></div>
    <div class="shortcut-item"><kbd>←</kbd><kbd>→</kbd><span>Navigate</span></div>
  </div>
</div>
```

```css
.action-bar {
  display: flex; align-items: center; gap: 10px; padding: 12px 20px;
  border-top: 1px solid var(--border-dim);
  background: rgba(2,4,10,0.85); backdrop-filter: blur(16px);
}
.action-btn {
  display: flex; align-items: center; gap: 9px; padding: 12px 24px; border-radius: 4px;
  cursor: pointer; font-family: var(--font-display); font-weight: 700; font-size: 11px;
  letter-spacing: 0.16em; position: relative; overflow: hidden; transition: all 0.25s;
}
.btn-approve {
  border: 1px solid rgba(0,200,80,0.5); color: #00ff88;
  background: linear-gradient(135deg, rgba(0,80,30,0.4), rgba(0,40,15,0.2));
  text-shadow: 0 0 10px rgba(0,255,100,0.6);
}
/* Continuous pulse ring on approve */
.btn-approve::before {
  content: ''; position: absolute; inset: -1px; border-radius: 4px;
  animation: approvePulse 2.5s ease-in-out infinite;
}
@keyframes approvePulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(0,220,80,0.4); }
  50%      { box-shadow: 0 0 0 5px rgba(0,220,80,0); }
}
.btn-approve:hover { box-shadow: 0 0 20px rgba(0,220,80,0.35); transform: translateY(-2px); }
.btn-reject {
  border: 1px solid rgba(255,60,60,0.45); color: #ff6680;
  background: linear-gradient(135deg, rgba(80,10,10,0.4), rgba(40,5,5,0.2));
}
.btn-reject:hover { box-shadow: 0 0 20px rgba(255,60,60,0.3); transform: translateY(-2px); }
.btn-rename { border: 1px solid rgba(255,200,0,0.3); color: #ffcc40; background: rgba(60,40,0,0.3); }
.btn-skip   { border: 1px solid var(--border-dim); color: var(--text-muted); background: rgba(0,10,30,0.3); }
.btn-icon { font-size: 14px; }

/* Keyboard shortcut hint display */
.shortcuts-row { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.shortcut-item { display: flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 9px; color: var(--text-dim); }
.shortcut-item kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 18px; padding: 0 4px; border-radius: 2px;
  border: 1px solid var(--border-mid); background: rgba(0,30,70,0.4);
  color: var(--text-muted); font-family: var(--font-mono); font-size: 9px;
}
```

```javascript
// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  switch(e.key.toLowerCase()) {
    case 'y': decide('approved'); break;
    case 'n': decide('rejected'); break;
    case 'r': document.getElementById('btnRename').click(); break;
    case 's': decide('skipped'); break;
    case 'arrowleft':  goToPrev(); break;
    case 'arrowright': goToNext(); break;
  }
});
```

---

### Step 13 — Segmented Progress Bar (v3.0)

Three-segment bar showing approved / rejected / pending split — updates in real time:

```html
<div class="rh-progress-segments" id="progressSegments"></div>
```

```css
.rh-progress-segments { display: flex; height: 4px; border-radius: 2px; overflow: hidden; gap: 1px; }
.seg { height: 100%; border-radius: 1px; transition: flex 0.6s cubic-bezier(0.16,1,0.3,1); }
.seg-approved { background: linear-gradient(90deg, #007733, #00cc66); }
.seg-rejected  { background: linear-gradient(90deg, #880022, #cc2233); }
.seg-pending   { background: rgba(0,60,120,0.5); }
```

```javascript
function updateProgress() {
  const approved = queue.filter(q => decisions[q.id] === 'approved').length;
  const rejected  = queue.filter(q => decisions[q.id] === 'rejected').length;
  const pending   = queue.length - approved - rejected;
  const segs = document.getElementById('progressSegments');
  segs.innerHTML = '';
  // Each segment's flex value = its count; CSS transition handles smooth resize
  if (approved > 0) { const s = document.createElement('div'); s.className = 'seg seg-approved'; s.style.flex = approved; segs.appendChild(s); }
  if (rejected > 0)  { const s = document.createElement('div'); s.className = 'seg seg-rejected';  s.style.flex = rejected;  segs.appendChild(s); }
  if (pending > 0)   { const s = document.createElement('div'); s.className = 'seg seg-pending';   s.style.flex = pending;   segs.appendChild(s); }
}
```

---

### Step 14 — Thumbnail Strip (v3.0)

Horizontal scrollable row of mini item previews. Active item highlighted, status color-coded:

```html
<div class="thumb-strip" id="thumbStrip"></div>
```

```css
.thumb-strip {
  flex-shrink: 0; display: flex; align-items: center;
  border-top: 1px solid var(--border-dim);
  background: rgba(1,3,8,0.8); overflow-x: auto; height: 64px; padding: 0 12px;
}
.thumb-strip::-webkit-scrollbar { height: 3px; }
.thumb-strip::-webkit-scrollbar-thumb { background: rgba(0,100,200,0.3); border-radius: 2px; }
.thumb-item {
  flex-shrink: 0; width: 80px; height: 50px; margin: 0 4px;
  border: 1px solid var(--border-dim); border-radius: 3px;
  background: rgba(0,10,28,0.6); cursor: pointer; transition: all 0.2s;
  display: flex; flex-direction: column; overflow: hidden;
}
.thumb-item.active   { border-color: var(--blue-core); box-shadow: 0 0 10px rgba(0,150,255,0.25); }
.thumb-item.approved { border-color: rgba(0,180,80,0.4); }
.thumb-item.rejected { border-color: rgba(255,60,60,0.3); }
.thumb-code   { font-family: var(--font-mono); font-size: 5.5px; color: rgba(100,180,255,0.5); padding: 4px 5px; line-height: 1.5; overflow: hidden; flex: 1; white-space: pre; }
.thumb-footer { display: flex; justify-content: space-between; padding: 2px 5px; border-top: 1px solid var(--border-dim); background: rgba(0,5,18,0.6); }
.thumb-name   { font-family: var(--font-mono); font-size: 5px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.thumb-status { font-size: 7px; flex-shrink: 0; }
```

```javascript
function buildThumbs() {
  const strip = document.getElementById('thumbStrip');
  strip.innerHTML = '';
  queue.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'thumb-item' + (i === currentIdx ? ' active' : '');
    if (decisions[item.id] === 'approved') el.classList.add('approved');
    if (decisions[item.id] === 'rejected')  el.classList.add('rejected');
    const preview = item.code.split('\n').slice(0, 8).join('\n');
    const icon = decisions[item.id] === 'approved' ? '✓' : decisions[item.id] === 'rejected' ? '✗' : '·';
    el.innerHTML = `<div class="thumb-code">${preview}</div>
      <div class="thumb-footer"><span class="thumb-name">${item.name}</span><span class="thumb-status">${icon}</span></div>`;
    el.addEventListener('click', () => { currentIdx = i; renderItem(i); updateThumbs(); });
    strip.appendChild(el);
  });
}

function updateThumbs() {
  document.querySelectorAll('.thumb-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentIdx);
    el.classList.toggle('approved', decisions[queue[i].id] === 'approved');
    el.classList.toggle('rejected',  decisions[queue[i].id] === 'rejected');
    // Scroll active into view
    if (i === currentIdx) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
}
```

---

### Step 15 — Decision Overlays on Focus Card (v3.0)

Flash overlays on the code block when a decision is made:

```html
<!-- Inside .code-focus-wrap, position: relative -->
<div class="decision-overlay approve" id="overlayApprove">✓ APPROVED</div>
<div class="decision-overlay reject"  id="overlayReject">✗ REJECTED</div>
<!-- Status ribbon — right edge of card -->
<div class="status-ribbon pending" id="statusRibbon"></div>
```

```css
.decision-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-size: 28px; font-weight: 900; letter-spacing: 0.2em;
  opacity: 0; pointer-events: none; z-index: 10; transition: opacity 0.2s;
  backdrop-filter: blur(2px); border-radius: 4px;
}
.decision-overlay.approve {
  color: #00ff88; text-shadow: 0 0 20px rgba(0,255,100,0.8);
  background: rgba(0,30,12,0.6); border: 1px solid rgba(0,200,80,0.3);
}
.decision-overlay.reject {
  color: #ff4455; text-shadow: 0 0 20px rgba(255,60,60,0.8);
  background: rgba(40,0,8,0.6);  border: 1px solid rgba(255,60,60,0.3);
}
.status-ribbon {
  position: absolute; top: 0; right: 0; bottom: 0; width: 3px; border-radius: 0 4px 4px 0;
  transition: background 0.3s, box-shadow 0.3s;
}
.status-ribbon.pending  { background: rgba(0,100,200,0.4); }
.status-ribbon.approved { background: #00cc66; box-shadow: 0 0 12px rgba(0,200,80,0.5); }
.status-ribbon.rejected { background: #ff4455; box-shadow: 0 0 12px rgba(255,60,60,0.5); }
```

```javascript
function decide(action) {
  const item = queue[currentIdx];
  decisions[item.id] = action;
  if (action === 'approved' || action === 'rejected') {
    const overlay = document.getElementById(action === 'approved' ? 'overlayApprove' : 'overlayReject');
    overlay.style.opacity = '1';
    document.getElementById('statusRibbon').className = 'status-ribbon ' + action;
    setTimeout(() => { overlay.style.opacity = '0'; }, 700);
    updateProgress(); updateThumbs();
    // Auto-advance after short delay
    setTimeout(() => { if (currentIdx < queue.length - 1) { currentIdx++; renderItem(currentIdx); } }, 600);
  }
}
```

---

### Step 16 — Mood / Distribution Bar Chart (v3.0)

Animated horizontal bars with block characters for a terminal feel:

```javascript
const MOODS = [
  { name: 'elegant',    pct: 62, color: '#00d4ff' },
  { name: 'minimal',   pct: 22, color: '#8ab8d8' },
  { name: 'futuristic',pct: 11, color: '#c080ff' },
  { name: 'editorial', pct:  5, color: '#ffcc40' },
];

function buildMoodChart() {
  const el = document.getElementById('moodChart');
  MOODS.forEach(m => {
    const totalBlocks = 20;
    const filled = Math.round(m.pct / 100 * totalBlocks);
    const row = document.createElement('div');
    row.className = 'mood-row';
    row.innerHTML = `
      <div class="mood-row-header">
        <span class="mood-name">
          <span class="mood-dot" style="background:${m.color};"></span>
          ${m.name}
        </span>
        <span class="mood-pct" style="color:${m.color};">${m.pct}%</span>
      </div>
      <div class="mood-track">
        <div class="mood-fill" data-pct="${m.pct}"
          style="background:linear-gradient(90deg,${m.color}60,${m.color});width:0%;transition:width 1.2s cubic-bezier(0.16,1,0.3,1);">
        </div>
      </div>
      <div class="mood-blocks" style="font-family:var(--font-mono);font-size:7px;color:${m.color};">
        ${'█'.repeat(filled)}<span style="color:var(--text-dim);">${'░'.repeat(totalBlocks-filled)}</span>
        &nbsp;${m.pct}%
      </div>`;
    el.appendChild(row);
  });
  // Animate bars in on next frame
  setTimeout(() => {
    document.querySelectorAll('.mood-fill[data-pct]').forEach(b => { b.style.width = b.dataset.pct + '%'; });
  }, 300);
}
```

Key CSS:
```css
.mood-track { height: 6px; background: rgba(0,20,60,0.5); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-dim); }
.mood-dot   { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
```

---

### Step 17 — Canvas Line Chart / Sparkline (v3.0)

Rendered via `<canvas>` — use for timelines, strength-over-time, trend data:

```html
<canvas id="timelineCanvas" height="120"></canvas>
```

```javascript
function buildTimeline(data, labels) {
  const cvs = document.getElementById('timelineCanvas');
  const cw = cvs.parentElement.offsetWidth;
  cvs.width = cw; cvs.height = 120;
  const c = cvs.getContext('2d');
  const pad = { t:12, r:12, b:12, l:36 };
  const w = cw - pad.l - pad.r, h = 120 - pad.t - pad.b;
  const maxY = 100;

  // Horizontal grid lines
  [25, 50, 75, 100].forEach(v => {
    const y = pad.t + h - (v / maxY) * h;
    c.beginPath(); c.moveTo(pad.l, y); c.lineTo(pad.l + w, y);
    c.strokeStyle = `rgba(0,80,160,${v===50?0.15:0.07})`; c.lineWidth = 1; c.stroke();
    c.font = '8px JetBrains Mono,monospace';
    c.fillStyle = 'rgba(0,80,160,0.5)';
    c.fillText(v + '%', 2, y + 3);
  });

  // Compute point coordinates
  const coords = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * w,
    y: pad.t + h - (v / maxY) * h
  }));

  // Gradient area fill
  const grad = c.createLinearGradient(0, pad.t, 0, pad.t + h);
  grad.addColorStop(0, 'rgba(0,170,255,0.25)');
  grad.addColorStop(1, 'rgba(0,100,255,0)');
  c.beginPath();
  c.moveTo(coords[0].x, pad.t + h);
  coords.forEach(p => c.lineTo(p.x, p.y));
  c.lineTo(coords[coords.length-1].x, pad.t + h);
  c.closePath(); c.fillStyle = grad; c.fill();

  // Line stroke
  c.beginPath();
  coords.forEach((p, i) => i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y));
  c.strokeStyle = '#00aaff'; c.lineWidth = 2;
  c.shadowColor = 'rgba(0,170,255,0.6)'; c.shadowBlur = 8;
  c.stroke(); c.shadowBlur = 0;

  // Dots — last dot larger + labeled
  coords.forEach((p, i) => {
    const isLast = i === coords.length - 1;
    c.beginPath(); c.arc(p.x, p.y, isLast ? 5 : 3, 0, Math.PI * 2);
    c.fillStyle = isLast ? '#00d4ff' : 'rgba(0,170,255,0.7)';
    if (isLast) { c.shadowColor = 'rgba(0,212,255,0.8)'; c.shadowBlur = 10; }
    c.fill(); c.shadowBlur = 0;
    if (isLast) {
      c.font = 'bold 10px Orbitron,monospace';
      c.fillStyle = '#00d4ff';
      c.fillText(data[i] + '%', p.x + 7, p.y + 4);
    }
  });
}
// Call after DOM ready + on resize:
window.addEventListener('load', () => buildTimeline(DATA_ARRAY, LABEL_ARRAY));
window.addEventListener('resize', () => setTimeout(() => buildTimeline(DATA_ARRAY, LABEL_ARRAY), 100));
```

---

### Step 18 — Stats Grid with Mini Bar Charts (v3.0)

Compact grid cells combining a label, primary value, and an inline mini bar chart:

```html
<div class="stats-grid" id="statsGrid"></div>
```

```css
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.stat-cell {
  padding: 14px 16px; border: 1px solid var(--border-dim); border-radius: 4px;
  background: rgba(0,10,30,0.5); position: relative; overflow: hidden; transition: all 0.2s;
}
.stat-cell:hover { border-color: rgba(0,120,255,0.2); }
.stat-cell::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(0,150,255,0.15),transparent); }
.stat-cell-label { font-family: var(--font-mono); font-size: 8px; color: var(--text-dim); letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px; }
.stat-cell-big { font-family: var(--font-display); font-size: 28px; font-weight: 900; color: var(--blue-bright); text-shadow: var(--glow-text); display: block; line-height: 1; }
.stat-mini-bars { display: flex; align-items: flex-end; gap: 2px; height: 20px; margin-top: 8px; }
.stat-mini-bar { flex: 1; background: var(--blue-electric); border-radius: 1px; min-height: 2px; opacity: 0.6; }
.stat-mini-bar.top { background: var(--blue-bright); opacity: 1; }
```

```javascript
// Build a stat cell with mini bars
function buildStatCell(label, value, sub, bars) {
  const cell = document.createElement('div');
  cell.className = 'stat-cell';
  const maxBar = Math.max(...bars);
  const barsHTML = bars.length ? `<div class="stat-mini-bars">
    ${bars.map((v,i) => `<div class="stat-mini-bar${v===maxBar?' top':''}" style="height:${(v/5*100)}%"></div>`).join('')}
  </div>` : '';
  cell.innerHTML = `<div class="stat-cell-label">${label}</div>
    <div style="color:var(--blue-bright);font-family:var(--font-display);font-size:11px;font-weight:700;">${value}</div>
    <div style="font-family:var(--font-mono);font-size:8px;color:var(--text-dim);">${sub}</div>
    ${barsHTML}`;
  return cell;
}
```

---

### Step 19 — Recommendation Cards (v3.0)

Three distinct types: `missing` (orange), `explore` (blue), `strength` (green):

```html
<div class="reco-grid" id="recoGrid"></div>
```

```css
.reco-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.reco-item {
  padding: 14px 16px; border: 1px solid var(--border-dim); border-radius: 4px;
  background: rgba(0,8,24,0.5); position: relative; overflow: hidden; transition: all 0.2s;
}
.reco-item::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; }
.reco-item.missing::before  { background: linear-gradient(90deg, transparent, rgba(255,160,0,0.4), transparent); }
.reco-item.explore::before  { background: linear-gradient(90deg, transparent, rgba(0,150,255,0.3), transparent); }
.reco-item.strength::before { background: linear-gradient(90deg, transparent, rgba(0,200,80,0.3), transparent); }
.reco-type { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
.reco-type.missing  { color: #ffaa40; }
.reco-type.explore  { color: var(--blue-core); }
.reco-type.strength { color: #00cc66; }
.reco-type-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.reco-text  { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px; }
.reco-btn   { padding: 5px 11px; border-radius: 2px; font-family: var(--font-mono); font-size: 9px; cursor: pointer; transition: all 0.2s; }
.reco-btn.primary { border: 1px solid var(--blue-core); color: var(--blue-bright); background: rgba(0,60,160,0.2); }
.reco-btn.ghost   { border: 1px solid var(--border-dim); color: var(--text-muted); background: transparent; }
```

---

### Step 20 — Re-Analyze Overlay with Step Log (v3.0)

Full-page overlay that plays step-by-step log messages before dismissing:

```html
<div class="reanalyze-overlay" id="raOverlay">
  <div class="ra-spinner"></div>
  <div class="ra-title">ANALYZING DESIGN DNA</div>
  <div class="ra-log" id="raLog">Initializing...</div>
</div>
```

```css
.reanalyze-overlay {
  position: absolute; inset: 0; z-index: 50; display: none;
  background: rgba(2,4,10,0.88); backdrop-filter: blur(4px);
  flex-direction: column; align-items: center; justify-content: center; gap: 14px;
}
.reanalyze-overlay.visible { display: flex; }
.ra-spinner { width: 40px; height: 40px; border-radius: 50%; border: 2px solid rgba(0,150,255,0.1); border-top-color: var(--blue-bright); animation: spin 1s linear infinite; }
.ra-title   { font-family: var(--font-display); font-size: 12px; color: var(--blue-bright); letter-spacing: 0.2em; }
.ra-log     { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); text-align: center; }
```

```javascript
const LOG_STEPS = [
  'Loading elements + generations...', 'Parsing mood distributions...',
  'Identifying pattern clusters...', 'Running aesthetic fingerprint model...',
  'Computing DNA strength vector...', 'Generating recommendations...', 'Analysis complete ✓',
];
document.getElementById('reanalyzeBtn').addEventListener('click', function() {
  document.getElementById('raOverlay').classList.add('visible');
  let step = 0;
  const run = () => {
    if (step >= LOG_STEPS.length) {
      setTimeout(() => {
        document.getElementById('raOverlay').classList.remove('visible');
        // re-animate bars...
      }, 400);
      return;
    }
    document.getElementById('raLog').textContent = LOG_STEPS[step++];
    setTimeout(run, step === LOG_STEPS.length ? 600 : 500);
  };
  run();
});
```

---

## Page Templates

### Template 1: Dashboard (default)
- Sidebar + content with centered card, glitch title, stat row, terminal row

### Template 2: Split-Panel Tool Page (v2.0)
Structure:
```
content
  └── .fetch-page (flex col, height 100%)
        ├── .fetch-topbar (eyebrow + glitch-title + meta pills)
        └── .fetch-panels (flex row, flex:1)
              ├── .panel-left (380px, overflow-y:auto)
              │     ├── panel-section: URL input
              │     ├── panel-section: Toggles
              │     ├── panel-section: Filter checkboxes (2-col grid)
              │     ├── panel-section: Action button (scan/submit)
              │     └── panel-section: Recent history list
              └── .panel-right (flex:1, flex col)
                    ├── .results-header (status badge + action buttons)
                    ├── .terminal-log (hidden until scan)
                    ├── .results-body (idle state → result categories)
                    └── .results-footer (selected count + select-all/clear)
```

### Template 3: Minimal Cyberpunk Card (no sidebar)
Full-screen centered card on space background. No sidebar/topbar.

### Template 4: Review / Approval Queue (v3.0)
Item-by-item focus review with full keyboard navigation:
```
content
  └── .review-page (flex col, height 100%)
        ├── .review-header (sticky — glitch title + segmented progress + batch toggle + shortcut hints)
        ├── .review-body (flex col, flex:1, overflow:hidden)
        │     ├── .nav-bar (counter "X of Y" + ← Previous / Next → buttons)
        │     ├── .batch-bar (hidden; reveals with "Approve All CSS" / "Reject All from URL")
        │     ├── .focus-area (flex row, flex:1)
        │     │     ├── .focus-main (flex:1)
        │     │     │     ├── .element-info-bar (name + category badge + source URL + date)
        │     │     │     └── .code-focus-wrap (code block + line numbers + status ribbon + decision overlays)
        │     │     └── .meta-panel (260px — Mood Tags / Compatibility / Stats / Similar)
        │     ├── .action-bar (✓ APPROVE · ✗ REJECT · ✎ RENAME · → SKIP + keyboard hints)
        │     └── .thumb-strip (horizontal scroll of all item thumbnails)
```

### Template 5: Data / Analytics / Report Page (v3.0)
Scrollable page with CSS grid layout and multiple data visualization sections:
```
content (overflow-y: auto)
  └── .dna-page
        ├── .dna-page-header (sticky — title + DNA strength badge + re-analyze button)
        └── .dna-grid (CSS grid-template-areas, 2 columns)
              ├── identity card  — spinning hex SVG + primary aesthetic label + strength bar
              ├── mood card      — horizontal animated bar chart per mood + block chars
              ├── stats card     — 3-col grid of stat cells (big number, text, mini bar chart)
              ├── elements card  — ranked list with star rating + mini code preview
              ├── timeline card  — canvas line chart with gradient area + dot markers
              └── reco card      — 3-col grid of missing/explore/strength recommendation cards
```

---

## Examples

### Example 1: Status Dashboard
**Input:** "Make a cyberpunk status dashboard with CPU, RAM, and Network stats"
```
- Topbar: logo + "SYS-MONITOR" breadcrumb + AI status
- Sidebar: Dashboard (active), Processes, Network, Logs, Settings
- Main: 3 stat cards (CPU %, RAM %, Network MB/s) with glowing numbers
- Each card: corner brackets, top line, terminal row
```

### Example 2: Designer Portfolio Layout
**Input:** "Create a sci-fi sidebar layout for a design portfolio"
```
- Sidebar sections: Studio / Work / Intelligence / System
- Main: glitch "SYSTEM ONLINE" card + stats row
```

### Example 3: Web Fetcher Tool
**Input:** "Build a web fetcher tool page with split panels"
```
- Left panel: URL input (glow), auto-save toggle, filter checkboxes (2-col grid), SCAN URL button (with loading spinner), recent URLs list
- Right panel: status badge (idle→scanning→done), terminal log output, result categories (expand/collapse), items with duplicate warning badges
- Footer: selected count + Save Selected / Save All / Discard
```

### Example 4: Review Queue (v3.0)
**Input:** "Build a review/approval queue for CSS elements"
```
- Sticky header: glitch title + segmented progress bar (approved/rejected/pending) + batch mode toggle + keyboard shortcut hints
- Counter bar: "X of Y" + Previous/Next buttons
- Focus card: element name + category + source URL + full syntax-highlighted code with line numbers + status ribbon on right edge
- Meta panel (right): Mood tags / Compatibility table / Metrics grid / Similar in Library
- Action bar: ✓ APPROVE (green glow + pulse ring) / ✗ REJECT (red) / ✎ RENAME (inline input) / → SKIP + keyboard shortcut badges
- Thumbnail strip: all items as mini cards, status color-coded, click to navigate, auto-scroll active into view
- Keyboard shortcuts: Y=approve, N=reject, R=rename, S=skip, ←→=navigate
- Decision overlays: "✓ APPROVED" / "✗ REJECTED" flash overlay + auto-advance after 600ms
```

### Example 5: DNA / Design Profile Report (v3.0)
**Input:** "Build a design DNA report / analytics page"
```
- Sticky header: "YOUR DESIGN DNA" glitch title + DNA strength badge (mini bar) + RE-ANALYZE button
- DNA Identity card: spinning hex SVG (3 nested rings counter-rotating) + "Modern Luxury Editorial" large label + tag cloud + animated strength progress bar
- Mood Distribution card: bar chart per mood with color-coded fills (animated from 0%) + block character display (████░░)
- Stats grid (6 cells): Favorite Framework / Context / Avg Speed (with mini vertical bar charts) + big numbers (84 approved, 47 generated)
- Top Elements list: ranked 01–05, star rating (★☆), code snippet preview, uses count
- Timeline canvas: 12-week sparkline chart with gradient fill, glow line, dots, last point labeled
- Recommendations (3 cards): MISSING (orange) / EXPLORE (blue) / STRENGTH (green) each with CTA buttons
- Re-analyze overlay: full-screen with spinner + step-by-step log messages, auto-dismiss
```

---

## Key CSS Animations Reference

| Name | Purpose | Duration |
|------|---------|----------|
| `gridDrift` | Dot grid drift | 60s linear |
| `floorScroll` | Perspective grid scroll | 20s linear |
| `slowRotate` | Giant hex spin | 150s linear |
| `orb1/2/3` | Ambient glow pulse | 22–32s |
| `streamFall` | Data streams | 3–8s random |
| `hexFloat` | Hex particle rise | 14–36s random |
| `beamSweep` | Horizontal scan beam | 10s linear |
| `blink` | Terminal cursor | 1s step-end |
| `gBefore/gAfter` | RGB glitch split | 7s infinite |
| `screenShake` | Screen distortion | 60–140ms |
| `pDot` | AI status pulse dot | 1.5s |
| `barGlow` | Topbar bottom line pulse | 5s |
| `sideGlow` | Sidebar right edge glow | 6s |
| `hexGlow` | Logo hex filter glow | 4s |
| `shimmer` | Button sweep shimmer | 2.5s infinite |
| `spin` | Loading spinner ring | 0.7s linear |
| `slideLeft` | Sidebar entrance | 0.45s |
| `fadeDown` | Topbar entrance | 0.4s |
| `fadeUp` | Content entrance | 0.5–0.6s |
| `approvePulse` | Approve button ring pulse | 2.5s infinite *(v3.0)* |
| `hexSpin` | Hex identity card rings | 12–20s linear *(v3.0)* |
| `strengthPulse` | DNA bar glow breathe | 3s ease-in-out *(v3.0)* |

---

## Color Accent Variants

The base palette is electric blue. For other moods, swap these variables:

| Mood | `--blue-core` | `--blue-bright` | Use case |
|------|-------------|----------------|---------|
| Blue (default) | `#00aaff` | `#00d4ff` | Tech, data, sci-fi |
| Green (matrix) | `#00cc66` | `#00ff88` | Approved states, success |
| Red (alert) | `#cc2233` | `#ff4455` | Rejected, danger, error |
| Purple (luxury) | `#aa00ff` | `#cc80ff` | AI, synthwave |
| Gold (premium) | `#b8860b` | `#ffd700` | Luxury, editorial |
| Orange (warn) | `#cc6600` | `#ffaa40` | Missing, caution |

These are used per-element in v3.0 (e.g. mood dots, recommendation card accents, status ribbons).

---

## Edge Cases & Troubleshooting

- **No sidebar**: Remove aside + main-layout flex, use full-width content with centered card
- **Split panel for other tools**: Reuse `.fetch-panels` structure; rename classes to fit context (e.g., `.gen-panels`)
- **Color other than blue**: Swap `--blue-core` / `--blue-bright` per Color Accent Variants table above
- **Mobile layout**: `@media (max-width: 768px)` collapse sidebar; for split panels, stack panels vertically
- **Content scrollable**: Only `overflow-y: auto` on `.content`, never on `body` (body = `overflow: hidden`). Exception: DNA report page — set `overflow-y: auto` on `.content` and let page scroll freely
- **Custom cursor not showing**: Ensure `body { cursor: none; }` — also add new interactive elements to cursor hover targets list
- **Panel left too narrow**: Increase `.panel-left` width to 420–460px for more complex forms
- **Terminal log too tall**: Limit `max-height` on `.terminal-log`; use `log.scrollTop = log.scrollHeight` to auto-scroll
- **Canvas chart not sizing**: Always set `cvs.width = cvs.parentElement.offsetWidth` inside the draw function; call again on `window.resize` with `setTimeout(..., 100)` debounce
- **Segmented progress bar jumpy**: Use `style.flex = count` (not `style.width`) so CSS `transition: flex` handles smooth animation without JavaScript calculation
- **Thumbnail strip not scrolling to active**: Use `el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })` after updating `.active` class
- **Decision overlays stacking**: Wrap in `position: relative` parent; always reset both overlays to `opacity: 0` in `renderItem()` before showing the new one
- **Re-analyze overlay blocking scroll**: Use `position: absolute` (not fixed) if page scrolls; for fixed topbar pages use `position: fixed`

---

## Output Format

- **Single HTML file**, self-contained (no external CSS/JS files)
- All CSS in `<style>` tag in `<head>`
- All JS in `<script>` tag at end of `<body>`
- Google Fonts loaded via `<link>` (only external dependency)
- File is immediately openable in a browser with no build step
- Default layout: `topbar (48px) + main-layout` with `sidebar (220px) + content (flex:1)`
- Split-panel pages: `content` → `fetch-page (flex col)` → `fetch-panels (flex row)`
- Review queue: `content` → `review-page (flex col)` → `review-body + action-bar + thumb-strip`
- Report/analytics pages: `content (overflow-y:auto)` → `dna-page` → sticky header + scrollable `.dna-grid`

### Custom Cursor Hover Targets (always keep in sync)

Add these selectors to the cursor expansion handler:
```javascript
document.querySelectorAll(
  'a, button, .result-item, .filter-item, .cat-header, .recent-item, ' +
  '.thumb-item, .toggle-track, .nav-item, .provider-card, ' +  // v3.0
  '.elem-row, .reco-btn, .reco-item, .stat-cell, .sim-item'    // v3.0
).forEach(el => {
  el.addEventListener('mouseenter', () => { /* expand ring */ });
  el.addEventListener('mouseleave', () => { /* shrink ring */ });
});
```
