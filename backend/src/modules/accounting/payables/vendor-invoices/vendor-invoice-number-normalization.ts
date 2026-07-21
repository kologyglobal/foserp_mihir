/**
 * Supplier invoice number normalisation (Phase 4A1).
 * Trim, uppercase, collapse repeated internal whitespace.
 * Preserves slash, dash and alphanumeric characters — does not equate ABC-001 with ABC/001.
 */
export function normalizeSupplierInvoiceNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase()
}

/**
 * Deterministic uniqueness key for future Phase 4A3 claim.
 * Remains null on early drafts; when claimed, format is:
 * tenantId|legalEntityId|vendorId|financialYearId|supplierInvoiceNumberNormalized
 */
export function buildSupplierInvoiceUniquenessKey(parts: {
  tenantId: string
  legalEntityId: string
  vendorId: string
  financialYearId: string
  supplierInvoiceNumberNormalized: string
}): string {
  return [
    parts.tenantId,
    parts.legalEntityId,
    parts.vendorId,
    parts.financialYearId,
    parts.supplierInvoiceNumberNormalized,
  ].join('|')
}
