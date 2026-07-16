import { useWorkOrderStore } from '../store/workOrderStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useApprovalStore } from '../store/approvalStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useMrpStore } from '../store/mrpStore'
import { useCrmStore } from '../store/crmStore'
import { computeSidebarCategoryCounts } from '../store/selectors/sidebarCounts.selectors'

/** Imperative sidebar badge counts — prefer useSidebarLiveCounts() in React components. */
export function getSidebarCategoryCounts(): Record<string, number> {
  const wo = useWorkOrderStore.getState()
  const quality = useQualityStore.getState()
  const dispatch = useDispatchStore.getState()
  const approval = useApprovalStore.getState()
  const purchase = usePurchaseStore.getState()
  const mrp = useMrpStore.getState()
  const crm = useCrmStore.getState()

  return computeSidebarCategoryCounts({
    workOrders: wo.workOrders,
    inspections: quality.inspections,
    dispatches: dispatch.dispatches,
    approvalRequests: approval.requests,
    purchaseOrders: purchase.purchaseOrders,
    salesOrders: mrp.salesOrders,
    opportunities: crm.opportunities,
    followUps: crm.followUps,
    quotationDocuments: crm.quotationDocuments,
  })
}

export function getSidebarCategoryCount(categoryId: string): number {
  return getSidebarCategoryCounts()[categoryId] ?? 0
}
