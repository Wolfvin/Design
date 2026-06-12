---
name: creative-motion
description: >
  The unified creative + animation skill. Activate for ANY visual design request — UI,
  poster, promo, dashboard, landing page, social media graphic, food menu, event flyer,
  product showcase, or any visual deliverable — where the output should be both
  contextually beautiful AND potentially alive with motion.

  Trigger on: "bikin design", "buat poster", "design promosi", "bikin lebih keren",
  "redesign bebas", "buat landing page", "bikin UI", "animate this", "buat showcase",
  "bikin dari nol", "improve this design", "demo theater", "buat animasi",
  "vibe", "feel", "karakter", "tone", "aesthetic", "nuansa", "kesan", "suasana",
  "gue mau yang...", "rasanya kayak", "mirip kayak [referensi]",
  or any request where a visual output would benefit from craft and intention.

  This skill has THREE brains: Vibe Extractor (what is the emotional DNA?),
  Creative Director (what does it look like?), and Choreographer (does it move?).
  All three run in sequence. The AI decides everything autonomously based on the
  extracted vibe. Deliver, then offer to refine.
skill-tree:
  type: leaf
  parent: twig-creative-direction
  also-matches:
    - twig-motion-principles
od:
  mode: design-system
  category: creative-direction
---

# Creative Motion Skill

## The three brains, one pipeline

```
BRAIN 0: Vibe Extractor   →  what is the emotional DNA of this request?
BRAIN 1: Creative Director →  what does it look like, given that DNA?
BRAIN 2: Choreographer    →  does it move, and how?
```

Brain 0 always runs first. Brain 1 builds on Brain 0's output.
**Brain 2 is OPTIONAL** — only activate if animation earns its place per the decision matrix below.

---

## BRAIN 0 — Vibe Extractor

### What this brain does

User requests are rarely precise. They say "yang keren", "vibe premium", "kayak Apple tapi
lebih edgy", "dark tapi tetep fun", "rasanya kayak naik mobil mewah". These are emotional
briefs — not visual specs. Brain 0 distills them into a concrete set of visual tokens
before any design decision is made.

**Trigger phrases that activate Brain 0 first:**
- "vibe", "feel", "karakter", "tone", "nuansa", "suasana", "kesan"
- "kayak [brand/referensi]", "mirip [sesuatu]", "inspired by"
- adjectives as the primary brief: "gelap", "dingin", "hangat", "berani", "elegan", "playful"
- "gue mau yang...", "rasanya harus..."
- Any reference to a brand, film, music genre, texture, material, or place as mood input

### The extraction process

When a vibe brief arrives, run this internally before touching any visual:

**Step 1 — Collect all signals**
Pull every emotional word, reference, adjective, and implication from the request.
Include implicit signals: "promosi mobil mewah" implies power + exclusivity even without
the user saying those words.

**Step 2 — Distill to a Vibe Token Set**
Compress signals into 4 concrete tokens:

```
TEMPERATURE : warm / neutral / cool / cold
WEIGHT      : heavy / medium / light / airy  
ENERGY      : explosive / dynamic / calm / still
CHARACTER   : raw / refined / playful / serious / rebellious / elegant
```

Example briefs → token sets:
- "dark luxury automotive merah hitam gold"
  → TEMP: cold · WEIGHT: heavy · ENERGY: dynamic · CHARACTER: refined
- "food promo warung, ramai, enak, murah"
  → TEMP: warm · WEIGHT: medium · ENERGY: explosive · CHARACTER: raw
- "health app, tenang, bersih"
  → TEMP: neutral · WEIGHT: light · ENERGY: still · CHARACTER: refined
- "konser EDM, neon, malam"
  → TEMP: cold · WEIGHT: heavy · ENERGY: explosive · CHARACTER: rebellious
- "WhatsApp promo, familiar, semua orang"
  → TEMP: neutral · WEIGHT: light · ENERGY: calm · CHARACTER: playful

**Step 3 — Lock the vibe**
From the token set, derive concrete visual decisions:

| Token | Visual implication |
|---|---|
| TEMP: warm | Reds, oranges, creams, amber — never cool blues |
| TEMP: cold | Deep blues, steel grays, near-black with cool undertones |
| TEMP: neutral | Greens, teals, pure white/black with no temperature bias |
| WEIGHT: heavy | Large type, thick borders, dense layouts, dark backgrounds |
| WEIGHT: light | Generous whitespace, thin type, open grids, light backgrounds |
| ENERGY: explosive | Asymmetry, diagonals, overlapping elements, large type jumps |
| ENERGY: calm | Grid-aligned, consistent spacing, no diagonal elements |
| CHARACTER: raw | Texture, grain, imperfect geometry, hand-crafted feel |
| CHARACTER: refined | Perfect grid, micro-details, restrained palette, high finish |
| CHARACTER: playful | Rounded shapes, friendly type, unexpected color pops |
| CHARACTER: rebellious | Rule-breaking layouts, high contrast, unconventional type |
| CHARACTER: elegant | Serif type, generous whitespace, gold/silver accents, minimal |

**Step 4 — State the vibe lock**
Before executing, output one line that confirms the extraction:
> "Vibe locked: [TOKEN SET] → [2-sentence visual translation]."

Example:
> "Vibe locked: cold · heavy · dynamic · refined →
> Dark near-black base, deep red + gold as dual accent, sharp angular geometry,
> condensed serif for brand name. Motion: mechanical and purposeful, not decorative."

This line is the contract. Every design decision after this must be traceable back to it.

---

## BRAIN 1 — Creative Director

### Step 0: Read context (runs after vibe is locked)

With the vibe token set in hand, answer these four questions:

**1. Domain / industry?**
Food & Beverage · Fashion · Automotive · Tech/SaaS · Finance · Health · Event ·
Retail · Education · Real Estate · Sport · Messaging / Consumer App · etc.
Domain provides the grammar. Vibe provides the accent. Both are required.

**2. Audience?**
- Mass market → warm, approachable, high contrast, no subtlety
- Premium / niche → restrained, typographic, generous whitespace
- Youth → bold color, energy, asymmetry, movement
- Corporate → structured, trustworthy, grid-aligned

**3. Format / medium?**
- Social media → vertical, readable at thumbnail, max 3 elements
- Web hero → horizontal, layered, immersive
- Poster print → vector-safe, CMYK palette, readable at distance
- UI component → functional first, beautiful second
- Interactive showcase → motion is core, not decoration

**4. Conflict check — vibe vs domain**
Sometimes the user's vibe conflicts with domain conventions.
- "dark tech aesthetic" for a warung food promo = conflict → vibe wins if user explicitly
  requested it, domain wins if vibe was inferred
- "playful and colorful" for a luxury car = conflict → ask for one clarifying word,
  then commit

### Activate signal

Signal in two lines before executing:
> "Vibe locked: [TOKEN SET] → [translation]."
> "Creative Motion aktif — [visual direction] + [animation intent]."

---

### Domain visual languages

#### Food & Beverage
- Palette: deep reds (#8B2500), burnt oranges (#D4580A), cream (#FFF8F0), earthy browns
- Shapes: round, approachable — no sharp angular layouts
- Type: chunky serif for artisan; bold rounded sans for fast food / mass market
- Texture: linen, kraft paper, wood grain feel
- Avoid: dark tech aesthetics, cold palettes, Silicon Valley minimalism
- Indonesian sub-languages:
  - Warung → bright warm + bold sans + high energy + crowded layouts
  - Fine dining → serif + muted + lots of space + muted gold accent
  - Street food → layered, hand-drawn feel, high saturation

#### Automotive (Luxury)
- Palette: near-black (#080808) as base; accent system can be DUAL:
  - Single accent → gold, silver, or red for maximum refinement
  - Dual accent → deep red + gold, or electric blue + silver = valid and powerful
    when TEMP is cold and CHARACTER is refined or rebellious
  - Rule: dual accents must have clear roles — one for brand color, one for detail/data
- Shapes: sharp, angular, long horizontals — speed is implied by geometry
- Type: serif for brand name; condensed sans for specs
- Depth: background → light streak → car body → type → detail (minimum 4 layers)
- Key: let the product breathe — empty dark space IS the luxury

#### Tech / SaaS / Product
- Palette options:
  - Minimal: dark (#0d0d14–#111118) + ONE accent (purple, teal, blue, amber)
  - Dual accent: valid when CHARACTER is rebellious or ENERGY is explosive
    e.g., electric blue (#0066FF) + hot red (#FF2244) on near-black = cyberpunk-adjacent
    e.g., purple (#7C3AED) + amber (#F59E0B) on dark = warm-tech premium
  - Rule: dual accent in tech works when accents are HIGH CONTRAST to each other
    and each has a dedicated role (primary action vs warning/highlight)
- Shapes: rounded cards, subtle borders, grid-aligned
- Type: geometric sans
- Technique: radial gradient cards, glassmorphism, subtle grid lines
- Reference: Linear, Raycast, Vercel (single accent) · Cyberpunk UI, gaming dashboards (dual accent)

#### Messaging / Consumer App (e.g. WhatsApp, Telegram, iMessage)
- Palette: brand green/blue as dominant accent on dark or white base
- Shapes: speech bubbles, rounded, human and approachable
- Type: system sans — never display or serif
- Key technique: the UI IS the demo — show it working, not just talking about it
- Motion: chat sequences, typing indicators, read receipts = the hero animation
- Avoid: cold tech minimalism — these apps are warm and familiar by nature

#### Fashion / Lifestyle
- Palette: 1–2 colors max; pure white or pure black backgrounds
- Type IS the design — large hero type, tiny body, asymmetric placement
- Negative space = confidence
- Reference: Zara, SSENSE, Highsnobiety

#### Event / Entertainment
- High energy: bold colors, dynamic angles, overlapping layers
- Type: display fonts, compressed, oversized — 72px+ hero
- Background: full-bleed vivid or textured dark
- Reference: festival posters, DWP visuals, concert flyers

#### Health / Wellness
- Palette: sage greens, soft blues, warm whites — nothing saturated
- Shapes: gentle curves, organic
- Type: clean medium-weight sans
- Reference: Headspace, Calm, modern apotek

#### Finance / Corporate
- Palette: navy, forest green, dark gray — trustworthy, never flashy
- Grid: strict, aligned, no decorative elements
- Type: clean sans — never serif or display

---

### Visual techniques

**Type scale with personality**
Hero: 48–72px for posters/promos. 24–36px for UI.
Scale gap between hero and body IS the hierarchy. Never be timid.

**Background as primary mood signal**
Food → cream/kraft · Cold tech → near-black with cool undertone ·
Warm tech → near-black with slight warm undertone (#0d0a08) ·
Fashion → pure white or black · Event → vivid saturated · Luxury → deep dark

**Layered depth**
Background → texture/wash → subject → type → detail accents.
Minimum 3 layers for any poster or promo. Flat = forgettable.

**Dual accent system (when applicable)**
Role 1: Brand/hero color — dominant, used for primary CTA and hero elements
Role 2: Detail/data color — used for specs, metadata, secondary accents
Rule: never use both at equal weight. 70/30 ratio minimum.

---

### Brain 1 self-check

- Does this match the LOCKED VIBE, not just the domain?
- Is the hierarchy traceable in 2 seconds?
- If dual accent: do both colors have clear, non-competing roles?
- Would the target audience immediately understand what this is?

---

## BRAIN 2 — Choreographer

### The animation decision

> **"Would motion make this MORE meaningful, or just more busy?"**

**Brain 2 is OPTIONAL — only activate if animation earns its place per the decision matrix.**
If animation does not add meaning, skip Brain 2 entirely. Stillness is a valid design choice.

Animation earns its place when it:
- Reveals information progressively
- Creates cause-and-effect that teaches (hover → tooltip, scroll → reveal)
- Signals product quality through polish
- Replaces static explanation with live demonstration

**Decision matrix:**

| Format | Audience | Add animation? |
|---|---|---|
| Landing page / web hero | Any | YES — entrance + hover |
| Product showcase / demo | Any | YES — scripted choreography |
| Messaging app promo | Any | YES — live chat sequence |
| Interactive UI | Any | YES — micro-interactions |
| Food promo (web) | Mass market | MAYBE — subtle entrance |
| Luxury poster | Premium | RARELY — stillness = luxury |
| Editorial / print | Any | NO |
| Dashboard / data UI | Professional | YES — count-up, progressive reveal |

---

### Animation types

#### 1. Entrance choreography
Stagger in narrative order. 80–200ms between items. Max 8 staggered.
```js
items.forEach((el, i) => setTimeout(() => el.classList.add('show'), i * 160 + 80));
```

#### 2. Hover-triggered interaction
Reveal something NEW — tooltip, stat, hidden info. Color change alone is weak.
```js
el.addEventListener('mouseenter', () => tooltip.classList.add('show'));
el.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
```

#### 3. Count-up numbers
`requestAnimationFrame`, `Math.round()`, 900–1400ms. Stagger starts by 150–300ms.

#### 4. Typewriter
JS interval only (not CSS steps). 38–55ms/char. Always pair with blinking cursor.

#### 5. Scene-based demo theater
Each scene = distinct micro-story. Use `played Set` to prevent re-runs.
Stop on last scene. Replay button > endless loop.

#### 6. Live product simulation
Use when: the product IS an interaction (messaging apps, chat UIs, OS demos).
Show the product working in real time — typing indicators, message delivery,
read receipts, notifications. This IS the demo, not decoration.

#### 7. Ambient / idle
Subtle only. Max 2 per component. Pulse, float, breathing glow.

#### 8. Mechanical motion
Automotive, machinery: `requestAnimationFrame` rotation. Stop after 2–3s unless
user is actively interacting. **Always provide `prefers-reduced-motion` fallback —
replace rotation with a static transform or fade.**

---

### Timing budget

| Moment | Timing |
|---|---|
| First element entrance | 0–80ms after trigger |
| Between staggered items | 120–200ms |
| Count-up duration | 900–1400ms |
| Typing speed | 38–55ms/char |
| Hover response | CSS transition 0.2–0.3s ease |
| Scene duration | 3.5–5s depending on content density |
| Pause after last element | +300–500ms before advancing |

Feels slow → remove one animation. Feels rushed → add pause after last element.

---

### Rules that never break

- Stagger with JS `setTimeout`, not CSS `animation-delay`.
- Every animated element needs a visible resting state before JS loads.
- Never animate more than one "hero" element simultaneously.
- Hover: always both mouseenter AND mouseleave.
- Scroll trigger: IntersectionObserver only — never scroll event listener.
- Stop autoplay on last scene. Replay > loop.
- **Always add `prefers-reduced-motion` fallback for any motion, including mechanical rotation.** When reduced motion is preferred, replace animations with static transforms or instant state changes.

---

## Final checklist before delivering

**Brain 0:**
- [ ] Vibe tokens extracted and stated explicitly
- [ ] Visual decisions are traceable back to token set

**Brain 1:**
- [ ] Domain + vibe conflict checked and resolved
- [ ] Palette matches vibe — not defaulted to tech aesthetic
- [ ] If dual accent: roles are clear, ratio is 70/30 minimum
- [ ] Hierarchy traceable in 2 seconds

**Brain 2:**
- [ ] Animation decision made consciously — Brain 2 only activated if motion earns its place
- [ ] Each animated element has cause-and-effect
- [ ] Timing feels like watching something happen
- [ ] Resting states set before JS executes
- [ ] No endless loops
- [ ] `prefers-reduced-motion` fallback included for all motion

**All:**
- [ ] Make decisions autonomously based on the extracted vibe. Deliver, then offer to refine
- [ ] No decorative elements without meaning
