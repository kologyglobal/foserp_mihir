import type { ApprovalRequest } from '../../types/approvalMatrix'
import type { FollowUp, Opportunity, QuotationDocument } from '../../types/crm'
import type { DispatchPlan } from '../../types/dispatch'
import type { SalesOrder } from '../../types/mrp'
import type { PurchaseOrder } from '../../types/purchase'
import type { QcInspection } from '../../types/quality'
import type { WorkOrder } from '../../types/workorder'

export interface SidebarCountSources {
  workOrders: WorkOrder[]
  inspections: QcInspection[]
  dispatches: DispatchPlan[]
  approvalRequests: ApprovalRequest[]
  purchaseOrders: PurchaseOrder[]
  salesOrders: SalesOrder[]
  opportunities: Opportunity[]
  followUps: FollowUp[]
  quotationDocuments: QuotationDocument[]
}

/** Pure derivation — safe to call from hooks or imperative utils. */
export function computeSidebarCategoryCounts(sources: SidebarCountSources): Record<string, number> {
  const workOrders = sources.workOrders ?? []
  const inspections = sources.inspections ?? []
  const dispatches = sources.dispatches ?? []
  const approvalRequests = sources.approvalRequests ?? []
  const purchaseOrders = sources.purchaseOrders ?? []
  const salesOrders = sources.salesOrders ?? []
  const opportunities = sources.opportunities ?? []
  const followUps = sources.followUps ?? []
  const quotationDocuments = sources.quotationDocuments ?? []

  const runningWo = workOrders.filter((w) => ['released', 'in_progress'].includes(w.status)).length
  const qcPending = inspections.filter((i) => i.status === 'pending').length
  const dispatchReady = dispatches.filter((d) => ['ready', 'planned', 'loading'].includes(d.status)).length
  const approvals = approvalRequests.filter((r) => r.status === 'pending').length
  const openPo = purchaseOrders.filter((p) => p.status === 'submitted').length
  const openSo = salesOrders.filter((s) => !['closed', 'cancelled'].includes(s.status)).length
  const pendingMrp = salesOrders.filter(
    (s) => s.status === 'confirmed' && !workOrders.some((w) => w.salesOrderId === s.id),
  ).length

  const openOpportunities = opportunities.filter((o) => o.status === 'open').length
  const dueFollowUps = followUps.filter((f) => f.status === 'pending' || f.status === 'overdue').length
  const pendingQuotations = quotationDocuments.filter(
    (d) => d.status === 'pending_approval' || d.status === 'sent',
  ).length

  return {
    executive: approvals,
    crm: openOpportunities + dueFollowUps + pendingQuotations,
    production: runningWo,
    quality: qcPending,
    dispatch: dispatchReady,
    purchase: openPo,
    sales: openSo + pendingMrp + dispatchReady,
    approvals,
  }
}
