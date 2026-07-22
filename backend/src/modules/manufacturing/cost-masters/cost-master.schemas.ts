import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listCostMastersQuerySchema = paginationSchema.extend({
  isActive: z.enum(['true', 'false']).optional(),
})

const labourRateCardFields = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  workCentreId: z.string().uuid().nullable().optional(),
  roleCode: z.string().trim().max(64).nullable().optional(),
  operatorUserId: z.string().uuid().nullable().optional(),
  ratePerHour: z.coerce.number().min(0),
  currencyCode: z.string().trim().min(3).max(8).default('INR'),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
})

const overheadCostPoolFields = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  plantCode: z.string().trim().max(32).nullable().optional(),
  driverType: z.enum(['LABOUR_HOURS', 'MACHINE_HOURS', 'GOOD_UNITS', 'SETUPS']),
  periodAmount: z.coerce.number().min(0),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  isActive: z.boolean().default(true),
})

export const createLabourRateCardSchema = labourRateCardFields.refine(
  (value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom,
  { path: ['effectiveTo'], message: 'effectiveTo must be on or after effectiveFrom' },
)
export const updateLabourRateCardSchema = labourRateCardFields.partial()
export const createOverheadCostPoolSchema = overheadCostPoolFields.refine(
  (value) => value.periodEnd >= value.periodStart,
  { path: ['periodEnd'], message: 'periodEnd must be on or after periodStart' },
)
export const updateOverheadCostPoolSchema = overheadCostPoolFields.partial()

export type ListCostMastersQuery = z.infer<typeof listCostMastersQuerySchema>
export type CreateLabourRateCardInput = z.infer<typeof createLabourRateCardSchema>
export type UpdateLabourRateCardInput = z.infer<typeof updateLabourRateCardSchema>
export type CreateOverheadCostPoolInput = z.infer<typeof createOverheadCostPoolSchema>
export type UpdateOverheadCostPoolInput = z.infer<typeof updateOverheadCostPoolSchema>
