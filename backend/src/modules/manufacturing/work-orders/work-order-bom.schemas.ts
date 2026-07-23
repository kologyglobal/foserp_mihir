import { z } from 'zod'

const BOM_LINE_TYPE_VALUES = [
  'RAW_MATERIAL',
  'BOUGHT_OUT',
  'CONSUMABLE',
  'SUBASSEMBLY',
  'MANUFACTURED_COMPONENT',
  'PACKAGING',
  'SERVICE',
] as const

export const addWorkOrderBomLineSchema = z.object({
  parentLineId: z.string().uuid().nullable().optional(),
  itemId: z.string().uuid(),
  uomId: z.string().uuid(),
  perUnitQuantity: z.coerce.number().positive(),
  scrapPercent: z.coerce.number().min(0).max(100).default(0),
  makeOrBuy: z.enum(['MAKE', 'BUY']).default('BUY'),
  lineType: z.enum(BOM_LINE_TYPE_VALUES).default('RAW_MATERIAL'),
  isOptional: z.boolean().default(false),
  descriptionOverride: z.string().trim().max(500).nullable().optional(),
  /** When true (default), also create/open a materials requirement if inventory is connected. */
  syncMaterial: z.boolean().default(true),
})

export const updateWorkOrderBomLineSchema = z
  .object({
    itemId: z.string().uuid().optional(),
    uomId: z.string().uuid().optional(),
    perUnitQuantity: z.coerce.number().positive().optional(),
    scrapPercent: z.coerce.number().min(0).max(100).optional(),
    requiredQuantity: z.coerce.number().positive().optional(),
    makeOrBuy: z.enum(['MAKE', 'BUY']).optional(),
    lineType: z.enum(BOM_LINE_TYPE_VALUES).optional(),
    isOptional: z.boolean().optional(),
    descriptionOverride: z.string().trim().max(500).nullable().optional(),
    parentLineId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (v) =>
      v.itemId !== undefined ||
      v.uomId !== undefined ||
      v.perUnitQuantity !== undefined ||
      v.scrapPercent !== undefined ||
      v.requiredQuantity !== undefined ||
      v.makeOrBuy !== undefined ||
      v.lineType !== undefined ||
      v.isOptional !== undefined ||
      v.descriptionOverride !== undefined ||
      v.parentLineId !== undefined,
    { message: 'At least one field is required' },
  )

export type AddWorkOrderBomLineInput = z.infer<typeof addWorkOrderBomLineSchema>
export type UpdateWorkOrderBomLineInput = z.infer<typeof updateWorkOrderBomLineSchema>
