---
name: Group barcode scan bug — already fixed
description: User reported scanning a "grup" barcode (multiple packages under one customer) at /admin/scan only added 1 of N packages. Verified fixed in current code.
---

## Verified state (2026-07-15)
Backend `GET /api/packages/scan/:barcode` in `artifacts/api-server/src/routes/packages.ts` detects the
`JAJ-GRUP-<id1>-<id2>-...` prefix, looks up all member packages by id, and returns them under
`packages: [...]` with `group: true`. Tested directly via curl with a 2-package group — both packages
returned correctly.

Frontend `artifacts/jastip/src/pages/admin/scan.tsx` `lookupAndAdd()` checks `data.group && Array.isArray(data.packages)`
and loops `addPackageItem()` over every member, adding all non-duplicate/non-delivered packages to the scan list.
This logic is correct and was confirmed by code review + live API test.

## If the user reports this bug again
Ask whether they tested on the Replit dev preview or on their own VPS deployment (see `scan-antispam.md` —
user runs their own VPS and must manually redeploy code changes). A report against the VPS most likely means
the VPS is running stale code, not that there's a new regression. Re-verify with a live scan test (create 2
packages for the same customer, build `JAJ-GRUP-<id1>-<id2>`, hit `/api/packages/scan/:barcode`) before assuming
new code changes are needed.
