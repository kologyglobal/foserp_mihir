import { z } from 'zod'

export const salesInvoiceStatusSchema = z.enum(['DRAFT', 'READY_TO_POST', 'POSTED', 'CANCELLED', 'REVERSED'])
export const salesInvoiceSourceTypeSchema = z.enum(['DIRECT', 'SALES_ORDER'])
export const salesInvoiceSupplyTypeSchema = z.enum(['INTRA_STATE', 'INTER_STATE', 'EXPORT', 'SEZ', 'NON_GST'])
export const salesInvoiceTaxTreatmentSchema = z.enum([
  'REGISTERED',
  'UNREGISTERED',
  'EXPORT_WITH_TAX',
  'EXPORT_WITHOUT_TAX',
  'SEZ_WITH_TAX',
  'SEZ_WITHOUT_TAX',
  'NON_GST',
])

export const receivableDocumentTypeSchema = z.enum([
  'SALES_INVOICE',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'OPENING_BALANCE',
  'CUSTOMER_RECEIPT',
])
export const receivableOpenItemStatusSchema = z.enum([
  'OPEN',
  'PARTIALLY_SETTLED',
  'SETTLED',
  'DISPUTED',
  'ON_HOLD',
])

export const decimalAmountSchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string')
export const decimalQuantitySchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string')
export const decimalRateSchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string')
