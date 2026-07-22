import { z } from 'zod'

export const savedViewIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const listSavedViewsQuerySchema = z.object({
  reportKey: z.string().trim().min(1).max(100).optional(),
})

export const createSavedViewSchema = z.object({
  reportKey: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional(),
  filters: z.record(z.unknown()).default({}),
  sorting: z.record(z.unknown()).optional(),
  grouping: z.record(z.unknown()).optional(),
  visibleColumns: z.array(z.string()).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  chartPreference: z.record(z.unknown()).optional(),
  isDefault: z.boolean().default(false),
  isShared: z.boolean().default(false),
  sharedRoleId: z.string().uuid().optional(),
})

export const updateSavedViewSchema = createSavedViewSchema.partial().omit({ reportKey: true })

export type ListSavedViewsQueryInput = z.infer<typeof listSavedViewsQuerySchema>
export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>
