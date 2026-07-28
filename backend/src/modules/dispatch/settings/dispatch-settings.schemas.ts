import { z } from 'zod'

export const updateDispatchSettingsSchema = z.object({
  version: z.coerce.number().int().min(0),
  allowPartialDispatch: z.boolean(),
  allowMultipleDispatches: z.boolean(),
  allowOverDispatch: z.boolean(),
  invoiceMode: z.enum(['ONE_PER_DISPATCH', 'CONSOLIDATED', 'MANUAL_ONLY']),
  requirePodBeforeInvoice: z.boolean(),
})

export type UpdateDispatchSettingsInput = z.infer<typeof updateDispatchSettingsSchema>
