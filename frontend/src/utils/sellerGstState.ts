/**
 * Seller (supply) GST registration state for commercial documents.
 * Prefer Finance default legal entity — never invent a free-form state or customer state.
 */
import { ensureLegalEntity, listLegalEntities } from '../services/bridges/financeApiBridge'
import { COMPANY_GSTIN, COMPANY_STATE } from '../types/invoice'
import { resolveGstStateCode } from './gstStateCode'

export function resolveSellerStateCodeFromParts(opts: {
  stateCode?: string | null
  state?: string | null
  gstin?: string | null
}): string | null {
  return (
    resolveGstStateCode(opts.stateCode) ??
    resolveGstStateCode(opts.state) ??
    resolveGstStateCode(opts.gstin)
  )
}

/**
 * Synchronous demo/print fallback only — prefer {@link loadSellerStateCode} for forms.
 */
export function getDemoSellerStateCode(): string | null {
  return (
    resolveGstStateCode(COMPANY_STATE) ??
    resolveGstStateCode(COMPANY_GSTIN) ??
    null
  )
}

/** Default legal entity GST state (seller / supplier for sales documents). */
export async function loadSellerStateCode(): Promise<string | null> {
  try {
    const preferred = await ensureLegalEntity()
    const code = resolveSellerStateCodeFromParts({
      stateCode: preferred.stateCode,
      gstin: preferred.gstin,
    })
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
    if (preferred) {
      const code = resolveSellerStateCodeFromParts({
        stateCode: preferred.stateCode,
        gstin: preferred.gstin,
      })
      if (code) return code
    }
  } catch {
    // fall through
  }

  return getDemoSellerStateCode()
}
