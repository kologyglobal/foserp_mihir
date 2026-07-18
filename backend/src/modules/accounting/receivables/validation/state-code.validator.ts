/** Common Indian GST state/UT codes (01–38). */
export const INDIAN_GST_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38',
])

export interface StateCodeValidationResult {
  valid: boolean
  normalized: string | null
  code: string
  message?: string
}

export function normalizeStateCode(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{1,2}$/.test(trimmed)) {
    return trimmed.padStart(2, '0')
  }
  return trimmed.length <= 8 ? trimmed : trimmed.slice(0, 8)
}

export function validateStateCode(value: string | null | undefined): StateCodeValidationResult {
  if (!value?.trim()) {
    return { valid: false, normalized: null, code: 'STATE_CODE_REQUIRED', message: 'State code is required' }
  }
  const normalized = normalizeStateCode(value)
  if (!normalized || !/^\d{2}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      code: 'INVALID_STATE_CODE_FORMAT',
      message: 'State code must be a 2-digit GST state code',
    }
  }
  if (!INDIAN_GST_STATE_CODES.has(normalized)) {
    return {
      valid: false,
      normalized,
      code: 'UNKNOWN_STATE_CODE',
      message: `State code ${normalized} is not a recognised Indian GST state code`,
    }
  }
  return { valid: true, normalized, code: 'OK' }
}
