import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listAttendanceDaysQuerySchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z
    .enum(['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'WEEKLY_OFF', 'HOLIDAY', 'ON_DUTY'])
    .optional(),
})

export const listExceptionsQuerySchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  resolved: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const createPunchSchema = z.object({
  employeeId: z.string().uuid(),
  punchedAt: z.string().min(1),
  punchType: z.enum(['IN', 'OUT']),
  source: z.string().trim().max(32).optional(),
  deviceRef: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
})

export const finalizeAttendanceDaySchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type ListAttendanceDaysQuery = z.infer<typeof listAttendanceDaysQuerySchema>
export type ListExceptionsQuery = z.infer<typeof listExceptionsQuerySchema>
export type CreatePunchInput = z.infer<typeof createPunchSchema>
export type FinalizeAttendanceDayInput = z.infer<typeof finalizeAttendanceDaySchema>
