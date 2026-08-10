import { z } from 'zod'

/** Max serialized size of one preference value (grid layouts are ~1KB). */
export const MAX_UI_PREFERENCE_VALUE_BYTES = 16_384

/** Namespaced key, e.g. "grid-columns:/inventory/ledger". */
export const uiPreferenceKeySchema = z
  .string()
  .trim()
  .min(1, 'prefKey is required')
  .max(191, 'prefKey too long (max 191 chars)')
  .regex(/^[\w.:/\-]+$/, 'prefKey may only contain letters, digits, ".", ":", "/", "-", "_"')

export const uiPreferenceKeyParamSchema = z.object({
  prefKey: uiPreferenceKeySchema,
})

export const putUiPreferenceSchema = z.object({
  value: z.unknown().refine(
    (v) => {
      if (v === undefined) return false
      try {
        return JSON.stringify(v).length <= MAX_UI_PREFERENCE_VALUE_BYTES
      } catch {
        return false
      }
    },
    { message: `value must be JSON-serializable and at most ${MAX_UI_PREFERENCE_VALUE_BYTES} bytes` },
  ),
})

export type PutUiPreferenceInput = z.infer<typeof putUiPreferenceSchema>
