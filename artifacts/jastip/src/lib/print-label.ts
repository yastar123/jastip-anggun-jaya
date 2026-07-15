// Shared thermal label print builder.
//
// The physical printer used in the shop is a 100mm x 150mm thermal label
// printer. Every barcode/QR label print (single, grouped-by-customer, and
// batch "print all") must target exactly this page size and fill it fully —
// not shrink into a corner (as happens when sized for A4) and not overflow
// off the stock (as happens when sized larger than the label).
//
// This module is the single source of truth for that layout so the four
// print call sites (barcode.tsx, barcode-batch-detail.tsx,
// barcode-group-detail.tsx, packages-detail.tsx) stay in sync.

export const LABEL_WIDTH_MM = 100;
export const LABEL_HEIGHT_MM = 150;

export const LABEL_STYLES = `
  @page { size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; }
  .label {
    width: ${LABEL_WIDTH_MM}mm; height: ${LABEL_HEIGHT_MM}mm;
    display: flex; flex-direction: column; overflow: hidden;
    page-break-after: always; break-after: page;
  }
  .label:last-child { page-break-after: avoid; break-after: avoid; }
  .header { background: #cc0000; color: #fff; padding: 4mm 5mm 3mm; flex-shrink: 0; }
  .h-title { font-size: 15pt; font-weight: 900; letter-spacing: 0.6px; line-height: 1.1; }
  .h-sub { font-size: 5.5pt; opacity: 0.9; margin-top: 1mm; }
  .qr-section {
    flex-shrink: 0; display: flex; flex-direction: column; align-items: center;
    padding: 4mm 4mm 3mm; border-bottom: 0.5px solid #eee;
  }
  .scan-label {
    background: #cc0000; color: #fff; font-size: 7pt; font-weight: 900;
    padding: 1.2mm 4mm; border-radius: 2px; letter-spacing: 0.5px; margin-bottom: 3mm;
  }
  .qr-img { width: 42mm; height: 42mm; display: block; }
  .qr-txt {
    font-size: 5pt; color: #888; font-family: monospace; text-align: center;
    margin-top: 2mm; word-break: break-all; max-width: 80mm; line-height: 1.2;
  }
  .info { flex: 1; padding: 3.5mm 5mm; overflow: hidden; display: flex; flex-direction: column; justify-content: center; }
  .cust {
    font-size: 15pt; font-weight: 900; color: #111; margin-bottom: 3mm; text-align: center;
    border-bottom: 0.5px solid #eee; padding-bottom: 2mm; line-height: 1.15;
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 4mm; }
  .field { display: flex; flex-direction: column; gap: 0.6mm; }
  .fl { font-size: 6pt; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.4px; }
  .fv { font-size: 9.5pt; font-weight: 700; color: #222; line-height: 1.2; }
  .fv.mono { font-family: monospace; font-size: 9pt; }
  .fv.red { color: #cc0000; font-size: 11pt; }
  .full { grid-column: 1 / -1; }
  .status { display: inline-block; padding: 0.8mm 2.5mm; border-radius: 3mm; font-size: 7.5pt; font-weight: 700; }
  .footer {
    border-top: 0.5px solid #eee; background: #f9f9f9; padding: 1.8mm 5mm;
    font-size: 5.5pt; color: #bbb; text-align: center; flex-shrink: 0;
  }
`;

export function labelHeaderHtml() {
  return `<div class="header">
    <div class="h-title">JASTIP ANGGUN JAYA</div>
    <div class="h-sub">Layanan Pengiriman Paket — Jakarta · Surabaya · Manokwari · Papua</div>
  </div>`;
}

export function labelFooterHtml() {
  return `<div class="footer">Jastip Anggun Jaya · +62 812-4500-8384 · Jln Merpati Sp 4 jlr 8 (Depan SMKN 4), Manokwari</div>`;
}

// Prefix used to encode a "grup" barcode — a single QR/barcode that stands
// for several packages belonging to the same customer (same trip). Scanning
// it (see admin/scan.tsx + POST /api/packages/scan/:barcode) must resolve
// and add ALL of the underlying packages, not just one of them.
export const GROUP_BARCODE_PREFIX = "JAJ-GRUP-";

/**
 * Builds the QR/barcode value for a set of packages. When there is more than
 * one package, encodes all of their ids into a single group barcode so a
 * single scan resolves every package in the group. A lone package keeps
 * using its own individual barcode/resi so single-package labels are
 * unaffected.
 */
export function groupQrValue(pkgs: { id: number; barcode?: string | null; resiNumber?: string | null }[]) {
  if (pkgs.length > 1) {
    return `${GROUP_BARCODE_PREFIX}${pkgs.map((p) => p.id).join("-")}`;
  }
  const first = pkgs[0];
  return first?.barcode || first?.resiNumber || first?.id?.toString() || "";
}

export function qrSectionHtml(qrDataUrl: string, qrValue: string) {
  return `<div class="qr-section">
    <div class="scan-label">SCAN RESI</div>
    <img class="qr-img" src="${qrDataUrl}" alt="QR" />
    <div class="qr-txt">${qrValue}</div>
  </div>`;
}

/** Wraps one label's body (qr section + info section) into a full page. */
export function labelPageHtml(innerHtml: string) {
  return `<div class="label">
    ${labelHeaderHtml()}
    ${innerHtml}
    ${labelFooterHtml()}
  </div>`;
}

/** Assembles the full printable HTML document from one or more label pages. */
export function labelDocumentHtml(title: string, pagesHtml: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>${LABEL_STYLES}</style>
</head>
<body>
  ${pagesHtml}
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`;
}
