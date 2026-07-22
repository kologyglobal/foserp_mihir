import { z } from 'zod'
import { WIP_MOVEMENT_TYPES } from './wip-movement.enums.js'

export const listWipMovementsQuerySchema = z.object({
  movementType: z.enum(WIP_MOVEMENT_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const createWipMovementSchema = z
  .object({
    movementType: z.enum(WIP_MOVEMENT_TYPES),
    itemId: z.string().uuid().optional(),
    quantity: z.coerce.number().positive(),
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    targetProductionOrderId: z.string().uuid().optional(),
    stageId: z.string().uuid().optional(),
    operationId: z.string().uuid().optional(),
    materialLineId: z.string().uuid().optional(),
    reason: z.string().trim().min(1).max(2000),
    remarks: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().trim().min(1).max(150).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.movementType === 'WO_TO_WO' && !val.targetProductionOrderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'targetProductionOrderId is required for WO_TO_WO transfers',
        path: ['targetProductionOrderId'],
      })
    }
    if (val.movementType === 'MATERIAL_RELOCATE' && !val.materialLineId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'materialLineId is required for MATERIAL_RELOCATE',
        path: ['materialLineId'],
      })
    }
    if (val.fromWarehouseId === val.toWarehouseId && val.movementType !== 'WO_TO_WO') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fromWarehouseId and toWarehouseId must differ for location/material moves',
        path: ['toWarehouseId'],
      })
    }
  })

export const transferToWorkOrderSchema = z.object({
  itemId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  materialLineId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(2000),
  remarks: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
})

export type ListWipMovementsQuery = z.infer<typeof listWipMovementsQuerySchema>
export type CreateWipMovementInput = z.infer<typeof createWipMovementSchema>
export type TransferToWorkOrderInput = z.infer<typeof transferToWorkOrderSchema>
