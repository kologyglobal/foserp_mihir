import { z } from 'zod'
import { validateEmail, normalizeEmail } from './email'
import { optionalEmailField, requiredEmailField } from './emailZod'
import {
  validateCrmCalendarDate,
  getDateInputMin,
  isFutureDateTime,
} from './crmDatePolicy'
import {
  phoneDigitsField,
  optionalPhoneField,
  optionalMobileForCountryField,
  refineMobileWithCountryField,
} from '../phoneValidationZod'
import { mobileDigitsOnly, validateMobileForCountry } from './mobilePhone'
import { sanitizePhoneDigits, PHONE_MAX_DIGITS } from '../phoneValidation'

/** Trim whitespace; empty string stays empty. */
export const trimString = (s: string) => s.trim()

/** Required non-empty trimmed text. */
export function requiredText(message = 'This field is required') {
  return z
    .string()
    .transform(trimString)
    .pipe(z.string().min(1, message))
}

/** Optional trimmed text (empty → empty string). */
export function optionalText(max = 2000) {
  return z
    .string()
    .max(max)
    .transform(trimString)
}

/** Re-export canonical email fields. */
export { optionalEmailField, requiredEmailField, normalizeEmail }

/** Digits-only phone (legacy / optional). Prefer `mobile` for CRM. */
export const phone = phoneDigitsField
export const optionalPhone = optionalPhoneField

/**
 * Optional mobile validated for a country (empty OK).
 * Prefer pairing with `refineMobileWithCountryField` when country is a sibling field.
 */
export function mobile(country?: string | null) {
  return optionalMobileForCountryField(country)
}

export { refineMobileWithCountryField, mobileDigitsOnly, validateMobileForCountry }

/** Optional CRM calendar date (`YYYY-MM-DD`). */
export function date(label = 'Date') {
  return z
    .string()
    .transform(trimString)
    .superRefine((val, ctx) => {
      const message = validateCrmCalendarDate(val, { label, required: false })
      if (message) ctx.addIssue({ code: 'custom', message })
    })
}

/** Required CRM calendar date. */
export function requiredDate(label = 'Date') {
  return z
    .string()
    .transform(trimString)
    .superRefine((val, ctx) => {
      const message = validateCrmCalendarDate(val, { label, required: true })
      if (message) ctx.addIssue({ code: 'custom', message })
    })
}

/** Date that must be today or later (local). */
export function futureDate(label = 'Date') {
  return z
    .string()
    .transform(trimString)
    .superRefine((val, ctx) => {
      const today = getDateInputMin()
      const message = validateCrmCalendarDate(val, {
        label,
        required: true,
        notBefore: today,
        notBeforeMessage: `${label} cannot be in the past`,
      })
      if (message) ctx.addIssue({ code: 'custom', message })
    })
}

/** Date that must be today or earlier (local). */
export function pastDate(label = 'Date') {
  return z
    .string()
    .transform(trimString)
    .superRefine((val, ctx) => {
      const today = getDateInputMin()
      const message = validateCrmCalendarDate(val, {
        label,
        required: true,
        notAfter: today,
        notAfterMessage: `${label} cannot be in the future`,
      })
      if (message) ctx.addIssue({ code: 'custom', message })
    })
}

/**
 * Object-level refine: `endKey` must be >= `startKey` when both set.
 */
export function dateRange<T extends Record<string, unknown>>(
  startKey: keyof T & string,
  endKey: keyof T & string,
  message = 'End date cannot be before start date',
) {
  return (data: T, ctx: z.RefinementCtx) => {
    const start = String(data[startKey] ?? '').trim()
    const end = String(data[endKey] ?? '').trim()
    if (!start || !end) return
    if (end < start) {
      ctx.addIssue({ code: 'custom', message, path: [endKey] })
    }
  }
}

/** Future date-time (follow-up style). */
export function futureDateTime(message = 'Date/time must be in the future') {
  return z.union([z.string(), z.date()]).superRefine((val, ctx) => {
    if (!isFutureDateTime(val)) {
      ctx.addIssue({ code: 'custom', message })
    }
  })
}

export function positiveNumber(message = 'Must be greater than zero') {
  return z.coerce.number({ error: 'Enter a valid number' }).positive(message)
}

export function nonNegativeNumber(message = 'Cannot be negative') {
  return z.coerce.number({ error: 'Enter a valid number' }).min(0, message)
}

export function quantity(message = 'Enter a valid quantity') {
  return z.coerce.number({ error: message }).positive(message)
}

export function currency(message = 'Enter a valid amount') {
  return z.coerce.number({ error: message }).min(0, message)
}

export function percentage(message = 'Enter a percentage between 0 and 100') {
  return z.coerce.number({ error: message }).min(0, message).max(100, message)
}

/** Indian PIN (6 digits) — optional empty. */
export function postalCode(message = 'Enter a valid 6-digit PIN code') {
  return z
    .string()
    .transform(trimString)
    .superRefine((val, ctx) => {
      if (!val) return
      if (!/^\d{6}$/.test(val)) {
        ctx.addIssue({ code: 'custom', message })
      }
    })
}

export function url(message = 'Enter a valid URL') {
  return z
    .string()
    .transform(trimString)
    .superRefine((val, ctx) => {
      if (!val) return
      try {
        // Allow missing protocol
        const candidate = /^https?:\/\//i.test(val) ? val : `https://${val}`
        // eslint-disable-next-line no-new
        new URL(candidate)
      } catch {
        ctx.addIssue({ code: 'custom', message })
      }
    })
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export function gstNumber(message = 'Invalid GSTIN format') {
  return z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(
      z
        .string()
        .length(15, 'GSTIN must be 15 characters')
        .regex(GSTIN_RE, message),
    )
}

export function optionalGstNumber(message = 'Invalid GSTIN format') {
  return z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .superRefine((val, ctx) => {
      if (!val) return
      if (val.length !== 15 || !GSTIN_RE.test(val)) {
        ctx.addIssue({ code: 'custom', message })
      }
    })
}

export function panNumber(message = 'Invalid PAN format') {
  return z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .superRefine((val, ctx) => {
      if (!val) return
      if (!PAN_RE.test(val)) {
        ctx.addIssue({ code: 'custom', message })
      }
    })
}

/** Generic tax id (GSTIN preferred for India; otherwise non-empty optional). */
export function taxNumber(message = 'Enter a valid tax number') {
  return optionalGstNumber(message)
}

export {
  validateEmail,
  validateCrmCalendarDate,
  sanitizePhoneDigits,
  PHONE_MAX_DIGITS,
  GSTIN_RE,
  PAN_RE,
}
