import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const PRODUCTION_TYPE_VALUES = [
  'ASSEMBLY',
  'FABRICATION',
  'MACHINING',
  'JOB_SHOP',
  'REPETITIVE',
  'PROJECT',
  'ENGINEER_TO_ORDER',
  'SUBCONTRACT',
] as const
export const EXECUTION_MODE_VALUES = ['SIMPLE', 'DETAILED'] as const
export const PLANNING_METHOD_VALUES = ['MANUAL', 'SALES_ORDER', 'STOCK_REPLENISHMENT', 'PRODUCTION_PLAN'] as const
export const CONSUMPTION_METHOD_VALUES = ['BACKFLUSH', 'ACTUAL', 'MANUAL_ADJUSTED'] as const
export const WIP_TRACKING_METHOD_VALUES = ['LOGICAL_WIP', 'STOCKED_SEMI_FINISHED', 'BOTH'] as const
export const OUTPUT_TRACKING_METHOD_VALUES = [
  'QUANTITY',
  'LOT',
  'BATCH',
  'SERIAL',
  'JOB',
  'PROJECT',
  'HEAT',
  'PIECE',
] as const

export const listProfilesQuerySchema = paginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      return value === 'true'
    }),
  productItemId: z.string().uuid().optional(),
  productionType: z.enum(PRODUCTION_TYPE_VALUES).optional(),
})

const profileBaseSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(300),
  productItemId: z.string().uuid(),
  productionType: z.enum(PRODUCTION_TYPE_VALUES),
  executionMode: z.enum(EXECUTION_MODE_VALUES).default('SIMPLE'),
  defaultBomVersionId: z.string().uuid().nullable().optional(),
  defaultRoutingVersionId: z.string().uuid().nullable().optional(),
  defaultQualityPlanRef: z.string().trim().max(64).optional(),
  planningMethod: z.enum(PLANNING_METHOD_VALUES).default('MANUAL'),
  materialConsumptionMethod: z.enum(CONSUMPTION_METHOD_VALUES).default('BACKFLUSH'),
  wipTrackingMethod: z.enum(WIP_TRACKING_METHOD_VALUES).default('LOGICAL_WIP'),
  outputTrackingMethod: z.enum(OUTPUT_TRACKING_METHOD_VALUES).default('QUANTITY'),
  plantCode: z.string().trim().max(32).optional(),
  productionWarehouseId: z.string().uuid().nullable().optional(),
  wipWarehouseId: z.string().uuid().nullable().optional(),
  finishedGoodsWarehouseId: z.string().uuid().nullable().optional(),
  scrapWarehouseId: z.string().uuid().nullable().optional(),
  directProductionOrderAllowed: z.boolean().default(true),
  partialCompletionAllowed: z.boolean().default(true),
  overproductionTolerancePercent: z.coerce.number().min(0).max(100).default(0),
  underproductionTolerancePercent: z.coerce.number().min(0).max(100).default(0),
  serialTrackingRequired: z.boolean().default(false),
  batchTrackingRequired: z.boolean().default(false),
  jobTrackingRequired: z.boolean().default(false),
  heatTrackingRequired: z.boolean().default(false),
  subcontractingAllowed: z.boolean().default(false),
  childProductionOrdersEnabled: z.boolean().default(false),
  approvalRuleRef: z.string().trim().max(64).optional(),
  isActive: z.boolean().default(true),
})

export const createProfileSchema = profileBaseSchema
export const updateProfileSchema = profileBaseSchema.partial()

export type ListProfilesQuery = z.infer<typeof listProfilesQuerySchema>
export type CreateProfileInput = z.infer<typeof createProfileSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
