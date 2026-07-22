import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const optionalUuid = z.string().uuid().nullable().optional()

export const listWarehouseMappingsQuerySchema = paginationSchema.extend({
  plantCode: z.string().trim().max(32).optional(),
  isDefault: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      return value === 'true'
    }),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      return value === 'true'
    }),
})

const warehouseMappingBaseSchema = z.object({
  plantCode: z.string().trim().max(32).nullable().optional(),
  rawMaterialWarehouseId: z.string().uuid(),
  productionIssueWarehouseId: optionalUuid,
  wipWarehouseId: optionalUuid,
  finishedGoodsWarehouseId: z.string().uuid(),
  qualityHoldWarehouseId: optionalUuid,
  reworkWarehouseId: optionalUuid,
  scrapWarehouseId: optionalUuid,
  jobWorkWarehouseId: optionalUuid,
  defaultReturnWarehouseId: optionalUuid,
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const createWarehouseMappingSchema = warehouseMappingBaseSchema
export const updateWarehouseMappingSchema = warehouseMappingBaseSchema.partial()

export const resolveWarehouseMappingQuerySchema = z.object({
  plantCode: z.string().trim().max(32).optional(),
  profileId: z.string().uuid().optional(),
})

export type ListWarehouseMappingsQuery = z.infer<typeof listWarehouseMappingsQuerySchema>
export type CreateWarehouseMappingInput = z.infer<typeof createWarehouseMappingSchema>
export type UpdateWarehouseMappingInput = z.infer<typeof updateWarehouseMappingSchema>
export type ResolveWarehouseMappingQuery = z.infer<typeof resolveWarehouseMappingQuerySchema>
