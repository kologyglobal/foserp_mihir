import { z } from 'zod'
import {
  PHONE_DIGITS_ONLY_MESSAGE,
  PHONE_MAX_DIGITS,
  PHONE_MAX_MESSAGE,
  sanitizePhoneDigits,
} from './phoneValidation'

/** Zod field: optional/empty or digits-only (sanitized). */
export const phoneDigitsField = z
  .string()
  .trim()
  .transform((s) => sanitizePhoneDigits(s))
  .refine((s) => s.length <= PHONE_MAX_DIGITS, { message: PHONE_MAX_MESSAGE })

/** Optional phone that may be omitted. */
export const optionalPhoneField = phoneDigitsField.optional()

/** Optional / nullable phone (API-style leads). */
export const optionalNullablePhoneField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null
    const digits = sanitizePhoneDigits(v)
    return digits === '' ? null : digits
  })
  .refine((v) => v == null || v.length <= PHONE_MAX_DIGITS, { message: PHONE_MAX_MESSAGE })

/** Strict check without transform — for schemas that must not coerce. */
export const phoneDigitsOnlyRefine = (message = PHONE_DIGITS_ONLY_MESSAGE) =>
  z
    .string()
    .trim()
    .max(PHONE_MAX_DIGITS, PHONE_MAX_MESSAGE)
    .regex(/^\d*$/, message)
