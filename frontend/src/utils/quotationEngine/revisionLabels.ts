/**
 * Internal revisionNo is 1-based (API + create): 1 = original document, 2 = first revise, …
 * Customer-facing labels start only after revise (R1, R2…). Original has no R suffix.
 * Legacy revision 0 is treated as original.
 */
export function quotationCustomerRevisionIndex(revisionNo: number): number {
  if (revisionNo == null || Number.isNaN(Number(revisionNo)) || revisionNo <= 1) return 0
  return revisionNo - 1
}

/** R1, R2… after first revise; empty string for the original quotation. */
export function quotationRevisionSuffix(revisionNo: number): string {
  const idx = quotationCustomerRevisionIndex(revisionNo)
  return idx === 0 ? '' : `R${idx}`
}

/** Original · R1 · R2… for UI chips and history. */
export function quotationRevisionLabel(revisionNo: number): string {
  const idx = quotationCustomerRevisionIndex(revisionNo)
  return idx === 0 ? 'Original' : `R${idx}`
}

/** QUO-000001 · R1 — base number only on original create. */
export function quotationNoWithRevision(quotationNo: string, revisionNo: number): string {
  const suffix = quotationRevisionSuffix(revisionNo)
  return suffix ? `${quotationNo} · ${suffix}` : quotationNo
}

/** Next customer revision when creating a new document: R1, R2… */
export function nextQuotationRevisionLabel(currentRevisionNo: number): string {
  return `R${quotationCustomerRevisionIndex(currentRevisionNo) + 1}`
}
