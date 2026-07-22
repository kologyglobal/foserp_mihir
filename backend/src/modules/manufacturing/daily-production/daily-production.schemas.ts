import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const quantityField = z.coerce.number().min(0).default(0)

/** Soft shift reference — no Shift master FK until HR module exists. */
const shiftCodeField = z.string().trim().max(32).optional()
const shiftLabelField = z.string().trim().max(64).optional()

export const createDailyBatchSchema = z.object({
  productionDate: z.string().min(4),
  shiftCode: shiftCodeField,
  shiftLabel: shiftLabelField,
  plantCode: z.string().trim().max(32).optional(),
  workCentreId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export const updateDailyBatchSchema = createDailyBatchSchema.partial()

export const upsertDailyLineSchema = z
  .object({
    productionOrderId: z.string().uuid(),
    stageId: z.string().uuid(),
    operationId: z.string().uuid().optional(),
    assignmentId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    machineId: z.string().uuid().optional(),
    workCentreId: z.string().uuid().optional(),
    goodQuantity: quantityField,
    reworkQuantity: quantityField,
    rejectedQuantity: quantityField,
    scrapQuantity: quantityField,
    labourMinutes: z.coerce.number().int().min(0).optional(),
    machineMinutes: z.coerce.number().int().min(0).optional(),
    downtimeMinutes: z.coerce.number().int().min(0).optional(),
    remarks: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().trim().min(1).max(150),
    lineOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine((v) => v.goodQuantity + v.reworkQuantity + v.rejectedQuantity + v.scrapQuantity > 0, {
    message: 'At least one quantity must be greater than zero',
  })

export const correctDailyLineSchema = z.object({
  goodQuantity: quantityField,
  reworkQuantity: quantityField,
  rejectedQuantity: quantityField,
  scrapQuantity: quantityField,
  reason: z.string().trim().min(1).max(500),
})

export const listDailyBatchesQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'SUBMITTED', 'PARTIALLY_REVERSED', 'REVERSED']).optional(),
  productionDate: z.string().min(4).optional(),
  workCentreId: z.string().uuid().optional(),
})

export type CreateDailyBatchInput = z.infer<typeof createDailyBatchSchema>
export type UpdateDailyBatchInput = z.infer<typeof updateDailyBatchSchema>
export type UpsertDailyLineInput = z.infer<typeof upsertDailyLineSchema>
export type CorrectDailyLineInput = z.infer<typeof correctDailyLineSchema>
export type ListDailyBatchesQuery = z.infer<typeof listDailyBatchesQuerySchema>
