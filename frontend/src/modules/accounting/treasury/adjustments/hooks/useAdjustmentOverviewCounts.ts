import { useEffect, useState } from 'react'
import { fetchAdjustments } from '../api/treasury-adjustment.api'
import type { TreasuryAdjustmentStatus } from '../api/treasury-adjustment.types'

export interface AdjustmentOverviewCounts {
  pendingApproval: number
  readyToPost: number
  posted: number
}

const EMPTY_COUNTS: AdjustmentOverviewCounts = { pendingApproval: 0, readyToPost: 0, posted: 0 }

/** Lightweight KPI counts for the adjustment list header — one `limit=1` list call per bucket. */
export function useAdjustmentOverviewCounts(legalEntityId: string | undefined, enabled: boolean) {
  const [counts, setCounts] = useState<AdjustmentOverviewCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled || !legalEntityId) {
      setLoading(false)
      return
    }
    const activeLegalEntityId = legalEntityId
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const statuses: Array<[keyof AdjustmentOverviewCounts, TreasuryAdjustmentStatus]> = [
          ['pendingApproval', 'PENDING_APPROVAL'],
          ['readyToPost', 'READY_TO_POST'],
          ['posted', 'POSTED'],
        ]
        const results = await Promise.all(
          statuses.map(([, status]) => fetchAdjustments({ legalEntityId: activeLegalEntityId, status, page: 1, limit: 1 })),
        )
        if (cancelled) return
        const next: AdjustmentOverviewCounts = { ...EMPTY_COUNTS }
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
  }, [legalEntityId, enabled])

  return { counts, loading }
}
