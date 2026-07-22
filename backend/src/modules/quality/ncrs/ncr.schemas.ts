import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listNcrsQuerySchema = paginationSchema.extend({
  status: z.enum(['OPEN', 'DISPOSITION_PENDING', 'ACTION_IN_PROGRESS', 'VERIFICATION_PENDING', 'INVESTIGATING', 'CORRECTIVE_ACTION', 'APPROVED', 'CLOSED', 'CANCELLED']).optional(),
  productionOrderId: z.string().uuid().optional(),
})
export const dispositionNcrSchema = z.object({ disposition: z.enum(['REWORK','RETURN_TO_SUPPLIER','SCRAP','USE_AS_IS','DEVIATION','SORT_AND_ACCEPT','REINSPECT','HOLD']), dispositionQuantity: z.number().positive().optional(), dispositionNotes: z.string().max(5000).optional(), ownerId: z.string().uuid().optional(), targetDate: z.string().datetime().optional() })
export const actionNcrSchema = z.object({ containmentAction: z.string().max(5000).optional(), rootCause: z.string().max(5000).optional(), correctiveAction: z.string().max(5000).optional(), preventiveAction: z.string().max(5000).optional() })
export const verifyNcrSchema = z.object({ effectivenessReview: z.string().max(5000).optional() })

export const closeNcrSchema = z.object({
  closureNotes: z.string().max(5000).optional(),
})

export type ListNcrsQuery = z.infer<typeof listNcrsQuerySchema>
export type CloseNcrInput = z.infer<typeof closeNcrSchema>
