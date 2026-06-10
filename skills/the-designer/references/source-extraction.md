# Source Extraction — Cara Baca CSS dari Website atau Codebase Kompleks

> Dibaca saat: **Mode EXTRACT DNA** dengan input berupa URL atau codebase yang CSS-nya tidak langsung terlihat.
> Konteks: web-shader-extractor punya teknik bagus untuk fetch dan parse source kompleks — ini versi yang diadaptasi untuk kebutuhan design DNA extraction.

---

## Prinsip Utama

**Baca CSS aktual, jangan tebak dari screenshot.**

Screenshot hanya fallback terakhir. Urutan prioritas source:
1. **CSS custom properties** (`:root { --token: ... }`) — paling akurat, biasanya tidak diobfuscate
2. **Stylesheet langsung** (via `web_fetch`)
3. **Inline styles** di HTML head
4. **Computed visual** dari screenshot — akurasi paling rendah

---

## Flow Ekstraksi dari URL

```
Input: URL dari user

Step 1: web_fetch URL → baca HTML
  → Cari: <link rel="stylesheet">, <style> inline, <link rel="preconnect"> untuk fonts
  → Cari: custom properties di :root {}
  → Cari: font imports (@import url('...fonts.googleapis.com...'))

Step 2: web_fetch stylesheet URL yang ditemukan
  → Parse: --custom-properties
  → Parse: font-face declarations
  → Parse: class patterns untuk komponen utama

Step 3: Jika CSS obfuscated (Next.js build, class="_abc123"):
  → Fallback ke custom properties — ini biasanya tidak di-obfuscate
  → Baca meta tags untuk color scheme hints
  → Analisis visual dari screenshot (paling terakhir)

Step 4: Compile ke DNA object
```

---

## Deteksi CSS Obfuscation

Ciri-ciri CSS yang di-obfuscate:
- Class names: `._1a2b3c`, `.css-xyz789`, `.sc-abc` (styled-components)
- Next.js build: `.module__className__hash`
- Tailwind JIT: class tidak ada di stylesheet, inline di HTML

**Cara kerja kalau obfuscated:**

```bash
# 1. Cari custom properties — ini paling reliable
# Di HTML/CSS, grep untuk: var(--, :root {

# 2. Cari font imports
# Di HTML head: <link href="fonts.googleapis.com...">
# Di CSS: @import url('...')
# Di JS: new FontFace()

# 3. Cari color hints di meta tags
# <meta name="theme-color" content="#hexvalue">
# <meta name="msapplication-TileColor" content="#hexvalue">

# 4. Cari design tokens di JS bundle
# Pattern: { primary: '#C91C1C', bg: '#02020A' }
# Pattern: colors: { brand: { 500: '#...' } }
```

---

## Teknik Fetch Multi-Step

Untuk site yang render via JS (SPA, Next.js, Nuxt):

```
1. web_fetch HTML page
   → Extract semua <link rel="stylesheet"> URLs
   → Extract semua <script src="..."> yang mungkin punya design tokens

2. web_fetch setiap stylesheet
   → Filter: baca semua :root { } blocks
   → Filter: baca semua @font-face blocks
   → Filter: baca pattern class CSS untuk komponen (button, card, input)

3. Kalau ada JS bundle yang kecil (< 50KB estimate dari path name):
   → web_fetch JS bundle
   → Cari pattern: { colors: { ... } }, theme: { ... }, tokens: { ... }

4. Compile semua yang ditemukan ke draft DNA
```

---

## Extract dari Codebase Lokal

Kalau user kasih codebase (sudah di-clone atau upload files):

**Priority baca:**

```
1. globals.css / variables.css / design-tokens.css
   → Custom properties langsung

2. tailwind.config.js / tailwind.config.ts
   → theme.extend.colors, theme.extend.spacing, theme.fontFamily

3. theme.ts / tokens.ts / colors.ts
   → Design tokens dalam format TypeScript/JS

4. index.css / main.css / App.css
   → Root-level custom properties

5. Component files (scan representatif, jangan semua):
   → Button.tsx / Card.tsx / Input.tsx
   → Extract: className patterns, inline styles, CSS modules
```

---

## Membaca Tailwind Config sebagai DNA Source

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary:   '#C91C1C',  // → tokens.colors.primary
        secondary: '#C4963A',  // → tokens.colors.secondary
        bg: {
          deep:    '#02020A',  // → tokens.colors.bg
          surface: '#07070F',  // → tokens.colors.surface
        }
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],  // → typography.roles.display
        body:    ['Barlow Condensed', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
      },
      spacing: {
        '4':  '4px',    // → tokens.spacing.scale
        '8':  '8px',
        '16': '16px',
      },
      borderRadius: {
        'sm': '1px',   // → tokens.radius.values
        'md': '2px',
        'lg': '3px',
      },
      transitionTimingFunction: {
        'snappy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // → tokens.easing
        'soft':   'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }
    }
  }
}
```

Setiap field di Tailwind config ini langsung map ke DNA object.

---

## Mengurai Next.js / __NEXT_DATA__

```
1. web_fetch page URL
2. Cari <script id="__NEXT_DATA__" type="application/json">
3. Parse JSON content
4. Cari: props.pageProps.theme / props.pageProps.designTokens / buildId
5. Kalau tidak ada di __NEXT_DATA__, cari di window.__CONFIG__ patterns di script tags
```

---

## CSS Variable Patterns yang Paling Informatif

Saat scraping CSS, prioritaskan patterns ini:

```css
/* 1. Color tokens — paling informatif */
:root {
  --color-primary: ...;
  --color-bg: ...;
  --color-text: ...;
  --color-border: ...;
}

/* 2. Typography tokens */
:root {
  --font-heading: ...;
  --font-body: ...;
  --font-size-base: ...;
  --letter-spacing-wide: ...;
}

/* 3. Spacing tokens */
:root {
  --space-1: ...;
  --space-4: ...;
  --spacing-section: ...;
}

/* 4. Motion tokens — sering diabaikan tapi penting */
:root {
  --ease-default: cubic-bezier(...);
  --duration-fast: 150ms;
  --duration-base: 250ms;
}

/* 5. Radius tokens */
:root {
  --radius-sm: ...;
  --radius-card: ...;
  --radius-full: ...;
}
```

Kalau semua custom properties ini ada → DNA bisa diisi dengan akurasi tinggi.
Kalau tidak ada custom properties → fallback ke analisis computed styles atau screenshot.

---

## Edge Cases

**Site tanpa CSS custom properties (legacy):**
- Cari hard-coded hex values yang berulang di stylesheet → itu warna primary
- Cari `font-family` di body selector → itu typography utama
- Cari `padding`/`margin` values yang konsisten → itu spacing base

**Site dengan CSS-in-JS (Emotion, styled-components):**
- CSS ada di JS bundle, bukan stylesheet terpisah
- Cari `createGlobalStyle`, `ThemeProvider`, `theme =` di JS
- Kalau JS bundle terlalu besar → fokus ke custom properties dan font imports saja

**Site dengan design tokens di CMS (Webflow, Framer):**
- Webflow: biasanya ada `wf-` prefixed variables
- Framer: ada `--framer-` prefixed variables
- Baca saja yang ada, map ke DNA format

---

## Output Extraction

Setelah scraping selesai, compile ke DNA draft dan tampilkan ke user:

```
Ekstraksi selesai dari: [URL/codebase]

Yang berhasil di-extract:
✅ Colors: primary, secondary, bg, surface, border, semantics
✅ Typography: 2 families (display + body), roles, constraints
✅ Spacing: base 8px, scale [4,8,16,24,32,48,64]
✅ Radius: max 3px, values [1px, 2px, 3px]
✅ Easing: 3 named curves
⚠️  Motion: tidak ada explicit duration tokens — default digunakan
❌ Layout: tidak ditemukan grid system — perlu input manual

Health score estimasi: 71/100
Gap utama: Layout, Copywriting

Simpan sebagai DNA "[nama]"?
```
