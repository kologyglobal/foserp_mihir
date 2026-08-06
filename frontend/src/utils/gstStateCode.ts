/** Indian GST state/UT codes — mirrors backend state-code.validator.ts */

export const INDIAN_GST_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38',
])

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

export const INDIAN_GST_STATE_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(INDIAN_GST_STATE_NAME_TO_CODE).map(([name, code]) => [code, name.replace(/\b\w/g, (c) => c.toUpperCase())]),
)

export function validateStateCode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  const padded = /^\d{1,2}$/.test(trimmed) ? trimmed.padStart(2, '0') : null
  if (padded && INDIAN_GST_STATE_CODES.has(padded)) return padded
  return null
}

/**
 * Resolve GST state code from bare code, state name, labelled form (`Maharashtra (27)`), or GSTIN prefix.
 */
export function resolveGstStateCode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()

  const paren = trimmed.match(/\((\d{1,2})\)\s*$/)
  if (paren) {
    const fromParen = validateStateCode(paren[1])
    if (fromParen) return fromParen
  }

  const asCode = validateStateCode(trimmed)
  if (asCode) return asCode

  const byName = INDIAN_GST_STATE_NAME_TO_CODE[trimmed.toLowerCase()]
  if (byName) return byName

  if (trimmed.length >= 2 && /^\d{2}/.test(trimmed)) {
    const fromPrefix = validateStateCode(trimmed.slice(0, 2))
    if (fromPrefix) return fromPrefix
  }

  return null
}

export function formatPlaceOfSupplyLabel(
  stateCode: string | null | undefined,
  stateName?: string | null,
): string {
  // Accept bare code, name, or already-labelled "Maharashtra (27)" without double-appending.
  const code =
    (stateCode ? validateStateCode(stateCode) : null) ??
    resolveGstStateCode(stateCode) ??
    resolveGstStateCode(stateName)

  // Strip trailing `(NN)` so `format(code, "Maharashtra (27)")` → once, not `(27) (27)`.
  const cleanedName = (stateName?.trim() || '').replace(/\s*\(\d{1,2}\)\s*$/, '').trim()

  const name =
    cleanedName ||
    (code ? INDIAN_GST_STATE_CODE_TO_NAME[code]?.replace(/\b\w/g, (c) => c.toUpperCase()) : '') ||
    ''
  if (code && name) {
    const titleName = name
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `${titleName} (${code})`
  }
  return name || code || ''
}

/** Sorted options for place-of-supply / legal-entity state selects. */
export function listGstStateSelectOptions(): { value: string; label: string }[] {
  return [...INDIAN_GST_STATE_CODES]
    .sort()
    .map((code) => ({
      value: code,
      label: formatPlaceOfSupplyLabel(code) || code,
    }))
}
