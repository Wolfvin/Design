# Regression Testing Guide — `fought/extension_source`

> **Tujuan dokumen ini:** Panduan bagi AI agent yang akan melakukan refactoring di `fought/extension_source`. Sebelum menyentuh kode apapun, buat regression test terlebih dahulu. Setelah refactor, semua test harus tetap hijau. Jika ada yang merah, lacak dan perbaiki sebelum push.

---

## Daftar Isi

1. [Filosofi Regression Test](#1-filosofi-regression-test)
2. [Jebakan Umum yang Membuat Test Tidak Valid](#2-jebakan-umum-yang-membuat-test-tidak-valid)
3. [Struktur Test yang Sudah Ada](#3-struktur-test-yang-sudah-ada)
4. [Cara Menulis Regression Test yang Benar](#4-cara-menulis-regression-test-yang-benar)
5. [Coverage per Modul — Apa yang Harus Ditest](#5-coverage-per-modul--apa-yang-harus-ditest)
6. [Checklist Sebelum Refactor](#6-checklist-sebelum-refactor)
7. [Workflow Lengkap](#7-workflow-lengkap)
8. [Menjalankan Test](#8-menjalankan-test)

---

## 1. Filosofi Regression Test

Regression test bukan untuk membuktikan kode kamu bagus. Tujuannya satu: **memastikan behavior sekarang tidak berubah setelah refactor**.

```
SEBELUM refactor → tulis test → pastikan HIJAU
SETELAH refactor → jalankan test → jika MERAH → lacak → perbaiki → test hijau lagi → baru push
```

**Aturan emas:**
- Test harus merepresentasikan **kontrak output** dari fungsi, bukan implementasinya.
- Kalau kamu refactor implementasi tapi output sama → test tetap hijau ✅
- Kalau output berubah karena refactor → test merah ❌ → kamu harus investigate, bukan ubah testnya

---

## 2. Jebakan Umum yang Membuat Test Tidak Valid

Ini adalah kesalahan yang paling sering dilakukan AI saat menulis regression test. **Baca ini baik-baik.**

### ❌ Jebakan 1 — Test terlalu longgar (false positive)

```typescript
// SALAH: test ini selalu hijau bahkan kalau fungsinya rusak
it("should return a filename", () => {
  const result = generateDynamicFilename(exportData);
  expect(typeof result).toBe("string"); // string apapun lolos
});
```

```typescript
// BENAR: test ini konkret dan akan merah kalau format berubah
it("should return filename with correct prefix and date format", () => {
  const result = generateDynamicFilename(exportData);
  expect(result).toMatch(/^FK_\d{2}-\d{4}_.+\.csv$/);
  expect(result).toContain("PT_MAJU");
});
```

### ❌ Jebakan 2 — Mock yang terlalu agresif (test tidak mencerminkan realita)

```typescript
// SALAH: mock menggantikan fungsi yang sedang ditest, bukan dependency-nya
vi.mock("../exporter.js", () => ({
  generateDynamicFilename: () => "FK_01-2025_test.csv", // ini bukan test, ini hardcode
}));
```

```typescript
// BENAR: hanya mock dependency eksternal (chrome API, fetch, storage)
vi.mock("../google-auth.js", () => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  authFetch: vi.fn(),
}));
// fungsi yang ditest sendiri TIDAK dimock
```

### ❌ Jebakan 3 — Snapshot test tanpa validasi semantik

```typescript
// BAHAYA: snapshot test bisa lolos meski output salah secara logika
expect(result).toMatchSnapshot(); // kalau snapshot-nya sendiri salah, test tetap hijau
```

Gunakan snapshot **hanya** untuk output yang besar (seperti seluruh CSV row) dan **selalu** kombinasikan dengan assertion semantik.

### ❌ Jebakan 4 — Test yang bergantung pada urutan eksekusi

```typescript
// SALAH: test B bergantung pada state yang dibuat test A
it("test A", () => { saveSubscription("tok", 9999); });
it("test B", () => { expect(getSubscriptionData()).not.toBeNull(); }); // gagal kalau A dilewati
```

Setiap test harus **independen** — setup state sendiri di `beforeEach`.

### ❌ Jebakan 5 — Tidak test edge case yang biasa rusak saat refactor

Refactor sering merusak:
- Input kosong / null / undefined
- String dengan karakter aneh (`/`, `\`, `<`, `>`, `"`)
- Angka negatif atau nol
- Array kosong
- Tanggal format tidak standar

**Selalu test edge case ini** untuk setiap fungsi.

---

## 3. Struktur Test yang Sudah Ada

### Regret-Based Testing (utama — plug-and-run)

```
fought/extension_source/regrets/
├── README.md                       ← dokumentasi regret system
├── manifest.json                   ← 22 cluster definitions
├── audit.log                       ← append-only history
├── format-date.regret              ← pure function fingerprints
├── format-date-time.regret
├── extract-month-year.regret
├── sanitize-filename.regret
├── sanitize-sheet-name.regret
├── sanitize-alphanumeric.regret
├── escape-csv.regret
├── format-period.regret
├── escape-html.regret
├── from-http-response.regret
├── from-unknown-error.regret
├── filename-from-hint.regret       ← filename strategy clusters
├── filename-from-data.regret
├── filename-fallback.regret
├── generate-dynamic-filename.regret
├── fought-error-retryable.regret   ← extracted pure logic clusters
├── fought-error-needs-reauth.regret
├── is-subscription-active.regret
├── sliding-window-check.regret
├── sliding-window-remaining.regret
└── calculate-countdown.regret
```

### Extracted Pure Logic Modules

```
fought/extension_source/ts/
├── subscription-logic.ts    ← isSubscriptionActive, isCompanyUser, hasFullAccess, checkRetryable, checkNeedsReauth
├── rate-limiter-logic.ts    ← checkSlidingWindow, remainingInWindow
└── payment-poller-logic.ts  ← calculateCountdown, parseExpiryString
```

### Vitest Tests (existing)

```
fought/extension_source/ts/
├── auto-renamer/__tests__/
│   ├── namer.unit.test.ts          ← generateWithholdingFilename, generateEInvoiceFilename
│   └── settings.unit.test.ts       ← settings read/write logic
├── xhr-mode/__tests__/
│   ├── bot-mode.unit.test.ts
│   ├── capture-mode.unit.test.ts
│   ├── csv.property.test.ts
│   ├── downloader.invalid.property.test.ts
│   ├── downloader.property.test.ts
│   ├── downloader.unit.test.ts     ← base64ToBlob
│   ├── exporter.property.test.ts   ← generateDynamicFilename property tests
│   ├── exporter.unit.test.ts       ← escapeCSV unit tests
│   ├── page-context.unit.test.ts
│   ├── postmessage.origin.test.ts
│   └── types.unit.test.ts
```

---

## 4. Cara Menulis Regression Test yang Benar

### 4.1 Pola dasar untuk fungsi pure (tidak ada side effect)

Ini adalah kasus paling mudah. Fungsi yang mengambil input dan mengembalikan output deterministik.

```typescript
// File: shared/__tests__/date-utils.regression.test.ts
import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, extractMonthYear } from "../date-utils.js";

describe("formatDate — regression", () => {
  // Test setiap format input yang diketahui dipakai di production
  it("converts ISO datetime to DD/MM/YYYY", () => {
    expect(formatDate("2025-01-15T00:00:00")).toBe("15/01/2025");
  });

  it("converts ISO date-only to DD/MM/YYYY", () => {
    expect(formatDate("2025-02-28")).toBe("28/02/2025");
  });

  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("returns input unchanged for unparseable string", () => {
    expect(formatDate("bukan-tanggal")).toBe("bukan-tanggal");
  });

  // Edge case: end of year
  it("handles December correctly", () => {
    expect(formatDate("2025-12-31T23:59:59")).toBe("31/12/2025");
  });
});
```

### 4.2 Pola untuk fungsi dengan dependency eksternal (chrome API, fetch)

Mock **hanya** dependency eksternal. Fungsi yang ditest sendiri jalan asli.

```typescript
// File: __tests__/subscription.regression.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock chrome.storage.local SEBELUM import modul
const storageMock: Record<string, unknown> = {};
vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: storageMock[key] })),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(storageMock, data);
      }),
      remove: vi.fn(async (key: string) => {
        delete storageMock[key];
      }),
    },
  },
});

// Mock google-auth dependency
vi.mock("../google-auth.js", () => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  getEmailId: vi.fn().mockResolvedValue("abc123"),
  authFetch: vi.fn(),
}));

// Mock api-config
vi.mock("../api-config.js", () => ({
  API_BASE_URL: "https://api.test.com/",
}));

import { isSubscribed, saveSubscription, clearSubscription } from "../subscription.js";

describe("isSubscribed — regression", () => {
  beforeEach(() => {
    // Reset storage sebelum setiap test
    Object.keys(storageMock).forEach(k => delete storageMock[k]);
  });

  it("returns false when storage is empty", async () => {
    expect(await isSubscribed()).toBe(false);
  });

  it("returns true for active non-expired subscription", async () => {
    await saveSubscription("sub_abc123", Date.now() + 86400_000); // +1 hari
    expect(await isSubscribed()).toBe(true);
  });

  it("returns false and clears storage for expired subscription", async () => {
    await saveSubscription("sub_expired", Date.now() - 1000); // sudah lewat
    expect(await isSubscribed()).toBe(false);
    // Verifikasi storage dibersihkan
    expect(await isSubscribed()).toBe(false);
  });
});
```

### 4.3 Pola untuk property-based test (invariant yang harus selalu terpenuhi)

Gunakan `fast-check` untuk test yang harus berlaku untuk input **apapun**.

```typescript
// File: shared/__tests__/filename-utils.property.test.ts
import { describe, it } from "vitest";
import fc from "fast-check";
import { sanitizeFilename } from "../filename-utils.js";

const ILLEGAL_CHARS = /[/\\?%*:|"<>]/;

describe("sanitizeFilename — property regression", () => {
  it("NEVER produces illegal filename characters regardless of input", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitizeFilename(input);
        // Invariant: hasil tidak boleh mengandung karakter illegal
        if (ILLEGAL_CHARS.test(result)) {
          throw new Error(`sanitizeFilename("${input}") returned "${result}" which contains illegal chars`);
        }
      }),
      { numRuns: 1000 } // jalankan 1000 kombinasi random
    );
  });

  it("ALWAYS preserves length equal-or-shorter than input (only replacing, not adding)", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitizeFilename(input);
        if (result.length > input.length) {
          throw new Error(`sanitizeFilename made string longer: "${input}" → "${result}"`);
        }
      }),
    );
  });
});
```

### 4.4 Pola untuk countdown/timer (fungsi dengan side effect waktu)

```typescript
// File: __tests__/payment-poller.regression.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startCountdown } from "../payment-poller.js";

describe("startCountdown — regression", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("updates element text with countdown format M:SS", () => {
    const el = document.createElement("span");
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 menit dari sekarang

    startCountdown({ expiredAt, countdownEl: el });
    vi.advanceTimersByTime(1000); // tick 1 detik

    // Format harus M:SS
    expect(el.textContent).toMatch(/^\d+:\d{2}$/);
    expect(el.textContent).toBe("4:59");
  });

  it("shows expired text when countdown reaches zero", () => {
    const el = document.createElement("span");
    const expiredAt = new Date(Date.now() + 2000).toISOString(); // 2 detik

    startCountdown({ expiredAt, countdownEl: el, expiredText: "QRIS expired" });
    vi.advanceTimersByTime(3000); // lewati expiry

    expect(el.textContent).toBe("QRIS expired");
  });

  it("returns cleanup function that stops timer", () => {
    const el = document.createElement("span");
    const expiredAt = new Date(Date.now() + 60_000).toISOString();

    const cleanup = startCountdown({ expiredAt, countdownEl: el });
    vi.advanceTimersByTime(1000);
    const textAfter1s = el.textContent;

    cleanup(); // stop timer
    vi.advanceTimersByTime(5000); // maju 5 detik lagi
    expect(el.textContent).toBe(textAfter1s); // text tidak berubah setelah cleanup
  });
});
```

---

## 5. Coverage per Modul — Status Regret

### Sudah Tercluster (22 clusters — semua SOLID)

| Modul | Fungsi | Cluster | Fingerprint |
|---|---|---|---|
| `shared/date-utils.ts` | `formatDate` | format-date | yju9g9g |
| `shared/date-utils.ts` | `formatDateTime` | format-date-time | 8oa45ft |
| `shared/date-utils.ts` | `extractMonthYear` | extract-month-year | 5ljcbov |
| `shared/filename-utils.ts` | `sanitizeFilename` | sanitize-filename | 3zk4yh3 |
| `shared/filename-utils.ts` | `sanitizeSheetName` | sanitize-sheet-name | 6b2pufc |
| `shared/filename-utils.ts` | `sanitizeToAlphanumeric` | sanitize-alphanumeric | 2mp7ls1 |
| `xhr-mode/exporter.ts` | `escapeCSV` | escape-csv | 4mcbm7s |
| `xhr-mode/exporter.ts` | `formatPeriod` | format-period | 12d5tvu |
| `xhr-mode/exporter.ts` | `filenameFromHint` | filename-from-hint | 32f1unk |
| `xhr-mode/exporter.ts` | `filenameFromData` | filename-from-data | 3bsw7j0 |
| `xhr-mode/exporter.ts` | `filenameFallback` | filename-fallback | 1d34f4w |
| `xhr-mode/exporter.ts` | `generateDynamicFilename` | generate-dynamic-filename | 4p6kjm4 |
| `shared/utils.ts` | `escapeHtml` | escape-html | 9ejfvis |
| `errors.ts` | `fromHttpResponse` | from-http-response | d3k1flx |
| `errors.ts` | `fromUnknown` | from-unknown-error | 2nd7ylr |
| `subscription-logic.ts` | `isSubscriptionActive` | is-subscription-active | wqs3ubz |
| `subscription-logic.ts` | `isCompanyUser` | is-company-user | — |
| `subscription-logic.ts` | `hasFullAccess` | has-full-access | — |
| `subscription-logic.ts` | `checkRetryable` | fought-error-retryable | 8kksgs8 |
| `subscription-logic.ts` | `checkNeedsReauth` | fought-error-needs-reauth | 4q3g0n4 |
| `rate-limiter-logic.ts` | `checkSlidingWindow` | sliding-window-check | 1dn8mf4 |
| `rate-limiter-logic.ts` | `remainingInWindow` | sliding-window-remaining | 5vetqyh |
| `payment-poller-logic.ts` | `calculateCountdown` | calculate-countdown | 4upje74 |

### Belum Tercluster (sulit — perlu mocking/CDP)

| Modul | Alasan |
|---|---|
| `sidepanel.ts` (2320 lines) | God object — perlu split dulu sebelum clustering |
| `background/*.ts` | Sangat bergantung pada `chrome.*` APIs |
| `content/*.ts` | Bergantung pada DOM Coretax yang spesifik |
| `google-auth.ts` | Network-dependent (OAuth flow) |

---

## 6. Checklist Sebelum Refactor

Lakukan ini **secara berurutan**, jangan ada yang dilewati.

```
[ ] 1. npm run regret:build (tsc only — preserves individual JS files)
[ ] 2. npm run regret:capture (capture semua cluster fingerprints)
[ ] 3. npm run regret:drift (5 runs — pastikan SEMUA STABLE)
[ ] 4. Jika ada DRIFT → tambah normalize rules ke manifest, re-capture
[ ] 5. npm run regret:health — pastikan semua SOLID
[ ] 6. Lakukan refactor
[ ] 7. npm run regret:build (rebuild tsc setelah refactor)
[ ] 8. npm run regret:validate — semua harus tetap HIJAU
[ ] 9. Jika ada yang MERAH:
       [ ] Baca fingerprint diff — lihat input/output mana yang berubah
       [ ] JANGAN edit .regret files — fix KODE
       [ ] Kalau behavior memang sengaja berubah → npm run regret:update -- <cluster> --reason "..."
[ ] 10. Semua hijau → npm run build → baru push
```

---

## 7. Workflow Lengkap (Regret-Based)

```bash
# 1. Masuk ke direktori
cd fought/extension_source

# 2. Build untuk regret testing (tsc only — preserves individual JS files)
npm run regret:build

# 3. Capture fingerprints (jika clusters baru ditambahkan ke manifest)
npm run regret:capture

# 4. Validate semua clusters — harus semua hijau
npm run regret:validate

# 5. Drift detection — 5 runs, semua STABLE
npm run regret:drift

# 6. Lakukan refactor

# 7. Rebuild tsc setelah refactor
npm run regret:build

# 8. Validate lagi — semua harus tetap hijau
npm run regret:validate

# 9. Kalau merah → fix KODE, jangan fix .regret

# 10. Kalau semua hijau, full build
npm run build

# 11. Commit
git add .
git commit -m "refactor(<modul>): <deskripsi>

- Regret clusters: 22/22 PASS+STABLE
- No behavior change in public API"
```

### Perintah Tambahan

```bash
# Health check — lihat cluster mana yang SOLID/GOOD/UNSTABLE/FRAGILE
npm run regret:health

# CI mode — fail-fast untuk pipeline
npm run regret:ci

# Pre-build guard — block build jika ada yang merah
npm run regret:guard

# Safe update — hanya jika behavior sengaja berubah
npm run regret:update -- <cluster-id> --reason "penjelasan spesifik kenapa berubah"
```

---

## 8. Menjalankan Test

### Regret Testing (primary)

```bash
# Build dulu (tsc only)
npm run regret:build

# Capture fingerprints
npm run regret:capture

# Validate semua cluster
npm run regret:validate

# Drift detection (5 runs)
npm run regret:drift

# Health report
npm run regret:health
```

### Vitest Unit Tests (secondary)

```bash
# Jalankan semua vitest test sekali
npm test

# Watch mode
npm run test:watch

# TypeScript check tanpa build
npm run check
```

---

## Catatan Penting untuk AI Agent

1. **Nama file test regression harus jelas**: gunakan suffix `.regression.test.ts` untuk membedakan dari test biasa yang sudah ada.
2. **Jangan hapus test yang sudah ada** — hanya tambah, jangan kurangi coverage.
3. **Import dengan `.js` extension** (bukan `.ts`) — ini adalah keharusan di project ini karena menggunakan ES modules. Contoh: `import { formatDate } from "../date-utils.js"`.
4. **Mock hanya apa yang perlu** — kalau fungsinya pure (tidak ada dependency eksternal), tidak perlu mock sama sekali.
5. **Setiap test harus bisa berjalan sendiri** — gunakan `beforeEach` untuk reset state.
6. **Jumlah test minimum per fungsi**: 1 happy path + 1 edge case (null/empty/undefined) + 1 format/boundary case.
7. **Jangan tulis test yang selalu hijau** — kalau ragu apakah test valid, sengaja ubah implementasi sedikit dan cek apakah test jadi merah. Kalau tetap hijau, test tidak valid.
