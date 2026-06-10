# Spacing & Layout — Referensi untuk DNA Extraction

> Dibaca saat: **Mode EXTRACT DNA** (aspek Token System — spacing, dan aspek Layout) dan **Mode AUDIT DNA**.
> Konteks: mengisi field `tokens.spacing`, `tokens.radius`, dan bagian layout DNA.

---

## Filosofi Spacing dalam DNA

**Spacing adalah ritme visual — bukan angka acak.**

DNA yang baik punya spacing system yang bisa dijelaskan:
- Base unit berapa? (biasanya 4px atau 8px)
- Apakah semua nilai di UI adalah multiple dari base?
- Apa makna semantic dari tiap step? (xs = tight, lg = comfortable)

```json
"spacing": {
  "base": "8px",
  "scale": [4, 8, 16, 24, 32, 48, 64, 96, 120],
  "why": "8px base — divisible ke 2 dan 4, cocok untuk komponen dengan border 0.5px"
}
```

---

## 8-Point Grid System

Standar industri. Semua spacing adalah multiple dari 8px (atau 4px untuk micro-spacing).

```css
:root {
  --space-unit: 0.5rem;  /* 8px base */

  --space-1:  0.25rem;   /*  4px — micro, gap antar label/icon */
  --space-2:  0.5rem;    /*  8px — compact, padding tombol kecil */
  --space-3:  0.75rem;   /* 12px — tight, gap antar form elements */
  --space-4:  1rem;      /* 16px — default, padding container */
  --space-6:  1.5rem;    /* 24px — comfortable, section gap */
  --space-8:  2rem;      /* 32px — loose, antara major groups */
  --space-12: 3rem;      /* 48px — generous, section padding */
  --space-16: 4rem;      /* 64px — page section separator */
  --space-24: 6rem;      /* 96px — hero padding, large whitespace */
}
```

**Semantic tokens (yang dipakai di komponen):**
```css
:root {
  --spacing-inline:  var(--space-2);  /*  8px — antar inline elements */
  --spacing-stack:   var(--space-4);  /* 16px — antar stacked elements */
  --spacing-inset:   var(--space-4);  /* 16px — padding dalam container */
  --spacing-section: var(--space-16); /* 64px — antar section major */
}
```

---

## Border Radius — Sinyal Karakter

Radius adalah salah satu sinyal karakter terkuat dalam design.

```css
/* Sharp (0-3px) = TEGAS, professional, military */
/* Cocok untuk: tool serius, gov portal, dark premium */
--radius-sm: 1px;
--radius-md: 2px;
--radius-max: 3px;   /* tidak pernah lebih dari ini */

/* Medium (4-8px) = modern, balanced, versatile */
/* Cocok untuk: SaaS, dashboard, general product */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;

/* Large (12-24px) = friendly, consumer, approachable */
/* Cocok untuk: social app, wellness, education */
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;  /* pills, badges */
```

**Dalam DNA, selalu catat alasannya:**
```json
"radius": {
  "max": "3px",
  "values": { "none": "0px", "sm": "1px", "md": "2px", "lg": "3px" },
  "why": "Sharp edges = tegas, tidak main-main. Radius besar = playful, tidak cocok untuk professional tool."
}
```

---

## Touch Target & Accessibility Sizing

Wajib diperhatikan saat DNA punya komponen yang diakses di mobile.

```css
:root {
  --touch-target-min: 44px;         /* WCAG AA minimum */
  --touch-target-comfortable: 48px; /* rekomendasi untuk nyaman */
  --touch-gap-min: 8px;             /* gap minimum antar touch targets */
}

/* Pastikan icon button punya area tap yang cukup */
.icon-button {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

---

## Icon Sizes — Scale Standard

```css
:root {
  --icon-xs:  12px;  /* Inline decorator, prefix dalam input */
  --icon-sm:  16px;  /* Kecil di dalam tombol, badge */
  --icon-md:  20px;  /* Default — navigasi, list */
  --icon-lg:  24px;  /* Emphasis, feature list */
  --icon-xl:  32px;  /* Large UI element */
  --icon-2xl: 48px;  /* Hero icons, empty state */
}
```

**Aturan pairing icon + touch target:**
- Icon 16px → wrap di container 32px (sm button)
- Icon 20px → wrap di container 40px (md button)
- Icon 24px → wrap di container 48px (lg button)

---

## Layout System — Untuk Aspek Layout DNA

Saat extract layout dari codebase, cari dan catat:

### Grid System
```css
/* Column-based grid */
.container {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-6);
  max-width: 1280px;
  padding: 0 var(--space-6);
}

/* Area-based layout (Fought style) */
.layout {
  display: grid;
  grid-template-areas:
    "hero    panel"
    "hero    panel";
  grid-template-columns: 46fr 54fr;  /* rasio hero vs panel */
}
```

### Breakpoints
```css
/* Mobile-first breakpoints */
/* sm: 640px | md: 768px | lg: 1024px | xl: 1280px | 2xl: 1536px */

@media (max-width: 768px) {
  /* Stack layout — panel geser ke bawah */
  .layout { grid-template-columns: 1fr; }
}
```

**Yang harus ada di DNA:**
```json
"layout": {
  "grid": "split 46/54 — hero kiri, panel kanan",
  "breakpoints": {
    "mobile": "768px — stack layout, hero top, panel bottom 65% height"
  },
  "container": "max-width 1280px, auto margins",
  "density": "compact — tool work, bukan content browsing"
}
```

---

## Container Queries — Modern Responsive Pattern

Saat extract dari codebase modern, cek apakah ada container queries:

```css
.card {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card { padding: var(--space-6); }
}

@container (min-width: 600px) {
  .card {
    display: grid;
    grid-template-columns: auto 1fr;
  }
}
```

Kalau ada → catat di DNA sebagai "component-level responsive behavior".

---

## Negative Space — Sinyal Density

Asymmetric spacing di hero sections memberi sinyal cinematic:

```css
/* Breathing room yang terasa premium */
.hero-section {
  padding-top: var(--space-24);    /* 96px — banyak udara di atas */
  padding-bottom: var(--space-16); /* 64px — less di bawah = visual weight ke bawah */
}

/* Stack spacing dengan rhythm */
.content > * + * { margin-top: var(--space-4); }
.content > h2 + * { margin-top: var(--space-2); }   /* lebih dekat setelah heading */
.content > * + h2 { margin-top: var(--space-8); }   /* lebih jauh sebelum heading baru */
```

---

## Aspect Ratios — Untuk Konsistensi Media

```css
:root {
  --aspect-square:   1 / 1;
  --aspect-video:    16 / 9;
  --aspect-photo:    4 / 3;
  --aspect-portrait: 3 / 4;
  --aspect-cinema:   21 / 9;
  --aspect-golden:   1.618 / 1;
}

/* Usage */
.thumbnail { aspect-ratio: var(--aspect-video); object-fit: cover; }
.avatar    { aspect-ratio: var(--aspect-square); border-radius: 50%; }
```

---

## Aturan Extractor — Yang Harus Di-capture ke DNA

Saat membaca CSS/codebase untuk extract spacing & layout:

1. **Base unit** — cek apakah ada `--space-unit` atau pattern 4px/8px
2. **Scale** — list semua nilai spacing yang dipakai, cek apakah konsisten
3. **Grid** — column count, gap, max-width, template-areas jika ada
4. **Radius** — nilai max yang dipakai, apakah ada `--radius-*` variables
5. **Breakpoints** — semua `@media` rules yang mengubah layout
6. **Density signal** — compact (tool) vs spacious (marketing) → masuk `identity.context`

**Red flag saat audit:**
- Spacing values tidak konsisten (campur 6px, 7px, 9px) → DNA perlu spacing system
- Radius inconsisten (ada 2px, ada 12px dalam satu project) → perlu constraint
- Tidak ada breakpoint → Medium Awareness aspek kosong
