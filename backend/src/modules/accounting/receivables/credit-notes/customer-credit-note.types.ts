import type { CustomerCreditNote, CustomerCreditNoteLine } from '@prisma/client'

export type CustomerCreditNoteWithLines = CustomerCreditNote & { lines: CustomerCreditNoteLine[] }

export interface CreditNoteLineCalculation {
  lineNumber: number
  originalInvoiceLineId: string | null
  adjustmentMode: CustomerCreditNoteLine['adjustmentMode']
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  hsnCodeSnapshot: string | null
  uomSnapshot: string | null
  description: string | null
  quantity: string
  unitRate: string
  revisedUnitRate: string | null
  grossAmount: string
  discountAmount: string
  taxableAmount: string
  cgstRate: string
  cgstAmount: string
  sgstRate: string
  sgstAmount: string
  igstRate: string
  igstAmount: string
  cessRate: string
  cessAmount: string
  lineTotal: string
  revenueReversalAccountId: string | null
  costCentreId: string | null
}

export interface CustomerCreditNoteCalculation {
  valid: boolean
  errors: Array<{ field: string; message: string }>
  lines: CreditNoteLineCalculation[]
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  discountAmount: string
  freightAmount: string
  otherChargesAmount: string
  roundOffAmount: string
  grandTotal: string
  baseTaxableAmount: string
  baseCgstAmount: string
  baseSgstAmount: string
  baseIgstAmount: string
  baseCessAmount: string
  baseTotalTaxAmount: string
  baseDiscountAmount: string
  baseFreightAmount: string
  baseOtherChargesAmount: string
  baseRoundOffAmount: string
  baseGrandTotal: string
}
