import { useEffect, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { fetchTransfers } from '../api/treasury-transfer.api'
import type { TreasuryTransferStatus } from '../api/treasury-transfer.types'

export interface TransferOverviewCounts {
  draft: number
  pendingApproval: number
  readyToPost: number
  inTransit: number
}

const EMPTY_COUNTS: TransferOverviewCounts = { draft: 0, pendingApproval: 0, readyToPost: 0, inTransit: 0 }

/** Lightweight counts for Bank & Cash overview KPIs — one `limit=1` list call per status. */
export function useTransferOverviewCounts(enabled: boolean) {
  const [counts, setCounts] = useState<TransferOverviewCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled || !isApiMode()) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const legalEntityId = resolveLegalEntityId()
        const statuses: Array<[keyof TransferOverviewCounts, TreasuryTransferStatus]> = [
          ['draft', 'DRAFT'],
          ['pendingApproval', 'PENDING_APPROVAL'],
          ['readyToPost', 'READY_TO_POST'],
          ['inTransit', 'IN_TRANSIT'],
        ]
        const results = await Promise.all(
          statuses.map(([, status]) => fetchTransfers({ legalEntityId, status, page: 1, limit: 1 })),
        )
        if (cancelled) return
        const next: TransferOverviewCounts = { ...EMPTY_COUNTS }
        statuses.forEach(([key], i) => {
          next[key] = results[i]?.total ?? 0
        })
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
  }, [enabled])

  return { counts, loading }
}
