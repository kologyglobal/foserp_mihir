/**
 * Next Action Engine — business-specific suggested actions from live demo data.
 */
import { formatMetricCurrency } from './erpAnalyticsService'
import { getUnifiedInboxData } from '../utils/controlTowerMetrics'
import { usePurchaseStore } from '../store/purchaseStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useEcoStore } from '../store/ecoStore'
import { useMrpStore } from '../store/mrpStore'
import { listPendingApprovalsForUser } from '../utils/approvalEngine'
import { getSessionUser } from '../utils/permissions'
import { buildCrmNextActions } from '../utils/crmNextActions'

export type NextActionSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface NextBusinessAction {
  id: string
  title: string
  reason: string
  documentCount: number
  valueImpact?: string
  severity: NextActionSeverity
  route: string
  actionLabel: string
}

export function buildNextBusinessActions(limit = 8): NextBusinessAction[] {
  const actions: NextBusinessAction[] = []
  const purchase = usePurchaseStore.getState()
  const quality = useQualityStore.getState()
  const dispatch = useDispatchStore.getState()
  const invoice = useInvoiceStore.getState()
  const eco = useEcoStore.getState()
  const mrp = useMrpStore.getState()

  const pendingPos = purchase.purchaseOrders.filter((p) => p.status === 'submitted')
  if (pendingPos.length > 0) {
    const value = pendingPos.reduce((s, p) => s + p.lines.reduce((ls, l) => ls + l.qty * l.rate, 0), 0)
    actions.push({
      id: 'approve-pos',
      title: `Approve ${pendingPos.length} PO${pendingPos.length > 1 ? 's' : ''} worth ${formatMetricCurrency(value)}`,
      reason: 'Purchase orders awaiting approval block material procurement',
      documentCount: pendingPos.length,
      valueImpact: formatMetricCurrency(value),
      severity: 'high',
      route: '/purchase/orders',
      actionLabel: 'Review POs',
    })
  }

  const delayedDispatches = dispatch.dispatches.filter(
    (d) => d.plannedDate && d.plannedDate < new Date().toISOString().slice(0, 10) && !['delivered', 'closed', 'cancelled'].includes(d.status),
  )
  if (delayedDispatches.length > 0) {
    actions.push({
      id: 'delayed-dispatch',
      title: `Resolve ${delayedDispatches.length} delayed dispatch${delayedDispatches.length > 1 ? 'es' : ''}`,
      reason: 'Planned dispatch dates have passed — customer delivery risk',
      documentCount: delayedDispatches.length,
      severity: 'critical',
      route: '/dispatch/register',
      actionLabel: 'Open dispatch register',
    })
  }

  const pendingQc = quality.getPendingInspections()
  if (pendingQc.length > 0) {
    actions.push({
      id: 'qc-pending',
      title: `Review ${pendingQc.length} pending QC inspection${pendingQc.length > 1 ? 's' : ''}`,
      reason: 'Operations blocked until inspection decisions are recorded',
      documentCount: pendingQc.length,
      severity: pendingQc.length > 5 ? 'high' : 'medium',
      route: '/quality/queue',
      actionLabel: 'QC queue',
    })
  }

  const shortages = mrp.getLatestRun()?.materialLines.filter((l) => l.shortageQty > 0) ?? []
  if (shortages.length > 0) {
    const top = shortages[0]
    actions.push({
      id: 'material-shortage',
      title: `Fix ${shortages.length} material shortage${shortages.length > 1 ? 's' : ''}`,
      reason: top ? `${top.itemCode} short for ${top.salesOrderNo ?? 'MRP'}` : 'MRP material gaps blocking production',
      documentCount: shortages.length,
      severity: 'high',
      route: '/mrp/planner',
      actionLabel: 'MRP planner',
    })
  }

  const overdue = invoice.getReceivables().filter((r) => r.daysOverdue > 0 || r.paymentStatus === 'overdue')
  if (overdue.length > 0) {
    const total = overdue.reduce((s, r) => s + r.balanceDue, 0)
    actions.push({
      id: 'overdue-ar',
      title: `Follow up ${formatMetricCurrency(total)} overdue AR`,
      reason: `${overdue.length} invoice${overdue.length > 1 ? 's' : ''} past due date`,
      documentCount: overdue.length,
      valueImpact: formatMetricCurrency(total),
      severity: 'high',
      route: '/invoices/register',
      actionLabel: 'AR register',
    })
  }

  const draftEcos = eco.ecos.filter((e) => e.approvalStatus === 'draft' || e.approvalStatus === 'pending_approval')
  if (draftEcos.length > 0) {
    const first = draftEcos[0]
    actions.push({
      id: 'eco-pending',
      title: `Release ${first?.ecoNo ?? 'pending ECO'} for engineering change`,
      reason: `${draftEcos.length} ECO/ECR record${draftEcos.length > 1 ? 's' : ''} awaiting release`,
      documentCount: draftEcos.length,
      severity: 'medium',
      route: first ? `/engineering/eco/${first.id}` : '/engineering/eco',
      actionLabel: 'ECO register',
    })
  }

  const user = getSessionUser()
  const matrixApprovals = listPendingApprovalsForUser(user)
  if (matrixApprovals.length > 0) {
    actions.push({
      id: 'matrix-approvals',
      title: `Complete ${matrixApprovals.length} matrix approval${matrixApprovals.length > 1 ? 's' : ''}`,
      reason: 'Approval workflow routing requires your sign-off',
      documentCount: matrixApprovals.length,
      severity: 'medium',
      route: '/approvals',
      actionLabel: 'Approval Workflow',
    })
  }

  const inbox = getUnifiedInboxData()
  if (inbox.counts.alerts > 0 && actions.length < limit) {
    actions.push({
      id: 'inbox-alerts',
      title: `Review ${inbox.counts.alerts} factory alert${inbox.counts.alerts > 1 ? 's' : ''}`,
      reason: 'Active alerts from production, quality, and dispatch',
      documentCount: inbox.counts.alerts,
      severity: 'medium',
      route: '/control-towers/inbox',
      actionLabel: 'Unified inbox',
    })
  }

  for (const crm of buildCrmNextActions(4)) {
    actions.push({
      id: crm.id,
      title: crm.title,
      reason: crm.reason,
      documentCount: 1,
      severity: crm.priority,
      route: crm.route,
      actionLabel: crm.actionLabel,
    })
  }

  const severityOrder: Record<NextActionSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  return actions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, limit)
}
