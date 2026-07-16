import { z } from 'zod'

/** Optional UUID — treat "" as null so empty selects from forms do not fail uuid(). */
export const optionalUuid = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().uuid().optional().nullable(),
)
