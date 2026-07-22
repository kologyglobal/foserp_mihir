import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'

const isoDateString = z.string().trim().min(8).max(32)

export const liquidityQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  asOfDate: isoDateString.optional(),
  currencyCode: z.string().trim().min(3).max(8).optional(),
})

export const forecastQuerySchema = liquidityQuerySchema.extend({
  horizonDays: z.coerce.number().int().min(1).max(90).default(30),
})

export const listDayClosesQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  status: z.enum(['OPEN', 'REVIEWED', 'CLOSED']).optional(),
  dateFrom: isoDateString.optional(),
  dateTo: isoDateString.optional(),
})

export const createDayCloseSchema = z.object({
  legalEntityId: z.string().uuid(),
  closeDate: isoDateString,
  notes: z.string().trim().max(1000).nullable().optional(),
})

export const dayCloseLifecycleSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export const reopenDayCloseSchema = dayCloseLifecycleSchema.extend({
  reason: z.string().trim().min(1).max(500),
})

export type LiquidityQuery = z.infer<typeof liquidityQuerySchema>
export type ForecastQuery = z.infer<typeof forecastQuerySchema>
export type ListDayClosesQuery = z.infer<typeof listDayClosesQuerySchema>
export type CreateDayCloseInput = z.infer<typeof createDayCloseSchema>
export type DayCloseLifecycleInput = z.infer<typeof dayCloseLifecycleSchema>
export type ReopenDayCloseInput = z.infer<typeof reopenDayCloseSchema>
