import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const CRM_PAYMENT_MODES = ['cash', 'bank', 'upi', 'cheque', 'neft', 'rtgs'] as const
export const CRM_TAX_INVOICE_STATUSES = ['draft', 'posted', 'partially_paid', 'paid', 'cancelled'] as const
export const CRM_COMMERCIAL_SOURCES = ['sales_order', 'proforma', 'direct', 'customer'] as const
export const CRM_PROFORMA_STATUSES = ['draft', 'issued', 'cancelled'] as const
export const CRM_PROFORMA_SOURCES = ['direct', 'sales_order'] as const

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const listReceiptsQuerySchema = paginationSchema.extend({
  companyId: z.string().uuid().optional(),
  proformaInvoiceId: z.string().optional(),
  availableOnly: z.coerce.boolean().optional(),
})

export const listInvoicesQuerySchema = paginationSchema.extend({
  companyId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  status: z.enum(CRM_TAX_INVOICE_STATUSES).optional(),
  openOnly: z.coerce.boolean().optional(),
})

export const listAllocationsQuerySchema = paginationSchema.extend({
  companyId: z.string().uuid().optional(),
  receiptId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  includeReversed: z.coerce.boolean().optional(),
})

export const createReceiptSchema = z.object({
  companyId: z.string().uuid(),
  receiptDate: dateOnly,
  paymentMode: z.enum(CRM_PAYMENT_MODES),
  transactionRef: z.string().trim().max(120).optional().nullable(),
  amount: z.number().positive(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  attachmentName: z.string().trim().max(255).optional().nullable(),
  proformaInvoiceId: z.string().trim().max(64).optional().nullable(),
  proformaNo: z.string().trim().max(64).optional().nullable(),
  /** When receiving against a proforma, client may send expected max (balance). */
  proformaGrandTotal: z.number().nonnegative().optional(),
})

export const invoiceLineSchema = z.object({
  itemId: z.string().uuid(),
  itemCode: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(500),
  hsnCode: z.string().trim().max(16).optional().nullable(),
  qty: z.number().positive(),
  uom: z.string().trim().max(16).optional(),
  unitPrice: z.number().nonnegative(),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional(),
  sourceLineId: z.string().trim().max(64).optional().nullable(),
  maxQty: z.number().positive().optional().nullable(),
})

export const createInvoiceSchema = z.object({
  companyId: z.string().uuid(),
  invoiceDate: dateOnly.optional(),
  dueDate: dateOnly.optional(),
  source: z.enum(CRM_COMMERCIAL_SOURCES).optional(),
  salesOrderId: z.string().uuid().optional().nullable(),
  salesOrderNo: z.string().trim().max(64).optional().nullable(),
  quotationId: z.string().uuid().optional().nullable(),
  quotationNo: z.string().trim().max(64).optional().nullable(),
  proformaInvoiceId: z.string().trim().max(64).optional().nullable(),
  proformaNo: z.string().trim().max(64).optional().nullable(),
  paymentTerms: z.string().trim().max(500).optional().nullable(),
  deliveryTerms: z.string().trim().max(500).optional().nullable(),
  customerPoNumber: z.string().trim().max(100).optional().nullable(),
  billingAddress: z.string().trim().max(2000).optional().nullable(),
  shippingAddress: z.string().trim().max(2000).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  customerState: z.string().trim().max(100).optional().nullable(),
  lines: z.array(invoiceLineSchema).min(1),
})

export const listProformasQuerySchema = paginationSchema.extend({
  companyId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  status: z.enum(CRM_PROFORMA_STATUSES).optional(),
})

export const createProformaSchema = z.object({
  companyId: z.string().uuid(),
  proformaDate: dateOnly.optional(),
  validUntil: dateOnly.optional(),
  source: z.enum(CRM_PROFORMA_SOURCES).optional(),
  salesOrderId: z.string().uuid().optional().nullable(),
  salesOrderNo: z.string().trim().max(64).optional().nullable(),
  quotationId: z.string().uuid().optional().nullable(),
  quotationNo: z.string().trim().max(64).optional().nullable(),
  paymentTerms: z.string().trim().max(500).optional().nullable(),
  deliveryTerms: z.string().trim().max(500).optional().nullable(),
  customerPoNumber: z.string().trim().max(100).optional().nullable(),
  billingAddress: z.string().trim().max(2000).optional().nullable(),
  shippingAddress: z.string().trim().max(2000).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  customerState: z.string().trim().max(100).optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  lines: z.array(invoiceLineSchema).min(1),
})

export const updateProformaSchema = createProformaSchema.partial().extend({
  companyId: z.string().uuid().optional(),
  lines: z.array(invoiceLineSchema).min(1).optional(),
})

export const allocatePaymentsSchema = z.object({
  receiptId: z.string().uuid(),
  allocationDate: dateOnly.optional(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid(),
        amount: z.number().positive(),
      }),
    )
    .min(1),
})

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type CreateProformaInput = z.infer<typeof createProformaSchema>
export type UpdateProformaInput = z.infer<typeof updateProformaSchema>
export type AllocatePaymentsInput = z.infer<typeof allocatePaymentsSchema>
export type ListReceiptsQuery = z.infer<typeof listReceiptsQuerySchema>
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>
export type ListProformasQuery = z.infer<typeof listProformasQuerySchema>
export type ListAllocationsQuery = z.infer<typeof listAllocationsQuerySchema>
