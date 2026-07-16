/**
 * Control Tower integration tests — npm run test:control-towers
 *
 * 1. All routes open
 * 2. Production tower shows WO/QC/WIP/job card data
 * 3. MRP planner shows shortage and supply data
 * 4. Executive dashboard calculations match existing data
 * 5. Inbox aggregates approvals/tasks/alerts
 * 6. Links open correct 360/detail pages
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

const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useInvoiceStore } = await import('../src/store/invoiceStore')
const {
  getProductionControlTowerData,
  getMrpPlannerWorkbenchData,
  getExecutiveDashboardData,
  getUnifiedInboxData,
} = await import('../src/utils/controlTowerMetrics')
const {
  CONTROL_TOWER_ROUTES,
  wo360Path,
  item360Path,
  vendor360Path,
} = await import('../src/config/controlTowerRoutes')

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

function resetStores() {
  useInventoryStore.setState({
    stockMovements: [...seedStockMovements],
    reservations: seedReservations.map((r) => ({ ...r })),
  })
  useMrpStore.setState({ runs: [], salesOrders: seedSalesOrders.map((s) => ({ ...s })) })
  useWorkOrderStore.setState({
    workOrders: [],
    materialLines: [],
    productionOperations: [],
    jobCards: [],
    subcontractShipments: [],
    fgReceipts: [],
    saReceipts: [],
    activities: [],
  })
}

resetStores()
const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
const runId = mrpResult.runId!
const woCreate = useWorkOrderStore.getState().createFromMrpRun(runId, so.id)
const fgWo = useWorkOrderStore.getState().workOrders.find((w) => w.woType === 'finished_goods')
if (fgWo) {
  useWorkOrderStore.getState().planWorkOrder(fgWo.id)
  useWorkOrderStore.getState().releaseWorkOrder(fgWo.id)
  useWorkOrderStore.getState().startProduction(fgWo.id)
}

// ── 1. All routes open ──────────────────────────────────────────────────────
check(
  1,
  'All control tower routes resolve',
  CONTROL_TOWER_ROUTES.executive === '/executive' &&
    CONTROL_TOWER_ROUTES.production === '/production/control-tower' &&
    CONTROL_TOWER_ROUTES.mrpPlanner === '/mrp/planner' &&
    CONTROL_TOWER_ROUTES.inbox === '/inbox',
  `${CONTROL_TOWER_ROUTES.executive}, ${CONTROL_TOWER_ROUTES.production}`,
)

// ── 2. Production tower WO/QC/WIP/job card data ───────────────────────────────
const prod = getProductionControlTowerData()
const workOrders = useWorkOrderStore.getState().workOrders
const jobCards = useWorkOrderStore.getState().jobCards
const runningCount = workOrders.filter((w) => w.status === 'in_production').length
const pendingQc = useQualityStore.getState().getPendingInspections()
const openRework = useQualityStore.getState().getOpenReworks()
const wipCenters = new Set(jobCards.filter((j) => j.status !== 'completed').map((j) => j.workCenterCode))

check(
  2,
  'Production tower shows WO/QC/WIP/job card data',
  prod.running === runningCount &&
    prod.runningList.length === runningCount &&
    prod.qcHolds === jobCards.filter((j) => j.status === 'qc_hold').length + pendingQc.length &&
    prod.reworkQueue === openRework.length &&
    prod.wipByWorkCenter.length === wipCenters.size &&
    Array.isArray(prod.todayJobCards) &&
    Array.isArray(prod.blockedOperations),
  `${prod.running} running, ${prod.wipByWorkCenter.length} work centers, ${prod.todayJobCards.length} job cards today`,
)

// ── 3. MRP planner shortage and supply data ───────────────────────────────────
const planner = getMrpPlannerWorkbenchData()
const latestRun = useMrpStore.getState().getLatestRun()
const runShortages = latestRun?.materialLines.filter((m) => m.shortageQty > 0) ?? []
const expectedDemand = latestRun?.materialLines.reduce((s, m) => s + m.requiredQty, 0) ?? 0
const expectedSupply =
  latestRun?.materialLines.reduce((s, m) => s + m.freeStock + m.suggestedPoQty, 0) ?? 0

check(
  3,
  'MRP planner shows shortage and supply data',
  !!planner.latestRun &&
    planner.shortages.length === runShortages.length &&
    planner.demandQty === expectedDemand &&
    planner.supplyQty === expectedSupply &&
    planner.soReadiness.length >= 1 &&
    Array.isArray(planner.woShortages),
  `${planner.shortages.length} shortages, demand ${planner.demandQty}, supply ${planner.supplyQty}`,
)

// ── 4. Executive dashboard calculations match existing data ─────────────────
const exec = getExecutiveDashboardData()
const salesOrders = useMrpStore.getState().salesOrders
const getProduct = useMasterStore.getState().getProduct
const openOrders = salesOrders.filter((s) => !['closed', 'cancelled'].includes(s.status))
const expectedOrderBook = openOrders.reduce((s, o) => {
  const product = getProduct(o.productId)
  const lineTotal = o.grandTotal ?? (o.unitPrice ?? product?.standardPrice ?? 0) * o.qty
  return s + lineTotal
}, 0)
const invMetrics = useInvoiceStore.getState().getMetrics()
const qcMetrics = useQualityStore.getState().getMetrics()
const activeWos = workOrders.filter((w) => !['closed', 'cancelled', 'completed'].includes(w.status))
const runningWos = workOrders.filter((w) => w.status === 'in_production').length
const expectedCapacity =
  activeWos.length > 0 ? Math.min(100, Math.round((runningWos / activeWos.length) * 100)) : 0

check(
  4,
  'Executive dashboard calculations match existing data',
  exec.orderBookCount === openOrders.length &&
    Math.abs(exec.orderBookValue - expectedOrderBook) < 0.01 &&
    exec.invoiceValue === invMetrics.totalInvoiced &&
    exec.paymentReceived === invMetrics.totalCollected &&
    exec.outstanding === invMetrics.totalReceivable &&
    exec.openNcr === qcMetrics.openNcr &&
    exec.capacityUtil === expectedCapacity,
  `order book ₹${exec.orderBookValue.toFixed(0)}, outstanding ₹${exec.outstanding.toFixed(0)}`,
)

// ── 5. Inbox aggregates approvals/tasks/alerts ────────────────────────────────
const inbox = getUnifiedInboxData()
const purchaseOrders = usePurchaseStore.getState().purchaseOrders
const dispatches = useDispatchStore.getState().dispatches
const invoices = useInvoiceStore.getState().invoices
const expectedPoPending = purchaseOrders.filter((p) => p.status === 'submitted').length
const expectedDispatchPending = dispatches.filter(
  (d) => !['delivered', 'pod_received', 'closed', 'cancelled'].includes(d.status),
).length
const expectedPaymentPending = invoices.filter((i) => i.balanceDue > 0).length
const expectedDelayedWo = workOrders.filter(
  (w) =>
    !['closed', 'completed', 'cancelled', 'fg_received'].includes(w.status) &&
    !!w.plannedFinishDate &&
    w.plannedFinishDate < new Date().toISOString().slice(0, 10),
).length

check(
  5,
  'Inbox aggregates approvals/tasks/alerts',
  inbox.counts.approvals === inbox.approvals.length &&
    inbox.counts.tasks === inbox.tasks.length &&
    inbox.counts.alerts === inbox.alerts.length &&
    inbox.counts.qcPending === pendingQc.length &&
    inbox.counts.poApprovalPending === expectedPoPending &&
    inbox.counts.dispatchPending === expectedDispatchPending &&
    inbox.counts.paymentPending === expectedPaymentPending &&
    inbox.counts.delayedWorkOrders === expectedDelayedWo &&
    inbox.work.length === inbox.approvals.length + inbox.tasks.length + inbox.alerts.length,
  `${inbox.counts.approvals} approvals, ${inbox.counts.tasks} tasks, ${inbox.counts.alerts} alerts`,
)

// ── 6. Links open correct 360/detail pages ───────────────────────────────────
const sampleWo = workOrders[0]
const sampleItem = latestRun?.materialLines[0]
const sampleVendor = usePurchaseStore.getState().purchaseOrders[0]?.vendorId
const woLink = sampleWo ? wo360Path(sampleWo.id) : ''
const itemLink = sampleItem ? item360Path(sampleItem.itemId) : ''
const vendorLink = sampleVendor ? vendor360Path(sampleVendor) : ''
const lateWoAlert = inbox.alerts.find((a) => a.id.startsWith('late-wo-'))
const qcTask = inbox.tasks.find((t) => t.id.startsWith('qc-'))

check(
  6,
  'Links open correct 360/detail pages',
  (!sampleWo || woLink === `/work-orders/${sampleWo.id}/360`) &&
    (!sampleItem || itemLink === `/masters/items/${sampleItem.itemId}`) &&
    (!sampleVendor || vendorLink === `/masters/vendors/${sampleVendor}`) &&
    (!lateWoAlert || lateWoAlert.href.startsWith('/work-orders/')) &&
    (!qcTask || qcTask.href.startsWith('/quality/inspections/')) &&
    woCreate.ok === true,
  sampleWo ? `WO → ${woLink}` : 'WO links verified',
)

console.log(`\nControl Towers: ${passed}/6 passed${failed ? `, ${failed} failed` : ''}`)
if (failed > 0) process.exit(1)
