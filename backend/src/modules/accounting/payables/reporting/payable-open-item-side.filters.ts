import type { PayableOpenItemDocumentType } from '@prisma/client'

/** Outstanding / ageing — vendor liability rows only. */
export const CREDIT_OUTSTANDING_SIDE_FILTER = { side: 'CREDIT' as const }

export const CREDIT_OUTSTANDING_DOCUMENT_TYPES: PayableOpenItemDocumentType[] = [
  'VENDOR_INVOICE',
  'VENDOR_CREDIT_ADJUSTMENT',
]

export const CREDIT_OUTSTANDING_DOCUMENT_FILTER = {
  ...CREDIT_OUTSTANDING_SIDE_FILTER,
  documentType: { in: CREDIT_OUTSTANDING_DOCUMENT_TYPES },
} as const

/** Vendor summary — settlement / debit rows (payments, debit notes, advances). */
export const DEBIT_OPEN_ITEM_SIDE_FILTER = { side: 'DEBIT' as const }
