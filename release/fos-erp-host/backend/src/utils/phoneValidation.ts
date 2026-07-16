import { z } from 'zod'

/** Standard phone / mobile — digits only (0–9). */
export const PHONE_MAX_DIGITS = 15
export const PHONE_DIGITS_ONLY_MESSAGE = 'Phone must contain digits only (0–9)'
export const PHONE_MAX_MESSAGE = `Phone must be at most ${PHONE_MAX_DIGITS} digits`

const digitsOnlyRegex = /^\d*$/

/** Optional phone string: empty or digits only, max 15. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(PHONE_MAX_DIGITS, PHONE_MAX_MESSAGE)
  .regex(digitsOnlyRegex, PHONE_DIGITS_ONLY_MESSAGE)
  .optional()

/** Optional nullable phone (leads, users). */
export const optionalNullablePhoneSchema = z
  .string()
  .trim()
  .max(PHONE_MAX_DIGITS, PHONE_MAX_MESSAGE)
  .regex(digitsOnlyRegex, PHONE_DIGITS_ONLY_MESSAGE)
  .optional()
  .nullable()

/** Required-or-empty default '' phone (vendors, masters). */
export const phoneFieldSchema = z
  .string()
  .trim()
  .max(PHONE_MAX_DIGITS, PHONE_MAX_MESSAGE)
  .regex(digitsOnlyRegex, PHONE_DIGITS_ONLY_MESSAGE)
