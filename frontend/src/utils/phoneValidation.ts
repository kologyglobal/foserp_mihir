/** Standard phone / mobile validation — digits only across the product. */

export const PHONE_MAX_DIGITS = 15

/** Strip everything except 0–9. */
export function sanitizePhoneDigits(value: string | null | undefined): string {
  if (value == null) return ''
  return String(value).replace(/\D/g, '')
}

/** True when empty (optional) or 1–PHONE_MAX_DIGITS numeric digits. */
export function isValidOptionalPhone(value: string | null | undefined): boolean {
  const digits = sanitizePhoneDigits(value)
  return digits.length <= PHONE_MAX_DIGITS
}

/** True when empty, or filled with digits only (after sanitize). */
export function isPhoneDigitsOnly(value: string | null | undefined): boolean {
  if (value == null || value === '') return true
  return /^\d+$/.test(String(value).trim())
}

export const PHONE_DIGITS_ONLY_MESSAGE = 'Numbers only — digits 0–9'
export const PHONE_MAX_MESSAGE = `Maximum ${PHONE_MAX_DIGITS} digits`
