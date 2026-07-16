import { z } from 'zod'

export const masterExportQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  itemType: z.enum(['raw', 'bought_out', 'consumable', 'sub_assembly', 'finished_good']).optional(),
  categoryId: z.string().uuid().optional(),
  vendorType: z.enum(['manufacturer', 'trader', 'service']).optional(),
  gstGroupId: z.string().uuid().optional(),
})

export type MasterExportQuery = z.infer<typeof masterExportQuerySchema>
