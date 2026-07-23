import type { CrmActivity, FollowUp, Opportunity, QuotationDocument } from '../types/crm'
import type { Lead } from '../types/sales'
import type { SalesOrder } from '../types/mrp'
import type { ReceivableRow } from '../types/invoice'
import type { DashboardFeedItem, DashboardQuickView } from '../types/dashboardInteraction'
import { formatCrmCurrency } from './crmMetrics'
import { formatCurrency } from './formatters/currency'
import { formatDate } from './dates/format'
type CustomerResolver = (id: string) => string

function oppQuickView(opp: Opportunity, customerName: string): DashboardQuickView {
  return {
    title: opp.opportunityName,
    subtitle: customerName,
    badge: opp.stage.replace(/_/g, ' '),
    badgeTone: opp.stage === 'won' ? 'success' : opp.stage === 'lost' ? 'critical' : 'neutral',
    fields: [
      { label: 'Value', value: formatCrmCurrency(opp.value) },
      { label: 'Probability', value: `${opp.probability}%` },
      { label: 'Owner', value: opp.ownerName },
      { label: 'Expected close', value: opp.expectedCloseDate ? formatDate(opp.expectedCloseDate) : '—' },
      { label: 'Stage', value: opp.stage.replace(/_/g, ' ') },
    ],
    primaryAction: { label: 'Open opportunity', href: `/crm/opportunities/${opp.id}` },
  }
}

function leadQuickView(lead: Lead, customerName: string): DashboardQuickView {
  return {
    title: lead.prospectName,
    subtitle: lead.leadNo,
    badge: lead.stage,
    fields: [
      { label: 'Expected value', value: formatCrmCurrency(lead.expectedValue) },
      { label: 'Owner', value: lead.leadOwnerName },
      { label: 'Source', value: lead.source },
      { label: 'Priority', value: lead.priority },
      ...(customerName ? [{ label: 'Customer', value: customerName }] : []),
    ],
    primaryAction: { label: 'Open lead', href: `/crm/leads/${lead.id}` },
  }
}

function quotationQuickView(doc: QuotationDocument, customerName: string, oppName?: string): DashboardQuickView {
  return {
    title: `${doc.quotationId} · Rev ${doc.revisionNo}`,
    subtitle: customerName,
    badge: doc.status.replace(/_/g, ' '),
    badgeTone: doc.status === 'pending_approval' ? 'warning' : doc.status === 'approved' ? 'success' : 'neutral',
    fields: [
      { label: 'Amount', value: formatCrmCurrency(doc.totalAmount) },
      { label: 'Owner', value: doc.salesOwnerName ?? '—' },
      { label: 'Created', value: formatDate(doc.createdAt.slice(0, 10)) },
      ...(oppName ? [{ label: 'Opportunity', value: oppName }] : []),
    ],
    primaryAction: { label: 'Open quotation', href: `/crm/quotations/${doc.quotationId}` },
    secondaryAction: { label: 'Review & approve', href: `/crm/quotations/${doc.quotationId}/editor?doc=${doc.id}` },
  }
}

function soQuickView(so: SalesOrder, customerName: string): DashboardQuickView {
  return {
    title: so.salesOrderNo,
    subtitle: customerName,
    badge: so.status.replace(/_/g, ' '),
    fields: [
      { label: 'Order date', value: formatDate(so.orderDate ?? so.createdAt.slice(0, 10)) },
      { label: 'Required date', value: formatDate(so.requiredDate) },
      { label: 'Owner', value: so.salesOwnerName ?? '—' },
      { label: 'Status', value: so.status.replace(/_/g, ' ') },
    ],
    primaryAction: { label: 'Open sales order', href: `/sales/orders/${so.id}` },
  }
}

function activityQuickView(
  act: CrmActivity,
  customerName: string,
  oppName?: string,
): DashboardQuickView {
  return {
    title: act.subject,
    subtitle: `${act.type} · ${act.ownerName}`,
    fields: [
      { label: 'Date', value: formatDate(act.activityDate) },
      { label: 'Description', value: act.description || '—' },
      ...(customerName ? [{ label: 'Customer', value: customerName }] : []),
      ...(oppName ? [{ label: 'Opportunity', value: oppName, href: act.opportunityId ? `/crm/opportunities/${act.opportunityId}` : undefined }] : []),
    ],
    primaryAction: act.opportunityId
      ? { label: 'Open opportunity', href: `/crm/opportunities/${act.opportunityId}` }
      : act.leadId
        ? { label: 'Open lead', href: `/crm/leads/${act.leadId}` }
        : undefined,
  }
}

function followUpQuickView(
  fu: FollowUp,
  customerName: string,
  oppName?: string,
): DashboardQuickView {
  return {
    title: `${fu.followUpType.replace(/_/g, ' ')} follow-up`,
    subtitle: customerName || fu.assignedToName,
    badge: fu.status,
    badgeTone: fu.status === 'overdue' ? 'critical' : fu.dueDate.slice(0, 10) === new Date().toISOString().slice(0, 10) ? 'warning' : 'neutral',
    fields: [
      { label: 'Due', value: `${formatDate(fu.dueDate)} ${fu.dueTime}` },
      { label: 'Assigned to', value: fu.assignedToName },
      { label: 'Priority', value: fu.priority },
      { label: 'Notes', value: fu.notes || '—' },
      ...(oppName ? [{ label: 'Opportunity', value: oppName }] : []),
    ],
    primaryAction: fu.opportunityId
      ? { label: 'Open opportunity', href: `/crm/opportunities/${fu.opportunityId}` }
      : undefined,
  }
}

export function buildCrmManagementFeed(input: {
  opportunities: Opportunity[]
  followUps: FollowUp[]
  activities: CrmActivity[]
  quotationDocuments: QuotationDocument[]
  leads: Lead[]
  resolveCustomerName: CustomerResolver
}): DashboardFeedItem[] {
  const events: DashboardFeedItem[] = []
  const oppMap = new Map(input.opportunities.map((o) => [o.id, o]))

  for (const act of [...input.activities].sort((a, b) => b.activityDate.localeCompare(a.activityDate)).slice(0, 15)) {
    const opp = act.opportunityId ? oppMap.get(act.opportunityId) : undefined
    const customerName = act.customerId ? input.resolveCustomerName(act.customerId) : opp ? input.resolveCustomerName(opp.customerId) : ''
    events.push({
      id: `act-${act.id}`,
      category: 'activity',
      title: act.subject,
      subtitle: `${act.type} · ${act.ownerName}`,
      timestamp: act.activityDate,
      user: act.ownerName,
      icon: 'general',
      href: act.opportunityId ? `/crm/opportunities/${act.opportunityId}` : act.leadId ? `/crm/leads/${act.leadId}` : undefined,
      documentRef: customerName || undefined,
      quickView: activityQuickView(act, customerName, opp?.opportunityName),
    })
  }

  for (const fu of [...input.followUps]
    .filter((f) => f.status !== 'completed')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 12)) {
    const opp = fu.opportunityId ? oppMap.get(fu.opportunityId) : undefined
    const customerName = fu.customerId ? input.resolveCustomerName(fu.customerId) : opp ? input.resolveCustomerName(opp.customerId) : ''
    const severity =
      fu.status === 'overdue'
        ? 'critical'
        : fu.dueDate.slice(0, 10) === new Date().toISOString().slice(0, 10)
          ? 'high'
          : 'medium'
    events.push({
      id: `fu-${fu.id}`,
      category: 'pipeline',
      title: `${fu.followUpType.replace(/_/g, ' ')} due ${formatDate(fu.dueDate)}`,
      subtitle: `${fu.assignedToName} · ${customerName || 'No customer'}`,
      timestamp: `${fu.dueDate}T${fu.dueTime || '09:00'}`,
      severity,
      icon: 'approval',
      href: fu.opportunityId ? `/crm/opportunities/${fu.opportunityId}` : undefined,
      quickView: followUpQuickView(fu, customerName, opp?.opportunityName),
    })
  }

  for (const lead of [...input.leads]
    .sort((a, b) => (b.modifiedAt ?? b.createdAt).localeCompare(a.modifiedAt ?? a.createdAt))
    .slice(0, 10)) {
    const customerName = lead.customerId ? input.resolveCustomerName(lead.customerId) : ''
    events.push({
      id: `lead-${lead.id}`,
      category: 'lead',
      title: `Lead ${lead.leadNo} — ${lead.stage}`,
      subtitle: `${lead.prospectName} · ${lead.leadOwnerName}`,
      timestamp: lead.modifiedAt ?? lead.createdAt,
      user: lead.leadOwnerName,
      icon: 'general',
      href: `/crm/leads/${lead.id}`,
      documentRef: formatCrmCurrency(lead.expectedValue),
      quickView: leadQuickView(lead, customerName),
    })
  }

  for (const doc of [...input.quotationDocuments]
    .filter((d) => d.status === 'pending_approval' || d.status === 'approved')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)) {
    const opp = doc.opportunityId ? oppMap.get(doc.opportunityId) : undefined
    const customerName = opp ? input.resolveCustomerName(opp.customerId) : 'Customer'
    events.push({
      id: `qt-${doc.id}`,
      category: 'quotation',
      title: `Quotation ${doc.quotationId} — ${doc.status.replace(/_/g, ' ')}`,
      subtitle: `${customerName} · ${formatCrmCurrency(doc.totalAmount)}`,
      timestamp: doc.modifiedAt ?? doc.createdAt,
      severity: doc.status === 'pending_approval' ? 'high' : 'info',
      icon: 'approval',
      href: `/crm/quotations/${doc.quotationId}`,
      quickView: quotationQuickView(doc, customerName, opp?.opportunityName),
    })
  }

  for (const opp of [...input.opportunities]
    .filter((o) => o.stage !== 'won' && o.stage !== 'lost')
    .sort((a, b) => (b.modifiedAt ?? b.createdAt).localeCompare(a.modifiedAt ?? a.createdAt))
    .slice(0, 8)) {
    const customerName = input.resolveCustomerName(opp.customerId)
    events.push({
      id: `opp-${opp.id}`,
      category: 'pipeline',
      title: `${opp.opportunityName} — ${opp.stage.replace(/_/g, ' ')}`,
      subtitle: `${customerName} · ${opp.ownerName}`,
      timestamp: opp.modifiedAt ?? opp.createdAt,
      user: opp.ownerName,
      icon: 'general',
      href: `/crm/opportunities/${opp.id}`,
      documentRef: formatCrmCurrency(opp.value),
      quickView: oppQuickView(opp, customerName),
    })
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 40)
}

export function buildSalesManagementFeed(input: {
  crmFeed: DashboardFeedItem[]
  salesOrders: SalesOrder[]
  invoices: { id: string; invoiceNo: string; customerId: string; gst: { grandTotal: number }; createdAt: string; status: string; dueDate?: string }[]
  dispatches: { id: string; dispatchNo: string; customerId: string; status: string; createdAt: string }[]
  receivables: ReceivableRow[]
  atRiskOrders: { salesOrderId: string; salesOrderNo: string; customerName: string; reason: string; severity: string }[]
  resolveCustomerName: CustomerResolver
}): DashboardFeedItem[] {
  const events: DashboardFeedItem[] = [...input.crmFeed]

  for (const so of [...input.salesOrders]
    .sort((a, b) => (b.orderDate ?? b.createdAt).localeCompare(a.orderDate ?? a.createdAt))
    .slice(0, 12)) {
    const customerName = input.resolveCustomerName(so.customerId)
    events.push({
      id: `so-${so.id}`,
      category: 'order',
      title: `SO ${so.salesOrderNo} — ${so.status.replace(/_/g, ' ')}`,
      subtitle: customerName,
      timestamp: so.orderDate ?? so.createdAt,
      user: so.salesOwnerName ?? undefined,
      icon: 'general',
      href: `/sales/orders/${so.id}`,
      quickView: soQuickView(so, customerName),
    })
  }

  for (const inv of [...input.invoices]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)) {
    const customerName = input.resolveCustomerName(inv.customerId)
    events.push({
      id: `inv-${inv.id}`,
      category: 'billing',
      title: `Invoice ${inv.invoiceNo} — ${inv.status}`,
      subtitle: customerName,
      timestamp: inv.createdAt,
      icon: 'payment',
      href: `/accounting/money-in/invoices/${inv.id}`,
      documentRef: formatCurrency(inv.gst.grandTotal),
      quickView: {
        title: inv.invoiceNo,
        subtitle: customerName,
        badge: inv.status,
        fields: [
          { label: 'Amount', value: formatCurrency(inv.gst.grandTotal) },
          { label: 'Status', value: inv.status },
          ...(inv.dueDate ? [{ label: 'Due date', value: formatDate(inv.dueDate) }] : []),
        ],
        primaryAction: { label: 'Open invoice', href: `/accounting/money-in/invoices/${inv.id}` },
      },
    })
  }

  for (const d of [...input.dispatches]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)) {
    events.push({
      id: `dsp-${d.id}`,
      category: 'order',
      title: `Dispatch ${d.dispatchNo} — ${d.status.replace(/_/g, ' ')}`,
      subtitle: input.resolveCustomerName(d.customerId),
      timestamp: d.createdAt,
      icon: 'dispatch',
      href: `/dispatch/register/${d.id}`,
      quickView: {
        title: d.dispatchNo,
        subtitle: input.resolveCustomerName(d.customerId),
        badge: d.status.replace(/_/g, ' '),
        fields: [{ label: 'Status', value: d.status.replace(/_/g, ' ') }],
        primaryAction: { label: 'Open dispatch', href: `/dispatch/register/${d.id}` },
      },
    })
  }

  for (const r of input.receivables.filter((row) => row.paymentStatus === 'overdue').slice(0, 6)) {
    events.push({
      id: `ar-${r.invoiceId}`,
      category: 'alert',
      title: `Overdue receivable — ${r.invoiceNo}`,
      subtitle: `${r.customerName} · ${formatCurrency(r.balanceDue)}`,
      timestamp: r.dueDate,
      severity: 'critical',
      icon: 'payment',
      href: `/accounting/money-in/invoices/${r.invoiceId}`,
      quickView: {
        title: r.invoiceNo,
        subtitle: r.customerName,
        badge: 'Overdue',
        badgeTone: 'critical',
        fields: [
          { label: 'Balance due', value: formatCurrency(r.balanceDue) },
          { label: 'Due date', value: formatDate(r.dueDate) },
          { label: 'Days overdue', value: `${r.daysOverdue}d` },
        ],
        primaryAction: { label: 'Open invoice', href: `/accounting/money-in/invoices/${r.invoiceId}` },
      },
    })
  }

  for (const risk of input.atRiskOrders.slice(0, 6)) {
    events.push({
      id: `risk-${risk.salesOrderId}`,
      category: 'alert',
      title: `At risk — ${risk.salesOrderNo}`,
      subtitle: risk.reason,
      timestamp: new Date().toISOString(),
      severity: risk.severity === 'critical' ? 'critical' : 'high',
      icon: 'qc',
      href: `/sales/orders/${risk.salesOrderId}`,
      quickView: {
        title: risk.salesOrderNo,
        subtitle: risk.customerName,
        badge: 'At risk',
        badgeTone: 'critical',
        fields: [{ label: 'Reason', value: risk.reason }],
        primaryAction: { label: 'Open order', href: `/sales/orders/${risk.salesOrderId}` },
      },
    })
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 50)
}

export function feedItemToLiveActivity(item: DashboardFeedItem) {
  return {
    id: item.id,
    icon: item.icon,
    action: item.title,
    user: item.user,
    timestamp: item.timestamp,
    href: item.href,
    documentRef: item.subtitle ?? item.documentRef,
    quickView: item.quickView,
  }
}

export function feedItemToLiveAlert(item: DashboardFeedItem) {
  return {
    id: item.id,
    severity: (item.severity === 'info' ? 'medium' : item.severity ?? 'medium') as 'critical' | 'high' | 'medium' | 'low',
    category: 'general' as const,
    message: item.title,
    documentRef: item.subtitle,
    href: item.href,
    actionLabel: 'View details',
    quickView: item.quickView,
  }
}
