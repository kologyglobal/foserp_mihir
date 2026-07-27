import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listCostEntriesQuerySchema = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  valuationMethod: z
    .enum(['FIFO', 'MOVING_WEIGHTED_AVERAGE', 'STANDARD_COST', 'SPECIFIC_IDENTIFICATION'])
    .optional(),
  entryType: z.enum(['RECEIPT', 'ISSUE', 'ADJUSTMENT', 'OPENING']).optional(),
  workOrderId: z.string().uuid().optional(),
  inventoryMovementId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
})

export type ListCostEntriesQuery = z.infer<typeof listCostEntriesQuerySchema>

export const listCostLayersQuerySchema = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'CONSUMED', 'REVERSED', 'ADJUSTED']).optional(),
  openOnly: z.coerce.boolean().optional(),
  serialId: z.string().uuid().optional(),
  lotId: z.string().uuid().optional(),
})

export type ListCostLayersQuery = z.infer<typeof listCostLayersQuerySchema>

export const valuationReconciliationQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  mismatchesOnly: z.coerce.boolean().optional().default(false),
})

export type ValuationReconciliationQuery = z.infer<typeof valuationReconciliationQuerySchema>

export const methodChangeBodySchema = z.object({
  toMethod: z.enum(['standard', 'average', 'fifo', 'specific']),
  effectiveDate: z.coerce.date().optional(),
  reason: z.string().trim().min(3).max(2000),
  force: z.boolean().optional().default(false),
  runOpeningMigration: z.boolean().optional().default(true),
})

export type MethodChangeBody = z.infer<typeof methodChangeBodySchema>

export const upsertStandardCostBodySchema = z.object({
  itemId: z.string().uuid(),
  unitCost: z.number().nonnegative(),
  effectiveFrom: z.coerce.date(),
  remarks: z.string().trim().max(2000).optional(),
  activate: z.boolean().optional().default(true),
})

export type UpsertStandardCostBody = z.infer<typeof upsertStandardCostBodySchema>

export const listVariancesQuerySchema = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  varianceType: z
    .enum(['PURCHASE_PRICE', 'STANDARD_ISSUE', 'STANDARD_RECEIPT', 'REVALUATION', 'OTHER'])
    .optional(),
})

export type ListVariancesQuery = z.infer<typeof listVariancesQuerySchema>
