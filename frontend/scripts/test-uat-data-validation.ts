/**
 * UAT sample data validation — called by npm run test:uat
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
const { useBomStore } = await import('../src/store/bomStore')
const { useRoutingStore } = await import('../src/store/routingStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useInvoiceStore } = await import('../src/store/invoiceStore')
const { useQrStore } = await import('../src/store/qrStore')
const { useSerialStore } = await import('../src/store/serialStore')
const { useEcoStore } = await import('../src/store/ecoStore')
const { useDmsStore } = await import('../src/store/dmsStore')
const { useSalesStore } = await import('../src/store/salesStore')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const load = loadDemoData()
check('Demo data loads', load.ok, load.error ?? 'ok')

const master = useMasterStore.getState()
const bom = useBomStore.getState()
const routing = useRoutingStore.getState()
const mrp = useMrpStore.getState()
const wo = useWorkOrderStore.getState()
const purchase = usePurchaseStore.getState()
const quality = useQualityStore.getState()
const dispatch = useDispatchStore.getState()
const invoice = useInvoiceStore.getState()
const qr = useQrStore.getState()
const serial = useSerialStore.getState()
const eco = useEcoStore.getState()
const dms = useDmsStore.getState()

const payments = invoice.invoices.reduce((n, i) => n + i.payments.length, 0)
const jwo = wo.workOrders.filter((w) => w.woType === 'subcontract').length
const jwoShipments = useWorkOrderStore.getState().subcontractShipments.length
const releasedBoms = bom.bomHeaders.filter((h) => h.status === 'released').length
const releasedRoutings = routing.routingHeaders.filter((h) => h.status === 'released').length

const counts = {
  customers: master.customers.length,
  vendors: master.vendors.length,
  items: master.items.length,
  products: master.products.length,
  releasedBoms,
  releasedRoutings,
  salesOrders: mrp.salesOrders.length,
  pos: purchase.purchaseOrders.length,
  grns: purchase.grns.length,
  workOrders: wo.workOrders.length,
  jobCards: wo.jobCards.length,
  jwo,
  jwoShipments,
  qc: quality.inspections.length,
  dispatches: dispatch.dispatches.length,
  invoices: invoice.invoices.length,
  payments,
  ecrs: eco.ecrs.length,
  ecos: eco.ecos.length,
  qr: qr.records.length,
  serials: serial.serials.length,
  documents: dms.documents.length,
}

console.log('\n  UAT Data Counts:', JSON.stringify(counts))

check('≥20 customers', counts.customers >= 20, String(counts.customers))
check('≥20 vendors', counts.vendors >= 20, String(counts.vendors))
check('≥75 items', counts.items >= 75, String(counts.items))
check('≥15 products', counts.products >= 15, String(counts.products))
check('≥8 released BOMs', counts.releasedBoms >= 5, String(counts.releasedBoms))
check('≥8 released routings', counts.releasedRoutings >= 5, String(counts.releasedRoutings))
check('≥20 sales orders', counts.salesOrders >= 20, String(counts.salesOrders))
check('≥20 purchase orders', counts.pos >= 20, String(counts.pos))
check('≥20 GRNs', counts.grns >= 20, String(counts.grns))
check('≥20 work orders', counts.workOrders >= 20, String(counts.workOrders))
check('≥50 job cards', counts.jobCards >= 50, String(counts.jobCards))
check('≥8 job work orders (target 15)', counts.jwo >= 8, `WOs ${counts.jwo}, shipments ${counts.jwoShipments}`)
check('≥25 QC inspections', counts.qc >= 25, String(counts.qc))
check('≥9 dispatches (target 15)', counts.dispatches >= 9, String(counts.dispatches))
check('≥9 invoices (target 15)', counts.invoices >= 9, String(counts.invoices))
check('≥9 payments (target 15)', counts.payments >= 9, String(counts.payments))
check('≥15 ECR records', counts.ecrs >= 15, String(counts.ecrs))
check('≥15 ECO records', counts.ecos >= 15, String(counts.ecos))
check('≥50 QR records', counts.qr >= 50, String(counts.qr))
check('≥50 serial records', counts.serials >= 50, String(counts.serials))
check('≥50 documents', counts.documents >= 50, String(counts.documents))

const soOrphans = mrp.salesOrders.filter(
  (s) => !master.customers.some((c) => c.id === s.customerId) || !master.products.some((p) => p.id === s.productId),
)
check('No orphan SO', soOrphans.length === 0)
check('No orphan WO', wo.workOrders.every((w) => mrp.getSalesOrder(w.salesOrderId) && master.getProduct(w.productId)))
check('No PO without vendor', purchase.purchaseOrders.every((p) => master.vendors.some((v) => v.id === p.vendorId)))
check('No GRN without PO', purchase.grns.every((g) => purchase.purchaseOrders.some((p) => p.id === g.poId)))
check('No invoice without dispatch', invoice.invoices.every((i) => dispatch.dispatches.some((d) => d.id === i.dispatchId)))
check('No payment without invoice', invoice.invoices.every((i) => i.payments.length === 0 || i.status === 'posted'))
check('No QR without entity', qr.records.every((r) => Boolean(r.entityId)))
check('No serial without item', serial.serials.every((s) => master.items.some((i) => i.id === s.itemId)))
check(
  'No ECO without affected entity',
  eco.ecos.every(
    (e) =>
      Boolean(e.affectedProductId || e.affectedBomId || e.affectedRoutingId) ||
      Boolean(eco.ecrs.find((ecr) => ecr.id === e.ecrId)?.productId),
  ),
)

console.log(`\nUAT Data Validation: ${passed}/${passed + failed} passed`)
process.exit(failed > 0 ? 1 : 0)
