import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { PIPELINE_STATUSES } from './pipeline.constants.js'

const stageInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(64),
  sequence: z.coerce.number().int().min(0).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  isClosedWon: z.boolean().optional(),
  isClosedLost: z.boolean().optional(),
})

export const listPipelinesQuerySchema = paginationSchema.extend({
  status: z.enum(PIPELINE_STATUSES).optional(),
  isDefault: z.coerce.boolean().optional(),
})

export const createPipelineSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(PIPELINE_STATUSES).optional(),
  stages: z.array(stageInputSchema).optional(),
})

export const updatePipelineSchema = createPipelineSchema.partial()

export type ListPipelinesQuery = z.infer<typeof listPipelinesQuerySchema>
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>
export type StageInput = z.infer<typeof stageInputSchema>
