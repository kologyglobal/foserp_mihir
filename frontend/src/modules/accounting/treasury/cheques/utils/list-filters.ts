import type { ListChequesQuery, TreasuryChequeDirection, TreasuryChequeStatus } from '../api/treasury-cheque.types'

export function parseChequeListFilters(searchParams: URLSearchParams, legalEntityId: string): ListChequesQuery {
  const page = Number(searchParams.get('page') || '1') || 1
  const status = (searchParams.get('status') as TreasuryChequeStatus | null) || undefined
  const direction = (searchParams.get('direction') as TreasuryChequeDirection | null) || undefined
  const search = searchParams.get('search') || undefined
  return {
    legalEntityId,
    page,
    limit: 20,
    ...(status ? { status } : {}),
    ...(direction ? { direction } : {}),
    ...(search ? { search } : {}),
  }
}

export function syncChequeListSearchParams(
  params: URLSearchParams,
  next: { status?: string; direction?: string; search?: string; page?: number },
) {
  if (next.status) params.set('status', next.status)
  else params.delete('status')
  if (next.direction) params.set('direction', next.direction)
  else params.delete('direction')
  if (next.search) params.set('search', next.search)
  else params.delete('search')
  if (next.page && next.page > 1) params.set('page', String(next.page))
  else params.delete('page')
  return params
}
