import type { ListBankStatementsQuery } from '../api/bank-statement.types'

export function parseListFilters(searchParams: URLSearchParams, legalEntityId: string): ListBankStatementsQuery {
  const page = Number(searchParams.get('page') || '1') || 1
  const status = searchParams.get('status') as ListBankStatementsQuery['status'] | null
  const treasuryAccountId = searchParams.get('treasuryAccountId') || undefined
  return {
    legalEntityId,
    page,
    limit: 20,
    ...(status ? { status } : {}),
    ...(treasuryAccountId ? { treasuryAccountId } : {}),
  }
}

export function syncListSearchParams(
  params: URLSearchParams,
  next: { status?: string; treasuryAccountId?: string; page?: number },
) {
  if (next.status) params.set('status', next.status)
  else params.delete('status')
  if (next.treasuryAccountId) params.set('treasuryAccountId', next.treasuryAccountId)
  else params.delete('treasuryAccountId')
  if (next.page && next.page > 1) params.set('page', String(next.page))
  else params.delete('page')
  return params
}
