export const QUOTATION_STATUSES = [
  'draft',
  'submitted',
  'pending_approval',
  'approved',
  'sent',
  'rejected',
  'superseded',
  'converted',
  'cancelled',
] as const

export const QUOTATION_DOCUMENT_STATUSES = [
  'draft',
  'sent',
  'pending_approval',
  'approved',
  'rejected',
  'superseded',
  'converted',
] as const

export const CUSTOMER_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const

/** @deprecated Do not use as a silent default on transactional lines — resolve from masters. */
export const DEFAULT_GST_PCT = 18

/**
 * Prefer omitted header GST only for legacy demos.
 * New lines must carry explicit taxPct from tax determination.
 */
export const LEGACY_QUOTATION_HEADER_GST_FALLBACK = DEFAULT_GST_PCT

/** Align with frontend quotation create default (`crmStore` / quotation create page). */
export const DEFAULT_VALIDITY_DAYS = 30

/** Align with frontend `types/crm.ts` — auto-approve when discount ≤ this % */
export const DISCOUNT_APPROVAL_THRESHOLD = 10
export const APPROVAL_AMOUNT_THRESHOLD = 5_000_000
