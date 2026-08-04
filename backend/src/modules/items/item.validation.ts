import { z } from 'zod'
import { paginationSchema } from '../../utils/pagination.js'
import { assertRawMaterialItemName, isRawMaterialItem } from './item-naming.rules.js'

export const listItemsQuerySchema = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  categoryId: z.string().uuid().optional(),
  itemType: z.enum(['raw', 'bought_out', 'consumable', 'sub_assembly', 'finished_good', 'scrap', 'service']).optional(),
  salesAllowed: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      return value === 'true' || value === '1'
    }),
})

const ITEM_TYPE_ENUM = z.enum(['raw', 'bought_out', 'consumable', 'sub_assembly', 'finished_good', 'scrap', 'service'])
const FULFILMENT_METHOD_ENUM = z.enum([
  'STOCK',
  'PURCHASE',
  'PRODUCTION',
  'SUBCONTRACT',
  'SERVICE',
  'MANUAL',
])

export const itemLookupQuerySchema = paginationSchema.extend({
  itemType: ITEM_TYPE_ENUM.optional(),
  /** Comma-separated or repeated query values — e.g. finished_good,sub_assembly */
  itemTypes: z
    .union([ITEM_TYPE_ENUM, z.array(ITEM_TYPE_ENUM), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      const list = Array.isArray(value)
        ? value
        : String(value)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
      const allowed = new Set(ITEM_TYPE_ENUM.options)
      const unique = [...new Set(list)].filter((v): v is z.infer<typeof ITEM_TYPE_ENUM> => allowed.has(v as z.infer<typeof ITEM_TYPE_ENUM>))
      return unique.length > 0 ? unique : undefined
    }),
  salesAllowed: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      return value === 'true' || value === '1'
    }),
  activeOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return true
      if (typeof value === 'boolean') return value
      return value === 'true' || value === '1'
    }),
})

const itemBaseSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(300),
  itemName2: z.string().trim().max(300).optional(),
  itemDescription: z.string().trim().max(5000).default(''),
  categoryId: z.string().uuid(),
  baseUomId: z.string().uuid(),
  itemType: z.enum(['raw', 'bought_out', 'consumable', 'sub_assembly', 'finished_good', 'scrap', 'service']),
  productType: z
    .enum(['boi', 'raw_material', 'sub_assembly', 'assembly_product', 'finish_product', 'scrap', 'service'])
    .optional(),
  inventoryType: z.enum(['inventory', 'non_inventory', 'service']).optional(),
  codeSeriesMode: z.enum(['auto', 'manual']).optional(),
  materialGrade: z.string().trim().max(100).default(''),
  hsnCode: z.string().trim().max(16).default(''),
  hsnId: z.string().uuid().nullable().optional(),
  gstGroupId: z.string().uuid().nullable().optional(),
  reorderLevel: z.coerce.number().min(0).default(0),
  reorderQty: z.coerce.number().min(0).default(0),
  standardRate: z.coerce.number().min(0).default(0),
  isPurchasable: z.boolean().optional(),
  isStockable: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  quantityPerUom: z.coerce.number().min(0).default(1),
  purchaseUomId: z.string().uuid().nullable().optional(),
  /** @deprecated Prefer uomConversionFactor — mirrored on write. */
  purchaseQtyPerUom: z.coerce.number().positive().default(1),
  /** Vendor units per 1 primary/base unit. */
  uomConversionFactor: z.coerce.number().positive().optional(),
  /** ±% receiving tolerance vs open PO qty on GRN (legacy dual-read). */
  receivingTolerancePercentage: z.coerce.number().min(0).max(100).optional(),
  receivingToleranceId: z.string().uuid().nullable().optional(),
  receiptEntryMode: z.enum(['UNIT_ONLY', 'WEIGHT_ONLY', 'UNIT_AND_WEIGHT']).optional(),
  conversionCalculationMode: z.enum(['AUTOMATIC', 'MANUAL']).optional(),
  allowManualUnitQuantity: z.boolean().optional(),
  allowManualWeightQuantity: z.boolean().optional(),
  requireWeightAtReceipt: z.boolean().optional(),
  weightUomId: z.string().uuid().nullable().optional(),
  standardWeightPerBaseUnit: z.coerce.number().min(0).optional(),
  salesDescription: z.string().trim().max(5000).nullable().optional(),
  salesUomId: z.string().uuid().nullable().optional(),
  defaultSalesRate: z.coerce.number().min(0).optional(),
  salesLeadDays: z.coerce.number().int().min(0).optional(),
  salesAllowed: z.boolean().optional(),
  defaultFulfilmentMethod: FULFILMENT_METHOD_ENUM.optional(),
  productionAllowed: z.boolean().optional(),
  qcRequired: z.boolean().optional(),
  batchTracked: z.boolean().optional(),
  serialTracked: z.boolean().optional(),
  qualityTestGroupCode: z.string().trim().max(32).nullable().optional(),
  productionBomId: z.string().trim().max(36).nullable().optional(),
  routingNo: z.string().trim().max(64).nullable().optional(),
  drawingNo: z.string().trim().max(64).nullable().optional(),
  subAssemblyRule: z.enum(['phantom', 'manufactured', 'purchased', 'subcontracted']).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  uomConversions: z
    .array(
      z.object({
        uomId: z.string().uuid(),
        conversionFactor: z.coerce.number().positive(),
        isPurchaseAllowed: z.boolean().optional(),
        isDefaultPurchase: z.boolean().optional(),
      }),
    )
    .optional(),
})

function validateItemNameFormat(
  data: { name?: string; itemType?: string; productType?: string },
  ctx: z.RefinementCtx,
  namePath: 'name' = 'name',
): void {
  if (!data.name?.trim()) return
  if (!isRawMaterialItem(data.itemType, data.productType)) return
  try {
    assertRawMaterialItemName(data.name, data.itemType, data.productType)
  } catch (err) {
    ctx.addIssue({
      code: 'custom',
      message: err instanceof Error ? err.message : 'Invalid raw material item name',
      path: [namePath],
    })
  }
}

function validateItemRules(data: z.infer<typeof itemBaseSchema>, ctx: z.RefinementCtx): void {
  if (data.itemType === 'sub_assembly' && !data.subAssemblyRule) {
    ctx.addIssue({ code: 'custom', message: 'Sub-assembly rule required', path: ['subAssemblyRule'] })
  }
  const factor = data.uomConversionFactor ?? data.purchaseQtyPerUom
  if (factor !== undefined && !(Number(factor) > 0)) {
    ctx.addIssue({
      code: 'custom',
      message: 'uomConversionFactor must be greater than zero',
      path: ['uomConversionFactor'],
    })
  }
  validateItemNameFormat(data, ctx)
}

export const createItemSchema = itemBaseSchema.superRefine(validateItemRules)
export const updateItemSchema = itemBaseSchema.partial().superRefine((data, ctx) => {
  if (data.itemType === 'sub_assembly' && data.subAssemblyRule === null) {
    ctx.addIssue({ code: 'custom', message: 'Sub-assembly rule required', path: ['subAssemblyRule'] })
  }
  validateItemNameFormat(data, ctx)
})

export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>
export type ItemLookupQuery = z.infer<typeof itemLookupQuerySchema>
export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
