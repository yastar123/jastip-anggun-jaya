---
name: Thermal label printing convention
description: Standard for all barcode/label print HTML builders in the Jastip app — 100mm x 50mm, not A4 or 100x100.
---

All package/barcode label print functions in `artifacts/jastip/src/pages/admin/barcode.tsx` and
`barcode-batch-detail.tsx` must target a **100mm x 50mm thermal label** (`@page { size: 100mm 50mm; margin: 0; }`),
not A4 and not a square 100x100mm label.

**Why:** the physical printer is a 100x50mm thermal label printer. Sizing for A4 caused printed labels to
render tiny/shrunk into a corner of an A4-sized page; sizing for 100x100 overflowed the actual 50mm-tall stock.

**How to apply:**
- Layout pattern: red header bar (brand name + tagline) → body row (QR code in a ~20mm-wide left column, package/customer
  info in a right-side 2-col grid) → thin footer bar. Fonts are in `pt`/`mm` units sized to fit within 50mm height, not `px`.
- Per-customer/group and batch "print all" labels **cannot** fit an itemized per-package table in 50mm of height — they
  were redesigned to show only aggregate fields (customer, totals, batch tag), matching the single-label design, with
  the itemized detail left to the in-app UI instead of the printout.
- There are currently 4 near-duplicate inline HTML/CSS builders implementing this same layout (single, grouped x2,
  batch-print x2) — see the tracked follow-up task about consolidating them into one shared template before adding new
  fields, or updates will drift.
