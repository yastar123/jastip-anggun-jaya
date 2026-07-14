---
name: Thermal label printing convention
description: Physical label size and shared print module for Jastip barcode/QR label printouts
---

The physical thermal printer used in the shop is **100mm × 150mm** (not 50mm or 100mm square, and not A4 — those were past mistakes). All barcode/QR label print HTML must target this exact page size and fill it (QR + info must not float in a corner or overflow).

All label print builders (single, grouped-by-customer, batch "print all", group "print all") share one module: `artifacts/jastip/src/lib/print-label.ts`, exposing `LABEL_WIDTH_MM`/`LABEL_HEIGHT_MM`, `LABEL_STYLES`, and helpers `qrSectionHtml()`, `labelPageHtml()`, `labelDocumentHtml()`. This replaced ~5 near-duplicate inline HTML/CSS builders previously spread across `barcode.tsx`, `barcode-batch-detail.tsx`, `barcode-group-detail.tsx`, and `packages-detail.tsx`.

**Why:** the builders had drifted to different, wrong page sizes over time (A4, 100×50mm, 100×100mm, 200×200mm) because each print call site duplicated its own markup/CSS instead of sharing one source of truth.

**How to apply:** any new label print flow should import from `print-label.ts` rather than writing inline HTML/CSS. `arsip-batch-detail.tsx`'s `buildGroupedArsipPrintHtml` is a different document type (A4 "archive report", not a thermal barcode label) and intentionally does not use this module.
