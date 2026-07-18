/**
 * Country-aware mobile / phone validation for CRM forms.
 * India is the default market; other countries use an E.164-ish digit-length fallback.
 * Prefer this over a single India-only regex when a country is selected.
 */

/** Strip spaces and common phone separators; keep leading `+` and digits. */
export function normalizeMobileInput(value: string): string {
  if (value == null) return ''
  return String(value).replace(/[\s\-().]/g, '')
}

/** Digits only (for storage / wa.me / tel:). */
export function mobileDigitsOnly(value: string): string {
  return normalizeMobileInput(value).replace(/\D/g, '')
}

const INDIA_ALIASES = new Set([
  'in',
  'india',
  'ind',
  '+91',
  '91',
  'inr',
])

/**
 * Map free-text / ISO / dial-code country values to a short validation key.
 * Defaults to `IN` when empty (product primary market).
 */
export function resolveMobileCountryKey(country?: string | null): string {
  if (country == null || String(country).trim() === '') return 'IN'
  const raw = String(country).trim()
  const lower = raw.toLowerCase()
  if (INDIA_ALIASES.has(lower)) return 'IN'

  const dial = lower.startsWith('+') ? lower : `+${lower}`
  if (dial === '+91') return 'IN'

  // Common CRM master labels → ISO-ish keys (validation still uses E.164 fallback unless IN)
  const byName: Record<string, string> = {
    'united states': 'US',
    usa: 'US',
    us: 'US',
    'united arab emirates': 'AE',
    uae: 'AE',
    ae: 'AE',
    'united kingdom': 'GB',
    uk: 'GB',
    gb: 'GB',
    singapore: 'SG',
    sg: 'SG',
    'saudi arabia': 'SA',
    sa: 'SA',
    qatar: 'QA',
    qa: 'QA',
    bahrain: 'BH',
    bh: 'BH',
    oman: 'OM',
    om: 'OM',
    kuwait: 'KW',
    kw: 'KW',
    nepal: 'NP',
    np: 'NP',
    bangladesh: 'BD',
    bd: 'BD',
    'sri lanka': 'LK',
    lk: 'LK',
  }
  if (byName[lower]) return byName[lower]

  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase()
  return 'OTHER'
}

export const MOBILE_INDIA_MESSAGE =
  'Enter a valid Indian mobile: 10 digits starting with 6–9 (optional +91)'

export const MOBILE_INTERNATIONAL_MESSAGE =
  'Enter a valid phone number (7–15 digits, optional country code)'

/** Optional +91, then 10 digits starting 6–9 (spaces/separators already stripped). */
const INDIA_MOBILE_RE = /^(?:\+91)?[6-9]\d{9}$/

function validateIndiaMobile(normalized: string): string | null {
  // Also accept bare 91-prefixed national numbers (common after digit-only inputs)
  let candidate = normalized
  if (/^91[6-9]\d{9}$/.test(candidate)) {
    candidate = `+${candidate}`
  }
  if (INDIA_MOBILE_RE.test(candidate)) return null
  return MOBILE_INDIA_MESSAGE
}

function validateE164ish(normalized: string): string | null {
  const digits = normalized.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    return MOBILE_INTERNATIONAL_MESSAGE
  }
  // Reject leading zeros-only / nonsense after strip
  if (!/^\+?\d+$/.test(normalized)) {
    return MOBILE_INTERNATIONAL_MESSAGE
  }
  return null
}

/**
 * Validate a mobile/phone value for a country.
 * @returns error message, or `null` when empty or valid.
 * Empty values are allowed here — required fields fail via form required rules.
 */
export function validateMobileForCountry(
  value: string,
  countryCode?: string | null,
): string | null {
  const normalized = normalizeMobileInput(value)
  if (!normalized) return null

  const key = resolveMobileCountryKey(countryCode)
  if (key === 'IN') return validateIndiaMobile(normalized)
  return validateE164ish(normalized)
}
