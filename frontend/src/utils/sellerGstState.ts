/**
 * Seller (supply) GST registration state for commercial documents.
 * Prefer Finance default legal entity — never invent a free-form state or customer state.
 *
 * Resolution order (GST SoT):
 * 1. GSTIN first 2 digits (actual registration)
 * 2. LE.statCode
 * 3. Registered address state / stateCode
 * Never fall back to customer / place-of-supply state.
 */
import { ensureLegalEntity, listLegalEntities } from '../services/bridges/financeApiBridge'
import type { LegalEntity } from '../types/financeSetup'
import { COMPANY_GSTIN, COMPANY_STATE } from '../types/invoice'
import { resolveGstStateCode } from './gstStateCode'

export function resolveSellerStateCodeFromParts(opts: {
  stateCode?: string | null
  state?: string | null
  gstin?: string | null
}): string | null {
  // GSTIN prefix is the registered place of business for the LE — prefer over free-form stateCode.
  return (
    resolveGstStateCode(opts.gstin) ??
    resolveGstStateCode(opts.stateCode) ??
    resolveGstStateCode(opts.state)
  )
}

function addressFields(json: unknown): { stateCode?: string | null; state?: string | null } {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {}
  const a = json as Record<string, unknown>
  return {
    stateCode: typeof a.stateCode === 'string' ? a.stateCode : null,
    state: typeof a.state === 'string' ? a.state : null,
  }
}

/** Resolve seller state from a Legal Entity row (includes registered address fallback). */
export function resolveSellerStateCodeFromLegalEntity(
  le: Pick<LegalEntity, 'gstin' | 'stateCode' | 'registeredAddressJson'> | null | undefined,
): string | null {
  if (!le) return null
  const addr = addressFields(le.registeredAddressJson)
  return (
    resolveGstStateCode(le.gstin) ??
    resolveGstStateCode(le.stateCode) ??
    resolveGstStateCode(addr.stateCode) ??
    resolveGstStateCode(addr.state)
  )
}

/**
 * Synchronous demo/print fallback only — prefer {@link loadSellerStateCode} for forms.
 * Company identity: Vasant Trailers Pune (Maharashtra / 27).
 */
export function getDemoSellerStateCode(): string | null {
  return (
    resolveGstStateCode(COMPANY_GSTIN) ??
    resolveGstStateCode(COMPANY_STATE) ??
    null
  )
}

/** Default legal entity GST state (seller / supplier for sales documents). */
export async function loadSellerStateCode(): Promise<string | null> {
  try {
    const preferred = await ensureLegalEntity()
    const code = resolveSellerStateCodeFromLegalEntity(preferred)
    if (code) return code
  } catch {
    // No selected LE in store — fall through to list scan / demo
  }

  try {
    const entities = await listLegalEntities()
    const list = Array.isArray(entities) ? entities : []
    const preferred =
      list.find((e) => e.isDefault && e.isActive !== false) ??
      list.find((e) => e.isActive !== false) ??
      list[0]
    const code = resolveSellerStateCodeFromLegalEntity(preferred)
    if (code) return code
  } catch {
    // fall through
  }

  return getDemoSellerStateCode()
}
