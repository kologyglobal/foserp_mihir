import { z } from 'zod'

export const reserveMaterialsSchema = z.object({
  materialIds: z.array(z.string().uuid()).optional(),
})

export const issueMaterialSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0).optional(),
  idempotencyKey: z.string().trim().min(1).max(150),
  remarks: z.string().trim().max(2000).optional(),
  /** Override material warehouse when the requirement line has none configured. */
  warehouseId: z.string().uuid().optional(),
  /** When true (or with manufacturing.material.additional_issue), allow issue beyond remaining requirement. */
  additional: z.boolean().optional(),
})

export const issuePreviewSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  additional: z.boolean().optional(),
})

export const returnMaterialSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  remarks: z.string().trim().max(2000).optional(),
})

export const shortageRequisitionSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  submit: z.boolean().default(false),
  /** When set, only these material lines are considered for the shortage PR. */
  materialIds: z.array(z.string().uuid()).min(1).optional(),
})

export const releaseReservationSchema = z.object({
  materialIds: z.array(z.string().uuid()).optional(),
  reason: z.string().trim().max(2000).optional(),
})

export const reallocateReservationSchema = z.object({
  sourceMaterialId: z.string().uuid(),
  targetWorkOrderId: z.string().uuid(),
  targetMaterialId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive(),
  reason: z.string().trim().max(2000).optional(),
})

const BOM_LINE_TYPE_VALUES = [
  'RAW_MATERIAL',
  'BOUGHT_OUT',
  'CONSUMABLE',
  'SUBASSEMBLY',
  'MANUFACTURED_COMPONENT',
  'PACKAGING',
  'SERVICE',
] as const

/** Manual WO material line (also appends a BOM-snapshot line for this WO only). */
export const addMaterialRequirementSchema = z.object({
  itemId: z.string().uuid(),
  uomId: z.string().uuid(),
  requiredQty: z.coerce.number().positive(),
  makeOrBuy: z.enum(['MAKE', 'BUY']).default('BUY'),
  lineType: z.enum(BOM_LINE_TYPE_VALUES).default('RAW_MATERIAL'),
  remarks: z.string().trim().max(2000).optional(),
})

/** Adjust required qty / substitute item on an existing WO material line (BOM-synced or manual). */
export const updateMaterialRequirementSchema = z
  .object({
    requiredQty: z.coerce.number().positive().optional(),
    itemId: z.string().uuid().optional(),
    uomId: z.string().uuid().optional(),
    remarks: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (v) =>
      v.requiredQty !== undefined ||
      v.itemId !== undefined ||
      v.uomId !== undefined ||
      v.remarks !== undefined,
    { message: 'At least one field is required' },
  )

export type ReserveMaterialsInput = z.infer<typeof reserveMaterialsSchema>
export type IssueMaterialInput = z.infer<typeof issueMaterialSchema>
export type IssuePreviewInput = z.infer<typeof issuePreviewSchema>
export type ReturnMaterialInput = z.infer<typeof returnMaterialSchema>
export type ShortageRequisitionInput = z.infer<typeof shortageRequisitionSchema>
export type ReleaseReservationInput = z.infer<typeof releaseReservationSchema>
export type ReallocateReservationInput = z.infer<typeof reallocateReservationSchema>
export type AddMaterialRequirementInput = z.infer<typeof addMaterialRequirementSchema>
export type UpdateMaterialRequirementInput = z.infer<typeof updateMaterialRequirementSchema>
