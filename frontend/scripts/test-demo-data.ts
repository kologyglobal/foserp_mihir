/**
 * Demo data wiring validation — npm run test:demo-data
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { loadDemoData } = await import('../src/demo/loadDemoData')
const { useMasterStore } = await import('../src/store/masterStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useInvoiceStore } = await import('../src/store/invoiceStore')
const { useQrStore } = await import('../src/store/qrStore')
const { useSerialStore } = await import('../src/store/serialStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useEcoStore } = await import('../src/store/ecoStore')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { getBom360Data, getCustomer360Data } = await import('../src/utils/entity360Metrics')
const {
  getProductionControlTowerData,
  getMrpPlannerWorkbenchData,
  getExecutiveDashboardData,
  getUnifiedInboxData,
} = await import('../src/utils/controlTowerMetrics')

let passed = 0
let failed = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const load = loadDemoData()
check(1, 'loadDemoData succeeds', load.ok, load.error ?? `${load.warnings?.length ?? 0} warnings`)

const master = useMasterStore.getState()
const sales = useSalesStore.getState()
const mrp = useMrpStore.getState()
const wo = useWorkOrderStore.getState()
const purchase = usePurchaseStore.getState()
const dispatch = useDispatchStore.getState()
const invoice = useInvoiceStore.getState()
const quality = useQualityStore.getState()
const qr = useQrStore.getState()
const serial = useSerialStore.getState()
const eco = useEcoStore.getState()
const inv = useInventoryStore.getState()

const counts = {
  customers: master.customers.length,
  vendors: master.vendors.length,
  items: master.items.length,
  products: master.products.length,
  leads: sales.leads.length,
  quotations: sales.quotations.length,
  salesOrders: mrp.salesOrders.length,
  workOrders: wo.workOrders.length,
  jobCards: wo.jobCards.length,
  prs: purchase.requisitions.length,
  rfqs: purchase.rfqs.length,
  pos: purchase.purchaseOrders.length,
  grns: purchase.grns.length,
  dispatches: dispatch.dispatches.length,
  invoices: invoice.invoices.length,
  qc: quality.inspections.length,
  movements: inv.stockMovements.length,
  qr: qr.records.length,
  serials: serial.serials.length,
  ecrs: eco.ecrs.length,
  ecos: eco.ecos.length,
}

check(2, 'Major masters ≥10 records', counts.customers >= 10 && counts.vendors >= 10 && counts.items >= 10 && counts.products >= 10,
  `customers ${counts.customers}, vendors ${counts.vendors}, items ${counts.items}, products ${counts.products}`)
// Legacy sales inquiries retired in resetDemoBaseline — pipeline is leads + quotations only
check(3, 'Sales pipeline ≥10 leads & quotes', counts.leads >= 10 && counts.quotations >= 10,
  `leads ${counts.leads}, quotes ${counts.quotations}`)
check(4, 'Sales orders ≥10', counts.salesOrders >= 10, String(counts.salesOrders))
check(5, 'Production ≥10 WOs and job cards', counts.workOrders >= 10 && counts.jobCards >= 10,
  `WOs ${counts.workOrders}, JCs ${counts.jobCards}`)
check(6, 'Purchase docs populated', counts.prs >= 8 && counts.rfqs >= 8 && counts.pos >= 10 && counts.grns >= 10,
  `PR ${counts.prs}, RFQ ${counts.rfqs}, PO ${counts.pos}, GRN ${counts.grns}`)
check(7, 'Dispatch & invoice chains exist', counts.dispatches >= 4 && counts.invoices >= 4,
  `dispatch ${counts.dispatches}, invoices ${counts.invoices}`)
check(8, 'Quality & inventory depth', counts.qc >= 10 && counts.movements >= 10,
  `QC ${counts.qc}, movements ${counts.movements}`)
check(9, 'QR, serial, ECO/ECR', counts.qr >= 10 && counts.serials >= 7 && counts.ecrs >= 10 && counts.ecos >= 5,
  `QR ${counts.qr}, serials ${counts.serials}, ECR ${counts.ecrs}, ECO ${counts.ecos}`)

const soOrphans = mrp.salesOrders.filter((s) => !master.customers.some((c) => c.id === s.customerId) || !master.products.some((p) => p.id === s.productId))
check(10, 'Every SO links customer + product', soOrphans.length === 0, soOrphans.length ? `${soOrphans.length} orphan SOs` : 'ok')

const woOrphans = wo.workOrders.filter((w) => {
  const so = mrp.getSalesOrder(w.salesOrderId)
  return !so || !master.getProduct(w.productId)
})
check(11, 'Every WO links SO + product', woOrphans.length === 0)

const poOrphans = purchase.purchaseOrders.filter((p) => !master.vendors.some((v) => v.id === p.vendorId))
check(12, 'Every PO links vendor', poOrphans.length === 0)

const grnOrphans = purchase.grns.filter((g) => !purchase.purchaseOrders.some((p) => p.id === g.poId))
check(13, 'Every GRN links PO', grnOrphans.length === 0)

const invOrphans = invoice.invoices.filter((i) => !dispatch.dispatches.some((d) => d.id === i.dispatchId))
check(14, 'Every invoice links dispatch', invOrphans.length === 0)

const payOrphans = invoice.invoices.filter((i) => i.payments.length > 0 && !i.dispatchId)
check(15, 'Every payment links invoice', payOrphans.length === 0)

const qrOrphans = qr.records.filter((r) => !r.entityId)
check(16, 'Every QR links entity', qrOrphans.length === 0)

const serialOrphans = serial.serials.filter((s) => !master.items.some((i) => i.id === s.itemId))
check(17, 'Every serial links item', serialOrphans.length === 0)

const bom360 = getBom360Data('bom-bulker-a')
const cust360 = getCustomer360Data('cust-abc')
const custOrderCount = (cust360?.openSo.length ?? 0) + (cust360?.closedSo.length ?? 0)
check(18, '360 pages have data', !!bom360 && bom360.flat.length > 0 && !!cust360 && custOrderCount > 0,
  `BOM lines ${bom360?.flat.length ?? 0}, ABC SOs ${custOrderCount}`)

const exec = getExecutiveDashboardData()
const prod = getProductionControlTowerData()
const planner = getMrpPlannerWorkbenchData()
const inbox = getUnifiedInboxData()
check(19, 'Control towers have live data',
  exec.orderBookValue >= 0 && prod.running >= 0 && planner.shortages.length >= 0 && inbox.work.length >= 0,
  `order book ₹${Math.round(exec.orderBookValue)}, running WOs ${prod.running}, inbox ${inbox.work.length}`)

const scenarioSo = mrp.salesOrders.find((s) => s.salesOrderNo === 'SO-0001')
check(20, 'Scenario 1 ABC Cement closed loop', scenarioSo?.status === 'closed' && scenarioSo.customerId === 'cust-abc')

console.log(`\n${passed}/${passed + failed} passed`)
process.exit(failed > 0 ? 1 : 0)
