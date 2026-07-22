import { useEffect, useState } from 'react'
import { fetchCheques } from '../api/treasury-cheque.api'
import type { TreasuryChequeStatus } from '../api/treasury-cheque.types'

export interface ChequeOverviewCounts {
  pendingApproval: number
  ready: number
  postedAwaitingClearance: number
  bounced: number
  pdc: number
}

const EMPTY_COUNTS: ChequeOverviewCounts = { pendingApproval: 0, ready: 0, postedAwaitingClearance: 0, bounced: 0, pdc: 0 }

/** Lightweight KPI counts for the cheque list header — one `limit=1` list call per bucket. */
export function useChequeOverviewCounts(legalEntityId: string | undefined, enabled: boolean) {
  const [counts, setCounts] = useState<ChequeOverviewCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled || !legalEntityId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const statuses: Array<[keyof Omit<ChequeOverviewCounts, 'postedAwaitingClearance' | 'pdc'>, TreasuryChequeStatus]> = [
          ['pendingApproval', 'PENDING_APPROVAL'],
          ['ready', 'READY'],
          ['bounced', 'BOUNCED'],
        ]
        const [statusResults, issuedRes, depositedRes, pdcRes] = await Promise.all([
          Promise.all(statuses.map(([, status]) => fetchCheques({ legalEntityId, status, page: 1, limit: 1 }))),
          fetchCheques({ legalEntityId, status: 'ISSUED', page: 1, limit: 1 }),
          fetchCheques({ legalEntityId, status: 'DEPOSITED', page: 1, limit: 1 }),
          fetchCheques({ legalEntityId, isPdc: true, page: 1, limit: 1 }),
        ])
        if (cancelled) return
        const next: ChequeOverviewCounts = { ...EMPTY_COUNTS }
        statuses.forEach(([key], i) => {
          next[key] = statusResults[i]?.total ?? 0
        })
        next.postedAwaitingClearance = (issuedRes.total ?? 0) + (depositedRes.total ?? 0)
        next.pdc = pdcRes.total ?? 0
        setCounts(next)
      } catch {
        if (!cancelled) setCounts(EMPTY_COUNTS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [legalEntityId, enabled])

  return { counts, loading }
}
