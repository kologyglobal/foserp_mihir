import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const createStockCountSchema = z.object({
  warehouseId: z.string().uuid(),
  countDate: z.coerce.date().optional(),
  itemIds: z.array(z.string().uuid()).min(1).optional(),
  remarks: z.string().trim().max(2000).optional(),
})

export const listStockCountsSchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'SNAPSHOTTED', 'COUNTING', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED']).optional(),
  warehouseId: z.string().uuid().optional(),
})

export const enterCountsSchema = z.object({
  lines: z.array(z.object({
    lineId: z.string().uuid(),
    countedQty: z.coerce.number().min(0).finite(),
    remarks: z.string().trim().max(1000).optional(),
  })).min(1),
})

export const stockCountPostingSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(100),
  remarks: z.string().trim().max(2000).optional(),
})

export const stockCountActionSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export type CreateStockCountInput = z.infer<typeof createStockCountSchema>
export type ListStockCountsInput = z.infer<typeof listStockCountsSchema>
export type EnterCountsInput = z.infer<typeof enterCountsSchema>
export type StockCountPostingInput = z.infer<typeof stockCountPostingSchema>
