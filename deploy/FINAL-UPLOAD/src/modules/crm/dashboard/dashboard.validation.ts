import { z } from 'zod'

export const dashboardQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).default('month'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  ownerId: z.string().uuid().optional(),
})

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
