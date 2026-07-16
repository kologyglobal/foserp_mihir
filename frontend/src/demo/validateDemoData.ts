import { useMasterStore } from '../store/masterStore'
import { useCrmStore } from '../store/crmStore'
import { useBomStore } from '../store/bomStore'
import { useRoutingStore } from '../store/routingStore'
import { useMrpStore } from '../store/mrpStore'
import { useSalesStore } from '../store/salesStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useEcoStore } from '../store/ecoStore'
import { useQrStore } from '../store/qrStore'
import { useSerialStore } from '../store/serialStore'
import { useDmsStore } from '../store/dmsStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useApprovalStore } from '../store/approvalStore'
import { useBarcodeStore } from '../store/barcodeStore'
import { useWorkCenterStore } from '../store/workCenterStore'
import { getErpExecutiveAnalytics, validateAnalyticsConsistency } from '../services/erpAnalyticsService'
import { getExecutiveDashboardData, getProductionControlTowerData, getUnifiedInboxData } from '../utils/controlTowerMetrics'
import { buildNotifications } from '../utils/workspaceMetrics'
import { SATURATION_TARGETS } from './seeds/demoSeedCatalog'

export interface DemoDataValidationReport {
  ok: boolean
  counts: Record<string, number>
  orphans: string[]
  kpiMismatches: string[]
  belowTarget: string[]
}

export function validateDemoDataCounts(): DemoDataValidationReport {
  const master = useMasterStore.getState()
  const bom = useBomStore.getState()
  const routing = useRoutingStore.getState()
  const mrp = useMrpStore.getState()
  const sales = useSalesStore.getState()
  const wo = useWorkOrderStore.getState()
  const purchase = usePurchaseStore.getState()
  const quality = useQualityStore.getState()
  const dispatch = useDispatchStore.getState()
  const invoice = useInvoiceStore.getState()
  const eco = useEcoStore.getState()
  const qr = useQrStore.getState()
  const serial = useSerialStore.getState()
  const dms = useDmsStore.getState()
  const inv = useInventoryStore.getState()
  const approval = useApprovalStore.getState()
  const barcode = useBarcodeStore.getState()

  const payments = invoice.invoices.reduce((n, i) => n + i.payments.length, 0)
  const counts: Record<string, number> = {
    customers: master.customers.length,
    customerContacts: master.customerContacts.length,
    vendors: master.vendors.length,
    items: master.items.length,
    products: master.products.length,
    boms: bom.bomHeaders.length,
    routings: routing.routingHeaders.length,
    workCenters: useWorkCenterStore.getState().workCenters.length,
    leads: sales.leads.length,
    inquiries: sales.inquiries.length,
    opportunities: useCrmStore.getState().opportunities.length,
    quotations: sales.quotations.length,
    salesOrders: mrp.salesOrders.length,
    mrpRuns: mrp.runs.length,
    purchaseRequisitions: purchase.requisitions.length,
    rfqs: purchase.rfqs.length,
    purchaseOrders: purchase.purchaseOrders.length,
    grns: purchase.grns.length,
    inventoryMovements: inv.stockMovements.length,
    workOrders: wo.workOrders.length,
    jobCards: wo.jobCards.length,
    jobWorkOrders: wo.workOrders.filter((w) => w.woType === 'subcontract').length,
    qcInspections: quality.inspections.length,
    ncrs: quality.ncrs.length,
    reworks: quality.reworks.length,
    dispatches: dispatch.dispatches.length,
    invoices: invoice.invoices.length,
    payments,
    ecrs: eco.ecrs.length,
    ecos: eco.ecos.length,
    approvalRequests: approval.requests.length,
    qrCodes: qr.records.length,
    barcodes: barcode.barcodes.length,
    serialNumbers: serial.serials.length,
    documents: dms.documents.length,
    notifications: buildNotifications().length,
    activities: wo.activities.length,
  }

  const orphans: string[] = []
  if (mrp.salesOrders.some((s) => !master.customers.some((c) => c.id === s.customerId) || !master.products.some((p) => p.id === s.productId))) {
    orphans.push('sales_order')
  }
  if (wo.workOrders.some((w) => !mrp.getSalesOrder(w.salesOrderId) || !master.getProduct(w.productId))) {
    orphans.push('work_order')
  }
  if (purchase.purchaseOrders.some((p) => !master.vendors.some((v) => v.id === p.vendorId))) {
    orphans.push('purchase_order')
  }
  if (purchase.grns.some((g) => !purchase.purchaseOrders.some((p) => p.id === g.poId))) {
    orphans.push('grn')
  }
  if (invoice.invoices.some((i) => !dispatch.dispatches.some((d) => d.id === i.dispatchId))) {
    orphans.push('invoice')
  }
  if (qr.records.some((r) => r.entityType === 'FINISHED_TRAILER' && r.metadata.customerId && !master.customers.some((c) => c.id === r.metadata.customerId))) {
    orphans.push('qr')
  }
  if (serial.serials.some((s) => s.customerId && !master.customers.some((c) => c.id === s.customerId))) {
    orphans.push('serial')
  }
  if (dms.documents.some((d) => d.entityLinks.some((l) => l.entityType === 'customer' && l.entityId && !master.customers.some((c) => c.id === l.entityId)))) {
    orphans.push('document')
  }

  const exec = getExecutiveDashboardData()
  const prod = getProductionControlTowerData()
  const analytics = getErpExecutiveAnalytics()
  const consistency = validateAnalyticsConsistency()
  const kpiMismatches: string[] = [...consistency.mismatches]

  if (exec.orderBookCount !== analytics.orderBookCount) {
    kpiMismatches.push(`orderBookCount ${exec.orderBookCount} vs ${analytics.orderBookCount}`)
  }
  if (Math.round(exec.orderBookValue) !== Math.round(analytics.orderBookValue)) {
    kpiMismatches.push(`orderBookValue ${exec.orderBookValue} vs ${analytics.orderBookValue}`)
  }
  if (prod.running !== analytics.runningWorkOrders) {
    kpiMismatches.push(`runningWO ${prod.running} vs ${analytics.runningWorkOrders}`)
  }
  const qcMetrics = quality.getMetrics()
  if (qcMetrics.pendingInspections !== analytics.qcPending) {
    kpiMismatches.push(`qcPending ${qcMetrics.pendingInspections} vs ${analytics.qcPending}`)
  }
  const readyDispatches = dispatch.dispatches.filter((d) => ['ready', 'planned', 'loading'].includes(d.status))
  if (readyDispatches.length !== analytics.dispatchReadyCount) {
    kpiMismatches.push(`dispatchReady ${readyDispatches.length} vs ${analytics.dispatchReadyCount}`)
  }
  if (Math.round(exec.invoiceValue) !== Math.round(analytics.invoicedYtd)) {
    kpiMismatches.push(`invoicedYtd ${exec.invoiceValue} vs ${analytics.invoicedYtd}`)
  }
  if (Math.round(exec.outstanding) !== Math.round(analytics.outstandingAr)) {
    kpiMismatches.push(`outstandingAr ${exec.outstanding} vs ${analytics.outstandingAr}`)
  }
  if (exec.openNcr !== analytics.openNcr) {
    kpiMismatches.push(`openNcr ${exec.openNcr} vs ${analytics.openNcr}`)
  }
  const pendingApprovals = getUnifiedInboxData().counts.approvals
  if (pendingApprovals !== analytics.pendingApprovals) {
    kpiMismatches.push(`pendingApprovals ${pendingApprovals} vs ${analytics.pendingApprovals}`)
  }

  const belowTarget: string[] = []
  const checks: [keyof typeof SATURATION_TARGETS, string][] = [
    ['customers', 'customers'],
    ['vendors', 'vendors'],
    ['items', 'items'],
    ['products', 'products'],
    ['boms', 'boms'],
    ['routings', 'routings'],
    ['leads', 'leads'],
    ['opportunities', 'opportunities'],
    ['quotations', 'quotations'],
    ['salesOrders', 'salesOrders'],
    ['purchaseRequisitions', 'purchaseRequisitions'],
    ['purchaseOrders', 'purchaseOrders'],
    ['grns', 'grns'],
    ['workOrders', 'workOrders'],
    ['jobCards', 'jobCards'],
    ['jobWorkOrders', 'jobWorkOrders'],
    ['qcInspections', 'qcInspections'],
    ['dispatches', 'dispatches'],
    ['invoices', 'invoices'],
    ['payments', 'payments'],
    ['ecrs', 'ecrs'],
    ['ecos', 'ecos'],
    ['qrCodes', 'qrCodes'],
    ['serialNumbers', 'serialNumbers'],
    ['documents', 'documents'],
  ]
  for (const [targetKey, countKey] of checks) {
    const target = SATURATION_TARGETS[targetKey]
    if ((counts[countKey] ?? 0) < target) belowTarget.push(`${countKey}: ${counts[countKey]} < ${target}`)
  }

  return {
    ok: orphans.length === 0 && kpiMismatches.length === 0 && belowTarget.length === 0,
    counts,
    orphans,
    kpiMismatches,
    belowTarget,
  }
}
