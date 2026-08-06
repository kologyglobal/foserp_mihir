/**
 * Pure helpers for PO compact line grid + quick manual entry.
 * No second tax engine — labels only mirror line snapshots + interstate flag.
 */

export type PoDiscountMode = 'pct' | 'flat'

export type PoCompactLineTaxLike = {
  gstRatePct?: number | null
  cgst?: number | null
  sgst?: number | null
  igst?: number | null
}

export type PoCompactHsnLike = {
  itemId?: string | null
  hsnId?: string | null
  hsnCode?: string | null
  sacCode?: string | null
  lineType?: 'GOODS' | 'SERVICE' | string | null
  itemType?: string | null
  itemName?: string | null
  itemCode?: string | null
  description?: string | null
}

export type PoDiscountLike = {
  discountPct?: number | null
  discountAmount?: number | null
}

/** User-facing GST column: `18% · CGST 9% + SGST 9%` or `18% · IGST 18%`. */
export function formatPoLineGstLabel(
  line: PoCompactLineTaxLike,
  isInterstate: boolean,
): string {
  const rate = Number(line.gstRatePct) || 0
  if (rate <= 0) return '—'
  if (isInterstate) {
    return `${rate}% · IGST ${rate}%`
  }
  const half = Number((rate / 2).toFixed(2))
  const halfLabel = Number.isInteger(half) ? String(half) : String(half)
  return `${rate}% · CGST ${halfLabel}% + SGST ${halfLabel}%`
}

export function resolvePoDiscountMode(line: PoDiscountLike): PoDiscountMode {
  if (Number(line.discountPct) > 0) return 'pct'
  if (Number(line.discountAmount) > 0) return 'flat'
  return 'pct'
}

/** Apply drawer discount mode into line patch fields. */
export function mapPoDiscountFields(
  mode: PoDiscountMode,
  value: number,
): { discountPct: number; discountAmount: number } {
  const n = Math.max(0, Number(value) || 0)
  if (mode === 'pct') {
    return { discountPct: n, discountAmount: 0 }
  }
  return { discountPct: 0, discountAmount: n }
}

export function formatPoDiscountDisplay(line: PoDiscountLike): string {
  const pct = Number(line.discountPct) || 0
  const amt = Number(line.discountAmount) || 0
  if (pct > 0) return `${pct}%`
  if (amt > 0) return String(amt)
  return '—'
}

export function isPoFreeTextLine(line: PoCompactHsnLike & { manualEntry?: boolean }): boolean {
  if (line.itemId) return false
  if (line.manualEntry) return true
  return Boolean(
    line.itemName?.trim() ||
      line.itemCode?.trim() ||
      line.description?.trim(),
  )
}

export function lineHasHsnSnapshot(line: PoCompactHsnLike): boolean {
  return Boolean(line.hsnId || line.hsnCode?.trim() || line.sacCode?.trim())
}

/** Payload slice for API create/update — free-text requires HSN code or id. */
export function mapPoLineHsnPersistPayload(line: PoCompactHsnLike): {
  hsnId: string | null
  hsnCode: string | null
} {
  const hsnId = line.hsnId?.trim() || null
  const code = (line.hsnCode?.trim() || line.sacCode?.trim() || '') || null
  return {
    hsnId: hsnId && hsnId.length > 0 ? hsnId : null,
    hsnCode: code,
  }
}

export function isPoServiceLine(line: PoCompactHsnLike): boolean {
  return (
    String(line.lineType ?? '').toUpperCase() === 'SERVICE' ||
    line.itemType === 'service'
  )
}

export function lineItemDescription(line: {
  itemCode?: string | null
  itemName?: string | null
  description?: string | null
}): string {
  const name = (line.itemName || line.description || '').trim()
  const code = (line.itemCode || '').trim()
  if (code && name) return `${code} — ${name}`
  return name || code || '—'
}

export type PoMoreDetailsVisibility = {
  showSpecification: boolean
  showExpectedDelivery: boolean
  showPrRef: boolean
  showWarehouse: boolean
  showGstGroup: boolean
  showQc: boolean
  showQualityTest: boolean
  showRemarks: boolean
  showAny: boolean
}

export function resolvePoMoreDetailsVisibility(line: {
  specification?: string | null
  expectedDeliveryDate?: string | null
  requiredDate?: string | null
  prLineId?: string | null
  requisitionNo?: string | null
  prSources?: unknown[] | null
  warehouseId?: string | null
  warehouseName?: string | null
  gstGroupId?: string | null
  gstGroupCode?: string | null
  qcRequired?: boolean | null
  qualityTestGroupCode?: string | null
  remarks?: string | null
  showPrAlways?: boolean
}): PoMoreDetailsVisibility {
  const showSpecification = Boolean(line.specification?.trim())
  const showExpectedDelivery = Boolean(
    (line.expectedDeliveryDate || line.requiredDate || '').trim(),
  )
  const showPrRef =
    Boolean(line.showPrAlways) ||
    Boolean(line.prLineId) ||
    Boolean(line.requisitionNo?.trim()) ||
    Boolean(line.prSources && line.prSources.length > 0)
  const showWarehouse = Boolean(line.warehouseId || line.warehouseName?.trim())
  const showGstGroup = Boolean(line.gstGroupId || line.gstGroupCode?.trim())
  const showQc = Boolean(line.qcRequired)
  const showQualityTest = Boolean(line.qualityTestGroupCode?.trim()) || showQc
  const showRemarks = Boolean(line.remarks?.trim())
  const showAny =
    showSpecification ||
    showExpectedDelivery ||
    showPrRef ||
    showWarehouse ||
    showGstGroup ||
    showQc ||
    showQualityTest ||
    showRemarks
  return {
    showSpecification,
    showExpectedDelivery,
    showPrRef,
    showWarehouse,
    showGstGroup,
    showQc,
    showQualityTest,
    showRemarks,
    showAny,
  }
}

/** Duplicate a line for editor state (new client key / blank ids). */
export function duplicatePoEditorLine<T extends { key: string; id: string; lineNo: number }>(
  line: T,
  nextLineNo: number,
  newKey: string = crypto.randomUUID(),
): T {
  return {
    ...line,
    key: newKey,
    id: '',
    lineNo: nextLineNo,
  }
}

export function lineShowsLifecycleMetrics(line: {
  receivedQty?: number | null
  receivedQtyBase?: number | null
  invoicedQty?: number | null
  outstandingQty?: number | null
  pendingQty?: number | null
}): boolean {
  return (
    (Number(line.receivedQty) || 0) > 0 ||
    (Number(line.receivedQtyBase) || 0) > 0 ||
    (Number(line.invoicedQty) || 0) > 0 ||
    (Number(line.outstandingQty) || 0) > 0 ||
    (Number(line.pendingQty) || 0) > 0
  )
}
