---
name: the-designer
description: >
  AI design system skill yang mengubah Claude dari "AI yang bikin UI" menjadi "AI yang berpikir
  seperti desainer". Skill ini mengelola DNA visual — buku panduan design yang tersimpan permanen
  di storage dan dipakai konsisten tanpa harus kasih context ulang setiap sesi.
  Scope output: HTML / CSS / TSX — semua yang berhubungan dengan web, app, interface UI.
  Gunakan skill ini setiap kali ada permintaan yang menyentuh UI web: membuat komponen baru,
  memperbaiki tampilan yang tidak konsisten, mengekstrak design system dari codebase atau URL,
  mengaudit kualitas design, atau menggabungkan referensi visual dari luar ke dalam DNA yang sudah ada.
  Trigger kata kunci: "bikin UI", "perbaiki tampilan", "desain ini jelek", "buat komponen",
  "extract DNA", "simpan design", "audit design", "health check DNA", "serap referensi ini",
  "upgrade DNA", "konsistensi visual", atau apapun yang menyebut nama DNA yang sudah tersimpan.
skill-tree:
  type: leaf
  parent: twig-design-system

---

# The Designer

Skill ini mengoperasikan sistem DNA visual — sebuah buku panduan design yang hidup dan bisa di-upgrade.
Setelah satu kali extract, DNA tersimpan di storage dan dipakai untuk semua build berikutnya tanpa tanya ulang soal warna, font, atau spacing.

---

## Decision Tree — Mulai dari Sini

```
User input
  │
  ├─ "extract DNA" / "website ini bagus" / "simpan design ini"
  │    → Mode 1: EXTRACT DNA → simpan ke storage
  │
  ├─ "buatkan UI" / "buat komponen" / "buat halaman"
  │    → Cek dna:index di storage
  │    ├─ Ada satu match → load DNA → Mode 2: BUILD FROM DNA
  │    ├─ Ada 2+ match → tanya user mana yang dipakai → load → Mode 2
  │    └─ Tidak ada match → jalankan Mode 1 dulu → lanjut Mode 2
  │
  ├─ "perbaiki" / "upgrade" / "ini jelek" / "fix design"
  │    → Mode 3: REPAIR WITH DNA
  │
  ├─ "audit DNA" / "evaluasi design" / "health check"
  │    → Mode 4: AUDIT DNA → hitung Health Score → laporan
  │
  └─ "upgrade DNA dengan" / "serap dari" / "absorb referensi"
       → Mode 5: ABSORB DNA
```

**Aturan wajib:** AI tidak pernah langsung edit atau build tanpa baca DNA dulu.

---

## Storage Keys

| Key | Isi |
|-----|-----|
| `dna:[name]` | DNA terbaru (full JSON string) |
| `dna:[name]:v[version]` | Versi spesifik untuk rollback |
| `dna:index` | `[{ name, description, version, updated, health_score }]` |

**Naming convention:**
- Project sendiri: `[project]-[theme]` → `fought-dark`, `smart-tax-light`
- Referensi luar: tidak disimpan permanen (dibuang setelah absorb)
- Setelah absorb: nama tetap, versi naik (1.0 → 1.1)

---

## Mode 1 — EXTRACT DNA

**Trigger:** User kasih codebase / URL / screenshot dan minta extract, atau trigger otomatis saat tidak ada DNA yang match.

**Input yang diterima:**
- Codebase (CSS / TSX / HTML) → baca file langsung
- URL → `web_fetch` URL, baca CSS custom properties, font imports, class patterns
- Screenshot → analisis visual (fallback, kurang akurat)
- Deskripsi verbal → generate DNA from scratch berdasarkan brief

**Soal URL dan CSS obfuscated:**
Kalau URL diberikan, wajib `web_fetch`. Kalau CSS obfuscated (Next.js build, Tailwind JIT — class jadi `_1a2b3c`), fallback ke:
1. Baca CSS custom properties (`:root { --token: ... }`) — biasanya tidak obfuscated
2. Analisis computed styles yang terlihat
3. Baca meta tags dan font imports di `<head>`

**Output:** DNA object di-save ke storage. Tampilkan ringkasan ke user: nama, versi, health_score, dan daftar aspek yang sudah terisi.

---

## Mode 2 — BUILD FROM DNA

**Trigger:** User minta buat UI baru.

**Flow:**
1. Baca `dna:index` — pilih DNA paling relevan berdasarkan description
2. Load DNA penuh dari storage
3. Quick-check DNA Decay (lihat bawah)
4. Build HTML/CSS/TSX berdasarkan DNA — tanpa tanya ulang soal warna/font/spacing
5. Kalau ada component snapshot di DNA, pakai exact CSS-nya

AI fokus ke **struktur dan konten**. Keputusan visual sudah dijawab oleh DNA.

---

## Mode 3 — REPAIR WITH DNA

**Trigger:** User minta perbaiki atau upgrade sesuatu yang sudah ada.

**Flow:**
```
User minta perbaiki X
  → Extract DNA dari halaman/codebase yang dimaksud (atau load yang sudah ada)
  → Analisis: kenapa X bermasalah berdasarkan DNA
  → Lihat juga: area lain yang perlu di-upgrade agar sinkron
  → Propose ke user: "Saya mau perbaiki X dan sekalian Y agar konsisten. Setuju?"
  → User approve
  → Update DNA (catat perubahan, naikkan versi)
  → Edit UI berdasarkan DNA yang sudah diupdate
```

Yang membedakan dari edit biasa: AI membaca konteks lebih luas dan kasih saran _beyond_ yang diminta user.

---

## Mode 4 — AUDIT DNA

**Trigger:** User bilang "audit DNA" / "evaluasi design" / "health check".

**Flow:**
1. Load DNA dari storage
2. Evaluasi 11 Aspek Design (lihat bawah), skor 0-10 per aspek
3. Hitung Health Score: total / 110 × 100
4. Temukan gap: aspek mana yang lemah atau belum terjawab
5. Buat laporan + propose plan upgrade
6. User approve → update DNA langsung

**Tampilkan laporan audit dengan format:**
```
DNA: [name] v[version]
Health Score: [N]/100

ASPEK          SKOR  CATATAN
Identity        9/10  Semua field terisi, why kuat
Token System    7/10  Easing belum punya semantic name
Tipografi       8/10  ...
...

GAP UTAMA:
- [aspek]: [masalah spesifik] → [rekomendasi]

SKOR SETELAH DIPERBAIKI (estimasi): [N]/100
```

---

## Mode 5 — ABSORB DNA

**Trigger:** "Upgrade DNA [A] dengan referensi [website/codebase]"

**Aturan dominasi:**
- DNA A = DOMINAN (base yang dipertahankan)
- Referensi = RESESIF (bahan ekstraksi, dibuang setelah selesai)
- Identity & tone A tidak pernah berubah karena absorb
- Token values A bisa diupdate kalau referensi punya solusi lebih baik dan user approve
- Constraint A tidak boleh dilanggar oleh referensi

**Flow:**
1. Extract DNA resesif dari referensi
2. Bandingkan per aspek dengan DNA A
3. Tampilkan DNA Diff (lihat format di bawah)
4. User approve per-aspek
5. Save DNA A versi baru (versi naik)
6. Buang DNA resesif

**Format DNA Diff:**
```
ASPEK: Tipografi
  SEKARANG  : Bebas Neue + Barlow Condensed + DM Mono
  DARI REF  : Inter + JetBrains Mono
  REKOMENDASI: Tidak adopt — DNA A punya 3-role system yang lebih kuat
  KEPUTUSAN : [Adopt] [Skip]

ASPEK: Motion Easing
  SEKARANG  : cubic-bezier(0.16, 1, 0.3, 1)
  DARI REF  : spring(1, 0.9, 0.5) — lebih organic
  REKOMENDASI: Bisa ditambahkan sebagai --ease-spring untuk micro-interactions
  KEPUTUSAN : [Adopt] [Skip]

ASPEK: Identity
  SEKARANG  : military, precision, premium
  DARI REF  : minimal, clean, editorial
  REKOMENDASI: SKIP OTOMATIS — identity tidak boleh berubah karena absorb
  KEPUTUSAN : [Locked]
```

---

## DNA Decay Detection

Saat load DNA untuk BUILD atau REPAIR, lakukan quick-check:
- Token di DNA sudah tidak ada di codebase → DNA outdated
- Component snapshot di DNA berbeda dari implementasi aktual → DNA outdated
- Constraint di DNA dilanggar di codebase → perlu reconcile

Jika ditemukan inkonsistensi → flag ke user:
> "DNA [name] terakhir diupdate [tanggal], ada [N] inkonsistensi. Mau sync dulu sebelum build?"

---

## 11 Aspek Design (Standar DNA)

DNA yang belum menjawab semua aspek ini dianggap belum selesai.

| # | Aspek | Yang Harus Ada |
|---|-------|----------------|
| 1 | **Identity** | tone, emotion, consumer, context, why (alasan setiap keputusan) |
| 2 | **Token System** | semantic names untuk warna/spacing/radius/border/easing + alasan tiap nilai |
| 3 | **Tipografi** | max 2 family, roles (display/body/mono), skala, letter-spacing, weight strategy |
| 4 | **Layout** | grid system, breakpoints (min. mobile + desktop), container, density strategy |
| 5 | **Warna** | psikologi, primary/secondary/accent/neutral, WCAG AA check, semantic colors |
| 6 | **Copywriting** | tone of voice, capitalization rule, label convention, microcopy guideline |
| 7 | **Motion** | durasi (micro/macro/page), easing philosophy, interaction feedback (hover/active/focus/disabled) |
| 8 | **Komponen** | states per komponen, variants, component snapshots (exact CSS) |
| 9 | **Medium Awareness** | desktop: hover states, layout lebar; mobile: touch targets min 44px, no hover |
| 10 | **Constraint** | minimal 3 hard constraints dengan alasannya |
| 11 | **Anti-Pattern** | minimal 3 hal yang explicitly dilarang untuk design ini |

**Health Score per aspek: 0-10. Total / 110 × 100 = skor akhir.**

Kalau skor turun setelah absorb → warning ke user sebelum save.

---

## Format DNA Object

```json
{
  "name": "fought-dark-precision",
  "version": "1.2",
  "created": "2026-06-01",
  "updated": "2026-06-01",
  "source": "internal/codebase",
  "description": "Military-grade dark UI untuk professional tool. Merah = authority/action, gold = premium/success. Target: akuntan pajak yang butuh confidence saat kerja.",
  "health_score": 91,

  "identity": {
    "tone": ["military", "precision", "premium", "cinematic"],
    "emotion": ["focused", "powerful", "authoritative", "confident"],
    "consumer": "Professional tax accountant, 25-45 tahun, kerja dengan data penting",
    "context": "Work tool, dipakai berjam-jam, butuh focus bukan distraksi",
    "why": "User butuh merasa 'ini tool serius'. Merah bukan aggressive — dia assertive."
  },

  "tokens": {
    "colors": {
      "bg": "#02020A",
      "surface": "#07070F",
      "primary": "#C91C1C",
      "primary_bright": "#FF2828",
      "secondary": "#C4963A",
      "white": "#F0EFED",
      "muted": "rgba(240,239,237,0.36)",
      "border": "rgba(255,255,255,0.06)",
      "semantics": {
        "action": "--primary (red) — karena merah = authority = ambil tindakan",
        "success": "--secondary (gold) — gold = premium = sesuatu yang berharga tercapai",
        "error": "--primary-bright — lebih vibrant untuk urgensi"
      }
    },
    "spacing": { "base": "8px", "scale": [4, 8, 16, 24, 32, 48, 64, 96, 120] },
    "radius": {
      "values": { "none": "0px", "sm": "1px", "md": "2px", "lg": "3px" },
      "why": "Sharp edges = tegas. Radius besar = playful, tidak cocok untuk tool ini."
    },
    "border": { "weight": "0.5px", "why": "Sub-pixel = detail yang hanya terlihat kalau perhatikan = sinyal kualitas" },
    "easing": {
      "default": "cubic-bezier(0.16, 1, 0.3, 1)",
      "snappy": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      "soft": "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
    }
  },

  "typography": {
    "families": ["Bebas Neue", "Barlow Condensed", "DM Mono"],
    "roles": {
      "display": { "family": "Bebas Neue", "usage": "Hero, H1-H4, semua heading — UPPERCASE" },
      "body": { "family": "Barlow Condensed", "usage": "Paragraf, label, nav, button" },
      "data": { "family": "DM Mono", "usage": "Angka, kode, badge, status, section number" }
    },
    "constraints": [
      "Semua heading UPPERCASE",
      "Max 2 font family (Barlow + DM Mono untuk non-display)",
      "Letter-spacing body: 0.06em",
      "Section numbers: DM Mono 9px, letter-spacing 0.32em"
    ]
  },

  "motion": {
    "durations": { "micro": "200ms", "macro": "350ms", "page": "600ms" },
    "philosophy": "Motion harus intentional. Hanya elemen yang perlu komunikasikan state change yang bergerak.",
    "signature": [
      "Entry: fadeSlashIn (skew + translate) untuk hero elements",
      "Scroll reveal: slow lerp 1.1s — sinematik bukan cepat",
      "Hover: translateY(-1.5px) untuk button, (-3px) untuk card"
    ]
  },

  "constraints": [
    "border-radius max 3px — tidak ada exception",
    "border weight selalu 0.5px — tidak ada 1px atau 2px",
    "cursor: none di seluruh UI — custom cursor wajib",
    "Semua heading UPPERCASE — tidak ada Title Case untuk heading",
    "Maksimal 2 accent color: red + gold"
  ],

  "antiPatterns": [
    "Jangan pakai border-radius > 3px",
    "Jangan campur lebih dari 2 accent color",
    "Jangan pakai font selain yang sudah ditetapkan",
    "Jangan shadow terlalu tebal — max 2 layer",
    "Jangan buat semua elemen animate — pilih yang butuh communicate state"
  ],

  "components": {
    "button_primary": "padding: 11px 20px | bg: rgba(red,0.1) | border: 0.5px rgba(red,0.38) | hover: rgba(red,0.22) + glow + translateY(-1.5px)",
    "button_ghost": "padding: 10px 18px | bg: transparent | border: 0.5px muted | hover: translateX(-2px)",
    "card": "bg: rgba(10,10,18,0.55) | border-top: 0.5px brighter | backdrop-filter: blur(24px) | hover: translateY(-3px)",
    "badge_active": "gold border 0.5px | gold dot with glow",
    "badge_error": "red border 0.5px | red dot with glow",
    "badge_pending": "muted border 0.5px | muted dot"
  },

  "notes": ""
}
```

---

## DNA Files — Buku Panduan Design yang Tersimpan

Folder `skills/the-designer/dna/` menyimpan DNA yang sudah di-extract dan siap dipakai.
Ini adalah **ground truth** — AI membaca file ini saat Mode BUILD atau REPAIR, bukan dari storage.

| File | DNA | Deskripsi |
|------|-----|-----------|
| `dna/fought-dark.md` | `fought-dark-precision` | Military-grade dark UI — merah + gold, cinematic, untuk professional tax tool. CoretaxConsole. |

**Cara pakai saat BUILD FROM DNA:**
1. Baca `dna/[nama].md` yang relevan
2. Extract token, typography, motion, constraints dari file tersebut
3. Build sesuai DNA — tidak perlu tanya ulang soal warna/font

**Cara tambah DNA baru:**
Setelah Mode EXTRACT selesai → simpan DNA object ke file baru di `dna/[project-theme].md`.
Format file: frontmatter nama + deskripsi singkat, lalu JSON object DNA lengkap.

---

## Referensi — Baca Saat Diperlukan

Semua referensi ada di `skills/the-designer/references/`. Jangan load semua sekaligus.

| File | Dibaca saat | Isi |
|------|------------|-----|
| `references/color-systems.md` | Extract / audit aspek **Warna** | Two-tier token system, OKLCH, WCAG contrast checker, psikologi warna per konteks, harmony functions, transparency scale |
| `references/typography-systems.md` | Extract / audit aspek **Tipografi** | Font roles, pairing guide per persona, modular scale, fluid type dengan clamp(), letter-spacing guide, OpenType features |
| `references/spacing-layout.md` | Extract / audit aspek **Token spacing** dan **Layout** | 8-point grid, semantic spacing, radius scale, touch targets, icon sizes, container queries, breakpoints |
| `references/design-heuristics.md` | **Mode AUDIT** dan checklist sebelum BUILD output | UX anti-patterns per severity, motion philosophy, component states checklist, color palette quick reference per kategori |
| `references/source-extraction.md` | Extract dari **URL atau codebase kompleks** | Cara baca CSS obfuscated, flow fetch multi-step, Tailwind config parsing, Next.js __NEXT_DATA__, edge cases |
