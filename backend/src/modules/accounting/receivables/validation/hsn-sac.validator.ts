export interface HsnSacValidationResult {
  valid: boolean
  normalized: string | null
  code: string
  message?: string
  severity: 'error' | 'warning' | 'none'
}

export function validateHsnSac(value: string | null | undefined): HsnSacValidationResult {
  if (!value?.trim()) {
    return { valid: true, normalized: null, code: 'OK', severity: 'none' }
  }
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      code: 'INVALID_HSN_SAC_FORMAT',
      message: 'HSN/SAC must contain digits only',
      severity: 'error',
    }
  }
  if (![4, 6, 8].includes(normalized.length)) {
    return {
      valid: true,
      normalized,
      code: 'HSN_SAC_LENGTH_WARNING',
      message: `HSN/SAC length ${normalized.length} is unusual — expected 4, 6, or 8 digits`,
      severity: 'warning',
    }
  }
  return { valid: true, normalized, code: 'OK', severity: 'none' }
}
