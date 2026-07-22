import type { ListTreasuryAdjustmentsQuery, TreasuryAdjustmentStatus, TreasuryAdjustmentType } from '../api/treasury-adjustment.types'

export function parseAdjustmentListFilters(searchParams: URLSearchParams, legalEntityId: string): ListTreasuryAdjustmentsQuery {
  const page = Number(searchParams.get('page') || '1') || 1
  const status = (searchParams.get('status') as TreasuryAdjustmentStatus | null) || undefined
  const adjustmentType = (searchParams.get('adjustmentType') as TreasuryAdjustmentType | null) || undefined
  return {
    legalEntityId,
    page,
    limit: 20,
    ...(status ? { status } : {}),
    ...(adjustmentType ? { adjustmentType } : {}),
  }
}

export function syncAdjustmentListSearchParams(
  params: URLSearchParams,
  next: { status?: string; adjustmentType?: string; page?: number },
) {
  if (next.status) params.set('status', next.status)
  else params.delete('status')
  if (next.adjustmentType) params.set('adjustmentType', next.adjustmentType)
  else params.delete('adjustmentType')
  if (next.page && next.page > 1) params.set('page', String(next.page))
  else params.delete('page')
  return params
}
