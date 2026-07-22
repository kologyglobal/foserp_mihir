import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'

export const listTreasuryTransactionsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  treasuryAccountId: z.string().uuid().optional(),
  accountType: z.enum(['BANK', 'CASH']).optional(),
  dateFrom: z.string().trim().min(8).max(32).optional(),
  dateTo: z.string().trim().min(8).max(32).optional(),
  reconciliationStatus: z.enum(['FULLY_RECONCILED', 'UNRECONCILED', 'PARTIALLY_RECONCILED']).optional(),
})

export type ListTreasuryTransactionsQuery = z.infer<typeof listTreasuryTransactionsQuerySchema>
