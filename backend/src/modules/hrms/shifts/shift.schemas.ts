import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:mm')

export const listShiftsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export const createShiftSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(150),
  legalEntityId: z.string().uuid().nullable().optional(),
  startTime: timeSchema,
  endTime: timeSchema,
  breakMinutes: z.number().int().min(0).default(0),
  graceInMinutes: z.number().int().min(0).default(0),
  graceOutMinutes: z.number().int().min(0).nullable().optional(),
  fullDayMinimumMinutes: z.number().int().positive(),
  halfDayMinimumMinutes: z.number().int().positive(),
  otEligible: z.boolean().default(true),
  otStartsAfterMinutes: z.number().int().min(0).nullable().optional(),
  overnightShift: z.boolean().optional(),
  weeklyOffDay: z.number().int().min(0).max(6).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const updateShiftSchema = createShiftSchema.partial().omit({ code: true }).extend({
  code: z.string().trim().min(1).max(32).optional(),
})

export const shiftIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  shiftId: z.string().uuid(),
})

export type CreateShiftInput = z.infer<typeof createShiftSchema>
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>
export type ListShiftsQuery = z.infer<typeof listShiftsQuerySchema>
