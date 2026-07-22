import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'

const isoDateString = z.string().trim().min(8).max(32)

export const bookQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  treasuryAccountId: z.string().uuid(),
  dateFrom: isoDateString.optional(),
  dateTo: isoDateString.optional(),
})

export type BookQuery = z.infer<typeof bookQuerySchema>
