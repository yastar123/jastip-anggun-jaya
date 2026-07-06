---
name: Batch pengiriman feature
description: Priority 1 batch implementation — DB schema, API, frontend, migration, lock guards
---

## What was built
New `batches` table + `service_types` table. Packages gained: `batchId` (FK), `serviceTypeId`, `statusVerifikasi` (BELUM/SUDAH), `statusPengambilan` (BELUM_DIAMBIL/SUDAH_DIAMBIL), `statusPembayaran` (BELUM_DIBAYAR/DP/SUDAH_DIBAYAR). Legacy `status`/`verified` kept for backward compat.

## Key rules
- **batchId is required** for new packages via API; migration created a legacy ARSIP batch for pre-existing rows.
- **Lock gate**: once `statusPengambilan = SUDAH_DIAMBIL`, all PATCH and tolak requests are rejected. Only customerName-only PATCH is exempt (used by grup input flow).
- **Atomic tolak lock**: uses `UPDATE ... WHERE ... AND ne(statusPengambilan, SUDAH_DIAMBIL)` — not a separate SELECT first.
- **serahkan** updates both `status=diserahkan` AND `statusPengambilan=SUDAH_DIAMBIL`.
- **verify** updates both `verified=sudah_diverifikasi` AND `statusVerifikasi=SUDAH_DIVERIFIKASI`.
- **scan** checks `statusPengambilan === SUDAH_DIAMBIL || status === diserahkan`.

## Migration
`scripts/migrate-batch-legacy.ts` — run with `npx tsx scripts/migrate-batch-legacy.ts`. Seeds service_types, creates legacy ARSIP batch id=1, backfills all package FK columns. Already run successfully.

## Frontend
- New page: `artifacts/jastip/src/pages/admin/batches.tsx` — shared by admin + owner via `/admin/batches` and `/owner/batches`.
- Batch selector card in packages-new.tsx and packages-import.tsx; persists last selection in `localStorage("jaj_last_batch_id")`.
- Auto-selects first OPEN batch if stored selection is gone.

**Why:** Packages grouped only by customerName caused contamination across service types and shipping periods. Batch scopes all queries and enforces period isolation.
