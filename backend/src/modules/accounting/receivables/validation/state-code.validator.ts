/** Common Indian GST state/UT codes (01–38). */
export const INDIAN_GST_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38',
])

/** Lowercase state/UT name → GST state code (for CRM state text like "Maharashtra"). */
const INDIAN_GST_STATE_NAME_TO_CODE: Record<string, string> = {
  'jammu and kashmir': '01',
  'jammu & kashmir': '01',
  'himachal pradesh': '02',
  punjab: '03',
  chandigarh: '04',
  uttarakhand: '05',
  haryana: '06',
  delhi: '07',
  'nct of delhi': '07',
  rajasthan: '08',
  'uttar pradesh': '09',
  bihar: '10',
  sikkim: '11',
  'arunachal pradesh': '12',
  nagaland: '13',
  manipur: '14',
  mizoram: '15',
  tripura: '16',
  meghalaya: '17',
  assam: '18',
  'west bengal': '19',
  jharkhand: '20',
  odisha: '21',
  orissa: '21',
  chhattisgarh: '22',
  'madhya pradesh': '23',
  gujarat: '24',
  'dadra and nagar haveli and daman and diu': '26',
  'dadra and nagar haveli': '26',
  'daman and diu': '26',
  maharashtra: '27',
  'andhra pradesh': '37',
  karnataka: '29',
  goa: '30',
  lakshadweep: '31',
  kerala: '32',
  'tamil nadu': '33',
  puducherry: '34',
  'andaman and nicobar islands': '35',
  telangana: '36',
  ladakh: '38',
}

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

/**
 * Resolve a GST state code from:
 * - bare 2-digit codes (`27`)
 * - names (`Maharashtra`)
 * - labelled forms (`Maharashtra (27)`)
 * - GSTIN prefix (`27AABCA…`)
 */
export function resolveGstStateCode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()

  const paren = trimmed.match(/\((\d{1,2})\)\s*$/)
  if (paren) {
    const fromParen = validateStateCode(paren[1])
    if (fromParen.valid) return fromParen.normalized
  }

  const asCode = validateStateCode(trimmed)
  if (asCode.valid) return asCode.normalized

  const byName = INDIAN_GST_STATE_NAME_TO_CODE[trimmed.toLowerCase()]
  if (byName) return byName

  // GSTIN / long tax id — first two chars when they look like a state code
  if (trimmed.length >= 2 && /^\d{2}/.test(trimmed)) {
    const fromPrefix = validateStateCode(trimmed.slice(0, 2))
    if (fromPrefix.valid) return fromPrefix.normalized
  }

  return null
}

export function resolveLegalEntityStateCode(entity: {
  stateCode?: string | null
  gstin?: string | null
  registeredAddressJson?: unknown
}): string | null {
  const fromField = resolveGstStateCode(entity.stateCode)
  if (fromField) return fromField
  const fromGstin = resolveGstStateCode(entity.gstin)
  if (fromGstin) return fromGstin
  if (entity.registeredAddressJson && typeof entity.registeredAddressJson === 'object') {
    const addr = entity.registeredAddressJson as Record<string, unknown>
    return (
      resolveGstStateCode(typeof addr.stateCode === 'string' ? addr.stateCode : null)
      ?? resolveGstStateCode(typeof addr.state === 'string' ? addr.state : null)
    )
  }
  return null
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
