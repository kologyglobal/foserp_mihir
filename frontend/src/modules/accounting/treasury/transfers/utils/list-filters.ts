import type { ListTransfersQuery, TreasuryTransferStatus, TreasuryTransferType } from '../api/treasury-transfer.types'

export function parseTransferListFilters(searchParams: URLSearchParams, legalEntityId: string): ListTransfersQuery {
  const page = Number(searchParams.get('page') || '1') || 1
  const status = (searchParams.get('status') as TreasuryTransferStatus | null) || undefined
  const transferType = (searchParams.get('transferType') as TreasuryTransferType | null) || undefined
  const search = searchParams.get('search') || undefined
  return {
    legalEntityId,
    page,
    limit: 20,
    ...(status ? { status } : {}),
    ...(transferType ? { transferType } : {}),
    ...(search ? { search } : {}),
  }
}

export function syncTransferListSearchParams(
  params: URLSearchParams,
  next: { status?: string; transferType?: string; search?: string; page?: number },
) {
  if (next.status) params.set('status', next.status)
  else params.delete('status')
  if (next.transferType) params.set('transferType', next.transferType)
  else params.delete('transferType')
  if (next.search) params.set('search', next.search)
  else params.delete('search')
  if (next.page && next.page > 1) params.set('page', String(next.page))
  else params.delete('page')
  return params
}
