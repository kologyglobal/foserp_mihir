import { z } from 'zod'

const settingsObject = z.record(z.string(), z.unknown())
const denormalizedFields = {
  allowOverproduction: z.boolean().optional(),
  overproductionTolerancePercent: z.coerce.number().min(0).max(100).optional(),
  allowCloseWithoutQc: z.boolean().optional(),
  requireReservation: z.boolean().optional(),
  allowPartialProduction: z.boolean().optional(),
  allowProductionWithoutFullMaterial: z.boolean().optional(),
  autoPostAbsorption: z.boolean().optional(),
  oeeEnabled: z.boolean().optional(),
  shiftMinutesPerDay: z.coerce.number().int().min(1).max(1440).optional(),
}

export const putManufacturingSettingsSchema = z
  .object({
    version: z.coerce.number().int().min(0).optional(),
    settings: settingsObject.optional(),
    payloadJson: settingsObject.optional(),
    ...denormalizedFields,
  })
  .refine((value) => value.settings != null || value.payloadJson != null, {
    message: 'settings is required',
    path: ['settings'],
  })

export const patchManufacturingSettingsSchema = z
  .object({
    version: z.coerce.number().int().min(0).optional(),
    settings: settingsObject.optional(),
    payloadJson: settingsObject.optional(),
    ...denormalizedFields,
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'version'),
    { message: 'At least one setting must be provided' },
  )

export type PutManufacturingSettingsInput = z.infer<typeof putManufacturingSettingsSchema>
export type PatchManufacturingSettingsInput = z.infer<typeof patchManufacturingSettingsSchema>
