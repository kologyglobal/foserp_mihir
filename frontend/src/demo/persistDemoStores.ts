import { ERP_STORAGE_KEYS, writePersistedJson } from '../store/persistConfig'
import { useMasterStore } from '../store/masterStore'
import { useBomStore } from '../store/bomStore'
import { useRoutingStore } from '../store/routingStore'
import { useWorkCenterStore } from '../store/workCenterStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useMrpStore } from '../store/mrpStore'
import { useSalesStore } from '../store/salesStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useCostingStore } from '../store/costingStore'
import { useFreezeStore } from '../store/freezeStore'
import { useDmsStore } from '../store/dmsStore'
import { useApprovalStore } from '../store/approvalStore'
import { useQrStore } from '../store/qrStore'
import { useSerialStore } from '../store/serialStore'
import { useEcoStore } from '../store/ecoStore'
import { useBarcodeStore } from '../store/barcodeStore'

/** Write all store slices to localStorage after demo load. */
export function persistAllDemoStores(): void {
  const m = useMasterStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.masters, {
    uoms: m.uoms,
    categories: m.categories,
    items: m.items,
    customers: m.customers,
    vendors: m.vendors,
    itemVendorMaps: m.itemVendorMaps,
    warehouses: m.warehouses,
    products: m.products,
  })
  const b = useBomStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.bom, { bomHeaders: b.bomHeaders, bomLines: b.bomLines })
  const r = useRoutingStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.routing, { routingHeaders: r.routingHeaders, routingOperations: r.routingOperations })
  const wc = useWorkCenterStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.workCenters, { workCenters: wc.workCenters })
  const inv = useInventoryStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.inventory, { stockMovements: inv.stockMovements, reservations: inv.reservations })
  const mrp = useMrpStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.mrp, { salesOrders: mrp.salesOrders, runs: mrp.runs })
  const sales = useSalesStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.sales, { leads: sales.leads, inquiries: sales.inquiries, quotations: sales.quotations })
  const wo = useWorkOrderStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.workOrders, {
    config: wo.config,
    workOrders: wo.workOrders,
    materialLines: wo.materialLines,
    productionOperations: wo.productionOperations,
    jobCards: wo.jobCards,
    subcontractShipments: wo.subcontractShipments,
    fgReceipts: wo.fgReceipts,
    saReceipts: wo.saReceipts,
    activities: wo.activities,
  })
  const p = usePurchaseStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.purchase, {
    requisitions: p.requisitions,
    rfqs: p.rfqs,
    purchaseOrders: p.purchaseOrders,
    grns: p.grns,
  })
  const q = useQualityStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.quality, {
    inspections: q.inspections,
    reworks: q.reworks,
    ncrs: q.ncrs,
    qcParameters: q.qcParameters,
    dynamicInspectionPlans: q.dynamicInspectionPlans,
  })
  writePersistedJson(ERP_STORAGE_KEYS.dispatch, { dispatches: useDispatchStore.getState().dispatches })
  writePersistedJson(ERP_STORAGE_KEYS.invoice, { invoices: useInvoiceStore.getState().invoices })
  writePersistedJson(ERP_STORAGE_KEYS.costing, { overheadPct: useCostingStore.getState().overheadPct })
  writePersistedJson(ERP_STORAGE_KEYS.freeze, { freezes: useFreezeStore.getState().freezes })
  writePersistedJson(ERP_STORAGE_KEYS.dms, {
    documents: useDmsStore.getState().documents,
    timeline: useDmsStore.getState().timeline,
  })
  const a = useApprovalStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.approval, { rules: a.rules, approvers: a.approvers, requests: a.requests })
  const qr = useQrStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.qr, { records: qr.records, history: qr.history, edges: qr.edges })
  writePersistedJson(ERP_STORAGE_KEYS.serial, { serials: useSerialStore.getState().serials })
  const eco = useEcoStore.getState()
  writePersistedJson(ERP_STORAGE_KEYS.eco, { ecrs: eco.ecrs, ecos: eco.ecos })
  writePersistedJson(ERP_STORAGE_KEYS.barcode, {
    barcodes: useBarcodeStore.getState().barcodes,
    history: useBarcodeStore.getState().history,
  })
}
