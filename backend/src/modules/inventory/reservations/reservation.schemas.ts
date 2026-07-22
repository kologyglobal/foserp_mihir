import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const createReservationSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  demandType: z.enum(['SO', 'WO', 'DISPATCH']),
  demandId: z.string().uuid(),
  referenceNo: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
})

export const cancelReservationSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export const listReservationsQuerySchema = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  demandType: z.enum(['SO', 'WO', 'DISPATCH']).optional(),
  demandId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'FULFILLED', 'CANCELLED']).optional(),
})

export type CreateReservationInput = z.infer<typeof createReservationSchema>
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>
