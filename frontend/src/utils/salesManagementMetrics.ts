import type { LiveActivityEvent } from '../components/live-erp/types'
import type { Opportunity, QuotationDocument } from '../types/crm'
import type { Lead, Quotation } from '../types/sales'
import type { SalesOrder } from '../types/mrp'
import type { ReceivableRow } from '../types/invoice'
import type { ProformaInvoice } from '../types/proformaInvoice'
import { buildCrmDashboardMetrics, formatCrmCurrency } from './crmMetrics'
import { sumActiveOrderBook, buildSalesAtRiskOrders, buildPendingMrpOrders } from './salesDashboardMetrics'
import type { WorkOrder } from '../types/workorder'
import type { QcInspection } from '../types/quality'

export type SalesDashboardView = 'overview' | 'pipeline' | 'execution' | 'billing'

export const SALES_VIEW_LABELS: Record<SalesDashboardView, string> = {
  overview: 'Overview',
  pipeline: 'Pipeline',
  execution: 'Execution',
  billing: 'Billing',
}

export interface SalesManagementMetrics {
  pipelineValue: number
  weightedForecast: number
  openOpportunities: number
  activeLeads: number
  quotationsPending: number
  approvedQuotesNotConverted: number
  wonDealsWithoutSo: number
  conversionRate: number
  orderBookValue: number
  openOrders: number
  confirmedOrders: number
  ordersInProduction: number
  dispatchReady: number
  invoicedOrders: number
  closedOrders: number
  atRiskCount: number
  pendingMrpCount: number
  qcHoldCount: number
  onTimeDeliveryPct: number
  totalInvoiced: number
  totalReceivable: number
  totalCollected: number
  overdueReceivables: number
  unpaidReceivables: number
  collectionRate: number
  proformaDraft: number
  proformaIssued: number
  proformaExpired: number
  topCustomers: { customerId: string; customerName: string; value: number; orderCount: number }[]
  topOwners: { ownerName: string; value: number; orderCount: number }[]
  commercialFunnel: { stage: string; shortLabel: string; count: number; value: number }[]
  wonWithoutSo: Opportunity[]
  pendingApprovalDocs: QuotationDocument[]
  topReceivables: ReceivableRow[]
}

function orderValue(so: SalesOrder): number {
  return so.grandTotal ?? (so.unitPrice != null ? so.unitPrice * so.qty : 0)
}

export function buildSalesManagementMetrics(input: {
  salesOrders: SalesOrder[]
  workOrders: WorkOrder[]
  inspections: QcInspection[]
  opportunities: Opportunity[]
  followUps: import('../types/crm').FollowUp[]
  activities: import('../types/crm').CrmActivity[]
  quotationDocuments: QuotationDocument[]
  leads: Lead[]
  quotations: Quotation[]
  invoiceMetrics: {
    totalInvoiced: number
    totalReceivable: number
    totalCollected: number
    overdueCount: number
    unpaidCount: number
  }
  receivables: ReceivableRow[]
  proformas: ProformaInvoice[]
  resolveCustomerName: (id: string) => string
}): SalesManagementMetrics {
  const {
    salesOrders,
    workOrders,
    inspections,
    opportunities,
    followUps,
    activities,
    quotationDocuments,
    leads,
    quotations,
    invoiceMetrics,
    receivables,
    proformas,
    resolveCustomerName,
  } = input

  const crm = buildCrmDashboardMetrics({
    opportunities,
    followUps,
    activities,
    quotationDocuments,
    leads,
  })

  const activeStatuses = new Set<SalesOrder['status']>([
    'open',
    'confirmed',
    'in_production',
    'ready_dispatch',
    'dispatched',
  ])

  const openOrders = salesOrders.filter((so) => activeStatuses.has(so.status))
  const orderBookValue = sumActiveOrderBook(salesOrders)
  const atRisk = buildSalesAtRiskOrders(salesOrders, workOrders, inspections)
  const pendingMrp = buildPendingMrpOrders(salesOrders, workOrders)

  const deliveredOnTime = salesOrders.filter(
    (so) => ['dispatched', 'invoiced', 'closed'].includes(so.status) && so.requiredDate,
  )
  const onTime = deliveredOnTime.filter((so) => {
    const finish = so.orderDate ?? so.createdAt
    return finish.slice(0, 10) <= so.requiredDate.slice(0, 10)
  })
  const onTimeDeliveryPct =
    deliveredOnTime.length > 0 ? Math.round((onTime.length / deliveredOnTime.length) * 100) : 100

  const customerMap = new Map<string, { value: number; count: number }>()
  for (const so of openOrders) {
    const cur = customerMap.get(so.customerId) ?? { value: 0, count: 0 }
    cur.value += orderValue(so)
    cur.count += 1
    customerMap.set(so.customerId, cur)
  }
  const topCustomers = [...customerMap.entries()]
    .map(([customerId, data]) => ({
      customerId,
      customerName: resolveCustomerName(customerId),
      value: data.value,
      orderCount: data.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const ownerMap = new Map<string, { value: number; count: number }>()
  for (const so of openOrders) {
    const owner = so.salesOwnerName?.trim() || 'Unassigned'
    const cur = ownerMap.get(owner) ?? { value: 0, count: 0 }
    cur.value += orderValue(so)
    cur.count += 1
    ownerMap.set(owner, cur)
  }
  const topOwners = [...ownerMap.entries()]
    .map(([ownerName, data]) => ({
      ownerName,
      value: data.value,
      orderCount: data.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  const openLeads = leads.filter((l) => l.lifecycleStatus === 'open' || l.lifecycleStatus === 'qualified').length
  const pendingQuotes =
    quotations.filter((q) => q.status === 'pending_approval' || q.status === 'submitted').length +
    quotationDocuments.filter((d) => d.status === 'pending_approval').length

  const wonWithoutSo = opportunities.filter((o) => o.status === 'won' && !o.salesOrderId)

  const leadValue = leads
    .filter((l) => l.lifecycleStatus === 'open' || l.lifecycleStatus === 'qualified')
    .reduce((s, l) => s + (l.expectedValue ?? 0), 0)
  const quoteValue = quotations
    .filter((q) => q.isLatestRevision && !['rejected', 'cancelled', 'superseded'].includes(q.status))
    .reduce((s, q) => s + (q.pricing?.grandTotal ?? 0), 0)

  const commercialFunnel = [
    { stage: 'Active Leads', shortLabel: 'Leads', count: openLeads, value: leadValue },
    { stage: 'Open Opportunities', shortLabel: 'Opportunities', count: crm.openOpportunities, value: crm.pipelineValue },
    { stage: 'Active Quotations', shortLabel: 'Quotations', count: quotations.filter((q) => q.isLatestRevision && q.status !== 'converted').length, value: quoteValue },
    { stage: 'Order Book', shortLabel: 'Sales Orders', count: openOrders.length, value: orderBookValue },
    { stage: 'Invoiced YTD', shortLabel: 'Invoiced', count: salesOrders.filter((so) => so.status === 'invoiced' || so.status === 'closed').length, value: invoiceMetrics.totalInvoiced },
  ]

  const collectionRate =
    invoiceMetrics.totalInvoiced > 0
      ? Math.round((invoiceMetrics.totalCollected / invoiceMetrics.totalInvoiced) * 100)
      : 0

  return {
    pipelineValue: crm.pipelineValue,
    weightedForecast: crm.weightedForecast,
    openOpportunities: crm.openOpportunities,
    activeLeads: openLeads,
    quotationsPending: pendingQuotes,
    approvedQuotesNotConverted: crm.approvedQuotationsNotConverted,
    wonDealsWithoutSo: wonWithoutSo.length,
    conversionRate: crm.conversionRate,
    orderBookValue,
    openOrders: openOrders.length,
    confirmedOrders: salesOrders.filter((so) => so.status === 'confirmed').length,
    ordersInProduction: salesOrders.filter((so) => so.status === 'in_production').length,
    dispatchReady: salesOrders.filter((so) => so.status === 'ready_dispatch').length,
    invoicedOrders: salesOrders.filter((so) => so.status === 'invoiced').length,
    closedOrders: salesOrders.filter((so) => so.status === 'closed').length,
    atRiskCount: atRisk.length,
    pendingMrpCount: pendingMrp.length,
    qcHoldCount: salesOrders.filter((so) =>
      atRisk.some((r) => r.id === so.id && r.riskReason.includes('QC')),
    ).length,
    onTimeDeliveryPct,
    totalInvoiced: invoiceMetrics.totalInvoiced,
    totalReceivable: invoiceMetrics.totalReceivable,
    totalCollected: invoiceMetrics.totalCollected,
    overdueReceivables: invoiceMetrics.overdueCount,
    unpaidReceivables: invoiceMetrics.unpaidCount,
    collectionRate,
    proformaDraft: proformas.filter((p) => p.status === 'draft').length,
    proformaIssued: proformas.filter((p) => p.status === 'issued').length,
    proformaExpired: proformas.filter(
      (p) => p.status === 'issued' && p.validUntil.slice(0, 10) < new Date().toISOString().slice(0, 10),
    ).length,
    topCustomers,
    topOwners,
    commercialFunnel,
    wonWithoutSo: wonWithoutSo.slice(0, 6),
    pendingApprovalDocs: quotationDocuments.filter((d) => d.status === 'pending_approval').slice(0, 6),
    topReceivables: receivables.slice(0, 6),
  }
}

export function buildSalesCommercialActivity(input: {
  salesOrders: SalesOrder[]
  invoices: { id: string; invoiceNo: string; customerId: string; gst: { grandTotal: number }; createdAt: string; status: string }[]
  dispatches: { id: string; dispatchNo: string; customerId: string; status: string; createdAt: string }[]
  resolveCustomerName: (id: string) => string
}): LiveActivityEvent[] {
  const events: LiveActivityEvent[] = []

  for (const so of [...input.salesOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)) {
    events.push({
      id: `so-${so.id}`,
      icon: 'general',
      action: `Sales order ${so.salesOrderNo} — ${so.status.replace(/_/g, ' ')}`,
      user: so.salesOwnerName ?? undefined,
      timestamp: so.orderDate ?? so.createdAt,
      href: `/sales/orders/${so.id}`,
      documentRef: input.resolveCustomerName(so.customerId),
    })
  }

  for (const inv of [...input.invoices]
    .filter((i) => i.status === 'posted')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)) {
    events.push({
      id: `inv-${inv.id}`,
      icon: 'payment',
      action: `Invoice ${inv.invoiceNo} posted`,
      timestamp: inv.createdAt,
      href: `/accounting/money-in/invoices/${inv.id}`,
      documentRef: formatCrmCurrency(inv.gst.grandTotal),
    })
  }

  for (const d of [...input.dispatches]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)) {
    events.push({
      id: `dsp-${d.id}`,
      icon: 'dispatch',
      action: `Dispatch ${d.dispatchNo} — ${d.status.replace(/_/g, ' ')}`,
      timestamp: d.createdAt,
      href: `/dispatch/register/${d.id}`,
    })
  }

  return events
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8)
}

export function buildCustomerOrderBookChartData(
  topCustomers: SalesManagementMetrics['topCustomers'],
) {
  return topCustomers.map((c) => ({
    label: c.customerName.length > 18 ? `${c.customerName.slice(0, 16)}…` : c.customerName,
    fullLabel: c.customerName,
    value: c.value,
    count: c.orderCount,
  }))
}

export function buildOwnerOrderBookChartData(topOwners: SalesManagementMetrics['topOwners']) {
  return topOwners.map((o) => ({
    label: o.ownerName.length > 14 ? `${o.ownerName.slice(0, 12)}…` : o.ownerName,
    fullLabel: o.ownerName,
    value: o.value,
    count: o.orderCount,
  }))
}

export function buildMonthlyBookingTrend(salesOrders: SalesOrder[]) {
  const buckets = new Map<string, { booked: number; invoiced: number }>()
  for (const so of salesOrders) {
    const month = (so.orderDate ?? so.createdAt).slice(0, 7)
    const label = new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const cur = buckets.get(label) ?? { booked: 0, invoiced: 0 }
    cur.booked += orderValue(so)
    if (['invoiced', 'closed'].includes(so.status)) cur.invoiced += orderValue(so)
    buckets.set(label, cur)
  }
  return [...buckets.entries()]
    .map(([label, data]) => ({ label, ...data }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-8)
}

export { formatCrmCurrency as formatSalesCurrency }
