import type { ExperienceRole } from '../types/roleExperience'
import { usePurchaseStore } from '../store/purchaseStore'
import { useQualityStore } from '../store/qualityStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useMobileGateStore } from '../store/mobileGateStore'
import { useMobileStockCountStore } from '../store/mobileStockCountStore'
import { useMobileDraftStore } from '../store/mobileDraftStore'
import { listPendingApprovalsForUser } from './approvalEngine'
import { getSessionUser } from './permissions'
import { mapExperienceToMobileRole } from './mobilePermissions'
import { buildMobileCrmPipelineMetrics, mobileCrmEnabled } from './mobileCrmPipeline'

export type MobileTaskPriority = 'high' | 'medium' | 'low'

export interface MobileTask {
  id: string
  title: string
  subtitle: string
  module: string
  count?: number
  priority: MobileTaskPriority
  dueLabel?: string
  path: string
  actionLabel: string
}

export function buildMobileTasks(role: ExperienceRole): MobileTask[] {
  const mobileRole = mapExperienceToMobileRole(role)
  const tasks: MobileTask[] = []

  const openPos = usePurchaseStore.getState().purchaseOrders.filter(
    (p) => !['closed', 'cancelled'].includes(p.status) && p.lines.some((l) => l.receivedQty < l.qty),
  )
  const pendingQc = useQualityStore.getState().getPendingInspections()
  const jobCards = useWorkOrderStore.getState().jobCards.filter((j) => j.status !== 'completed')
  const loadingDispatches = useDispatchStore.getState().dispatches.filter((d) =>
    ['planned', 'loading', 'ready'].includes(d.status),
  )
  const user = getSessionUser()
  const approvals = listPendingApprovalsForUser(user)
  const insideVehicles = useMobileGateStore.getState().getInsideVehicles()
  const draftCounts = useMobileDraftStore.getState().drafts.length
  const pendingCounts = useMobileStockCountStore.getState().sessions.filter((s) => s.status === 'submitted')

  if (mobileRole === 'store_user' || mobileRole === 'manager') {
    if (openPos.length > 0) {
      tasks.push({
        id: 'grn-pending',
        title: 'Pending GRN',
        subtitle: `${openPos.length} POs with open receipt`,
        module: 'Stores',
        count: openPos.length,
        priority: 'high',
        path: '/m/grn',
        actionLabel: 'Receive',
      })
    }
    tasks.push({
      id: 'material-issue',
      title: 'Material Issue',
      subtitle: 'Issue to work orders',
      module: 'Stores',
      priority: 'medium',
      path: '/m/material-issue',
      actionLabel: 'Issue',
    })
    tasks.push({
      id: 'stock-count',
      title: 'Stock Count',
      subtitle: pendingCounts.length > 0 ? `${pendingCounts.length} awaiting approval` : 'Physical count',
      module: 'Stores',
      priority: pendingCounts.length > 0 ? 'high' : 'medium',
      path: '/m/stock-count',
      actionLabel: 'Count',
    })
  }

  if (mobileRole === 'gate_keeper' || mobileRole === 'dispatch_user' || mobileRole === 'manager') {
    tasks.push({
      id: 'gate-inward',
      title: 'Vehicle Entry',
      subtitle: `${insideVehicles.length} vehicles inside`,
      module: 'Gate',
      count: insideVehicles.length,
      priority: 'medium',
      path: '/m/gate',
      actionLabel: 'Gate',
    })
  }

  if (mobileRole === 'shop_floor' || mobileRole === 'manager') {
    const myJobs = jobCards.filter((j) => ['pending', 'assigned', 'in_progress'].includes(j.status))
    if (myJobs.length > 0) {
      tasks.push({
        id: 'my-job-cards',
        title: 'My Job Cards',
        subtitle: `${myJobs.length} active job cards`,
        module: 'Production',
        count: myJobs.length,
        priority: 'high',
        path: '/m/shop-floor',
        actionLabel: 'Open',
      })
    }
  }

  if (mobileRole === 'quality_inspector' || mobileRole === 'manager') {
    if (pendingQc.length > 0) {
      tasks.push({
        id: 'qc-pending',
        title: 'Pending QC',
        subtitle: `${pendingQc.length} inspections waiting`,
        module: 'Quality',
        count: pendingQc.length,
        priority: 'high',
        path: '/m/qc',
        actionLabel: 'Inspect',
      })
    }
  }

  if (mobileRole === 'dispatch_user' || mobileRole === 'manager') {
    if (loadingDispatches.length > 0) {
      tasks.push({
        id: 'dispatch-loading',
        title: 'Loading Today',
        subtitle: `${loadingDispatches.length} dispatch plans`,
        module: 'Dispatch',
        count: loadingDispatches.length,
        priority: 'high',
        path: '/m/dispatch',
        actionLabel: 'Load',
      })
    }
  }

  if (approvals.length > 0 && (mobileRole === 'manager' || mobileRole === 'store_user')) {
    tasks.push({
      id: 'approvals',
      title: 'Pending Approvals',
      subtitle: `${approvals.length} documents`,
      module: 'Approvals',
      count: approvals.length,
      priority: 'high',
      path: '/m/approvals',
      actionLabel: 'Review',
    })
  }

  if (draftCounts > 0) {
    tasks.push({
      id: 'drafts',
      title: 'Saved Drafts',
      subtitle: `${draftCounts} offline drafts`,
      module: 'Sync',
      count: draftCounts,
      priority: 'medium',
      path: '/m/tasks',
      actionLabel: 'Sync',
    })
  }

  if (mobileCrmEnabled()) {
    const crm = buildMobileCrmPipelineMetrics()
    if (crm.followUpsDue > 0) {
      tasks.push({
        id: 'crm-follow-ups',
        title: 'CRM Follow-ups',
        subtitle: `${crm.followUpsDue} due today or overdue`,
        module: 'CRM',
        count: crm.followUpsDue,
        priority: 'high',
        dueLabel: 'Today',
        path: '/m/crm/follow-ups',
        actionLabel: 'View',
      })
    }
    if (crm.quotationsPendingApproval > 0) {
      tasks.push({
        id: 'crm-quote-approval',
        title: 'Quotation Approvals',
        subtitle: `${crm.quotationsPendingApproval} pending customer approval`,
        module: 'CRM',
        count: crm.quotationsPendingApproval,
        priority: 'high',
        path: '/m/crm/quotations',
        actionLabel: 'Review',
      })
    }
    if (crm.openOpportunities > 0) {
      tasks.push({
        id: 'crm-pipeline',
        title: 'CRM Pipeline',
        subtitle: `${crm.openOpportunities} open opportunities`,
        module: 'CRM',
        count: crm.openOpportunities,
        priority: 'medium',
        path: '/m/crm',
        actionLabel: 'Open',
      })
    }
  }

  return tasks
}

export function mobileTaskCount(role: ExperienceRole): number {
  return buildMobileTasks(role).reduce((n, t) => n + (t.count ?? 1), 0)
}
