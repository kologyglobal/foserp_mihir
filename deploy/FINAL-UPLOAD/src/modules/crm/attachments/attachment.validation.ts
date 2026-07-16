import { z } from 'zod'

export const attachmentIdParamSchema = z.object({
  attachmentId: z.string().uuid(),
})
