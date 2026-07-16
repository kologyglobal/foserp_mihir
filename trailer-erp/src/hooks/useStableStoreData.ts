import { useMemo } from 'react'
import { useSalesStore } from '../store/salesStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useBomStore } from '../store/bomStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useMasterStore } from '../store/masterStore'
import { useDmsStore } from '../store/dmsStore'
import { useBarcodeStore } from '../store/barcodeStore'
import { useCrmStore } from '../store/crmStore'
import { useCrmMasterStore } from '../store/crmMasterStore'
import { useMrpStore } from '../store/mrpStore'
import { useApprovalStore } from '../store/approvalStore'
import { useMobileGateStore } from '../store/mobileGateStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useSerialStore } from '../store/serialStore'
import type { CommercialTerm } from '../types/master'
import { listCommercialTermsFromCrm } from '../utils/commercialTermsAdapter'
import { normalizeLead } from '../utils/leadUtils'

/** Single lead by id — subscribe to `leads` slice; never call getLead() inside a Zustand selector. */
export function useLead(leadId: string | undefined) {
  const leads = useSalesStore((s) => s.leads)
  return useMemo(() => {
    if (!leadId) return undefined
    const raw = leads.find((l) => l.id === leadId)
    return raw ? normalizeLead(raw) : undefined
  }, [leads, leadId])
}

/** Non-converted leads for inquiry conversion. */
export function useOpenLeads() {
  const leads = useSalesStore((s) => s.leads)
  return useMemo(
    () => leads.filter((l) => {
      const n = normalizeLead(l)
      return n.stage !== 'converted_to_opportunity' && n.stage !== 'closed'
        && n.lifecycleStatus !== 'converted' && n.lifecycleStatus !== 'closed'
    }),
    [leads],
  )
}

export function usePendingCustomerApprovals() {
  const quotations = useSalesStore((s) => s.quotations)
  return useMemo(
    () => useSalesStore.getState().getPendingCustomerApprovals(),
    [quotations],
  )
}

export function useQualityMetrics() {
  const inspections = useQualityStore((s) => s.inspections)
  const reworks = useQualityStore((s) => s.reworks)
  const ncrs = useQualityStore((s) => s.ncrs)
  return useMemo(() => useQualityStore.getState().getMetrics(), [inspections, reworks, ncrs])
}

export function usePendingInspections() {
  const inspections = useQualityStore((s) => s.inspections)
  return useMemo(() => useQualityStore.getState().getPendingInspections(), [inspections])
}

export function useOpenReworks() {
  const reworks = useQualityStore((s) => s.reworks)
  return useMemo(() => useQualityStore.getState().getOpenReworks(), [reworks])
}

export function useOpenNcrs() {
  const ncrs = useQualityStore((s) => s.ncrs)
  return useMemo(() => useQualityStore.getState().getOpenNcrs(), [ncrs])
}

export function useWorkOrderReworks(workOrderId: string | undefined) {
  const reworks = useQualityStore((s) => s.reworks)
  return useMemo(
    () => (workOrderId ? reworks.filter((r) => r.workOrderId === workOrderId) : []),
    [reworks, workOrderId],
  )
}

export function useWorkOrderInspections(workOrderId: string | undefined) {
  const inspections = useQualityStore((s) => s.inspections)
  return useMemo(
    () => (workOrderId ? inspections.filter((i) => i.workOrderId === workOrderId) : []),
    [inspections, workOrderId],
  )
}

export function useProductBomHeaders(productId: string | undefined) {
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  return useMemo(
    () => (productId ? bomHeaders.filter((b) => b.productId === productId) : []),
    [bomHeaders, productId],
  )
}

export function usePurchaseReports() {
  const requisitions = usePurchaseStore((s) => s.requisitions)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  return useMemo(() => {
    const store = usePurchaseStore.getState()
    return {
      pending: store.getPendingPrReport(),
      openPo: store.getOpenPoReport(),
      delayed: store.getDelayedPoReport(),
      expected: store.getMaterialExpectedThisWeek(),
    }
  }, [requisitions, purchaseOrders])
}

export function useDispatchReports() {
  const dispatches = useDispatchStore((s) => s.dispatches)
  return useMemo(() => {
    const store = useDispatchStore.getState()
    return {
      ready: store.getDispatchReadyReport(),
      pending: store.getPendingDispatchReport(),
      month: store.getDispatchedThisMonthReport(),
      podPending: store.getPodPendingReport(),
    }
  }, [dispatches])
}

export function useQualityProductionReports() {
  const inspections = useQualityStore((s) => s.inspections)
  const reworks = useQualityStore((s) => s.reworks)
  const ncrs = useQualityStore((s) => s.ncrs)
  return useMemo(() => {
    const store = useQualityStore.getState()
    return {
      pending: store.getPendingInspectionReport(),
      rejections: store.getRejectionReport(),
      ageing: store.getNcrAgeingReport(),
      vendorRating: store.getVendorQualityRating(),
      metrics: store.getMetrics(),
    }
  }, [inspections, reworks, ncrs])
}

export function useIncomingPendingInspections() {
  const inspections = useQualityStore((s) => s.inspections)
  return useMemo(
    () => inspections.filter((i) => i.category === 'incoming' && i.status === 'pending'),
    [inspections],
  )
}

/** Posted invoice receivables — never call getReceivables() inside a Zustand selector. */
export function useReceivables() {
  const invoices = useInvoiceStore((s) => s.invoices)
  return useMemo(() => useInvoiceStore.getState().getReceivables(), [invoices])
}

/** CRM contacts for a customer (operational register). */
export function useCrmContactsForCustomer(customerId: string | undefined) {
  const contacts = useCrmStore((s) => s.contacts)
  return useMemo(
    () => (customerId ? contacts.filter((c) => c.customerId === customerId && (c.isActive ?? true)) : []),
    [contacts, customerId],
  )
}

/** Master contacts for a customer. */
export function useCustomerContacts(customerId: string | undefined) {
  const customerContacts = useMasterStore((s) => s.customerContacts)
  return useMemo(
    () => (customerId ? customerContacts.filter((c) => c.customerId === customerId && c.isActive) : []),
    [customerContacts, customerId],
  )
}

/** Commercial terms by type — sourced from CRM payment/delivery masters (not masterStore). */
export function useCommercialTermsByType(termType: CommercialTerm['termType']) {
  const entries = useCrmMasterStore((s) => s.entries)
  return useMemo(() => listCommercialTermsFromCrm(termType, true), [entries, termType])
}

/** DMS approval queue snapshot. */
export function useDmsApprovalQueue() {
  const documents = useDmsStore((s) => s.documents)
  return useMemo(() => useDmsStore.getState().getApprovalQueue(), [documents])
}

/** Barcode scan history. */
export function useBarcodeHistory() {
  const history = useBarcodeStore((s) => s.history)
  return useMemo(() => useBarcodeStore.getState().getAllHistory(), [history])
}

/** Open CRM opportunities. */
export function useOpenOpportunities() {
  const opportunities = useCrmStore((s) => s.opportunities)
  return useMemo(() => opportunities.filter((o) => o.status === 'open'), [opportunities])
}

/** MRP dashboard summary derived from runs + sales orders. */
export function useMrpDashboardSummary() {
  const runs = useMrpStore((s) => s.runs)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  return useMemo(() => useMrpStore.getState().getDashboardSummary(), [runs, salesOrders])
}

/** Approval requests count for an entity — primitive selector (safe). */
export function useApprovalRequestCount(documentType: string, entityId: string) {
  const requests = useApprovalStore((s) => s.requests)
  return useMemo(
    () => requests.filter((r) => r.documentType === documentType && r.entityId === entityId).length,
    [requests, documentType, entityId],
  )
}

export function useInsideGateVehicles() {
  const entries = useMobileGateStore((s) => s.entries)
  return useMemo(
    () => entries.filter((e) => e.direction === 'inward' && e.status === 'inside'),
    [entries],
  )
}

export function useLoadingPlannedDispatches() {
  const dispatches = useDispatchStore((s) => s.dispatches)
  return useMemo(
    () => dispatches.filter((d) => ['loading', 'planned'].includes(d.status)),
    [dispatches],
  )
}

export function useOpenJobCards() {
  const jobCards = useWorkOrderStore((s) => s.jobCards)
  return useMemo(() => jobCards.filter((j) => j.status !== 'completed'), [jobCards])
}

export function useSubcontractWorkOrders() {
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  return useMemo(() => workOrders.filter((w) => w.woType === 'subcontract'), [workOrders])
}

export function useSubcontractShipmentsForWorkOrder(workOrderId: string | undefined) {
  const shipments = useWorkOrderStore((s) => s.subcontractShipments)
  return useMemo(
    () => (workOrderId ? shipments.filter((sh) => sh.workOrderId === workOrderId && sh.status !== 'received') : []),
    [shipments, workOrderId],
  )
}

/** Approval queue preview — never call listRequests().slice() inside a Zustand selector. */
export function useApprovalRequestsPreview(limit = 50) {
  const requests = useApprovalStore((s) => s.requests)
  return useMemo(
    () => useApprovalStore.getState().listRequests().slice(0, limit),
    [requests, limit],
  )
}

/** Serial register list — never call listSerials() inside a Zustand selector. */
export function useSerialList(filters?: Parameters<ReturnType<typeof useSerialStore.getState>['listSerials']>[0]) {
  const serials = useSerialStore((s) => s.serials)
  return useMemo(() => useSerialStore.getState().listSerials(filters), [serials, filters])
}

export function useQuotationDocument(documentId: string | undefined) {
  const documents = useCrmStore((s) => s.quotationDocuments)
  return useMemo(
    () => (documentId ? documents.find((d) => d.id === documentId) : undefined),
    [documents, documentId],
  )
}

export function useQuotationTemplate(templateId: string | undefined) {
  const templates = useCrmStore((s) => s.quotationTemplates)
  return useMemo(
    () => (templateId ? templates.find((t) => t.id === templateId) : undefined),
    [templates, templateId],
  )
}

export function useCrmOpportunity(opportunityId: string | undefined) {
  const opportunities = useCrmStore((s) => s.opportunities)
  return useMemo(
    () => (opportunityId ? opportunities.find((o) => o.id === opportunityId) : undefined),
    [opportunities, opportunityId],
  )
}

export function useApprovalRequest(requestId: string | undefined) {
  const requests = useApprovalStore((s) => s.requests)
  return useMemo(
    () => (requestId ? requests.find((r) => r.id === requestId) : undefined),
    [requests, requestId],
  )
}
