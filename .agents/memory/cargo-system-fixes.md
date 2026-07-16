---
name: Cargo system fixes
description: Rules and logic changes for Jastip Cargo service — barcode, pricing, import, batch delete, export
---

## Rules for Jastip Cargo (jastip kargo)

### 1. No group barcode for Cargo
- `packages-type.tsx`: Cargo card shows only "Input Paket Kargo" button (no "Grup Paket")
- `packages-import.tsx`: kargo imports use `packageMode: "single"` → each package gets its own barcode
- `packages-new.tsx`: grup mode not offered when serviceType = "jastip kargo"

### 2. Ongkir Cargo = direct input, NOT berat × tarif
- `packages-new.tsx`: replaced "Harga Kubikasi × M³/Ton" calculation with a direct `totalShipping` input field
- The `useEffect` for kargo now returns early after setting volumeWeight/usedWeight — does NOT set shippingRate/totalShipping
- Schema validation: for kargo, `totalShipping > 0` is required; `realWeight` is optional
- `packages-import.tsx`: kargo uses "Ongkir Paket" column directly as `totalShipping`; `kargoRate` column removed from calculation

### 3. Berat tidak wajib untuk Cargo
- Schema: `realWeight` changed from `.min(0.001)` to `.optional().nullable()`
- superRefine: realWeight required only for non-kargo services
- Kargo form label changed to "M³ / Ton (Berat Aktual) (Opsional)"

### 4. Bug fix: Pakai (m3) 0.01 terbaca 10
- Root cause: `Math.max(10, rawUsed)` was applied to `usedWeight` storage — so 0.01 became 10
- Fix: `usedWeight` now stores actual max(realWeight, volumeWeight) without the minimum-10 floor
- The `Math.max(10, ...)` billing floor is now REMOVED for cargo entirely since pricing is direct input

### 5. Kargo import template
- New columns: "Ukuran Barang", "Pakai (m3)", "Ongkir Paket" (required)
- Removed: "Harga Kubikasi" as a multiplier
- "Berat Real (Ton)" is now optional (not required)
- `num()` function normalizes comma → dot for decimal parsing (fix for Indonesian locale Excel)
- `pakaiM3` column: if provided, used directly as volumeWeight (avoids recalculation bugs)

### 6. Hapus Batch (soft delete)
- `batches.tsx`: "Hapus Batch" button added to OPEN and CLOSED batch cards (red color)
- Confirmation dialog warns user: data stays in DB, batch hidden from active view
- API: PATCH statusBatch to "HAPUS"
- `batches.ts` API: GET /api/batches now filters out statusBatch="HAPUS" by default

### 7. Export Cargo PDF
- `packages.tsx`: new `exportPdfKargo()` function for Jastip Kargo export
- Columns: No, Nama Konsumen, Tgl Masuk, No Resi/Kurir, No Paket, Jenis Barang, Ukuran (cm), Pakai (M³), Ongkir Paket, Status
- NO weight columns (berat real, berat volume, tarif/kg) — as per requirement
- Orange header color (matching Cargo brand color)
- Shows total ongkir keseluruhan at bottom

**Why:**
User reported multiple Cargo-specific bugs: wrong barcode grouping, wrong price calculation (weight×7000 instead of direct input), m3 display bug, and missing delete batch feature.
