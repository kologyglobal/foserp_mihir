import type { ListStandingInstructionsQuery, StandingInstructionStatus } from '../api/standing-instruction.types'

export function parseSiListFilters(searchParams: URLSearchParams, legalEntityId: string): ListStandingInstructionsQuery {
  const page = Number(searchParams.get('page') || '1') || 1
  const status = (searchParams.get('status') as StandingInstructionStatus | null) || undefined
  return {
    legalEntityId,
    page,
    limit: 20,
    ...(status ? { status } : {}),
  }
}

export function syncSiListSearchParams(params: URLSearchParams, next: { status?: string; page?: number }) {
  if (next.status) params.set('status', next.status)
  else params.delete('status')
  if (next.page && next.page > 1) params.set('page', String(next.page))
  else params.delete('page')
  return params
}
