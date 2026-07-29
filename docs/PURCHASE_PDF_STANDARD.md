# Purchase PDF document standardization

## Locked rules

- **Paper size:** A4 only (`210 × 297 mm`). Users cannot change size.
- **Orientation:** fixed **per document type** (not selectable on print):

| Document | Orientation |
|----------|-------------|
| Purchase Requisition | Portrait |
| RFQ | Portrait |
| Purchase Order | Portrait |
| Purchase Invoice | Portrait |
| Purchase Return | Portrait |
| Quality Inspection | Portrait |
| **GRN** | **Landscape** |

- Multi-page: same A4 page; table continues across pages (jsPDF slices canvas).
- Margins: ~10–12 mm.
- Branding: shared `PurchaseDocumentLetterhead` (Vasant Fabricators).

## Implementation

| Piece | Role |
|-------|------|
| `frontend/src/utils/purchasePrintFormat.ts` | A4 constants + orientation matrix |
| `frontend/src/utils/documentPdfDownload.ts` | jsPDF `format: 'a4'` + orientation |
| `frontend/src/utils/purchaseDocumentPdfExport.ts` | Injects `@page { size: A4 … }` for browser Print |
| `frontend/src/components/print/DocumentPrintShell.tsx` | Passes `documentKind`; shows “A4 Portrait/Landscape (fixed)” |
| Purchase Setup → Print | Paper size / orientation controls are **read-only locked** |

## Do not

- Offer Letter / Legal / custom sizes in Setup or print UI.
- Let end users pick orientation on the print toolbar.
- Generate different paper sizes per user — filing and vendor packs must stay consistent.
