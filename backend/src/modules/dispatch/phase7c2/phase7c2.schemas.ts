import { z } from 'zod'
import { paginationSchema, uuidParamSchema } from '../../../utils/pagination.js'

export const dispatchOrderIdParamSchema = uuidParamSchema

export const dispatchLineIdParamSchema = z.object({
  id: z.string().uuid(),
  lineId: z.string().uuid(),
})

export const reservationLineSchema = z.object({
  outboundDispatchLineId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
})

export const previewReservationsSchema = z.object({
  lines: z.array(reservationLineSchema).min(1),
})

export const postReservationsSchema = z.object({
  lines: z.array(reservationLineSchema).min(1),
  remarks: z.string().max(2000).optional(),
  idempotencyKey: z.string().max(150).optional(),
})

export const releaseReservationsSchema = z.object({
  reservationIds: z.array(z.string().uuid()).optional(),
  quantities: z
    .array(
      z.object({
        reservationId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
      }),
    )
    .optional(),
  reason: z.string().max(500).optional(),
})

export const reallocateReservationSchema = z.object({
  reservationId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  reason: z.string().max(500).optional(),
})

export const createPickListsSchema = z.object({
  idempotencyKey: z.string().max(150).optional(),
  plannedPickDate: z.string().optional(),
  priority: z.string().max(16).optional(),
  remarks: z.string().max(2000).optional(),
})

export const listPickListsQuerySchema = paginationSchema.extend({
  outboundDispatchId: z.string().uuid().optional(),
  status: z
    .enum([
      'DRAFT',
      'RELEASED',
      'IN_PROGRESS',
      'PARTIALLY_PICKED',
      'PICKED',
      'BLOCKED',
      'CANCELLED',
    ])
    .optional(),
})

export const pickActionSchema = z.object({
  pickLineId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  lotRef: z.string().max(100).optional(),
  serialRef: z.string().max(100).optional(),
  heatNumber: z.string().max(100).optional(),
  idempotencyKey: z.string().max(150).optional(),
  remarks: z.string().max(2000).optional(),
})

export const shortageSchema = z.object({
  pickLineId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  reasonCode: z.string().max(64).optional(),
  remarks: z.string().max(2000).optional(),
  idempotencyKey: z.string().max(150).optional(),
})

export const assignPickListSchema = z.object({
  assignedTo: z.string().min(1).max(191),
})

export const cancelPickListSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type PreviewReservationsInput = z.infer<typeof previewReservationsSchema>
export type PostReservationsInput = z.infer<typeof postReservationsSchema>
export type ReleaseReservationsInput = z.infer<typeof releaseReservationsSchema>
export type ReallocateReservationInput = z.infer<typeof reallocateReservationSchema>
export type CreatePickListsInput = z.infer<typeof createPickListsSchema>
export type PickActionInput = z.infer<typeof pickActionSchema>
export type ShortageInput = z.infer<typeof shortageSchema>
export type AssignPickListInput = z.infer<typeof assignPickListSchema>
export type ListPickListsQuery = z.infer<typeof listPickListsQuerySchema>
