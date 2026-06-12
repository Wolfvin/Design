# the-designer — Brainstorming Placeholder
> Status: DRAFT — belum ada yang final, ini ruang pikir dulu

---

## Apa ini?

Skill yang mengubah Claude dari "AI yang bikin UI" menjadi "AI yang berpikir seperti desainer".
Bukan sekadar generate komponen — tapi punya DNA visual, tahu kenapa setiap keputusan diambil,
dan bisa konsisten tanpa harus cek ulang semua file setiap kali.

**Scope output:** HTML / CSS / TSX — semua yang berhubungan dengan web, app, interface UI.
Tidak untuk PDF, PPT, atau format non-web.

---

## Masalah yang Mau Dipecahkan

Selama ini kalau minta Claude bikin / perbaiki UI:
- Harus kasih context berulang-ulang ("ingat warnanya merah ya, bordernya 0.5px ya")
- Claude langsung perbaiki bagian yang diminta, tanpa lihat konteks sekitarnya
- Hasilnya inkonsisten antar komponen karena tidak ada "buku panduan" yang dipegang
- Tidak ada cara extract "soul" dari desain yang sudah bagus ke tempat yang permanen

**Solusi:** DNA system. Satu kali extract, tersimpan di storage, dipakai selamanya.
DNA = buku panduan design yang hidup dan bisa di-upgrade.

---

## 2 Entry Point Utama

### Entry Point A — "Perbaiki / Upgrade sesuatu"

User minta perbaiki sesuatu (tipografi jelek, layout aneh, komponen tidak konsisten).

**Flow:**
```
User minta perbaiki X
  → AI TIDAK langsung edit
  → AI extract DNA dari halaman/codebase yang dimaksud
  → AI baca DNA: "oh, designnya begini, dan memang X bermasalah"
  → AI juga lihat: "tapi di bagian Y ini juga bisa di-upgrade sekalian, biar sinkron"
  → AI tanya user: "Saya mau perbaiki X dan sekalian Y agar konsisten, setuju?"
  → User approve
  → AI edit DNA (perbarui buku panduan)
  → AI buat/edit UI berdasarkan DNA yang sudah diupdate
  → Hasilnya konsisten karena ada panduan, bukan tebak-tebakan
```

Kuncinya: **AI tidak pernah langsung edit tanpa baca DNA dulu.**
DNA = AI baca konteks → AI bisa kasih saran yang lebih luas dari yang diminta.

---

### Entry Point B — "Buatkan UI ini"

User minta buat UI baru (halaman, komponen, section, dll).

**Flow:**
```
User minta buat UI X
  → AI cek storage: apakah sudah ada DNA yang mirip/relevan?
  
  Jika TIDAK ADA DNA yang relevan:
    → Masuk ke Entry Point A (extract DNA dulu dari context yang ada)
    → Setelah DNA ada, lanjut build
  
  Jika ADA DNA yang relevan:
    → AI load DNA tersebut
    → AI baca description DNA: "ini design military dark premium untuk tax professional"
    → AI build UI langsung sesuai DNA, tanpa tanya ulang soal warna/font/dll
    → Hasilnya konsisten karena DNA jadi panduan
```

**Matching logic:**
AI baca semua `dna:index` di storage, lihat `description` masing-masing DNA,
pilih yang paling relevan berdasarkan konteks request user.
Kalau ada beberapa kandidat → tanya user mana yang mau dipakai.

---

## DNA Absorption System (bukan Hybrid)

Konsep: **DNA A menyerap DNA B**. Bukan merge equal — ada dominasi.

Skenario: *"Upgrade DNA Fought dengan referensi website ini"*

```
Langkah:
1. Extract DNA B dari website referensi (bersifat RESESIF)
2. DNA A yang sudah ada tetap jadi BASE (bersifat DOMINAN)
3. AI analisis: aspek mana dari DNA B yang bisa memperkuat DNA A
   - Apakah ada teknik tipografi dari B yang lebih baik dari A?
   - Apakah motion philosophy B lebih refined?
   - Apakah ada token pattern di B yang belum ada di A?
4. AI tampilkan DNA DIFF — per aspek:
   "Aspek tipografi: saat ini [X], dari referensi bisa jadi [Y]. Adopt?"
   "Aspek motion: saat ini [X], referensi tidak punya ini → tetap."
5. User approve per-aspek (bukan all-or-nothing)
6. DNA A versi baru di-save (versi naik: 1.0 → 1.1)
7. DNA B di-discard (tidak disimpan, dia hanya jadi bahan ekstraksi)
```

**Aturan dominasi:**
- Identity & tone A tidak pernah berubah karena B — ini DNA inti
- Token values A bisa diupdate kalau B punya solusi lebih baik dan user approve
- Constraint A tidak boleh dilanggar oleh B
- Kalau B punya sesuatu yang A tidak punya → kandidat untuk ditambahkan ke A

Hasilnya tetap DNA A, hanya versi yang lebih kaya.

---

## Mode-Mode Skill

### Mode 1 — EXTRACT DNA
**Trigger:** User kasih codebase / URL / screenshot dan minta extract,
atau trigger otomatis dari Entry Point A/B saat tidak ada DNA yang match.

**Input bisa berupa:**
- Codebase (CSS/TSX/HTML files) → baca file langsung
- URL website → `web_fetch` URL, baca CSS custom properties, font imports, class patterns
- Screenshot → visual analysis (fallback, kurang akurat dibanding CSS)
- Deskripsi verbal → generate DNA from scratch berdasarkan brief

**Soal URL dan CSS:**
Kalau user kasih URL, AI wajib `web_fetch` untuk baca CSS-nya secara langsung —
jauh lebih akurat daripada nebak dari screenshot.

Edge case: beberapa site CSS-nya obfuscated (Next.js build, Tailwind JIT) —
class names jadi `_1a2b3c`. Dalam kasus ini, fallback ke:
- Baca CSS custom properties (`:root { --token: ... }`) — ini biasanya tidak obfuscated
- Analisis visual dari computed styles yang terlihat
- Baca meta tags, font imports di `<head>`

**Output:** DNA object tersimpan ke storage dengan nama + description.

**Sub-mode:**
- Extract dari **project sendiri** (Fought, Smart Tax, dll)
- Extract dari **referensi luar** (website orang lain yang bagus)
- Extract dari **deskripsi** (DNA from scratch berdasarkan brief)

---

### Mode 2 — BUILD FROM DNA
**Trigger:** User minta buat UI.

Flow: cek storage → load DNA → build → output HTML/CSS/TSX.

AI tidak perlu tanya ulang soal warna, font, spacing — semua sudah di DNA.
AI fokus ke **struktur dan konten**, bukan keputusan visual.

Kalau ada component snapshot di DNA, AI bisa langsung pakai exact CSS-nya —
hasilnya lebih akurat dari sekedar "primary button merah".

---

### Mode 3 — REPAIR WITH DNA
**Trigger:** User minta perbaiki / upgrade sesuatu yang sudah ada.

Flow: extract DNA dari yang ada → analisis → propose perbaikan lebih luas → user approve → update DNA → edit UI.

Yang membedakan dari "AI biasa yang langsung edit":
AI membaca konteks lebih luas dan kasih saran beyond yang diminta user.

---

### Mode 4 — AUDIT DNA
**Trigger:** User bilang "audit DNA ini" / "evaluasi design" / "DNA ini sudah bagus?"

**Flow:**
1. Load DNA dari storage
2. Evaluasi berdasarkan 11 Aspek Design (lihat bawah)
3. Hitung **DNA Health Score** (0-100) per aspek
4. Temukan gap: aspek mana yang lemah, tidak konsisten, atau belum dijawab
5. Buat laporan + propose plan upgrade
6. User approve → update DNA langsung (bukan hanya plan)

---

### Mode 5 — ABSORB DNA
**Trigger:** "Upgrade DNA [A] dengan referensi [website/codebase]"

Flow sesuai DNA Absorption System di atas.
DNA A dominan, referensi resesif. Output: DNA A versi baru. Referensi di-discard.

---

## DNA Health Score

Setiap DNA punya skor 0-100 yang dihitung otomatis berdasarkan 11 aspek.
Skor dihitung ulang setiap kali DNA di-update.

**Fungsi:**
- Quality gate: kalau skor turun setelah absorb → AI warning dulu sebelum save
- Audit entry point: skor rendah di aspek tertentu = tau harus mulai dari mana
- Progress tracking: DNA v1.0 skor 62, v1.1 skor 78 → terlihat progresnya

**Skoring per aspek (masing-masing 0-10, total /110 → normalized ke 100):**

| Aspek | Cara hitung |
|-------|-------------|
| Identity | Apakah tone, emotion, consumer, why semua terisi? |
| Token System | Berapa % token yang punya semantic name + alasan? |
| Tipografi | Apakah max 2 family? Ada semua roles? Ada constraints? |
| Layout | Ada grid system? Ada breakpoint strategy? |
| Warna | Ada psikologi warna? Ada semantic colors? WCAG check? |
| Copywriting | Ada voice guide? Ada capitalization rule? |
| Motion | Ada duration standards? Ada easing yang named? |
| Komponen | Ada states? Ada variants? Ada component snapshots? |
| Medium Awareness | Ada desktop + mobile considerations? |
| Constraint | Ada minimal 3 hard constraints dengan alasan? |
| Anti-Pattern | Ada minimal 3 hal yang explicitly dilarang? |

---

## DNA Diff (sebelum Absorb)

Sebelum eksekusi absorb, AI tampilkan diff yang jelas per aspek.
User approve per-aspek, bukan all-or-nothing.

Format diff:
```
ASPEK: Tipografi
  SEKARANG : Bebas Neue (display) + Barlow Condensed (body) + DM Mono (data)
  DARI REF  : Inter (display + body) + JetBrains Mono (data)
  REKOMENDASI: Tidak adopt — DNA A punya 3-role system yang lebih kuat.
  KEPUTUSAN : [Adopt] [Skip]

ASPEK: Motion Easing  
  SEKARANG : cubic-bezier(0.16, 1, 0.3, 1) — custom
  DARI REF  : spring(1, 0.9, 0.5) — lebih organic
  REKOMENDASI: Bisa ditambahkan sebagai --ease-spring untuk micro-interactions.
  KEPUTUSAN : [Adopt] [Skip]

ASPEK: Identity
  SEKARANG : military, precision, premium
  DARI REF  : minimal, clean, editorial
  REKOMENDASI: SKIP OTOMATIS — identity tidak boleh berubah karena absorb.
  KEPUTUSAN : [Locked — tidak bisa diubah]
```

---

## DNA Decay Detection

Kalau codebase sudah banyak diupdate tapi DNA tidak pernah di-update — DNA itu stale.

AI bisa deteksi ini dengan compare DNA vs kode aktual:
- Token di DNA sudah tidak ada di codebase → DNA outdated
- Komponen snapshot di DNA sudah berbeda dari implementasi aktual → DNA outdated
- DNA punya constraint yang sudah dilanggar di codebase → perlu reconcile

Trigger: saat AI load DNA untuk BUILD atau REPAIR, AI quick-check inkonsistensi.
Kalau ada → flag ke user: "DNA Fought terakhir diupdate 3 bulan lalu, ada 4 inkonsistensi. Mau sync dulu?"

---

## 11 Aspek Design (Checklist Wajib)

> DNA yang belum menjawab semua aspek ini dianggap belum selesai.

### Aspek 1 — Identity & Persona Produk
Sebelum warna, font, atau spacing — siapa produk ini?
- Tone: formal / playful / technical / premium / minimal
- Emosi yang ingin ditimbulkan: percaya / excited / calm / focused / powerful
- Siapa consumernya: developer, akuntan, creative, enterprise, mass market
- Konteks pemakaian: kerja (fokus, efisiensi), santai (exploration), darurat (kecepatan)

DNA harus encode **why** bukan hanya **what**.
"Merah karena authority untuk user yang butuh confidence saat kerja dengan data pajak."
Bukan "merah karena keren."

### Aspek 2 — Token System (Bahasa Visual)
- Warna: semantik, bukan literal. `--red` = authority
- Spacing: skala konsisten — 4px atau 8px base
- Radius: keputusan karakter (0px = tegas, 999px = friendly)
- Shadow: kedalaman bukan dekorasi
- Border: weight dan opacity sebagai sinyal
- Easing: named custom curves, bukan `ease-in-out` generik

Referensi internal: `visual-design-foundations/references/color-systems.md`
→ Two-tier token system (primitive → semantic) bisa jadi acuan struktur token DNA

### Aspek 3 — Tipografi sebagai Hierarki Kognitif
- Berapa font roles: display / body / mono / accent — max 2 family
- Skala ukuran: clamp() untuk responsif atau fixed
- Letter-spacing: tight = premium/modern, loose = airy/editorial
- Line-height: reading comfort vs display impact
- Weight strategy: max 4 weight per family

Referensi internal: `visual-design-foundations/references/typography-systems.md`
→ Modular scale, fluid typography dengan clamp(), font pairing guidelines ada di sini

### Aspek 4 — Layout & Struktur
- Grid system: column-based, area-based, atau free
- Breakpoints: berapa dan di mana (setidaknya mobile 768px dan desktop)
- Container max-width dan padding strategy
- Density: compact vs spacious — ini juga sinyal persona
- Hierarki visual: apa yang harus dilihat pertama, kedua, ketiga

### Aspek 5 — Warna & Kombinasi Warna (+ Psikologi)
- Psikologi warna: apa yang dikomunikasikan ke consumer target
- Primary / secondary / accent / neutral system
- Dark vs light mode (apakah perlu keduanya)
- Contrast accessibility: WCAG AA minimum (4.5:1 body, 3:1 large text)
- Warna semantik: success, warning, error, info — konsisten dengan palette utama

Referensi internal: `visual-design-foundations/references/color-systems.md`
→ WCAG contrast checker code, OKLCH color generation, color harmony functions ada di sini

### Aspek 6 — Copywriting & Voice
- Tone of voice: formal/informal, first/second person
- Capitalization style: ALL CAPS label, Title Case heading?
- Label conventions: konsisten di seluruh UI
- Microcopy: error messages, empty states, loading states, CTA

### Aspek 7 — Motion & Interaksi
- Kapan animasi menambah nilai vs jadi noise
- Duration standards: micro (100-200ms), macro (300-600ms), page (400-800ms)
- Easing philosophy: spring / ease-out / custom cubic
- Interaction feedback: hover, active, focus, disabled — semua harus punya response

### Aspek 8 — Komponen sebagai Kontrak Visual
- States: default / hover / active / disabled / loading / error
- Variants: size (sm/md/lg), style (primary/ghost/destructive)
- Component snapshots: exact CSS tersimpan di DNA → output lebih akurat saat BUILD

### Aspek 9 — Medium Awareness
Scope saat ini: web only (desktop + mobile)
- Desktop: hover states ada, pointer precision tinggi, layout lebar
- Mobile: touch targets min 44px (WCAG), no hover, thumb-friendly zones
- DNA encode keputusan untuk kedua medium

### Aspek 10 — Constraint sebagai Identitas
Bukan batasan — ini tanda tangan desain.
DNA harus punya minimal 3 hard constraints dengan alasannya.
Contoh Fought: border-radius max 3px ("sharp = tegas"), border 0.5px ("detail yang hanya terlihat kalau perhatikan"), cursor: none ("total control experience").
**Kalau tidak ada constraint, DNA belum selesai.**

### Aspek 11 — Anti-Pattern (Apa yang Harus Dihindari)
DNA harus punya minimal 3 hal yang explicitly dilarang untuk desain ini:
- Over-engineering: terlalu banyak shadow layer
- Terlalu banyak warna accent: > 2-3 biasanya noise
- Font kebanyakan: max 2 family, max 4 weight
- Spacing tidak konsisten: campur nilai di luar skala
- Motion berlebihan: kalau semua bergerak, tidak ada yang special

---

## DNA Storage System

### Format DNA Object
```json
{
  "name": "fought-dark-precision",
  "version": "1.2",
  "created": "2026-06-01",
  "updated": "2026-06-01",
  "source": "internal/codebase",
  "description": "Military-grade dark UI untuk professional tool. Merah = authority/action, gold = premium/success. Tegas, presisi, sinematik. Target: akuntan pajak yang butuh confidence saat kerja.",
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
        "success": "--secondary (gold) — karena gold = premium = sesuatu yang berharga tercapai",
        "error": "--primary-bright (bright red) — lebih vibrant untuk urgensi"
      }
    },
    "spacing": {
      "base": "8px",
      "scale": [4, 8, 16, 24, 32, 48, 64, 96, 120]
    },
    "radius": {
      "max": "3px",
      "values": {"none": "0px", "sm": "1px", "md": "2px", "lg": "3px"},
      "why": "Sharp edges = tegas, tidak main-main. Radius besar = playful, tidak cocok"
    },
    "border": {
      "weight": "0.5px",
      "why": "Sub-pixel border = detail yang hanya terlihat kalau user memperhatikan = sinyal kualitas"
    },
    "easing": {
      "default": "cubic-bezier(0.16, 1, 0.3, 1)",
      "snappy": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      "soft": "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
    }
  },

  "typography": {
    "families": ["Bebas Neue", "Barlow Condensed", "DM Mono"],
    "roles": {
      "display": {"family": "Bebas Neue", "usage": "Hero, H1-H4, semua heading — UPPERCASE"},
      "body": {"family": "Barlow Condensed", "usage": "Paragraf, label, nav, button"},
      "data": {"family": "DM Mono", "usage": "Angka, kode, badge, status, section number"}
    },
    "constraints": [
      "Semua heading UPPERCASE",
      "Max 2 font family (Barlow + DM Mono untuk non-display), display = Bebas",
      "Letter-spacing body: 0.06em",
      "Section numbers: DM Mono 9px, letter-spacing 0.32em"
    ]
  },

  "motion": {
    "durations": {"micro": "200ms", "macro": "350ms", "page": "600ms"},
    "philosophy": "Motion harus intentional. Tidak semua elemen bergerak — hanya yang perlu komunikasikan state change.",
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
    "Jangan pakai font selain 3 yang sudah ditetapkan",
    "Jangan shadow terlalu tebal — max 2 layer shadow",
    "Jangan buat semua elemen animate — pilih yang butuh communicate state"
  ],

  "components": {
    "button_primary": "padding: 11px 20px | bg: rgba(red,0.1) | border: 0.5px rgba(red,0.38) | hover: rgba(red,0.22) + glow + translateY(-1.5px) | shine animation on hover",
    "button_ghost": "padding: 10px 18px | bg: transparent | border: 0.5px muted | hover: translateX(-2px)",
    "card": "bg: rgba(10,10,18,0.55) | border-top: 0.5px border-b (brighter) | backdrop-filter: blur(24px) | hover: translateY(-3px) | ::after top gradient line",
    "badge_active": "gold border 0.5px | gold dot with glow",
    "badge_error": "red border 0.5px | red dot with glow",
    "badge_pending": "muted border 0.5px | muted dot"
  },

  "notes": "DNA extracted dari Fought vps-deploy/next. Background canvas (useRedSlashBg) bukan bagian DNA komponen — dia layer environment terpisah. DNA ini untuk komponen, layout, dan token."
}
```

### DNA Versioning
- Setiap update → versi naik: `1.0 → 1.1 → 1.2`
- Semua versi lama disimpan di storage dengan key `dna:[name]:v[version]`
- Key `dna:[name]` selalu pointing ke versi terbaru
- `dna:index` menyimpan list dengan versi terbaru per DNA

### Storage Keys
- `dna:[name]` → DNA terbaru (full object, JSON string)
- `dna:[name]:v[version]` → versi spesifik (untuk rollback)
- `dna:index` → `[{ name, description, version, updated, health_score }]`

### Naming Convention
- Project sendiri: `[project]-[theme]` → `fought-dark`, `smart-tax-light`
- Referensi luar: tidak disimpan (dibuang setelah absorb)
- Setelah absorb: nama tetap, versi naik

---

## Decision Tree Lengkap

```
User input
  │
  ├─ "extract DNA" / "website ini bagus" / "simpan design ini"
  │    → Mode EXTRACT DNA → simpan ke storage
  │
  ├─ "buatkan UI" / "buat komponen" / "buat halaman"
  │    → Cek dna:index
  │    ├─ Ada match → load DNA → BUILD FROM DNA
  │    ├─ Ada 2+ match → tanya user mana yang dipakai
  │    └─ Tidak ada match → Entry Point A → extract dulu → BUILD FROM DNA
  │
  ├─ "perbaiki" / "upgrade" / "ini jelek" / "fix design"
  │    → Mode REPAIR WITH DNA
  │    → Extract DNA dari context → analisis → propose luas → approve → update DNA → edit UI
  │
  ├─ "audit DNA" / "evaluasi design" / "health check"
  │    → Mode AUDIT DNA → hitung Health Score → laporan → propose update
  │
  └─ "upgrade DNA dengan" / "serap dari" / "absorb referensi ini"
       → Mode ABSORB DNA
       → Extract DNA resesif → DNA Diff per aspek → approve → update DNA A (versi naik)
```

---

## Referensi Internal yang Relevan di Archives

| Skill Archive | Apa yang bisa dipinjam |
|---------------|------------------------|
| `visual-design-foundations/` | Color systems (two-tier token), typography scale, WCAG checker code |
| `visual-design-foundations/references/color-systems.md` | OKLCH generation, harmony functions, color blindness matrix |
| `visual-design-foundations/references/typography-systems.md` | Modular scale, fluid type dengan clamp(), font pairing, OpenType features |
| `visual-design-foundations/references/spacing-iconography.md` | Spacing system, icon sizing |
| `ui-ux-pro-max/` | UI/UX reasoning data, design heuristics CSV |
| `ui-ux-pro-max/assets/data/colors.csv` | Color reference data |
| `ui-ux-pro-max/assets/data/typography.csv` | Typography reference |
| `web-shader-extractor/` | Pattern cara extract dari source kompleks (fetch DOM → parse → extract) |

---

## Open Questions (Masih Perlu Diputuskan)

- [ ] Kalau user minta buat UI dan ada 2+ DNA yang match — tanya user atau pakai yang paling recent?
- [ ] DNA Decay: apakah deteksi ini jalan otomatis setiap load, atau hanya saat user minta audit?
- [ ] Health Score: apakah ditampilkan ke user setiap kali DNA di-update, atau hanya saat audit?
- [ ] Absorb: DNA resesif langsung discard setelah selesai, atau di-archive sementara sebagai `ref-*`?
- [ ] Apakah ada batas max DNA di storage, atau bebas?
- [ ] Rollback: apakah user bisa bilang "kembalikan DNA ke versi 1.0" dan AI langsung eksekusi?
