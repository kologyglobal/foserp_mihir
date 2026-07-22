import { z } from 'zod'
import { paginationSchema, uuidParamSchema } from '../../../utils/pagination.js'

export const dispatchOrderIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const createPackingSessionSchema = z.object({
  idempotencyKey: z.string().max(150).optional(),
  plannedPackingDate: z.string().optional(),
  assignedTo: z.string().max(191).optional(),
  packingStation: z.string().max(64).optional(),
  remarks: z.string().max(2000).optional(),
})

export const listPackingSessionsQuerySchema = paginationSchema.extend({
  outboundDispatchId: z.string().uuid().optional(),
  status: z
    .enum([
      'DRAFT',
      'READY',
      'IN_PROGRESS',
      'PARTIALLY_PACKED',
      'PACKED',
      'VERIFIED',
      'BLOCKED',
      'CANCELLED',
    ])
    .optional(),
})

export const createPackageSchema = z.object({
  packageTypeId: z.string().uuid().optional(),
  packageReference: z.string().max(100).optional(),
  tareWeight: z.coerce.number().nonnegative().optional(),
  sealNumber: z.string().max(64).optional(),
  externalMarking: z.string().max(200).optional(),
  remarks: z.string().max(2000).optional(),
  idempotencyKey: z.string().max(150).optional(),
})

export const packActionSchema = z.object({
  pickLineId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  lotRef: z.string().max(100).optional(),
  serialRef: z.string().max(100).optional(),
  heatNumber: z.string().max(100).optional(),
  idempotencyKey: z.string().max(150).optional(),
  remarks: z.string().max(2000).optional(),
})

export const unpackActionSchema = z.object({
  packageLineId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  idempotencyKey: z.string().max(150).optional(),
  remarks: z.string().max(2000).optional(),
})

export const moveLinesSchema = z.object({
  packageLineIds: z.array(z.string().uuid()).min(1),
  destinationPackageId: z.string().uuid(),
  idempotencyKey: z.string().max(150).optional(),
  remarks: z.string().max(2000).optional(),
})

export const packingShortageSchema = z.object({
  pickLineId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  reasonCode: z.string().max(64).optional(),
  remarks: z.string().max(2000).optional(),
  idempotencyKey: z.string().max(150).optional(),
})

export const cancelPackingSessionSchema = z.object({
  reason: z.string().max(500).optional(),
})

export const cancelPackageSchema = z.object({
  reason: z.string().max(500).optional(),
})

export const updatePackageSchema = z.object({
  packageReference: z.string().max(100).nullable().optional(),
  tareWeight: z.coerce.number().nonnegative().nullable().optional(),
  grossWeight: z.coerce.number().nonnegative().nullable().optional(),
  netWeight: z.coerce.number().nonnegative().nullable().optional(),
  length: z.coerce.number().nonnegative().nullable().optional(),
  width: z.coerce.number().nonnegative().nullable().optional(),
  height: z.coerce.number().nonnegative().nullable().optional(),
  sealNumber: z.string().max(64).nullable().optional(),
  externalMarking: z.string().max(200).nullable().optional(),
  remarks: z.string().max(2000).nullable().optional(),
})

export const createPackageTypeSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  defaultTareWeight: z.coerce.number().nonnegative().optional(),
  defaultLength: z.coerce.number().nonnegative().optional(),
  defaultWidth: z.coerce.number().nonnegative().optional(),
  defaultHeight: z.coerce.number().nonnegative().optional(),
  weightUomId: z.string().uuid().optional(),
  dimensionUomId: z.string().uuid().optional(),
  reusable: z.boolean().optional(),
  active: z.boolean().optional(),
})

export const updatePackageTypeSchema = createPackageTypeSchema
  .omit({ code: true })
  .partial()
  .extend({
    description: z.string().max(2000).nullable().optional(),
    defaultTareWeight: z.coerce.number().nonnegative().nullable().optional(),
    defaultLength: z.coerce.number().nonnegative().nullable().optional(),
    defaultWidth: z.coerce.number().nonnegative().nullable().optional(),
    defaultHeight: z.coerce.number().nonnegative().nullable().optional(),
    weightUomId: z.string().uuid().nullable().optional(),
    dimensionUomId: z.string().uuid().nullable().optional(),
  })

export type CreatePackingSessionInput = z.infer<typeof createPackingSessionSchema>
export type ListPackingSessionsQuery = z.infer<typeof listPackingSessionsQuerySchema>
export type CreatePackageInput = z.infer<typeof createPackageSchema>
export type PackActionInput = z.infer<typeof packActionSchema>
export type UnpackActionInput = z.infer<typeof unpackActionSchema>
export type MoveLinesInput = z.infer<typeof moveLinesSchema>
export type PackingShortageInput = z.infer<typeof packingShortageSchema>
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>
export type CreatePackageTypeInput = z.infer<typeof createPackageTypeSchema>
export type UpdatePackageTypeInput = z.infer<typeof updatePackageTypeSchema>

export { uuidParamSchema }
