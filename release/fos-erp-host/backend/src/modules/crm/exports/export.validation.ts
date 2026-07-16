import { z } from 'zod'

export const CRM_EXPORT_RESOURCES = [
  'companies',
  'contacts',
  'leads',
  'opportunities',
  'quotations',
  'activities',
  'follow-ups',
] as const

export const crmExportQuerySchema = z.object({
  search: z.string().trim().optional(),
  ownerId: z.string().uuid().optional(),
  status: z.string().optional(),
  stage: z.string().optional(),
  source: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export type CrmExportQuery = z.infer<typeof crmExportQuerySchema>
