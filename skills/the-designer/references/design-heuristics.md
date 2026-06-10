# Design Heuristics — Referensi untuk Audit & Build

> Dibaca saat: **Mode AUDIT DNA** (semua aspek) dan **Mode BUILD FROM DNA** (sebagai checklist sebelum output).
> Konteks: heuristics ini membantu AI menilai kualitas design dan mendeteksi anti-patterns.

---

## UI Reasoning — Pattern per Kategori Produk

Saat extract DNA dari product baru atau generate DNA from scratch, gunakan tabel ini sebagai referensi.

| Kategori | Style Priority | Color Mood | Motion | Anti-Pattern Umum |
|----------|---------------|-----------|--------|-------------------|
| **Gov / Tax Portal** | Accessible + Minimal | Professional blue + High contrast | Clear focus rings, no decoration | Ornate design, low contrast, AI purple/pink gradient |
| **Professional Tool (dark)** | Dark Mode + Glassmorphism | Dark tech + Vibrant accents | Real-time feedback + Alert pulse | Light backgrounds, no security indicators |
| **Financial Dashboard** | Data-Dense + Dark OLED | Dark bg + Red/Green + Trust blue | Real-time number animations + Alert pulse | Light mode default, slow rendering |
| **SaaS (General)** | Glassmorphism + Flat | Trust blue + Accent contrast | Subtle hover 200-250ms + Smooth transitions | Excessive animation, dark mode by default |
| **Enterprise B2B** | Trust + Minimal | Professional blue + Neutral grey | Subtle section transitions + Feature reveals | Playful design, hidden credentials |
| **Creative Agency** | Brutalism + Motion | Bold primaries + Artistic freedom | CRT scanlines + Glitch effects | Corporate minimalism |
| **E-commerce Luxury** | Liquid Glass + Glassmorphism | Premium dark + Gold | Chromatic aberration + Fluid 400-600ms | Vibrant & block |
| **Healthcare** | Neumorphism + Accessible | Calm blue + Health green | Soft box-shadow + Smooth press 150ms | Bright neon, motion-heavy |

---

## UX Guidelines — Checklist Anti-Regression

Saat audit DNA atau sebelum output BUILD, cek checklist ini. Item HIGH severity wajib terpenuhi.

### Navigation & Interaksi
- [ ] **Active state** — current page/section harus terlihat berbeda (color/underline)
- [ ] **Focus states** — keyboard user butuh visible focus ring; `outline: none` tanpa replacement = VIOLATION
- [ ] **Hover states** — semua elemen interaktif harus ada visual feedback saat hover
- [ ] **Touch targets** — minimum 44×44px; jangan ada tombol kecil tanpa wrapping

### Animation & Motion
- [ ] **Durasi micro-interactions** — 150-300ms. Di atas 500ms untuk UI = terlalu lambat
- [ ] **Tidak semua bergerak** — max 1-2 elemen yang animate per view
- [ ] **`prefers-reduced-motion`** — wajib ada respeknya untuk user yang sensitif motion
- [ ] **Tidak infinite animation** di elemen dekoratif — hanya loader / pulse aktif
- [ ] **Transform/opacity** — gunakan ini untuk animasi, bukan `top`/`width`/`height` (reflow mahal)

### Layout
- [ ] **`overflow-hidden`** — jangan blindly apply; test semua content muat
- [ ] **Content jumping** — reserve space untuk async content (aspect-ratio atau fixed height)
- [ ] **Z-index system** — pakai skala (10, 20, 30, 50), jangan `z-[9999]`
- [ ] **Viewport units** — pakai `dvh` untuk mobile, bukan `100vh` (browser chrome issues)
- [ ] **Text max-width** — limit ke 65-75ch untuk readability

### Mobile Specific
- [ ] **Touch gap** — minimum 8px antar touch targets
- [ ] **Pull to refresh** — disable kalau tidak dibutuhkan (`overscroll-behavior: contain`)
- [ ] **Gesture conflicts** — hindari horizontal swipe pada main content

---

## Motion Philosophy untuk DNA

Masukkan ini saat mengisi aspek Motion di DNA:

```
Durasi standards:
  micro:  100-200ms  → hover, focus, toggle
  macro:  300-500ms  → slide in/out, expand/collapse
  page:   400-800ms  → route transition, major reveal

Easing guide:
  ease-out        → elemen masuk ke view (decelerates, feels natural)
  ease-in         → elemen keluar dari view
  spring/snappy   → micro-interaction yang butuh "bounce" feeling
  linear          → JANGAN untuk UI — terasa robotic

Kapan animasi menambah nilai:
  - State change yang tidak obvious tanpa feedback visual
  - Hierarchy reveal (scroll-triggered, staggered)
  - Loading/progress indicator
  - Transition antar halaman/wizard step

Kapan animasi jadi noise:
  - Elemen yang user tidak peduli (icon di nav bar yang berputar terus)
  - Setelah user sudah familiar dengan UI
  - Saat ada content penting yang harus dibaca dulu
```

---

## Component States — Checklist Completeness

Setiap komponen di DNA harus punya semua states ini:

| State | Wajib ada | Contoh visual |
|-------|-----------|---------------|
| Default | ✅ | Border subtle, bg neutral |
| Hover | ✅ | Bg sedikit lebih terang, translateY(-1.5px) |
| Active/Pressed | ✅ | Sedikit lebih gelap, translateY(0) |
| Focus (keyboard) | ✅ | Focus ring 2px visible |
| Disabled | ✅ | Opacity 40%, pointer-events: none |
| Loading | ✅ untuk async | Skeleton atau spinner |
| Error | ✅ untuk input | Border merah, ikon, pesan |
| Success | ✅ untuk form | Border hijau/gold, ikon |

**Saat audit:** Kalau component snapshot di DNA tidak menyebut semua states → flag sebagai gap.

---

## Color Palette per Kategori — Quick Reference

Saat perlu referensi warna cepat untuk generate DNA from scratch:

| Kategori | Primary | Secondary | CTA | BG |
|----------|---------|-----------|-----|-----|
| **Professional Tool (dark)** | `#C91C1C` | `#C4963A` | `#FF2828` | `#02020A` |
| **Financial Dashboard** | `#0F172A` | `#1E293B` | `#22C55E` | `#020617` |
| **Analytics Dashboard** | `#1E40AF` | `#3B82F6` | `#F59E0B` | `#F8FAFC` |
| **SaaS General** | `#2563EB` | `#3B82F6` | `#F97316` | `#F8FAFC` |
| **Gov / Tax** | `#0F172A` | `#334155` | `#0369A1` | `#F8FAFC` |
| **E-commerce Luxury** | `#1C1917` | `#44403C` | `#CA8A04` | `#FAFAF9` |
| **Healthcare** | `#0891B2` | `#22D3EE` | `#059669` | `#ECFEFF` |
| **Creative Agency** | `#EC4899` | `#F472B6` | `#06B6D4` | `#FDF2F8` |

---

## Anti-Patterns yang Harus Masuk DNA

Field `antiPatterns[]` di DNA harus berisi larangan spesifik, bukan generik. Contoh buruk vs baik:

```
❌ TERLALU GENERIK (tidak berguna):
"Jangan buat design yang jelek"
"Hindari warna yang tidak cocok"

✅ SPESIFIK DAN BISA DICEK:
"Jangan pakai border-radius > 3px"
"Jangan campur lebih dari 2 accent color"
"Jangan pakai shadow lebih dari 2 layer"
"Jangan animate elemen yang tidak berkomunikasikan state change"
"Jangan pakai font selain Bebas Neue, Barlow Condensed, DM Mono"
```

**Anti-pattern universal yang berlaku di hampir semua dark professional UI:**
- AI purple/pink gradient (`#6366F1`, `#A855F7` dominan) → terasa generic, bukan brand
- Box shadow terlalu tebal di dark bg → terasa aneh, shadow untuk light UI
- Border radius terlalu besar di tool serius → playful, mengurangi authority
- Semua elemen animate → tidak ada yang terasa special
- Terlalu banyak accent color (> 2-3) → visual noise

---

## Density Decision

`identity.context` di DNA harus mencatat density yang tepat:

| Context | Density | Contoh spacing | Contoh font size |
|---------|---------|---------------|-----------------|
| **Work tool** (dipakai berjam-jam) | Compact | padding: 8-16px | body: 13-14px |
| **Content/reading** | Comfortable | padding: 16-24px | body: 16px |
| **Marketing/landing** | Spacious | padding: 24-48px | body: 16-18px |
| **Mobile-first** | Touch-friendly | padding: 16px, tap 44px | body: 16px |

DNA Fought → **compact** (tax professional, berjam-jam, data-dense). Spacing ketat tapi bukan cramped.
