import { z } from 'zod'

const amount = z.union([z.string(), z.number()]).transform(String)
const purpose = z.enum([
  'SALES_RETURN', 'PRICE_ADJUSTMENT', 'QUANTITY_ADJUSTMENT', 'QUALITY_CLAIM',
  'DISCOUNT', 'FREIGHT_ADJUSTMENT', 'TAX_CORRECTION', 'COMMERCIAL_SETTLEMENT', 'OTHER',
])
const adjustmentMode = z.enum(['FULL_LINE', 'QUANTITY', 'VALUE', 'RATE', 'TAX_ONLY', 'FULL_INVOICE'])

export const customerCreditNoteLineSchema = z.object({
  lineNumber: z.number().int().min(1),
  originalInvoiceLineId: z.string().uuid().nullable().optional(),
  adjustmentMode,
  quantity: amount.optional(),
  value: amount.optional(),
  revisedUnitRate: amount.nullable().optional(),
  itemId: z.string().uuid().nullable().optional(),
  itemCode: z.string().max(64).nullable().optional(),
  itemName: z.string().max(300).nullable().optional(),
  hsnCode: z.string().max(16).nullable().optional(),
  uom: z.string().max(32).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  unitRate: amount.optional(),
  gstRate: amount.optional(),
  cessRate: amount.optional(),
  revenueReversalAccountId: z.string().uuid().nullable().optional(),
  costCentreId: z.string().uuid().nullable().optional(),
})

const draftFields = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  purpose,
  reasonId: z.string().uuid().nullable().optional(),
  sourceType: z.enum(['SALES_INVOICE', 'DIRECT']).default('SALES_INVOICE'),
  originalInvoiceId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid(),
  creditNoteDate: z.string(),
  postingDate: z.string(),
  supplyType: z.enum(['INTRA_STATE', 'INTER_STATE', 'EXPORT', 'SEZ', 'NON_GST']).optional(),
  taxTreatment: z.enum([
    'REGISTERED', 'UNREGISTERED', 'EXPORT_WITH_TAX', 'EXPORT_WITHOUT_TAX',
    'SEZ_WITH_TAX', 'SEZ_WITHOUT_TAX', 'NON_GST',
  ]).optional(),
  currencyCode: z.string().max(8).default('INR'),
  exchangeRate: amount.default('1'),
  freightAmount: amount.default('0'),
  otherChargesAmount: amount.default('0'),
  roundOffAmount: amount.default('0'),
  inventoryReturnRequired: z.boolean().default(false),
  inventoryReturnMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
  approvalRequired: z.boolean().default(false),
  lines: z.array(customerCreditNoteLineSchema).min(1),
})

function validateSource(
  body: { sourceType: 'SALES_INVOICE' | 'DIRECT'; originalInvoiceId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (body.sourceType === 'SALES_INVOICE' && !body.originalInvoiceId) {
    ctx.addIssue({ code: 'custom', path: ['originalInvoiceId'], message: 'originalInvoiceId is required' })
  }
  if (body.sourceType === 'DIRECT' && body.originalInvoiceId) {
    ctx.addIssue({ code: 'custom', path: ['originalInvoiceId'], message: 'originalInvoiceId must be omitted for DIRECT notes' })
  }
}

export const createCustomerCreditNoteSchema = draftFields.superRefine(validateSource)
export type CreateCustomerCreditNoteInput = z.infer<typeof createCustomerCreditNoteSchema>

export const updateCustomerCreditNoteSchema = draftFields
  .omit({ legalEntityId: true })
  .extend({ updatedAt: z.string().datetime({ offset: true }) })
  .superRefine(validateSource)
export type UpdateCustomerCreditNoteInput = z.infer<typeof updateCustomerCreditNoteSchema>

export const cancelCustomerCreditNoteSchema = z.object({ cancellationReason: z.string().min(1).max(500) })
export const submitCustomerCreditNoteSchema = z.object({ comments: z.string().max(1000).optional() }).default({})
export const creditNoteDecisionSchema = z.object({ comments: z.string().max(1000).optional() }).default({})

export const listCustomerCreditNotesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  originalInvoiceId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'READY_TO_POST', 'POSTED', 'REJECTED', 'CANCELLED']).optional(),
  purpose: purpose.optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
export type ListCustomerCreditNotesQuery = z.infer<typeof listCustomerCreditNotesQuerySchema>
