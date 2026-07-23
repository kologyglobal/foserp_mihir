/**
 * Tax master → finance engine resolve client.
 * Forms must call this (or AR/AP calculate APIs) instead of hardcoding CGST/SGST/IGST.
 */
import { apiRequest, tenantPath } from '@/services/api/client'
import { isApiMode } from '@/config/apiConfig'

export type GstResolveApplicability = 'SALES' | 'PURCHASE'

export interface ResolvedGstRate {
  id: string
  code: string
  gstGroupId: string
  cgstRate: string
  sgstRate: string
  igstRate: string
  gstRate: string
  fromState: string
  locationStateCode: string
  dateFrom: string
  dateTo: string | null
  applicableFor: 'SALES' | 'PURCHASE' | 'BOTH'
}

export type ResolveGstTaxParams = {
  applicableFor: GstResolveApplicability
  asOfDate?: string
  fromState?: string
  toState?: string
  gstGroupId?: string
  hsnId?: string
  hsnCode?: string
  itemId?: string
}

function buildQuery(params: ResolveGstTaxParams): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

/** Resolve CGST/SGST/IGST from masters (API mode). Returns null when no match / demo mode. */
export async function resolveGstTaxFromMasters(
  params: ResolveGstTaxParams,
): Promise<ResolvedGstRate | null> {
  if (!isApiMode()) return null
  const res = await apiRequest<ResolvedGstRate | null>(
    `${tenantPath('/masters/tax/resolve')}${buildQuery(params)}`,
  )
  return res.data ?? null
}
