const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/i

export interface PanValidationResult {
  valid: boolean
  normalized: string | null
  code: string
  message?: string
}

export function validatePan(value: string | null | undefined): PanValidationResult {
  if (!value?.trim()) {
    return { valid: true, normalized: null, code: 'OK' }
  }
  const normalized = value.trim().toUpperCase()
  if (!PAN_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      code: 'INVALID_PAN_FORMAT',
      message: 'PAN must match format AAAAA9999A (5 letters, 4 digits, 1 letter)',
    }
  }
  return { valid: true, normalized, code: 'OK' }
}
