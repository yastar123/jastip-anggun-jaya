---
name: Jastip JAJ project
description: Main working app details, conventions, and key decisions for the Jastip Anggun Jaya logistics platform.
---

# Jastip Anggun Jaya — Project Notes

## App location
- Frontend: `artifacts/jastip/` (port 5000)
- Backend API: `artifacts/api-server/` (port 8080)
- DB lib: `lib/db/` (Drizzle ORM, PostgreSQL)

## Auth
- Password hash: SHA256(password + "jaj_salt_2024")
- Demo accounts: Owner 081200000000/owner123, Admin 081200000001/admin123

## Database
- DATABASE_URL is set (PostgreSQL via Replit)
- Schema push: `pnpm --filter @workspace/db run push`
- After push, run: `npx tsx scripts/migrate-batch-legacy.ts` (seeds service_types, creates legacy batch, backfills existing packages)
- Demo seed: `pnpm --filter @workspace/scripts run seed-demo`

## Key schema decisions
- `packages` table has BOTH old fields (`status`, `verified`) and new fields (`statusVerifikasi`, `statusPengambilan`, `statusPembayaran`)
- The verify endpoint (`POST /packages/:id/verify`) updates BOTH `verified` AND `statusVerifikasi`
- Frontend code should use NEW fields: `statusVerifikasi`, `statusPengambilan`, `statusPembayaran`
- `batch_id` is FK to `batches` table; `service_type_id` is FK to `service_types` table
- Legacy batch (id=1) has statusBatch=ARSIP and covers all pre-batch data

## Grouping rule (critical)
Packages MUST be grouped by `customerName + serviceType + batchId` in ALL views:
- barcode.tsx: ✅ fixed (composite key)
- barcode-group-detail.tsx: ✅ fixed (filters by serviceType+batchId URL params)
- verify.tsx: ✅ fixed (PkgGroup has batchId, isMatch checks all three)
- scan.tsx: POS-style (per package), no grouping issue

## Lock rule
- `statusPengambilan = SUDAH_DIAMBIL` is PERMANENT. Backend enforces via atomic check.
- UI must NOT show "Kembalikan ke Pending" for already-delivered packages. (✅ fixed in scan.tsx)
- Backend `/tolak` endpoint uses atomic `ne(statusPengambilan, "SUDAH_DIAMBIL")` check.

## Batch rules
- Batch selector is required in Input Paket form and Import Excel (both validate before save)
- API: POST /packages requires batchId, rejects CLOSED/ARSIP batches
- "admin utama" role for susulan after CLOSED = Owner role (not a separate role)

**Why:** Architecture bug — grouping by name only caused cross-batch and cross-service data mixing. Composite key is the fix.
