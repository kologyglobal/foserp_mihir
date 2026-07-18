import { validatePan } from './pan.validator.js'
import { validateStateCode } from './state-code.validator.js'

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i

/** Best-effort GSTIN checksum — optional validation. */
const GSTIN_CHECKSUM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function computeGstinChecksum(gstin14: string): string {
  let factor = 2
  let sum = 0
  const mod = GSTIN_CHECKSUM_CHARS.length
  for (let i = gstin14.length - 1; i >= 0; i -= 1) {
    const codePoint = GSTIN_CHECKSUM_CHARS.indexOf(gstin14[i]!.toUpperCase())
    if (codePoint < 0) return '?'
    let addend = factor * codePoint
    factor = factor === 2 ? 1 : 2
    addend = Math.floor(addend / mod) + (addend % mod)
    sum += addend
  }
  const checksumCodePoint = (mod - (sum % mod)) % mod
  return GSTIN_CHECKSUM_CHARS[checksumCodePoint] ?? '?'
}

export interface GstinValidationResult {
  valid: boolean
  normalized: string | null
  code: string
  message?: string
  checksumValid?: boolean
}

export function validateGstin(value: string | null | undefined): GstinValidationResult {
  if (!value?.trim()) {
    return { valid: true, normalized: null, code: 'OK' }
  }
  const normalized = value.trim().toUpperCase()
  if (normalized.length !== 15) {
    return {
      valid: false,
      normalized,
      code: 'INVALID_GSTIN_LENGTH',
      message: 'GSTIN must be exactly 15 characters',
    }
  }
  if (!GSTIN_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      code: 'INVALID_GSTIN_FORMAT',
      message: 'GSTIN format must be 2-digit state + 10-char PAN + entity + Z + checksum',
    }
  }

  const stateCode = normalized.slice(0, 2)
  const stateCheck = validateStateCode(stateCode)
  if (!stateCheck.valid) {
    return {
      valid: false,
      normalized,
      code: 'INVALID_GSTIN_STATE',
      message: `GSTIN state prefix ${stateCode} is invalid`,
    }
  }

  const panPart = normalized.slice(2, 12)
  const panCheck = validatePan(panPart)
  if (!panCheck.valid) {
    return {
      valid: false,
      normalized,
      code: 'INVALID_GSTIN_PAN',
      message: 'Embedded PAN portion of GSTIN is invalid',
    }
  }

  const expectedChecksum = computeGstinChecksum(normalized.slice(0, 14))
  const checksumValid = expectedChecksum === normalized[14]
  if (!checksumValid) {
    return {
      valid: true,
      normalized,
      code: 'GSTIN_CHECKSUM_WARNING',
      message: 'GSTIN checksum could not be verified (best-effort validation passed format checks)',
      checksumValid: false,
    }
  }

  return { valid: true, normalized, code: 'OK', checksumValid: true }
}
