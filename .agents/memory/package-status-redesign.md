---
name: Package status redesign
description: Status enum reduced to pending/diserahkan; customer role removed; packageMode added
---

## Rule
Package status enum is now only `["pending", "diserahkan"]`. All old references to `in_transit`, `ready`, `picked_up` must be updated.

**Why:** User requested simplification — packages are either waiting (pending) or handed over (diserahkan).

**How to apply:** When adding new status filters or stats, only use these two values. The `diserahkan` status is set via the `/api/packages/:id/serahkan` endpoint; `tolak` resets back to `pending`.

## Also changed
- Customer role is completely removed from frontend routes and login page (only admin/owner active)
- `packageMode` column added to packages table: "single" or "grup"
- Scan page has Serahkan and Tolak buttons (no more generic confirm)
- Barcode page has 2 tabs (1 Paket / Grup Paket) with pagination
- Label print opens full A4 window with package info grid
- Ongkir auto-calculated from bracket tables in packages-new.tsx
