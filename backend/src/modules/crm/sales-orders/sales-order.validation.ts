import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { optionalUuid } from '../../../utils/zodHelpers.js'

export const SALES_ORDER_STATUSES = [
  'open',
  'confirmed',
  'in_production',
  'ready_dispatch',
  'dispatched',
  'invoiced',
  'closed',
] as const

export const SALES_ORDER_SOURCES = ['quotation', 'direct'] as const

const optionalDate = z.preprocess(
  (v) => (v === '' ? null : v),
  z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().nullable(),
)

const salesOrderLineSchema = z.object({
  id: z.string().uuid().optional(),
  lineNo: z.number().int().positive().optional(),
  productOrItem: z.string().trim().min(1),
  description: z.string().trim().optional().default(''),
  productId: optionalUuid,
  qty: z.number().positive(),
  uom: z.string().trim().min(1).default('NOS'),
  unitPrice: z.number().nonnegative(),
  discountPct: z.number().min(0).max(100).default(0),
  taxPct: z.number().min(0).max(100).default(18),
  technicalScopeRef: z.string().trim().optional().nullable(),
})

export const listSalesOrdersQuerySchema = paginationSchema.extend({
  customerId: z.string().uuid().optional(),
  quotationId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  status: z.enum(SALES_ORDER_STATUSES).optional(),
  search: z.string().trim().optional(),
})

export const convertQuotationToSalesOrderSchema = z.object({
  documentId: z.string().uuid().optional(),
  customerPoNumber: z.string().trim().min(1).optional(),
  customerPoDate: z.string().datetime().optional().nullable(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  deliveryLocation: z.string().trim().optional().nullable(),
  locationId: optionalUuid,
  internalRemarks: z.string().trim().optional().nullable(),
})

export const createSalesOrderSchema = z
  .object({
    customerId: z.string().uuid(),
    source: z.enum(SALES_ORDER_SOURCES).default('direct'),
    productId: optionalUuid,
    qty: z.number().positive().optional(),
    unitPrice: z.number().nonnegative().optional(),
    discountPct: z.number().min(0).max(100).optional().nullable(),
    customerPoNumber: z.string().trim().min(1),
    customerPoDate: optionalDate,
    paymentTerms: z.string().trim().min(1),
    deliveryTerms: z.string().trim().min(1),
    warrantyTerms: z.string().trim().optional().nullable(),
    commercialNotes: z.string().trim().optional().nullable(),
    technicalNotes: z.string().trim().optional().nullable(),
    expectedDeliveryDate: optionalDate,
    requiredDate: optionalDate,
    orderDate: optionalDate,
    deliveryLocation: z.string().trim().optional().nullable(),
    locationId: optionalUuid,
    billingAddress: z.string().trim().optional().nullable(),
    shippingAddress: z.string().trim().optional().nullable(),
    opportunityId: optionalUuid,
    contactId: optionalUuid,
    quotationId: optionalUuid,
    quotationNo: z.string().trim().optional().nullable(),
    quotationRevisionNo: z.number().int().nonnegative().optional().nullable(),
    quotationDocumentId: optionalUuid,
    salesOwnerId: optionalUuid,
    salesOwnerName: z.string().trim().optional().nullable(),
    internalRemarks: z.string().trim().optional().nullable(),
    remarks: z.string().trim().optional().nullable(),
    directSoReason: z.string().trim().optional().nullable(),
    lines: z.array(salesOrderLineSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const hasLines = Boolean(data.lines?.length)
    if (!hasLines && (!data.productId || data.qty == null || data.unitPrice == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide lines[] or productId + qty + unitPrice',
        path: ['lines'],
      })
    }
    if (data.source === 'direct' && !data.directSoReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'directSoReason is required for direct sales orders',
        path: ['directSoReason'],
      })
    }
  })

export const updateSalesOrderSchema = z.object({
  customerPoNumber: z.string().trim().min(1).optional(),
  customerPoDate: optionalDate,
  expectedDeliveryDate: optionalDate,
  requiredDate: optionalDate,
  deliveryLocation: z.string().trim().optional().nullable(),
  locationId: optionalUuid,
  internalRemarks: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  paymentTerms: z.string().trim().min(1).optional(),
  deliveryTerms: z.string().trim().min(1).optional(),
  warrantyTerms: z.string().trim().optional().nullable(),
  commercialNotes: z.string().trim().optional().nullable(),
  technicalNotes: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
  shippingAddress: z.string().trim().optional().nullable(),
  directSoReason: z.string().trim().optional().nullable(),
  qty: z.number().positive().optional(),
  unitPrice: z.number().nonnegative().optional().nullable(),
  discountPct: z.number().min(0).max(100).optional().nullable(),
  contactId: optionalUuid,
  salesOwnerId: optionalUuid,
  salesOwnerName: z.string().trim().optional().nullable(),
  lines: z.array(salesOrderLineSchema).optional(),
})

export type ListSalesOrdersQuery = z.infer<typeof listSalesOrdersQuerySchema>
export type ConvertQuotationToSalesOrderInput = z.infer<typeof convertQuotationToSalesOrderSchema>
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>
