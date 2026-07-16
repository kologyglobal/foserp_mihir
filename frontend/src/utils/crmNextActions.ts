/**
 * CRM Next Action Engine — business-specific sales actions from live CRM data.
 */
import type { NextActionSeverity } from '../services/nextActionEngine'
import { useCrmStore } from '../store/crmStore'
import { useMasterStore } from '../store/masterStore'
import { useSalesStore } from '../store/salesStore'
import { formatCrmCurrency } from './crmMetrics'
import { opportunityStageLabel } from './opportunityUtils'

export interface CrmNextAction {
  id: string
  title: string
  reason: string
  customerName?: string
  opportunityName?: string
  quotationNo?: string
  ownerName?: string
  valueImpact?: string
  priority: NextActionSeverity
  route: string
  actionLabel: string
}

const today = () => new Date().toISOString().slice(0, 10)

function daysSince(iso: string): number {
  const d = new Date(iso.slice(0, 10))
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

export function buildCrmNextActions(limit = 10): CrmNextAction[] {
  const crm = useCrmStore.getState()
  const customers = useMasterStore.getState().customers
  const sales = useSalesStore.getState()
  const actions: CrmNextAction[] = []
  const custName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.customerName ?? 'Customer' : 'Customer')

  const dueToday = crm.followUps.filter((f) => f.status === 'pending' && f.dueDate.slice(0, 10) === today())
  for (const f of dueToday.slice(0, 3)) {
    const opp = f.opportunityId ? crm.getOpportunity(f.opportunityId) : null
    actions.push({
      id: `fu-today-${f.id}`,
      title: `Follow up ${custName(f.customerId)} today at ${f.dueTime ?? 'scheduled time'}`,
      reason: f.notes || `Scheduled ${f.followUpType.replace(/_/g, ' ')}`,
      customerName: custName(f.customerId),
      opportunityName: opp?.opportunityName,
      ownerName: f.assignedToName,
      valueImpact: opp ? formatCrmCurrency(opp.value) : undefined,
      priority: f.priority === 'critical' ? 'critical' : f.priority === 'high' ? 'high' : 'medium',
      route: f.opportunityId ? `/crm/opportunities/${f.opportunityId}` : '/crm/leads',
      actionLabel: 'Open follow-up',
    })
  }

  const overdue = crm.followUps.filter((f) => f.status === 'overdue')
  for (const f of overdue.slice(0, 2)) {
    actions.push({
      id: `fu-overdue-${f.id}`,
      title: `Call ${custName(f.customerId)} — overdue follow-up`,
      reason: `Due ${f.dueDate} — ${f.followUpType.replace(/_/g, ' ')}`,
      customerName: custName(f.customerId),
      ownerName: f.assignedToName,
      priority: 'critical',
      route: f.opportunityId ? `/crm/opportunities?view=follow-ups` : '/crm/leads',
      actionLabel: 'Resolve now',
    })
  }

  const pendingApproval = crm.quotationDocuments.filter((d) => d.status === 'pending_approval')
  for (const d of pendingApproval.slice(0, 2)) {
    const q = sales.getQuotation(d.quotationId)
    actions.push({
      id: `quo-approval-${d.id}`,
      title: `Review ${formatCrmCurrency(d.totalAmount)} quotation pending approval`,
      reason: `${q?.quotationNo ?? d.quotationId} Rev ${d.revisionNo} awaiting manager sign-off`,
      quotationNo: q?.quotationNo ?? d.quotationId,
      valueImpact: formatCrmCurrency(d.totalAmount),
      ownerName: d.salesOwnerName ?? undefined,
      priority: d.totalAmount >= 3000000 ? 'critical' : 'high',
      route: `/crm/quotations/${d.quotationId}/editor?doc=${d.id}`,
      actionLabel: 'Review quotation',
    })
  }

  const approvedNotConverted = crm.quotationDocuments.filter(
    (d) => d.status === 'approved' && d.revisionNo === Math.max(
      ...crm.quotationDocuments.filter((x) => x.quotationId === d.quotationId).map((x) => x.revisionNo),
    ),
  )
  for (const d of approvedNotConverted.slice(0, 2)) {
    const opp = d.opportunityId ? crm.getOpportunity(d.opportunityId) : null
    if (opp?.salesOrderId) continue
    const q = sales.getQuotation(d.quotationId)
    actions.push({
      id: `quo-convert-${d.id}`,
      title: `Convert approved quotation ${q?.quotationNo ?? d.quotationId} to Sales Order`,
      reason: 'Quotation approved — ready for order conversion',
      customerName: opp ? custName(opp.customerId) : undefined,
      quotationNo: q?.quotationNo ?? d.quotationId,
      priority: 'high',
      route: `/crm/quotations/${d.quotationId}/editor?doc=${d.id}`,
      actionLabel: 'Convert to SO',
    })
  }

  const stale = crm.opportunities.filter(
    (o) => o.status === 'open' && daysSince(o.lastActivityAt ?? o.createdAt) >= 7,
  )
  for (const o of stale.slice(0, 2)) {
    actions.push({
      id: `stale-opp-${o.id}`,
      title: `Call ${custName(o.customerId)} — no activity for ${daysSince(o.lastActivityAt ?? o.createdAt)} days`,
      reason: `${o.opportunityName} in ${opportunityStageLabel(o.stage)}`,
      customerName: custName(o.customerId),
      opportunityName: o.opportunityName,
      priority: 'medium',
      route: `/crm/opportunities/${o.id}`,
      actionLabel: 'Open opportunity',
    })
  }

  const stageMoves = crm.opportunities.filter(
    (o) => o.status === 'open' && o.stage === 'qualified' && o.probability >= 50,
  )
  for (const o of stageMoves.slice(0, 1)) {
    actions.push({
      id: `stage-move-${o.id}`,
      title: `Move ${custName(o.customerId)} opportunity to Technical Review`,
      reason: `Qualified deal worth ${formatCrmCurrency(o.value)} — ready for technical evaluation`,
      customerName: custName(o.customerId),
      opportunityName: o.opportunityName,
      priority: 'medium',
      route: `/crm/opportunities/${o.id}`,
      actionLabel: 'Move stage',
    })
  }

  const sentRevised = crm.quotationDocuments.filter((d) => d.status === 'sent' && d.revisionNo > 0)
  for (const d of sentRevised.slice(0, 1)) {
    const opp = d.opportunityId ? crm.getOpportunity(d.opportunityId) : null
    const q = sales.getQuotation(d.quotationId)
    actions.push({
      id: `quo-revised-${d.id}`,
      title: `Send revised quotation to ${opp ? custName(opp.customerId) : 'customer'}`,
      reason: `Revision ${d.revisionNo} sent — confirm customer receipt`,
      customerName: opp ? custName(opp.customerId) : undefined,
      quotationNo: q?.quotationNo ?? d.quotationId,
      priority: 'medium',
      route: `/crm/quotations/${d.quotationId}/preview?doc=${d.id}`,
      actionLabel: 'Preview & send',
    })
  }

  const severityOrder: Record<NextActionSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  return actions.sort((a, b) => severityOrder[a.priority] - severityOrder[b.priority]).slice(0, limit)
}
