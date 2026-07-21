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

export const DEFAULT_GST_PCT = 18

/** Align with frontend `types/crm.ts` — auto-approve when discount ≤ this % */
export const DISCOUNT_APPROVAL_THRESHOLD = 10
export const APPROVAL_AMOUNT_THRESHOLD = 5_000_000
