# Typography Systems — Referensi untuk DNA Extraction

> Dibaca saat: **Mode EXTRACT DNA** (aspek Tipografi) dan **Mode AUDIT DNA** (aspek Tipografi).
> Konteks: semua teknik di sini dipakai untuk mengisi field `typography` dalam DNA object.

---

## Filosofi Tipografi dalam DNA

**Tipografi adalah hierarki kognitif — bukan pilihan estetika semata.**

Saat extract tipografi ke DNA, yang harus terjawab:

1. **Berapa font roles?** — display / body / mono / accent (max 2 family, max 4 weight)
2. **Apa tugas masing-masing?** — kapan dipakai, di elemen apa
3. **Apa constraints-nya?** — aturan yang tidak boleh dilanggar
4. **Kenapa pilihan ini cocok untuk identity produk?**

DNA yang hanya mencatat nama font tanpa roles dan constraints = DNA tipografi yang belum selesai.

---

## Font Roles — Standar DNA

```json
"typography": {
  "families": ["Bebas Neue", "Barlow Condensed", "DM Mono"],
  "roles": {
    "display": {
      "family": "Bebas Neue",
      "usage": "Hero, H1-H4, semua heading — UPPERCASE",
      "why": "Bebas Neue = impact. Heading adalah pintu masuk visual, harus tegas."
    },
    "body": {
      "family": "Barlow Condensed",
      "usage": "Paragraf, label, nav, button, semua teks interaktif",
      "why": "Condensed = efisiensi ruang. Cocok untuk tool yang data-dense."
    },
    "data": {
      "family": "DM Mono",
      "usage": "Angka, kode, badge, status, section number",
      "why": "Monospace = alignment tabular. Angka yang lurus = presisi yang terasa."
    }
  },
  "constraints": [
    "Semua heading UPPERCASE — tidak ada Title Case untuk heading",
    "Max 2 font family untuk non-display content",
    "Letter-spacing body: 0.06em",
    "Section numbers: DM Mono 9px, letter-spacing 0.32em"
  ]
}
```

---

## Font Pairing — Referensi per Persona

Gunakan saat generate DNA from scratch dari deskripsi verbal. Pilih pairing yang cocok dengan `identity.tone`.

| Pairing | Tone | Ideal untuk |
|---------|------|-------------|
| **Bebas Neue + Barlow Condensed** | Military, bold, impactful | Dark professional tools, agency, tax/gov portal |
| **Inter + Inter** | Minimal, clean, Swiss | Dashboard, admin panel, design system |
| **Playfair Display + Inter** | Elegant, luxury, editorial | Premium brand, fashion, spa |
| **Space Grotesk + DM Sans** | Tech, startup, innovative | SaaS, developer tools, AI product |
| **Cormorant + Montserrat** | High-end, fashion, refined | Luxury e-commerce, jewelry |
| **JetBrains Mono + IBM Plex Sans** | Developer, precise, functional | Dev tools, CLI, docs |
| **Bebas Neue + Source Sans 3** | Bold, dramatic, impactful | Marketing, sports, event |
| **Fredoka + Nunito** | Playful, friendly, warm | Children, education, casual app |

---

## Modular Scale — Untuk Generate Skala Ukuran

Saat extract tipografi dari codebase, cek apakah ada skala matematika. Kalau ada, catat rationya di DNA.

```ts
const RATIOS = {
  minorThird:    1.200,  // casual, approachable
  majorThird:    1.250,  // balanced, versatile — paling umum
  perfectFourth: 1.333,  // clear hierarchy, professional
  augmentedFourth: 1.414, // dramatic contrast
  goldenRatio:   1.618,  // editorial, high contrast
};

function generateScale(baseSize: number, ratio: number): Record<string, string> {
  const steps = [
    { name: 'xs',   exp: -2 },
    { name: 'sm',   exp: -1 },
    { name: 'base', exp:  0 },  // baseSize
    { name: 'md',   exp:  1 },
    { name: 'lg',   exp:  2 },
    { name: 'xl',   exp:  3 },
    { name: '2xl',  exp:  4 },
    { name: '3xl',  exp:  5 },
    { name: '4xl',  exp:  6 },
  ];
  return Object.fromEntries(
    steps.map(({ name, exp }) => [name, `${Math.round(baseSize * Math.pow(ratio, exp) * 100) / 100}px`])
  );
}
```

**Skala umum berbasis 16px + perfectFourth:**
```
xs: 9px  |  sm: 12px  |  base: 16px  |  lg: 21px  |  xl: 28px  |  2xl: 38px  |  3xl: 50px
```

---

## Fluid Typography — Untuk Responsive DNA

Saat extract dari codebase modern, cek `clamp()`. Ini sinyal bahwa tipografi sudah responsive.

```css
/* Pattern fluid type */
h1 { font-size: clamp(2rem, 5vw + 1rem, 4rem); }   /* min 32px, max 64px */
h2 { font-size: clamp(1.5rem, 3vw + 0.5rem, 2.5rem); }
p  { font-size: clamp(1rem, 1vw + 0.75rem, 1.25rem); }
```

Kalau tidak ada `clamp()`, cek apakah ada breakpoint-based sizing. Catat di DNA sebagai fixed scale.

---

## Letter-spacing & Line-height — Sinyal Persona

Letter-spacing dan line-height adalah sinyal identitas yang sering diabaikan tapi sangat berpengaruh.

```css
/* Tight = premium, modern, editorial */
.heading { letter-spacing: -0.02em; }

/* Loose = airy, readable, accessible */
.caption { letter-spacing: 0.10em; }

/* Ultra-loose = MILITARY / TEGAS (dipakai di Fought) */
.section-label { letter-spacing: 0.32em; font-size: 9px; }

/* Line-height untuk reading comfort */
body    { line-height: 1.5; }   /* comfortable */
heading { line-height: 1.1; }   /* tight = impactful */
```

**Dalam DNA, catat letter-spacing per role:**
```json
"letterSpacing": {
  "display":  "-0.01em",
  "body":      "0.06em",
  "data":      "0.08em",
  "label":     "0.32em"
}
```

---

## Font Loading — Best Practices untuk Build

Saat Mode BUILD FROM DNA dan generate HTML/CSS, gunakan ini:

```css
/* Import via Google Fonts dengan display=swap */
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700&family=DM+Mono:wght@300;400&display=swap');

/* Atau preload untuk critical fonts */
```

```html
<link rel="preload" href="/fonts/bebas-neue.woff2" as="font" type="font/woff2" crossorigin>
```

**font-display: swap** — tunjukkan fallback dulu, swap saat loaded. Ini yang dipakai untuk performance.

---

## Vertical Rhythm — Untuk Layout Konsisten

```css
/* Baseline grid: semua margin multiple dari --baseline */
:root { --baseline: 1.5rem; }  /* 24px */

h1 {
  font-size: 2.5rem;
  line-height: calc(var(--baseline) * 2);    /* 48px */
  margin-bottom: var(--baseline);            /* 24px */
}
h2 {
  font-size: 2rem;
  line-height: calc(var(--baseline) * 1.5);  /* 36px */
  margin-bottom: calc(var(--baseline) * 0.5); /* 12px */
}
p {
  font-size: 1rem;
  line-height: var(--baseline);              /* 24px */
  margin-bottom: var(--baseline);
}
```

---

## OpenType Features — Untuk Angka dan Data

Saat DNA punya role `data` (mono untuk angka), aktifkan tabular nums agar angka align di kolom:

```css
/* Tabel data, dashboard metrics */
.data-table td,
.metric-value {
  font-variant-numeric: tabular-nums lining-nums;
}

/* Heading premium — small caps */
.section-eyebrow {
  font-variant-caps: small-caps;
  letter-spacing: 0.15em;
}
```

---

## Semantic Typography Classes — Referensi untuk Build

Gunakan class names berbasis purpose, bukan appearance:

```css
.text-display   { font-family: var(--font-display); font-size: var(--font-4xl); line-height: 1.0; }
.text-headline  { font-family: var(--font-display); font-size: var(--font-3xl); line-height: 1.1; }
.text-title     { font-family: var(--font-body);    font-size: var(--font-xl);  line-height: 1.2; }
.text-body      { font-family: var(--font-body);    font-size: var(--font-base); line-height: 1.5; }
.text-label     { font-family: var(--font-body);    font-size: var(--font-sm);   letter-spacing: 0.08em; }
.text-caption   { font-family: var(--font-data);    font-size: var(--font-xs);   letter-spacing: 0.20em; text-transform: uppercase; }
.text-data      { font-family: var(--font-data);    font-variant-numeric: tabular-nums; }
```

---

## Aturan Extractor — Yang Harus Di-capture ke DNA

Saat membaca CSS/codebase untuk extract tipografi, cari dan catat:

1. `font-family` yang dipakai — kelompokkan per role
2. `font-weight` variants yang aktif dipakai (bukan semua yang di-import)
3. `letter-spacing` per class/element type
4. `line-height` per role
5. `text-transform` (UPPERCASE = constraint kuat, masuk `constraints[]`)
6. `font-size` scale — apakah ada pola matematika?
7. `font-variant-numeric` — apakah angka dihandle khusus?

Kalau menemukan lebih dari 3 font families aktif → flag ke user: "DNA ini melanggar prinsip max 2 family. Mau consolidate?"
