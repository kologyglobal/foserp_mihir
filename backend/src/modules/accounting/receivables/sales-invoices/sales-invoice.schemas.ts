import { z } from 'zod'
import {
  decimalAmountSchema,
  decimalQuantitySchema,
  salesInvoiceSourceTypeSchema,
  salesInvoiceStatusSchema,
  salesInvoiceSupplyTypeSchema,
  salesInvoiceTaxTreatmentSchema,
} from '../shared/receivables.schemas.js'
import {
  freightModeSchema,
  invoiceDiscountTypeSchema,
  lineDiscountTypeSchema,
  otherChargeInputSchema,
  roundingModeSchema,
  taxPricingModeSchema,
} from '../calculation/sales-invoice-calculation.schemas.js'
import type { OtherChargeInput } from '../calculation/sales-invoice-calculation.types.js'

export const salesInvoiceLineRequestSchema = z
  .object({
    lineNumber: z.number().int().min(1),
    itemId: z.string().uuid().nullable().optional(),
    itemCode: z.string().max(64).nullable().optional(),
    itemName: z.string().max(300).nullable().optional(),
    description: z.string().max(500),
    hsnSacCode: z.string().max(16).nullable().optional(),
    hsnCode: z.string().max(16).nullable().optional(),
    quantity: decimalQuantitySchema,
    unitOfMeasure: z.string().max(32).nullable().optional(),
    uom: z.string().max(32).nullable().optional(),
    unitPrice: decimalAmountSchema.optional(),
    unitRate: decimalAmountSchema.optional(),
    discountType: lineDiscountTypeSchema.optional(),
    discountValue: decimalAmountSchema.optional(),
    taxRate: decimalAmountSchema.optional(),
    gstRate: decimalAmountSchema.optional(),
    cessRate: decimalAmountSchema.optional(),
    revenueAccountId: z.string().uuid().nullable().optional(),
    costCentreId: z.string().uuid().nullable().optional(),
    isTaxInclusive: z.boolean().optional(),
    sourceLineId: z.string().max(64).nullable().optional(),
  })
  .transform((line) => {
    const unitPrice = line.unitPrice ?? line.unitRate
    if (!unitPrice) {
      throw new z.ZodError([
        {
          code: 'custom',
          message: 'unitPrice or unitRate is required',
          path: ['unitPrice'],
        },
      ])
    }
    return {
      lineNumber: line.lineNumber,
      itemId: line.itemId ?? null,
      itemCode: line.itemCode ?? null,
      itemName: line.itemName ?? null,
      description: line.description,
      hsnCode: line.hsnSacCode ?? line.hsnCode ?? null,
      uom: line.unitOfMeasure ?? line.uom ?? null,
      quantity: line.quantity,
      unitPrice,
      lineDiscountType: line.discountType,
      lineDiscountValue: line.discountValue,
      gstRate: line.taxRate ?? line.gstRate,
      cessRate: line.cessRate,
      revenueAccountId: line.revenueAccountId ?? null,
      costCentreId: line.costCentreId ?? null,
      isTaxInclusive: line.isTaxInclusive,
      sourceLineId: line.sourceLineId ?? null,
    }
  })

export type SalesInvoiceLineRequest = z.infer<typeof salesInvoiceLineRequestSchema>

const salesInvoiceDraftFieldsSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid(),
  sourceType: salesInvoiceSourceTypeSchema.default('DIRECT'),
  sourceDocumentId: z.string().uuid().nullable().optional(),
  invoiceDate: z.string(),
  postingDate: z.string(),
  dueDate: z.string().nullable().optional(),
  paymentTermsDays: z.number().int().min(0).nullable().optional(),
  placeOfSupply: z.string().max(8).nullable().optional(),
  placeOfSupplyStateCode: z.string().max(8).nullable().optional(),
  supplyType: salesInvoiceSupplyTypeSchema.optional(),
  taxTreatment: salesInvoiceTaxTreatmentSchema,
  currencyCode: z.string().max(8).default('INR'),
  exchangeRate: decimalAmountSchema.optional(),
  taxPricingMode: taxPricingModeSchema.optional(),
  invoiceDiscountType: invoiceDiscountTypeSchema.optional(),
  invoiceDiscountValue: decimalAmountSchema.optional(),
  freightMode: freightModeSchema.optional(),
  freightAmount: decimalAmountSchema.optional(),
  freightTaxRate: decimalAmountSchema.nullable().optional(),
  freightRevenueAccountId: z.string().uuid().nullable().optional(),
  otherCharges: z.array(otherChargeInputSchema).optional(),
  otherChargesAmount: decimalAmountSchema.optional(),
  roundingMode: roundingModeSchema.optional(),
  manualRoundOff: decimalAmountSchema.optional(),
  roundingTolerance: decimalAmountSchema.optional(),
  referenceNumber: z.string().max(64).nullable().optional(),
  customerPoNumber: z.string().max(64).nullable().optional(),
  narration: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(salesInvoiceLineRequestSchema).min(1),
})

type DraftFields = z.infer<typeof salesInvoiceDraftFieldsSchema>

export interface NormalizedSalesInvoiceBody {
  legalEntityId?: string
  branchId?: string | null
  customerId: string
  sourceType: 'DIRECT' | 'SALES_ORDER'
  sourceDocumentId?: string | null
  invoiceDate: string
  postingDate: string
  dueDate?: string | null
  paymentTermsDays?: number | null
  placeOfSupply: string | null
  supplyType?: z.infer<typeof salesInvoiceSupplyTypeSchema>
  taxTreatment: z.infer<typeof salesInvoiceTaxTreatmentSchema>
  currencyCode: string
  exchangeRate: string
  taxPricingMode: 'EXCLUSIVE' | 'INCLUSIVE'
  invoiceDiscountType?: z.infer<typeof invoiceDiscountTypeSchema>
  invoiceDiscountValue?: string
  freightMode: 'NON_TAXABLE' | 'TAXABLE'
  freightAmount: string
  freightTaxRate?: string | null
  freightRevenueAccountId?: string | null
  otherCharges?: OtherChargeInput[]
  otherChargesAmount: string
  roundingMode: 'NONE' | 'NEAREST_UNIT' | 'NEAREST_0_05' | 'MANUAL'
  manualRoundOff?: string
  roundingTolerance?: string
  referenceNumber?: string | null
  customerPoNumber?: string | null
  narration: string | null
  lines: SalesInvoiceLineRequest[]
}

function normalizeDraftBody(body: DraftFields | Omit<DraftFields, 'legalEntityId'>): NormalizedSalesInvoiceBody {
  const { placeOfSupplyStateCode: _pos, notes: _notes, ...rest } = body
  return {
    ...rest,
    placeOfSupply: body.placeOfSupply ?? body.placeOfSupplyStateCode ?? null,
    narration: body.narration ?? body.notes ?? null,
    exchangeRate: body.exchangeRate ?? '1',
    taxPricingMode: body.taxPricingMode ?? 'EXCLUSIVE',
    freightMode: body.freightMode ?? 'NON_TAXABLE',
    freightAmount: body.freightAmount ?? '0',
    otherChargesAmount: body.otherChargesAmount ?? '0',
    roundingMode: body.roundingMode ?? 'NONE',
  }
}

export type CreateSalesInvoiceInput = NormalizedSalesInvoiceBody & { legalEntityId: string }

export const createSalesInvoiceSchema = salesInvoiceDraftFieldsSchema
  .transform((body) => normalizeDraftBody(body) as CreateSalesInvoiceInput)
  .superRefine((body, ctx) => {
    if (body.sourceType === 'SALES_ORDER' && !body.sourceDocumentId) {
      ctx.addIssue({
        code: 'custom',
        message: 'sourceDocumentId is required when sourceType is SALES_ORDER',
        path: ['sourceDocumentId'],
      })
    }
    if (body.sourceType === 'DIRECT' && body.sourceDocumentId) {
      ctx.addIssue({
        code: 'custom',
        message: 'sourceDocumentId must be omitted for DIRECT invoices',
        path: ['sourceDocumentId'],
      })
    }
  })

export type UpdateSalesInvoiceInput = NormalizedSalesInvoiceBody & { updatedAt: string }

const updateFieldsSchema = salesInvoiceDraftFieldsSchema.omit({ legalEntityId: true }).extend({
  updatedAt: z.string().datetime({ offset: true }),
})

export const updateSalesInvoiceSchema = updateFieldsSchema.transform(
  (body): UpdateSalesInvoiceInput => ({
    ...normalizeDraftBody(body),
    updatedAt: body.updatedAt,
  }),
)

export const cancelSalesInvoiceSchema = z.object({
  cancellationReason: z.string().min(1).max(500),
})

export type CancelSalesInvoiceInput = z.infer<typeof cancelSalesInvoiceSchema>

export const reverseSalesInvoiceSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export type ReverseSalesInvoiceBody = z.infer<typeof reverseSalesInvoiceSchema>

export const listSalesInvoicesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: salesInvoiceStatusSchema.optional(),
  sourceType: salesInvoiceSourceTypeSchema.optional(),
  currencyCode: z.string().max(8).optional(),
  createdBy: z.string().uuid().optional(),
  invoiceDateFrom: z.string().optional(),
  invoiceDateTo: z.string().optional(),
  postingDateFrom: z.string().optional(),
  postingDateTo: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['invoiceDate', 'postingDate', 'dueDate', 'createdAt', 'updatedAt', 'totalAmount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type ListSalesInvoicesQueryInput = z.infer<typeof listSalesInvoicesQuerySchema>

export const salesInvoiceIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const salesInvoiceDraftInputSchema = salesInvoiceDraftFieldsSchema
export type SalesInvoiceDraftInput = z.infer<typeof salesInvoiceDraftInputSchema>
