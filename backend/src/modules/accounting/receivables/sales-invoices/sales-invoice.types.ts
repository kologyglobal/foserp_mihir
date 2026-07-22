/** Domain types for AR sales invoices — amounts as decimal strings in DTOs. */

import type { SalesInvoiceValidationPreview } from '../validation/invoice-validation.types.js'
import type { SalesInvoiceAllowedActions } from './sales-invoice-allowed-actions.js'

export type SalesInvoiceStatus = 'DRAFT' | 'READY_TO_POST' | 'POSTED' | 'CANCELLED' | 'REVERSED'
export type SalesInvoiceSourceType = 'DIRECT' | 'SALES_ORDER' | 'OUTBOUND_DISPATCH'
export type SalesInvoiceSettlementStatus =
  | 'NOT_APPLICABLE'
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
export type SalesInvoiceSupplyType = 'INTRA_STATE' | 'INTER_STATE' | 'EXPORT' | 'SEZ' | 'NON_GST'
export type SalesInvoiceTaxTreatment =
  | 'REGISTERED'
  | 'UNREGISTERED'
  | 'EXPORT_WITH_TAX'
  | 'EXPORT_WITHOUT_TAX'
  | 'SEZ_WITH_TAX'
  | 'SEZ_WITHOUT_TAX'
  | 'NON_GST'

export interface SalesInvoiceLineDto {
  id: string
  lineNumber: number
  sourceLineId: string | null
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  hsnCodeSnapshot: string | null
  uomSnapshot: string | null
  description: string | null
  quantity: string
  unitRate: string
  grossAmount: string
  discountPercent: string
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
  revenueAccountId: string | null
  costCentreId: string | null
}

export interface SalesInvoiceDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  financialYearId: string | null
  invoiceNumber: string | null
  draftReference: string | null
  status: SalesInvoiceStatus
  customerId: string
  customerCodeSnapshot: string | null
  customerNameSnapshot: string
  customerGstinSnapshot: string | null
  customerPanSnapshot: string | null
  customerStateCodeSnapshot: string | null
  customerBillingAddressSnapshot: Record<string, unknown> | null
  customerShippingAddressSnapshot: Record<string, unknown> | null
  sourceType: SalesInvoiceSourceType
  sourceDocumentId: string | null
  sourceDocumentSnapshot: Record<string, unknown> | null
  invoiceDate: string
  postingDate: string | null
  referenceNumber: string | null
  customerPoNumber: string | null
  paymentTermsDays: number | null
  freightAmount: string
  otherChargesAmount: string
  dueDate: string | null
  placeOfSupply: string | null
  supplyType: SalesInvoiceSupplyType
  taxTreatment: SalesInvoiceTaxTreatment
  currencyCode: string
  exchangeRate: string
  subtotalAmount: string
  discountAmount: string
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  roundOffAmount: string
  totalAmount: string
  outstandingAmount: string
  amountPaid: string
  amountAdjusted: string
  baseSubtotalAmount: string
  baseDiscountAmount: string
  baseTaxableAmount: string
  baseCgstAmount: string
  baseSgstAmount: string
  baseIgstAmount: string
  baseCessAmount: string
  baseTotalTaxAmount: string
  baseRoundOffAmount: string
  baseTotalAmount: string
  narration: string | null
  accountingVoucherId: string | null
  postingEventId: string | null
  postedAt: string | null
  postedBy: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancellationReason: string | null
  reversalVoucherId: string | null
  reversedAt: string | null
  reversedBy: string | null
  reversalReason: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  lines?: SalesInvoiceLineDto[]
  allowedActions?: SalesInvoiceAllowedActions
  validationSummary?: Pick<SalesInvoiceValidationPreview, 'valid' | 'errors' | 'warnings'> | null
  metaWarnings?: Array<{ code: string; message: string }>
  receivableOpenItemId?: string | null
}

export interface SalesInvoiceListItemDto extends Omit<SalesInvoiceDto, 'lines' | 'validationSummary'> {}

export interface ListSalesInvoicesQuery {
  legalEntityId: string
  branchId?: string
  customerId?: string
  status?: SalesInvoiceStatus
  sourceType?: SalesInvoiceSourceType
  currencyCode?: string
  createdBy?: string
  invoiceDateFrom?: string
  invoiceDateTo?: string
  postingDateFrom?: string
  postingDateTo?: string
  dueDateFrom?: string
  dueDateTo?: string
  search?: string
  page?: number
  limit?: number
  pageSize?: number
  sort?: string
  sortOrder?: 'asc' | 'desc'
}

export type SalesInvoiceWithLines = import('@prisma/client').SalesInvoice & {
  lines: import('@prisma/client').SalesInvoiceLine[]
  sourceLinks?: import('@prisma/client').SalesInvoiceSourceLink[]
}

export interface SalesInvoiceCalculationContext {
  taxPricingMode?: 'EXCLUSIVE' | 'INCLUSIVE'
  invoiceDiscountType?: 'PERCENTAGE' | 'AMOUNT'
  invoiceDiscountValue?: string
  freightMode?: 'NON_TAXABLE' | 'TAXABLE'
  freightTaxRate?: string | null
  freightRevenueAccountId?: string | null
  otherCharges?: import('../calculation/sales-invoice-calculation.types.js').OtherChargeInput[]
  roundingMode?: 'NONE' | 'NEAREST_UNIT' | 'NEAREST_0_05' | 'MANUAL'
  manualRoundOff?: string
  roundingTolerance?: string
  lines: SalesInvoiceLineRequestContext[]
}

export interface SalesInvoiceLineRequestContext {
  lineNumber: number
  sourceLineId?: string | null
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  description?: string | null
  hsnCode?: string | null
  uom?: string | null
  quantity: string
  unitPrice: string
  lineDiscountType?: 'PERCENTAGE' | 'AMOUNT'
  lineDiscountValue?: string
  gstRate?: string
  cessRate?: string
  isTaxInclusive?: boolean
  revenueAccountId?: string | null
  costCentreId?: string | null
}
