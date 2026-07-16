/**
 * Entity 360 integration tests — npm run test:entity-360
 *
 * 1. BOM 360 route opens
 * 2. BOM tree renders
 * 3. BOM cost rollup matches BOM lines
 * 4. BOM usage shows linked product/WO/SO
 * 5. Customer 360 route opens
 * 6. Customer SO list renders
 * 7. Customer dispatch and invoice tabs show linked records
 * 8. Customer outstanding calculation works
 * 9. Global search can find BOM 360 and Customer 360
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

const { getBom360Data, getCustomer360Data } = await import('../src/utils/entity360Metrics')
const { bom360Path, customer360Path, ENTITY_360_ROUTES } = await import('../src/config/entity360Routes')
const { computeBomTotalCost } = await import('../src/utils/bom')
const { useBomStore } = await import('../src/store/bomStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { seedSalesOrders } = await import('../src/data/mrp/seed')

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

const bomId = 'bom-bulker-a'
const customerId = 'cust-abc'

// ── 1. BOM 360 route opens ──────────────────────────────────────────────────
const bomRoute = bom360Path(bomId)
check(
  1,
  'BOM 360 route opens',
  bomRoute === `/engineering/boms/${bomId}/360` && ENTITY_360_ROUTES.bom360 === '/engineering/boms/:id/360',
  bomRoute,
)

// ── 2. BOM tree renders ─────────────────────────────────────────────────────
const bom360 = getBom360Data(bomId)
check(
  2,
  'BOM tree renders',
  !!bom360 && bom360.tree.length > 0 && bom360.flat.length > 0,
  `${bom360?.tree.length ?? 0} roots, ${bom360?.flat.length ?? 0} lines`,
)

// ── 3. BOM cost rollup matches BOM lines ────────────────────────────────────
const leafCostSum = bom360?.leafLines.reduce((s, l) => s + l.totalCost, 0) ?? 0
const treeCost = bom360 ? computeBomTotalCost(bom360.tree) : 0
check(
  3,
  'BOM cost rollup matches BOM lines',
  !!bom360 &&
    Math.abs(leafCostSum - bom360.materialCost) < 0.01 &&
    Math.abs(treeCost - bom360.materialCost) < 0.01,
  `material ${bom360?.materialCost.toFixed(2)}`,
)

// ── 4. BOM usage shows linked product/WO/SO ─────────────────────────────────
check(
  4,
  'BOM usage shows linked product/WO/SO',
  !!bom360?.product &&
    Array.isArray(bom360.sosUsing) &&
    Array.isArray(bom360.wosUsing) &&
    bom360.product.id === 'prod-45m3',
  `product ${bom360?.product?.productCode}, ${bom360?.sosUsing.length} SO, ${bom360?.wosUsing.length} WO`,
)

// ── 5. Customer 360 route opens ─────────────────────────────────────────────
const customerRoute = customer360Path(customerId)
check(
  5,
  'Customer 360 route opens',
  customerRoute === `/masters/companies/${customerId}/360` &&
    ENTITY_360_ROUTES.customer360 === '/masters/companies/:id/360',
  customerRoute,
)

// ── 6. Customer SO list renders ─────────────────────────────────────────────
useMrpStore.setState({ salesOrders: [...seedSalesOrders] })
const cust360 = getCustomer360Data(customerId)
const soCount = (cust360?.openSo.length ?? 0) + (cust360?.closedSo.length ?? 0)
check(
  6,
  'Customer SO list renders',
  !!cust360 && soCount >= 1 && cust360.openSo.every((so) => so.customerId === customerId),
  `${soCount} orders for ${cust360?.customer.customerCode}`,
)

// ── 7. Customer dispatch and invoice tabs show linked records ───────────────
check(
  7,
  'Customer dispatch and invoice tabs show linked records',
  !!cust360 &&
    cust360.pendingDispatch.every((d) => d.customerId === customerId) &&
    cust360.customerInvoices.every((i) => i.customerId === customerId) &&
    Array.isArray(cust360.dispatchHistory),
  `${cust360?.pendingDispatch.length} dispatch, ${cust360?.customerInvoices.length} invoices`,
)

// ── 8. Customer outstanding calculation works ───────────────────────────────
const sumBalance = cust360?.customerInvoices.reduce((s, i) => s + i.balanceDue, 0) ?? -1
check(
  8,
  'Customer outstanding calculation works',
  !!cust360 && Math.abs(sumBalance - cust360.outstanding) < 0.01,
  `outstanding ₹${cust360?.outstanding.toFixed(0)}`,
)

// ── 9. Global search can find BOM 360 and Customer 360 ──────────────────────
const { runGlobalSearch } = await import('../src/utils/globalSearchIndex')
const { useWorkCenterStore } = await import('../src/store/workCenterStore')
const { useRoutingStore } = await import('../src/store/routingStore')
const { useCrmMasterStore } = await import('../src/store/crmMasterStore')
const { useCrmStore } = await import('../src/store/crmStore')

function globalSearchHits(query: string) {
  const master = useMasterStore.getState()
  return runGlobalSearch(query, {
    masters: {
      uoms: master.uoms,
      categories: master.categories,
      items: master.items,
      customers: master.customers,
      vendors: master.vendors,
      warehouses: master.warehouses,
      locations: master.locations,
      products: master.products,
      customerContacts: master.customerContacts,
      transporters: master.transporters,
      commercialTerms: master.commercialTerms,
      bomHeaders: useBomStore.getState().bomHeaders,
      workCenters: useWorkCenterStore.getState().workCenters,
      routingHeaders: useRoutingStore.getState().routingHeaders,
      crmMasterEntries: useCrmMasterStore.getState().entries,
      crmContacts: useCrmStore.getState().contacts,
      hsnMasters: master.hsnMasters,
      gstGroups: master.gstGroups,
      gstRates: master.gstRates,
    },
    transactions: {
      salesOrders: [],
      purchaseOrders: [],
      workOrders: [],
      jobCards: [],
      subcontractShipments: [],
      invoices: [],
      grns: [],
      qrRecords: [],
      serials: [],
      ecos: [],
    },
  }, '/masters')
}

const bom = useBomStore.getState().bomHeaders.find((b) => b.id === bomId)!
const customer = useMasterStore.getState().customers.find((c) => c.id === customerId)!
const bomHits = globalSearchHits(bom.bomNo)
const custHits = globalSearchHits(customer.customerCode)
check(
  9,
  'Global search can find BOM 360 and Customer 360',
  bomHits.some((h) => h.type === 'BOM 360' && h.href === bom360Path(bomId)) &&
    custHits.some((h) => h.type === 'Company 360' && h.href === customer360Path(customerId)),
  `BOM hit ${bomHits.length}, Customer hit ${custHits.length}`,
)

console.log(`\nEntity 360: ${passed}/9 passed${failed ? `, ${failed} failed` : ''}`)
if (failed > 0) process.exit(1)
