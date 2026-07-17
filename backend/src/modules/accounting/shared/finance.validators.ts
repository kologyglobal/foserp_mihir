import { ValidationError } from '../../../utils/errors.js'

/** Indian PAN: AAAAA9999A */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

/** Indian GSTIN: 15 chars */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

/** Indian CIN */
export const CIN_REGEX = /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/

export function normalizeTaxId(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim().toUpperCase()
  return trimmed.length ? trimmed : null
}

export function validatePan(pan: string | null | undefined): void {
  const normalized = normalizeTaxId(pan)
  if (normalized && !PAN_REGEX.test(normalized)) {
    throw new ValidationError('The PAN format is invalid.')
  }
}

export function validateGstin(gstin: string | null | undefined): void {
  const normalized = normalizeTaxId(gstin)
  if (normalized && !GSTIN_REGEX.test(normalized)) {
    throw new ValidationError('The GSTIN format is invalid.')
  }
}

export function validateCin(cin: string | null | undefined): void {
  const normalized = normalizeTaxId(cin)
  if (normalized && !CIN_REGEX.test(normalized)) {
    throw new ValidationError('The CIN format is invalid.')
  }
}

export function validateLegalEntityTaxIds(input: {
  pan?: string | null
  gstin?: string | null
  cin?: string | null
}): void {
  validatePan(input.pan)
  validateGstin(input.gstin)
  validateCin(input.cin)
}
