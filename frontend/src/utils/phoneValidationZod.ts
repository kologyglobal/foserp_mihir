import { z } from 'zod'
import {
  PHONE_DIGITS_ONLY_MESSAGE,
  PHONE_MAX_DIGITS,
  PHONE_MAX_MESSAGE,
  sanitizePhoneDigits,
} from './phoneValidation'
import {
  mobileDigitsOnly,
  validateMobileForCountry,
} from './validation/mobilePhone'

/** Zod field: optional/empty or digits-only (sanitized). Legacy — prefer country-aware helpers for CRM. */
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

/**
 * Optional mobile validated for a country (empty OK).
 * Stores digits only after normalize.
 */
export function optionalMobileForCountryField(country?: string | null) {
  return z
    .string()
    .trim()
    .transform((s) => mobileDigitsOnly(s))
    .superRefine((digits, ctx) => {
      if (!digits) return
      const message = validateMobileForCountry(digits, country)
      if (message) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message })
      }
    })
}

/**
 * Object-level refine for forms that carry `country` beside a phone field.
 * Use after `.object({...})` when phone and country are siblings.
 */
export function refineMobileWithCountryField<
  T extends { country?: string | null },
>(
  phoneKey: keyof T & string,
  countryKey: keyof T & string = 'country' as keyof T & string,
) {
  return (data: T, ctx: z.RefinementCtx) => {
    const raw = data[phoneKey]
    const value = raw == null ? '' : String(raw)
    if (!value.trim()) return
    const country = data[countryKey] == null ? null : String(data[countryKey])
    const message = validateMobileForCountry(value, country)
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [phoneKey] })
    }
  }
}
