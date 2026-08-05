/**
 * Tax master → finance engine resolve client.
 * Forms must call this (or AR/AP calculate APIs) instead of hardcoding CGST/SGST/IGST.
 */
import { apiRequest, tenantPath } from '@/services/api/client'
import { isApiMode } from '@/config/apiConfig'

export type GstResolveApplicability = 'SALES' | 'PURCHASE'

/** Phase 1 full determination payload from GET …/masters/tax/resolve */
export interface ResolveGstTaxResultDto {
  resolved: boolean
  hsnSacCode: string | null
  hsnId: string | null
  gstGroupId: string | null
  taxCategory: string
  gstRate: number
  taxScheme: 'cgst_sgst' | 'igst' | 'utgst_pair'
  cgstRate: number
  sgstRate: number
  utgstRate: number
  igstRate: number
  cessRate: number
  reverseCharge: boolean
  ruleId: string | null
  ruleCode: string | null
  ruleVersion: string | null
  source: 'MASTER' | 'UNRESOLVED'
  fromStateSnapshot: string | null
  toStateSnapshot: string | null
  warnings: string[]
  blockers: string[]
  masterRate?: {
    id: string
    code: string
    cgstRate: string
    sgstRate: string
    igstRate: string
    gstRate: string
  } | null
}

/** @deprecated Prefer ResolveGstTaxResultDto — kept for callers expecting rate-only row shape */
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
  legalEntityId?: string
  branchId?: string
  gstGroupId?: string
  hsnId?: string
  hsnCode?: string
  itemId?: string
  reverseCharge?: boolean
}

function buildQuery(params: ResolveGstTaxParams): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'boolean') qs.set(k, v ? 'true' : 'false')
    else qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

/** Resolve line tax from masters (API mode). Returns null in demo or network failure. */
export async function resolveGstTaxFromMasters(
  params: ResolveGstTaxParams,
): Promise<ResolveGstTaxResultDto | null> {
  if (!isApiMode()) return null
  const res = await apiRequest<ResolveGstTaxResultDto | null>(
    `${tenantPath('/masters/tax/resolve')}${buildQuery(params)}`,
  )
  return res.data ?? null
}

/** Map Phase 1 DTO into the older rate shape for legacy callers. */
export function toLegacyResolvedRate(dto: ResolveGstTaxResultDto | null): ResolvedGstRate | null {
  if (!dto?.resolved || !dto.masterRate) return null
  return {
    id: dto.masterRate.id,
    code: dto.masterRate.code,
    gstGroupId: dto.gstGroupId ?? '',
    cgstRate: dto.masterRate.cgstRate,
    sgstRate: dto.masterRate.sgstRate,
    igstRate: dto.masterRate.igstRate,
    gstRate: dto.masterRate.gstRate,
    fromState: dto.fromStateSnapshot ?? '',
    locationStateCode: dto.toStateSnapshot ?? '',
    dateFrom: '',
    dateTo: null,
    applicableFor: 'BOTH',
  }
}
