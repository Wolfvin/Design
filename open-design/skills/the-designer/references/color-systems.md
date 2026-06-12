# Color Systems — Referensi untuk DNA Extraction

> Dibaca saat: **Mode EXTRACT DNA** (aspek Warna) dan **Mode AUDIT DNA** (aspek Warna).
> Konteks: semua teknik di sini dipakai untuk mengisi atau mengevaluasi field `tokens.colors` dalam DNA object.

---

## Filosofi Warna dalam DNA

**Warna bukan dekorasi — dia komunikasi.**

Saat extract warna dari sebuah design ke dalam DNA, pertanyaannya bukan *"apa hexnya?"* tapi *"apa yang dikomunikasikan warna ini ke user?"*

DNA menyimpan dua lapisan:
1. **Token primitif** — nilai hex/rgb/hsl mentah
2. **Semantik** — alasan kenapa token itu ada dan apa maknanya

Kalau DNA hanya menyimpan hex tanpa semantik, DNA itu belum selesai.

```
CONTOH BENAR:
"primary": "#C91C1C",
"semantics": { "action": "--primary — merah = authority = ambil tindakan" }

CONTOH SALAH (hanya nilai, tidak ada makna):
"primary": "#C91C1C"
```

---

## Two-Tier Token System

Struktur token yang ideal untuk DNA. Tier 1 = nilai mentah, Tier 2 = makna.

```css
/* Tier 1: Primitive — nilai mentah, tidak punya konteks */
:root {
  --primitive-red-500: #C91C1C;
  --primitive-red-bright: #FF2828;
  --primitive-gold-500: #C4963A;
  --primitive-bg-deep: #02020A;
  --primitive-surface: #07070F;
}

/* Tier 2: Semantic — purpose-based, ini yang dipakai di komponen */
:root {
  --color-action:    var(--primitive-red-500);    /* primary CTA */
  --color-urgent:    var(--primitive-red-bright); /* error, warning */
  --color-premium:   var(--primitive-gold-500);   /* success, verified */
  --color-bg:        var(--primitive-bg-deep);    /* canvas background */
  --color-surface:   var(--primitive-surface);    /* card, panel */
}
```

**Dalam DNA object**, simpan sebagai:
```json
"colors": {
  "bg": "#02020A",
  "surface": "#07070F",
  "primary": "#C91C1C",
  "semantics": {
    "action": "--primary (red) — authority = ambil tindakan",
    "success": "--secondary (gold) — premium = sesuatu berharga tercapai",
    "error": "--primary-bright — vibrant untuk urgensi"
  }
}
```

---

## Psikologi Warna per Konteks

Saat extract DNA, gunakan tabel ini untuk mengisi field `identity.why` dan `tokens.colors.semantics`.

| Warna | Psikologi | Cocok untuk | Hindari di |
|-------|-----------|-------------|------------|
| **Merah** | Authority, urgency, action, kekuatan | CTAs, error state, brand power tools | Healthcare (terror), wellness |
| **Gold/Amber** | Premium, success, warmth, trusted | Achievement, verified, subscription | Budget products, minimalis bersih |
| **Biru gelap (Navy)** | Trust, stability, professionalism | Fintech, gov, B2B enterprise | Creative agency, entertainment |
| **Biru terang (Cyan)** | Teknologi, freshness, openness | Health tech, SaaS, dashboard | Luxury, legal |
| **Hijau** | Growth, success, eco, health | Konfirmasi sukses, sustainability | Urgency actions |
| **Ungu** | Inovasi, AI, kreativitas, misteri | AI products, NFT, creative | Gov, medical, high-trust |
| **Dark bg (#0x–#1x)** | Premium, fokus, cinematic, serius | Professional tools, dark UI | Consumer mass market |
| **White/Light bg** | Bersih, accessible, terbuka | Dokumen, content-heavy, umum | Dark-first cinematic brand |

---

## WCAG Contrast — Wajib Cek Saat Extract

Setiap pasangan teks/background di DNA harus melewati WCAG AA minimum:
- Body text: **4.5:1**
- Large text / heading: **3:1**
- UI components / borders: **3:1**

**Cara hitung cepat (formula):**

```ts
function getLuminance(r: number, g: number, b: number): number {
  return [r, g, b].reduce((sum, c, i) => {
    c = c / 255;
    c = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return sum + c * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function contrastRatio(hex1: string, hex2: string): number {
  // parse hex to [r,g,b] lalu masukkan ke getLuminance
  const l1 = getLuminance(...hexToRgb(hex1));
  const l2 = getLuminance(...hexToRgb(hex2));
  const [lighter, darker] = [Math.max(l1, l2), Math.min(l1, l2)];
  return (lighter + 0.05) / (darker + 0.05);
}

// Target: >= 4.5 untuk body text, >= 3.0 untuk large text
```

**Catatan untuk dark UI:**
`#F0EFED` (white) di atas `#02020A` (deep bg) → rasio ~18:1 — aman.
`rgba(240,239,237,0.36)` (muted) di atas `#02020A` → sekitar 4.8:1 — pas AA.

---

## OKLCH — Untuk Generate Palette yang Perceptually Uniform

Gunakan ini saat harus generate skala warna yang terasa konsisten secara visual (bukan matematis saja).

```css
/* OKLCH: L=lightness (0-1), C=chroma (0-0.4), H=hue (0-360) */
/* Keunggulan: langkah lightness terasa sama di semua hue */

:root {
  --red-dim:    oklch(35% 0.18 22);   /* sangat gelap, untuk background subtle */
  --red-base:   oklch(45% 0.22 22);   /* base brand red */
  --red-bright: oklch(58% 0.26 22);   /* hover state, vibrant */
  --red-text:   oklch(70% 0.20 22);   /* red text di dark bg — tetap readable */
}
```

**Cara baca OKLCH:**
- L naik → lebih terang. Untuk dark palette, L: 0.25–0.55 adalah range kerja.
- C naik → lebih vibrant. Dark UI premium biasanya C: 0.15–0.25.
- H = hue angle: 0/360=merah, 120=hijau, 250=biru, 60=kuning.

---

## Color Harmony — Untuk DNA from Scratch (Deskripsi Verbal)

Saat user kasih brief verbal ("bikin design military dark premium"), gunakan ini untuk memilih kombinasi warna.

```ts
function generateHarmony(baseHue: number, type: 'complementary' | 'triadic' | 'analogous' | 'split-complementary'): number[] {
  switch (type) {
    case 'complementary':      return [baseHue, (baseHue + 180) % 360];
    case 'triadic':            return [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360];
    case 'analogous':          return [(baseHue - 30 + 360) % 360, baseHue, (baseHue + 30) % 360];
    case 'split-complementary': return [baseHue, (baseHue + 150) % 360, (baseHue + 210) % 360];
  }
}
```

**Rekomendasi per DNA personality:**
- **Military/dark premium** → 2 accent max (complementary): merah (H=0) + gold (H=40)
- **Tech/SaaS modern** → analogous di biru (H=210–270)
- **Wellness/calm** → analogous hijau-biru (H=150–210)
- **Creative/agency** → triadic atau split-complementary

---

## Transparency Scale — Untuk Dark UI

Dark UI sering pakai `rgba` / opacity bukan solid colors untuk depth dan hierarchy.

```css
/* Pattern di dark palette */
--text-primary:  rgba(240, 239, 237, 1.00);   /* 100% — main text */
--text-muted:    rgba(240, 239, 237, 0.36);   /* 36% — secondary text */
--text-ghost:    rgba(240, 239, 237, 0.18);   /* 18% — placeholder, disabled */
--border-subtle: rgba(255, 255, 255, 0.06);   /* 6% — dividers, barely visible */
--border-active: rgba(255, 255, 255, 0.12);   /* 12% — active state border */
--surface-hover: rgba(255, 255, 255, 0.04);   /* 4% — hover bg on cards */
```

**Aturan extractor:** Saat baca CSS, kalau menemukan banyak `rgba` dengan opacity rendah → ini dark UI dengan transparency system. Ekstrak semua opacity variants sebagai token terpisah.

---

## CSS Color Functions Modern

```css
/* color-mix — blend dua warna */
--border-accent: color-mix(in srgb, var(--primary) 38%, transparent);

/* Relative color — turunkan lightness dari token yang sudah ada */
--primary-dim:  hsl(from var(--primary) h s calc(l - 15%));
--primary-glow: hsl(from var(--primary) h s calc(l + 20%));

/* Alpha variation */
--primary-10: rgb(from var(--primary) r g b / 0.10);
--primary-22: rgb(from var(--primary) r g b / 0.22);
```

---

## Color Blindness — Quick Check

Sebelum finalize palette DNA, cek 2 skenario kritis:

1. **Protanopia / Deuteranopia (red-green):** Jangan pakai red-green sebagai satu-satunya differentiator. Pasangkan dengan ikon atau label teks.
2. **Tritanopia (blue-yellow):** Jarang, tapi perlu dipertimbangkan untuk health/gov products.

**Rule praktis untuk dark UI merah-gold:**
- Merah dan gold cukup berbeda di brightness — aman untuk mayoritas color blindness
- Tambahkan ikon atau label kalau keduanya dipakai untuk status berbeda (error vs success)
