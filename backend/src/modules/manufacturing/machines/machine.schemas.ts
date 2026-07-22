import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const MACHINE_STATUSES = ['AVAILABLE', 'IN_USE', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE'] as const

export const listMachinesQuerySchema = paginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      return value === 'true'
    }),
  workCentreId: z.string().uuid().optional(),
  status: z.enum(MACHINE_STATUSES).optional(),
})

const machineBaseSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  workCentreId: z.string().uuid(),
  description: z.string().trim().max(2000).optional(),
  manufacturer: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  serialNumber: z.string().trim().max(100).optional(),
  capacity: z.coerce.number().min(0).optional(),
  costRate: z.coerce.number().min(0).nullable().optional(),
  capacityUomId: z.string().uuid().nullable().optional(),
  status: z.enum(MACHINE_STATUSES).optional(),
  isActive: z.boolean().optional(),
})

export const createMachineSchema = machineBaseSchema
export const updateMachineSchema = machineBaseSchema.partial()

export const setMachineStatusSchema = z.object({
  status: z.enum(MACHINE_STATUSES),
})

export type ListMachinesQuery = z.infer<typeof listMachinesQuerySchema>
export type CreateMachineInput = z.infer<typeof createMachineSchema>
export type UpdateMachineInput = z.infer<typeof updateMachineSchema>
export type SetMachineStatusInput = z.infer<typeof setMachineStatusSchema>
