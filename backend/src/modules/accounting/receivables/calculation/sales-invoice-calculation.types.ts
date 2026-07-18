import type {
  SalesInvoiceSupplyType,
  SalesInvoiceTaxTreatment,
} from '../sales-invoices/sales-invoice.types.js'

export type LineDiscountType = 'PERCENTAGE' | 'AMOUNT'
export type InvoiceDiscountType = 'PERCENTAGE' | 'AMOUNT'
export type TaxPricingMode = 'EXCLUSIVE' | 'INCLUSIVE'
export type RoundingMode = 'NONE' | 'NEAREST_UNIT' | 'NEAREST_0_05' | 'MANUAL'
export type FreightMode = 'NON_TAXABLE' | 'TAXABLE'

export interface OtherChargeInput {
  code: string
  description: string
  amount: string
  taxRate?: string | null
  accountId?: string | null
  includeInTaxableValue: boolean
}

export interface SalesInvoiceLineCalculationInput {
  lineNumber: number
  quantity: string
  unitPrice: string
  lineDiscountType?: LineDiscountType
  lineDiscountValue?: string
  gstRate?: string
  cessRate?: string
  hsnCode?: string | null
  isTaxInclusive?: boolean
  description?: string | null
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  uomSnapshot?: string | null
  revenueAccountId?: string | null
  costCentreId?: string | null
}

export interface SalesInvoiceCalculationInput {
  legalEntityId: string
  /** Required for sync calculation — loaded from LE in validation preview when omitted. */
  legalEntityStateCode?: string | null
  customerId?: string
  placeOfSupply?: string | null
  /** Manual override — validated against derived supply type. */
  supplyType?: SalesInvoiceSupplyType
  taxTreatment: SalesInvoiceTaxTreatment
  currencyCode?: string
  exchangeRate?: string
  taxPricingMode?: TaxPricingMode
  invoiceDiscountType?: InvoiceDiscountType
  invoiceDiscountValue?: string
  freightMode?: FreightMode
  freightAmount?: string
  freightTaxRate?: string | null
  freightRevenueAccountId?: string | null
  /** Legacy shorthand — single non-taxable other charge (summed with otherCharges). */
  otherChargesAmount?: string
  otherCharges?: OtherChargeInput[]
  roundingMode?: RoundingMode
  manualRoundOff?: string
  roundingTolerance?: string
  invoiceDate?: string
  postingDate?: string
  lines: SalesInvoiceLineCalculationInput[]
}

export interface CalculationIssue {
  code: string
  message: string
  field?: string
  severity: 'error' | 'warning'
}

export interface CalculatedSalesInvoiceLine {
  lineNumber: number
  quantity: string
  unitPrice: string
  grossAmount: string
  lineDiscountAmount: string
  allocatedInvoiceDiscount: string
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
  hsnCode: string | null
  description: string | null
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  uomSnapshot: string | null
  revenueAccountId: string | null
  costCentreId: string | null
  isTaxInclusive: boolean
}

export interface TaxSummaryByRate {
  gstRate: string
  cessRate: string
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
}

export interface SalesInvoiceCalculationResult {
  valid: boolean
  derivedSupplyType: SalesInvoiceSupplyType
  supplyType: SalesInvoiceSupplyType
  lines: CalculatedSalesInvoiceLine[]
  subtotalAmount: string
  lineDiscountTotal: string
  invoiceDiscountAmount: string
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  freightAmount: string
  freightTaxableAmount: string
  freightCgstAmount: string
  freightSgstAmount: string
  freightIgstAmount: string
  otherChargesAmount: string
  otherChargesTaxableAmount: string
  otherChargesCgstAmount: string
  otherChargesSgstAmount: string
  otherChargesIgstAmount: string
  preRoundTotal: string
  roundOffAmount: string
  totalAmount: string
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
  taxSummary: TaxSummaryByRate[]
  errors: CalculationIssue[]
  warnings: CalculationIssue[]
}
