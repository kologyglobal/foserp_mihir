import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listCalendarsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export const createCalendarSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(150),
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  year: z.number().int().min(2000).max(2100),
  isActive: z.boolean().optional(),
})

export const updateCalendarSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  branchId: z.string().uuid().nullable().optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  isActive: z.boolean().optional(),
})

export const createHolidayDaySchema = z.object({
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(150),
  holidayType: z.enum(['NATIONAL', 'FESTIVAL', 'COMPANY', 'OPTIONAL']),
  optionalHoliday: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const updateHolidayDaySchema = createHolidayDaySchema.partial()

export const calendarIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  calendarId: z.string().uuid(),
})

export const holidayDayParamSchema = calendarIdParamSchema.extend({
  dayId: z.string().uuid(),
})

export const resolveHolidayQuerySchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type CreateCalendarInput = z.infer<typeof createCalendarSchema>
export type UpdateCalendarInput = z.infer<typeof updateCalendarSchema>
export type CreateHolidayDayInput = z.infer<typeof createHolidayDaySchema>
export type UpdateHolidayDayInput = z.infer<typeof updateHolidayDaySchema>
export type ListCalendarsQuery = z.infer<typeof listCalendarsQuerySchema>
