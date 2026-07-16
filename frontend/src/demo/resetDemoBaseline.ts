import { seedSalesOrders } from '../data/mrp/seed'
import { seedStockMovements, seedReservations } from '../data/inventory/seed'
import { seedDmsDocuments } from '../data/dms/seedDocuments'
import { DEFAULT_APPROVAL_RULES, DEFAULT_APPROVER_DEFINITIONS } from '../data/approval/seedApprovalMatrix'
import { mergeBomWithSeed, mergeMastersWithSeed, mergeRoutingWithSeed, mergeWorkCentersWithSeed } from '../utils/persistMigration'
import { useInventoryStore } from '../store/inventoryStore'
import { useMrpStore } from '../store/mrpStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useQualityStore } from '../store/qualityStore'
import { useMasterStore } from '../store/masterStore'
import { useBomStore } from '../store/bomStore'
import { useRoutingStore } from '../store/routingStore'
import { useWorkCenterStore } from '../store/workCenterStore'
import { useCostingStore } from '../store/costingStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useFreezeStore } from '../store/freezeStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useSalesStore } from '../store/salesStore'
import { useDmsStore } from '../store/dmsStore'
import { useApprovalStore } from '../store/approvalStore'
import { useQrStore } from '../store/qrStore'
import { useSerialStore } from '../store/serialStore'
import { useEcoStore } from '../store/ecoStore'
import { useBarcodeStore } from '../store/barcodeStore'
import { DEFAULT_WO_CONFIG } from '../types/workorder'
import { DEFAULT_OVERHEAD_PCT } from '../types/costing'
import { applyDemoMasterExtensions } from '../data/demo/mastersExtension'
import { buildDemoSalesPipeline } from '../data/demo/salesPipelineSeed'
import { buildDemoMrpSalesOrders } from '../data/demo/mrpOrdersSeed'
import { CRM_EXTENSION_CUSTOMERS } from '../data/crm/crmSampleSeed'
import { useCrmStore } from '../store/crmStore'
import { seedDemoInventoryMovements } from '../data/demo/inventoryExtension'
import { ensureDemoBomRoutingForProducts } from './demoBomRoutingClone'

/** Reset all transactional stores to empty baseline and reload master/sales seeds. */
export function resetDemoBaseline(): void {
  const masters = applyDemoMasterExtensions(mergeMastersWithSeed(null))
  const bom = mergeBomWithSeed(null)
  const routing = mergeRoutingWithSeed(null)
  const workCenters = mergeWorkCentersWithSeed(null)
  const pipeline = buildDemoSalesPipeline()
  const salesOrders = buildDemoMrpSalesOrders()

  useMasterStore.setState({
    uoms: masters.uoms,
    warehouses: masters.warehouses,
    categories: masters.categories,
    items: masters.items,
    customers: [...masters.customers, ...CRM_EXTENSION_CUSTOMERS.filter((c) => !masters.customers.some((m) => m.id === c.id))],
    vendors: masters.vendors,
    products: masters.products,
    itemVendorMaps: masters.itemVendorMaps,
  })
  useBomStore.setState({ bomHeaders: bom.bomHeaders, bomLines: bom.bomLines })
  useRoutingStore.setState({ routingHeaders: routing.routingHeaders, routingOperations: routing.routingOperations })
  ensureDemoBomRoutingForProducts(['prod-iso', 'prod-sidewall', 'prod-lowbed', 'prod-cement-bulker'])
  useWorkCenterStore.setState({ workCenters: workCenters.workCenters })

  useInventoryStore.setState({
    stockMovements: [...seedDemoInventoryMovements(), ...seedStockMovements],
    reservations: seedReservations.map((r) => ({ ...r })),
  })
  useMrpStore.setState({ runs: [], salesOrders: salesOrders.map((s) => ({ ...s })) })
  useSalesStore.setState({
    leads: pipeline.leads.map((l) => ({ ...l })),
    inquiries: [],
    quotations: pipeline.quotations.map((q) => ({ ...q })),
  })

  useWorkOrderStore.setState({
    config: DEFAULT_WO_CONFIG,
    workOrders: [],
    materialLines: [],
    productionOperations: [],
    jobCards: [],
    subcontractShipments: [],
    fgReceipts: [],
    saReceipts: [],
    activities: [],
  })
  usePurchaseStore.setState({ requisitions: [], rfqs: [], purchaseOrders: [], grns: [] })
  useQualityStore.setState((s) => ({
    ...s,
    inspections: [],
    reworks: [],
    ncrs: [],
  }))
  useFreezeStore.setState({ freezes: [] })
  useCostingStore.setState({ overheadPct: DEFAULT_OVERHEAD_PCT })
  useDispatchStore.setState({ dispatches: [] })
  useInvoiceStore.setState({ invoices: [] })
  useDmsStore.setState({ documents: seedDmsDocuments.map((d) => ({ ...d })), timeline: [] })
  useApprovalStore.setState({ rules: DEFAULT_APPROVAL_RULES.map((r) => ({ ...r, condition: { ...r.condition } })), approvers: DEFAULT_APPROVER_DEFINITIONS.map((a) => ({ ...a })), requests: [] })
  useQrStore.setState({ records: [], history: [], edges: [] })
  useSerialStore.setState({ serials: [] })
  useEcoStore.setState({ ecrs: [], ecos: [] })
  useBarcodeStore.setState({ barcodes: [], history: [] })

  const customerIds = useMasterStore.getState().customers.map((c) => c.id)
  useCrmStore.getState().loadSampleData(customerIds)
}

/** Legacy seed SO list (SO-0001 anchor) — used by tests; demo uses buildDemoMrpSalesOrders. */
export { seedSalesOrders }
