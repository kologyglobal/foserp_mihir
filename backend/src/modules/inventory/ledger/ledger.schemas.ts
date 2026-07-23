import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const movementTypeValues = ['OPENING', 'INWARD', 'ISSUE', 'ADJUSTMENT'] as const
const referenceTypeValues = [
  'OPN',
  'INW',
  'ISS',
  'ADJ',
  'GRN',
  'ISSUE_TO_WO',
  'RETURN_FROM_WO',
  'FG_RECEIPT',
  'SA_RECEIPT',
  'FG_DISPATCH',
] as const

export const listLedgerQuerySchema = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  movementType: z.enum(movementTypeValues).optional(),
  referenceType: z.enum(referenceTypeValues).optional(),
  workOrderId: z.string().uuid().optional(),
  stockStatus: z.enum(['UNRESTRICTED', 'QC_HOLD', 'BLOCKED', 'REJECTED']).optional(),
  batchId: z.string().uuid().optional(),
  serialId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
})

export type ListLedgerQuery = z.infer<typeof listLedgerQuerySchema>
