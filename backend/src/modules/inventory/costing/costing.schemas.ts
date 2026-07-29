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

export const runReconciliationBodySchema = z
  .object({
    itemId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    mismatchesOnly: z.boolean().optional(),
  })
  .default({})

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

export const effectiveMethodQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  postingDate: z.coerce.date().optional(),
})

export type EffectiveMethodQuery = z.infer<typeof effectiveMethodQuerySchema>

export const itemCostingSummaryParamSchema = z.object({
  itemId: z.string().uuid(),
})

export const listValuationItemsQuerySchema = paginationSchema.extend({
  warehouseId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
})

export const listMovingAverageQuerySchema = paginationSchema.extend({
  warehouseId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
})

export const listStandardCostsQuerySchema = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED']).optional(),
})

export const listSpecificQuerySchema = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  unidentifiedOnly: z.coerce.boolean().optional(),
})

export const methodChangePreviewQuerySchema = z.object({
  toMethod: z.enum(['standard', 'average', 'fifo', 'specific']),
  effectiveDate: z.coerce.date().optional(),
})

export type MethodChangePreviewQuery = z.infer<typeof methodChangePreviewQuerySchema>

export const listMovingAverageHistoryQuerySchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export type ListMovingAverageHistoryQuery = z.infer<typeof listMovingAverageHistoryQuerySchema>

export type ListValuationItemsQuery = z.infer<typeof listValuationItemsQuerySchema>
export type ListMovingAverageQuery = z.infer<typeof listMovingAverageQuerySchema>
export type ListStandardCostsQuery = z.infer<typeof listStandardCostsQuerySchema>
export type ListSpecificQuery = z.infer<typeof listSpecificQuerySchema>
