import { z } from 'zod'

export const RFQ_STATUSES = [
  'DRAFT',
  'SENT',
  'QUOTATION_RECEIVED',
  'UNDER_COMPARISON',
  'VENDOR_SELECTED',
  'CONVERTED_TO_PO',
  'CANCELLED',
  'CLOSED',
] as const

const optionalUuid = z.string().uuid().optional().nullable()
const dateInput = z.string().min(1).optional().nullable()

export const listRfqsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
  status: z.enum(RFQ_STATUSES).optional(),
  purchaseRequisitionId: z.string().uuid().optional(),
})

export const rfqLineSchema = z.object({
  purchaseRequisitionLineId: optionalUuid,
  itemId: optionalUuid,
  itemCodeSnapshot: z.string().max(64).optional().default(''),
  itemNameSnapshot: z.string().max(300).optional().default(''),
  description: z.string().optional().nullable(),
  requiredQuantity: z.coerce.number().positive(),
  uomId: optionalUuid,
  targetRate: z.coerce.number().min(0).optional().nullable(),
  requiredDate: dateInput,
  remarks: z.string().optional().nullable(),
})

export const createRfqSchema = z.object({
  rfqDate: dateInput,
  purchaseRequisitionId: optionalUuid,
  title: z.string().max(300).optional().nullable(),
  responseDueDate: dateInput,
  remarks: z.string().optional().nullable(),
  vendorIds: z.array(z.string().uuid()).min(1),
  lines: z.array(rfqLineSchema).min(1),
})

export const updateRfqSchema = z.object({
  title: z.string().max(300).optional().nullable(),
  responseDueDate: dateInput,
  remarks: z.string().optional().nullable(),
  vendorIds: z.array(z.string().uuid()).min(1).optional(),
  lines: z.array(rfqLineSchema).min(1).optional(),
})

export const setRfqVendorsSchema = z.object({
  vendorIds: z.array(z.string().uuid()).min(1),
})

export const lifecycleRemarksSchema = z
  .object({
    remarks: z.string().optional().nullable(),
  })
  .default({})

export const convertPrToRfqSchema = z
  .object({
    title: z.string().max(300).optional().nullable(),
    responseDueDate: dateInput,
    remarks: z.string().optional().nullable(),
    vendorIds: z.array(z.string().uuid()).optional(),
  })
  .default({})

export type ListRfqsQuery = z.infer<typeof listRfqsQuerySchema>
export type CreateRfqInput = z.infer<typeof createRfqSchema>
export type UpdateRfqInput = z.infer<typeof updateRfqSchema>
export type SetRfqVendorsInput = z.infer<typeof setRfqVendorsSchema>
export type LifecycleRemarksInput = z.infer<typeof lifecycleRemarksSchema>
export type ConvertPrToRfqInput = z.infer<typeof convertPrToRfqSchema>
