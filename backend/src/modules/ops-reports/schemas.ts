import { z } from 'zod'
import { reportFiltersSchema, reportKeyParamSchema } from './filters.js'

export { reportKeyParamSchema, reportFiltersSchema }

export const reportQueryBodySchema = reportFiltersSchema

export type ReportQueryBodyInput = z.infer<typeof reportQueryBodySchema>
