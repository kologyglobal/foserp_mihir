/**
 * FOS ERP — Purchase document print/PDF format (locked).
 *
 * Paper size is always A4. Users cannot change size.
 * Orientation is fixed per document type (not user-selectable on print).
 */

export type PurchasePrintPaperSizeLocked = 'A4'
export type PurchasePrintOrientationLocked = 'portrait' | 'landscape'

/** ISO A4 in millimetres. */
export const PURCHASE_PDF_A4_MM = {
  width: 210,
  height: 297,
} as const

export type PurchasePrintDocumentKind =
  | 'purchase_requisition'
  | 'request_for_quotation'
  | 'purchase_order'
  | 'goods_receipt_note'
  | 'purchase_invoice'
  | 'purchase_return'
  | 'quality_inspection'
  | 'generic'

/**
 * Document-type orientation matrix (industry practice for manufacturing ERP).
 * GRN / wide tabular docs → landscape; transactional docs → portrait.
 */
export const PURCHASE_PRINT_ORIENTATION: Record<
  PurchasePrintDocumentKind,
  PurchasePrintOrientationLocked
> = {
  purchase_requisition: 'portrait',
  request_for_quotation: 'portrait',
  purchase_order: 'portrait',
  goods_receipt_note: 'landscape',
  purchase_invoice: 'portrait',
  purchase_return: 'portrait',
  quality_inspection: 'portrait',
  generic: 'portrait',
}

export function purchasePrintOrientation(
  kind: PurchasePrintDocumentKind,
): PurchasePrintOrientationLocked {
  return PURCHASE_PRINT_ORIENTATION[kind] ?? 'portrait'
}

export function purchasePdfPageSizeMm(orientation: PurchasePrintOrientationLocked): {
  width: number
  height: number
} {
  if (orientation === 'landscape') {
    return { width: PURCHASE_PDF_A4_MM.height, height: PURCHASE_PDF_A4_MM.width }
  }
  return { width: PURCHASE_PDF_A4_MM.width, height: PURCHASE_PDF_A4_MM.height }
}

/** Human-readable lock note for Setup / toolbar. */
export const PURCHASE_PDF_SIZE_LOCK_NOTE =
  'All purchase documents print on fixed A4. Size cannot be changed. Orientation is set by document type (e.g. GRN landscape).'
