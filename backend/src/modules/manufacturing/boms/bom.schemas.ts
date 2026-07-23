import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const QUANTITY_BASIS_VALUES = ['PER_UNIT', 'FIXED_PER_ORDER', 'PER_BATCH'] as const
export const MAKE_OR_BUY_VALUES = ['MAKE', 'BUY'] as const
export const BOM_LINE_TYPE_VALUES = [
  'RAW_MATERIAL',
  'BOUGHT_OUT',
  'CONSUMABLE',
  'SUBASSEMBLY',
  'MANUFACTURED_COMPONENT',
  'PACKAGING',
  'SERVICE',
] as const
export const CONSUMPTION_METHOD_VALUES = ['BACKFLUSH', 'ACTUAL', 'MANUAL_ADJUSTED'] as const

export const listBomsQuerySchema = paginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      return value === 'true'
    }),
  productItemId: z.string().uuid().optional(),
})

export const createBomSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(300),
  productItemId: z.string().uuid(),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
})

export const updateBomSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const listBomVersionsQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'SUPERSEDED', 'ARCHIVED']).optional(),
})

export const createBomVersionSchema = z.object({
  revisionCode: z.string().trim().min(1).max(32),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  baseQuantity: z.coerce.number().positive(),
  baseUomId: z.string().uuid(),
  expectedYieldPercent: z.coerce.number().min(0).max(100).default(100),
  drawingRevision: z.string().trim().max(64).optional(),
  revisionNotes: z.string().trim().max(4000).optional(),
})

export const updateBomVersionSchema = z.object({
  revisionCode: z.string().trim().min(1).max(32).optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  baseQuantity: z.coerce.number().positive().optional(),
  baseUomId: z.string().uuid().optional(),
  expectedYieldPercent: z.coerce.number().min(0).max(100).optional(),
  drawingRevision: z.string().trim().max(64).nullable().optional(),
  revisionNotes: z.string().trim().max(4000).nullable().optional(),
})

export const createBomLineSchema = z.object({
  parentLineId: z.string().uuid().nullable().optional(),
  sequence: z.coerce.number().int().positive().optional(),
  itemId: z.string().uuid(),
  descriptionOverride: z.string().trim().max(500).optional(),
  quantity: z.coerce.number().positive(),
  uomId: z.string().uuid(),
  quantityBasis: z.enum(QUANTITY_BASIS_VALUES).default('PER_UNIT'),
  fixedQuantity: z.coerce.number().min(0).nullable().optional(),
  scrapPercent: z.coerce.number().min(0).max(100).default(0),
  yieldPercent: z.coerce.number().min(0).max(100).default(100),
  makeOrBuy: z.enum(MAKE_OR_BUY_VALUES).default('MAKE'),
  lineType: z.enum(BOM_LINE_TYPE_VALUES),
  issueStageGroupId: z.string().trim().max(36).nullable().optional(),
  issueOperationId: z.string().trim().max(36).nullable().optional(),
  consumptionMethod: z.enum(CONSUMPTION_METHOD_VALUES).nullable().optional(),
  isOptional: z.boolean().default(false),
  substituteAllowed: z.boolean().default(false),
  qualityRequired: z.boolean().default(false),
  certificateRequired: z.boolean().default(false),
  childProductionOrderRequired: z.boolean().default(false),
  stockedSemiFinished: z.boolean().default(false),
  phantomAssembly: z.boolean().default(false),
  drawingReference: z.string().trim().max(64).optional(),
  specification: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
})

export const updateBomLineSchema = createBomLineSchema.partial()

export const compareBomVersionsQuerySchema = z.object({
  from: z.string().uuid().optional(),
  to: z.string().uuid(),
})

const bomImportRowSchema = z.record(z.string(), z.string())

export const previewBomImportSchema = z.object({
  rows: z.array(bomImportRowSchema).min(1).max(2000),
  restrictBomCode: z.string().trim().min(1).max(64).optional(),
})

export const confirmBomImportSchema = previewBomImportSchema.extend({
  idempotencyKey: z.string().uuid(),
})

export type ListBomsQuery = z.infer<typeof listBomsQuerySchema>
export type CreateBomInput = z.infer<typeof createBomSchema>
export type UpdateBomInput = z.infer<typeof updateBomSchema>
export type ListBomVersionsQuery = z.infer<typeof listBomVersionsQuerySchema>
export type CreateBomVersionInput = z.infer<typeof createBomVersionSchema>
export type UpdateBomVersionInput = z.infer<typeof updateBomVersionSchema>
export type CreateBomLineInput = z.infer<typeof createBomLineSchema>
export type UpdateBomLineInput = z.infer<typeof updateBomLineSchema>
export type CompareBomVersionsQuery = z.infer<typeof compareBomVersionsQuerySchema>
export type PreviewBomImportInput = z.infer<typeof previewBomImportSchema>
export type ConfirmBomImportInput = z.infer<typeof confirmBomImportSchema>
