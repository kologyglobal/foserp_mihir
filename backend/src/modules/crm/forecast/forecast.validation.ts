import { z } from 'zod'

export const forecastQuerySchema = z.object({
  ownerId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export type ForecastQuery = z.infer<typeof forecastQuerySchema>
