import { useMemo } from 'react'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useApprovalStore } from '../store/approvalStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useMrpStore } from '../store/mrpStore'
import { useCrmStore } from '../store/crmStore'
import { computeSidebarCategoryCounts } from '../store/selectors/sidebarCounts.selectors'

/** Reactive sidebar badge counts — one render per underlying slice change. */
export function useSidebarLiveCounts(): Record<string, number> {
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const inspections = useQualityStore((s) => s.inspections)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const approvalRequests = useApprovalStore((s) => s.requests)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const opportunities = useCrmStore((s) => s.opportunities)
  const followUps = useCrmStore((s) => s.followUps)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)

  return useMemo(
    () =>
      computeSidebarCategoryCounts({
        workOrders,
        inspections,
        dispatches,
        approvalRequests,
        purchaseOrders,
        salesOrders,
        opportunities,
        followUps,
        quotationDocuments,
      }),
    [
      workOrders,
      inspections,
      dispatches,
      approvalRequests,
      purchaseOrders,
      salesOrders,
      opportunities,
      followUps,
      quotationDocuments,
    ],
  )
}

export function useSidebarCategoryCount(categoryId: string): number {
  const counts = useSidebarLiveCounts()
  return counts[categoryId] ?? 0
}
