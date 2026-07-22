import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const lotStatuses = ['ACTIVE', 'QUARANTINE', 'EXPIRED', 'CONSUMED', 'CANCELLED'] as const
export const serialStatuses = [
  'AVAILABLE', 'RESERVED', 'QC_HOLD', 'BLOCKED', 'REJECTED', 'ISSUED', 'SCRAPPED', 'RETURNED',
] as const

const filters = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
})

export const listLotsSchema = filters.extend({ status: z.enum(lotStatuses).optional() })
export const createLotSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  lotNumber: z.string().trim().min(1).max(100),
  heatNumber: z.string().trim().max(100).optional(),
  quantityOnHand: z.coerce.number().min(0).finite().default(0),
  status: z.enum(lotStatuses).optional(),
  manufacturedAt: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  receivedAt: z.coerce.date().optional(),
  sourceReferenceType: z.string().trim().max(64).optional(),
  sourceReferenceId: z.string().trim().max(191).optional(),
})
export const patchLotStatusSchema = z.object({ status: z.enum(lotStatuses) })

export const listSerialsSchema = filters.extend({
  status: z.enum(serialStatuses).optional(),
  lotId: z.string().uuid().optional(),
})
export const createSerialSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  lotId: z.string().uuid().optional(),
  serialNumber: z.string().trim().min(1).max(100),
  status: z.enum(serialStatuses).optional(),
})
export const patchSerialStatusSchema = z.object({ status: z.enum(serialStatuses) })

export type ListLotsInput = z.infer<typeof listLotsSchema>
export type CreateLotInput = z.infer<typeof createLotSchema>
export type ListSerialsInput = z.infer<typeof listSerialsSchema>
export type CreateSerialInput = z.infer<typeof createSerialSchema>
