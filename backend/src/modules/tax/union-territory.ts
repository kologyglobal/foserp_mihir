/**
 * Indian GST Union Territory detection — for CGST+UTGST scheme.
 * Codes align with INDIAN_GST_STATE_CODES / state-code.validator.
 */
export const UNION_TERRITORY_GST_CODES = new Set([
  '04', // Chandigarh
  '07', // Delhi
  '26', // Dadra & Nagar Haveli and Daman & Diu
  '31', // Lakshadweep
  '34', // Puducherry
  '35', // Andaman & Nicobar
  '38', // Ladakh
  // Jammu & Kashmir 01 treated as UT for scheme purposes after reorganisation
  '01',
])

export function isUnionTerritoryStateCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false
  const c = code.trim().padStart(2, '0')
  return UNION_TERRITORY_GST_CODES.has(c)
}
