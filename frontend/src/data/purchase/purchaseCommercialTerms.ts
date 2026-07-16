/**
 * Standard commercial-term picklists for purchase documents (demo).
 * Aligned with Purchase Setup defaults and seed PO / RFQ values — not a full MDM module.
 */

export const PURCHASE_PAYMENT_TERMS = [
  'Net 15',
  'Net 21',
  'Net 30',
  'Net 45',
  'Net 60',
  'Advance 50%',
  '100% Advance',
  'CDC',
] as const

export const PURCHASE_DELIVERY_TERMS = [
  'FOR Chakan',
  'FOR Destination',
  'Ex-Works',
  'Ex-Works Bhosari',
  'Door Delivery',
  'FOB',
  'CIF',
  'Returnable Gate Pass',
] as const

export const PURCHASE_FREIGHT_TERMS = [
  'Buyer Account',
  'Buyer freight',
  'Seller freight',
  'Vendor',
  'Buyer',
  'Included',
  'Freight Extra',
  'To Pay at Destination',
] as const

export const PURCHASE_PRICE_BASIS = [
  'Ex-Works',
  'FOR',
  'FOR Destination',
  'FOB',
  'CIF',
  'CIP',
  'CFR',
] as const

export const PURCHASE_PACKING_TERMS = [
  'Standard',
  'Mill standard packing',
  'Bundle packing',
  'Standard carton',
  'As agreed',
] as const

export const PURCHASE_INSURANCE_TERMS = [
  'N/A',
  'As agreed',
  'Buyer risk after ex-works',
  'Seller transit insurance',
  'Buyer Account',
  'Included in CIF',
] as const

/** Price / delivery bases where insurance clauses are typically applicable. */
const INSURANCE_HINT = /\b(CIF|CIP|CFR|FOB)\b/i

/**
 * Insurance terms: show when already filled, or when price/delivery basis implies transit risk transfer.
 * Always reveal a saved non-empty value so edits never hide existing data.
 */
export function isPurchaseInsuranceTermsApplicable(
  priceBasis: string,
  deliveryTerms: string,
  insuranceTerms: string,
): boolean {
  if (insuranceTerms.trim()) return true
  return INSURANCE_HINT.test(`${priceBasis} ${deliveryTerms}`)
}

/**
 * Inspection requirement: show when already filled, or when setup marks any line category as QC-required.
 * Always reveal a saved non-empty value.
 */
export function isPurchaseInspectionRequirementApplicable(
  inspectionRequirement: string,
  lineCategories: readonly string[],
  inspectionRequiredCategories: readonly string[],
): boolean {
  if (inspectionRequirement.trim()) return true
  if (inspectionRequiredCategories.length === 0) return false
  const required = new Set(inspectionRequiredCategories)
  return lineCategories.some((c) => required.has(c))
}

/** Keep saved free-text values selectable even when not in the standard list. */
export function withCurrentTermOption(
  options: readonly string[],
  current: string | undefined | null,
): string[] {
  const trimmed = (current ?? '').trim()
  if (!trimmed) return [...options]
  if (options.includes(trimmed)) return [...options]
  return [trimmed, ...options]
}
