import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listBalancesQuerySchema = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
})

export const stockPositionQuerySchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
})

export const reconcileBalancesQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  mismatchesOnly: z.preprocess(
    (value) => value === undefined ? true : value === true || value === 'true',
    z.boolean(),
  ),
})

export type ListBalancesQuery = z.infer<typeof listBalancesQuerySchema>
export type StockPositionQuery = z.infer<typeof stockPositionQuerySchema>
export type ReconcileBalancesQuery = z.infer<typeof reconcileBalancesQuerySchema>
