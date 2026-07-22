import { z } from 'zod'

export const uuidParamSchema = z.object({ id: z.string().uuid() })
export const dispatchOrderIdParamSchema = z.object({ id: z.string().uuid() })

export const listChallansQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.string().optional(),
  outboundDispatchId: z.string().uuid().optional(),
  q: z.string().optional(),
})

export const createChallanSchema = z.object({
  packingSessionId: z.string().uuid().optional(),
  documentDate: z.string().optional(),
  movementDate: z.string().optional(),
  movementReason: z
    .enum([
      'SALES_DELIVERY',
      'JOB_WORK_DISPATCH',
      'SAMPLE',
      'DEMONSTRATION',
      'REPAIR',
      'REPLACEMENT',
      'STOCK_TRANSFER',
      'RETURNABLE_MATERIAL',
      'NON_RETURNABLE_MATERIAL',
      'OTHER',
    ])
    .optional(),
  remarks: z.string().max(4000).optional(),
  idempotencyKey: z.string().max(150).optional(),
})

export const updateChallanSchema = z.object({
  documentDate: z.string().optional(),
  movementDate: z.string().nullable().optional(),
  movementReason: z
    .enum([
      'SALES_DELIVERY',
      'JOB_WORK_DISPATCH',
      'SAMPLE',
      'DEMONSTRATION',
      'REPAIR',
      'REPLACEMENT',
      'STOCK_TRANSFER',
      'RETURNABLE_MATERIAL',
      'NON_RETURNABLE_MATERIAL',
      'OTHER',
    ])
    .optional(),
  transportMode: z.string().max(64).nullable().optional(),
  transporterName: z.string().max(200).nullable().optional(),
  transporterDocumentRef: z.string().max(100).nullable().optional(),
  vehicleNumber: z.string().max(64).nullable().optional(),
  driverName: z.string().max(120).nullable().optional(),
  driverPhone: z.string().max(32).nullable().optional(),
  lrGrNumber: z.string().max(100).nullable().optional(),
  lrGrDate: z.string().nullable().optional(),
  eWayBillReference: z.string().max(100).nullable().optional(),
  eWayBillDate: z.string().nullable().optional(),
  destination: z.string().max(300).nullable().optional(),
  remarks: z.string().max(4000).nullable().optional(),
  termsText: z.string().max(4000).nullable().optional(),
  sourceVersion: z.number().int().positive().optional(),
})

export const reasonSchema = z.object({
  reason: z.string().min(1).max(2000),
  idempotencyKey: z.string().max(150).optional(),
})

export const issueSchema = z.object({
  idempotencyKey: z.string().max(150).optional(),
  sourceVersion: z.number().int().positive().optional(),
})

export type CreateChallanInput = z.infer<typeof createChallanSchema>
export type UpdateChallanInput = z.infer<typeof updateChallanSchema>
export type ListChallansQuery = z.infer<typeof listChallansQuerySchema>
