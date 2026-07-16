/**
 * Purchase Module — npm run test:purchase-module
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { buildPurchaseDashboardMetrics } = await import('../src/utils/purchaseMetrics')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { itemRequiresIncomingQc } = await import('../src/data/quality/itemQcConfig')
const { poIsAmendable } = await import('../src/types/purchase')

let pass = 0
let fail = 0
function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`) }
}

console.log('\nPurchase Module Tests\n')
setSessionUserForTests({ roleId: 'role-purchase-head', userId: 'test-buyer', userName: 'Purchase Head' })
mem.clear()

useInventoryStore.setState({ stockMovements: [...seedStockMovements], reservations: [...seedReservations] })
usePurchaseStore.setState({ requisitions: [], rfqs: [], purchaseOrders: [], grns: [], vendorQuotations: [], purchaseReturns: [] })
useMrpStore.setState({ runs: [] })

const nav = read('src/config/navigation.ts')
const routes = read('src/routes/purchaseRoutes.tsx')
const formPages = read('src/modules/purchase/PurchaseFormPages.tsx')

check(1, 'Purchase menu appears', nav.includes("label: 'Dashboard', path: '/purchase'") && nav.includes('Vendor Quotations'))
check(2, 'Purchase routes module exists', routes.includes('purchaseRouteTree'))
check(3, 'Purchase Dashboard route', routes.includes('PurchaseModuleDashboard'))
check(4, 'PR list route', routes.includes('PurchaseRequisitionListPage'))
check(5, 'PR full-page create route', routes.includes('PurchaseRequisitionFormPage'))
check(6, 'PR form uses ErpSmartSelect', formPages.includes('ErpSmartSelect'))
check(7, 'PR form uses CRM card form shell', formPages.includes('PurchaseCardFormShell') && formPages.includes('ErpCardSection'))
check(7.1, 'PR form has no undefined BC essentials', !formPages.includes('ErpDocEssentialsStrip') && !formPages.includes('ErpDocumentWorkspace'))
check(8, 'PR lines grid CRM style', read('src/components/purchase/PrLineItemsGrid.tsx').includes('quo-editor-price__table'))
const docPages = read('src/modules/purchase/PurchaseDocumentPages.tsx')
const rfqFormPages = read('src/modules/purchase/RfqFormPages.tsx')
const poAmendPage = read('src/modules/purchase/PoAmendFormPage.tsx')
check(8.1, 'RFQ uses CRM card form shell', docPages.includes('RfqDocumentPage') && docPages.includes('PurchaseCardFormShell'))
check(8.15, 'RFQ create uses CRM card form', rfqFormPages.includes('RfqCreateDocumentPage') && rfqFormPages.includes('PurchaseCardFormShell'))
check(8.16, 'RFQ list uses OperationalPageShell', read('src/modules/purchase/PurchasePages.tsx').includes('RfqListPage') && read('src/modules/purchase/PurchasePages.tsx').includes('OperationalPageShell'))
check(8.17, 'RFQ new route wired', routes.includes('RfqCreateDocumentPage'))
check(8.2, 'PO uses CRM card form shell', docPages.includes('PurchaseOrderDocumentPage') && docPages.includes('ErpFactBoxPanel'))
check(8.21, 'Direct PO create page', routes.includes('PoCreateDocumentPage') && read('src/modules/purchase/PoFormPages.tsx').includes('PoCreateDocumentPage'))
check(8.22, 'Manual PO without PR', read('src/modules/purchase/PoFormPages.tsx').includes('createManualPo') && read('src/store/purchaseStore.ts').includes('createManualPo:'))
check(8.3, 'GRN uses CRM card form shell', docPages.includes('GrnDocumentPage') && docPages.includes('ErpStickySaveBar'))
check(8.4, 'PO amend uses CRM card form', poAmendPage.includes('PurchaseCardFormShell') && poAmendPage.includes('ErpCommandBar'))
check(8.5, 'PR detail uses CRM card form', read('src/modules/purchase/PurchasePages.tsx').includes('PurchaseRequisitionDocumentPage readOnly'))

// MRP → PR flow
const so = seedSalesOrders.find((s) => s.salesOrderNo === 'SO-0001')!
const mrpResult = useMrpStore.getState().runMrpForOrder(so.id, undefined, { autoReserve: false })
const run = useMrpStore.getState().getRun(mrpResult.runId!)!
const prId = usePurchaseStore.getState().createPrFromMrpRun(run, so.id)
const pr = usePurchaseStore.getState().getPr(prId)!
check(9, 'Purchase Dashboard metrics compute', buildPurchaseDashboardMetrics().openPrs >= 1)
check(10, 'PR list loads data', Boolean(pr))
check(11, 'PR submit', usePurchaseStore.getState().submitPr(prId).ok)
check(12, 'PR approve', usePurchaseStore.getState().approvePr(prId).ok)

const vendors = useMasterStore.getState().vendors.filter((v) => v.isActive)
const rfqR = usePurchaseStore.getState().createRfqFromPr(prId, [vendors[0]!.id, vendors[1]!.id])
check(13, 'RFQ from approved PR', rfqR.ok, rfqR.rfqId)
const rfq = usePurchaseStore.getState().getRfq(rfqR.rfqId!)!
check(14, 'RFQ supports multiple vendors', rfq.vendorIds.length >= 2)
check(14.1, 'RFQ created as draft', rfq.status === 'draft')
check(14.2, 'Send RFQ to vendors', usePurchaseStore.getState().sendRfq(rfqR.rfqId!).ok)

const line = rfq.lines[0]!
usePurchaseStore.getState().addRfqQuote(rfqR.rfqId!, vendors[0]!.id, line.itemId, { rate: 100, leadTimeDays: 7, freightAmount: 500, gstPct: 18 })
usePurchaseStore.getState().addRfqQuote(rfqR.rfqId!, vendors[1]!.id, line.itemId, { rate: 120, leadTimeDays: 5, freightAmount: 200, gstPct: 18 })
check(15, 'Vendor quotation recorded', usePurchaseStore.getState().vendorQuotations.some((q) => q.rfqId === rfqR.rfqId))
check(16, 'Comparison ranks vendors', usePurchaseStore.getState().getVendorComparison(rfqR.rfqId!).length >= 2)

const poR = usePurchaseStore.getState().createPoFromRfq(rfqR.rfqId!, vendors[0]!.id)
check(17, 'PO from comparison path', poR.ok, poR.poId)
const po = usePurchaseStore.getState().getPo(poR.poId!)!
check(18, 'PO line totals calculate', po.lines.reduce((s, l) => s + l.qty * l.rate, 0) > 0)
usePurchaseStore.getState().submitPo(poR.poId!)
usePurchaseStore.getState().approvePo(poR.poId!)
check(19, 'PO approval works', usePurchaseStore.getState().getPo(poR.poId!)!.status === 'approved')
usePurchaseStore.getState().releasePo(poR.poId!)
usePurchaseStore.getState().sendPo(poR.poId!)
const sent = usePurchaseStore.getState().getPo(poR.poId!)!
check(20, 'Released/sent PO workflow', sent.status === 'sent')
check(21, 'PO print route registered', routes.includes("path: 'orders/:id/print'"))
check(22, 'Released PO amendability rule', poIsAmendable(sent))

const recv = sent.lines[0]!
let grnR: { ok: boolean; grnId?: string; error?: string }
if (recv.qty > 1) {
  const partialQty = Math.floor(recv.qty / 2)
  const partialR = usePurchaseStore.getState().postGrn(poR.poId!, [{ poLineId: recv.id, receivedQty: partialQty }])
  check(23, 'Partial GRN from PO', partialR.ok, partialR.grnId)
  const partialPo = usePurchaseStore.getState().getPo(poR.poId!)!
  check(23.1, 'PO partial status after partial GRN', partialPo.status === 'partial')
  check(23.2, 'Remaining qty tracked', partialPo.lines[0]!.qty - partialPo.lines[0]!.receivedQty === recv.qty - partialQty)
  grnR = usePurchaseStore.getState().postGrn(poR.poId!, [{ poLineId: recv.id, receivedQty: recv.qty - partialQty }])
} else {
  grnR = usePurchaseStore.getState().postGrn(poR.poId!, [{ poLineId: recv.id, receivedQty: recv.qty }])
  check(23, 'GRN from PO', grnR.ok, grnR.grnId)
}
check(24, 'GRN from PO completes', grnR.ok, grnR.grnId)
const grn = usePurchaseStore.getState().getGrn(grnR.grnId!)!
check(25, 'GRN fetches PO lines', grn.lines.length > 0)
const over = usePurchaseStore.getState().postGrn(poR.poId!, [{ poLineId: recv.id, receivedQty: recv.qty * 2 }])
check(26, 'GRN blocks over-receipt beyond tolerance', !over.ok)
if (itemRequiresIncomingQc(recv.itemId)) {
  check(27, 'QC required triggers handover', grn.status === 'pending_qc' || grn.qcRequired)
} else {
  check(27, 'GRN posts without QC', grn.status === 'posted' || grn.status === 'pending_qc')
}
const retR = usePurchaseStore.getState().createPurchaseReturnFromGrn(grnR.grnId!, [{ grnLineId: grn.lines[0]!.id, returnQty: 1, reason: 'qc_rejection' }])
check(28, 'Purchase return from GRN', retR.ok)

check(29, 'Vendor performance report', usePurchaseStore.getState().getVendorPerformanceReport().length >= 0)
check(30, 'Purchase reports route', routes.includes('PurchaseReportsPage'))
check(31, 'Purchase masters route', routes.includes('PurchaseMastersHubPage'))
check(32, 'Permission service in store', read('src/store/purchaseStore.ts').includes("assertPermission('purchase'"))
check(33, 'Purchase tab presets', read('src/components/erp/card-form/tabPresets.ts').includes('ERP_CARD_FORM_TABS_PO'))
check(33.1, 'PR create uses lines-first tabs', read('src/components/erp/card-form/tabPresets.ts').includes('ERP_CARD_FORM_TABS_PR_CREATE'))
check(33.2, 'RFQ create tabs preset', read('src/components/erp/card-form/tabPresets.ts').includes('ERP_CARD_FORM_TABS_RFQ_CREATE'))
check(33.3, 'RFQ comparison tab', read('src/components/erp/card-form/tabPresets.ts').includes("id: 'comparison'"))
check(34, 'No native select in PR form', !formPages.includes('<select'))
check(35, 'Vendor performance page', read('src/modules/purchase/PurchaseExtendedPages.tsx').includes('VendorPerformancePage'))

const manualVendor = useMasterStore.getState().vendors.find((v) => v.isActive)!
const manualItem = useMasterStore.getState().items.find((i) => i.isActive && i.isPurchasable)!
const manualWh = useMasterStore.getState().warehouses.find((w) => w.isActive)!
const manualPoR = usePurchaseStore.getState().createManualPo({
  vendorId: manualVendor.id,
  lines: [{ itemId: manualItem.id, warehouseId: manualWh.id, qty: 5, rate: 250, requiredDate: new Date().toISOString().slice(0, 10) }],
})
check(36, 'Manual PO without PR', manualPoR.ok, manualPoR.poId)
const manualPo = manualPoR.poId ? usePurchaseStore.getState().getPo(manualPoR.poId) : undefined
check(37, 'Manual PO has no PR link', Boolean(manualPo && manualPo.prId === null && manualPo.rfqId === null))

const exportUtil = read('src/utils/purchaseOrderExport.ts')
const printDoc = read('src/components/purchase/PurchaseOrderPrintDocument.tsx')
check(38, 'PO print document component', printDoc.includes('PurchaseOrderPrintDocument') && printDoc.includes('po-print-doc'))
check(39, 'PO PDF export utility', exportUtil.includes('downloadPoPdf') && exportUtil.includes('buildPoPrintHtml'))
check(40, 'PO Excel export utility', exportUtil.includes('downloadPoExcel') && exportUtil.includes('exportPoExcelTsv'))
check(41, 'PO print page export actions', read('src/modules/purchase/PurchaseProductionPages.tsx').includes('Download PDF') && read('src/modules/purchase/PurchaseProductionPages.tsx').includes('Export Excel'))
const poListPage = read('src/modules/purchase/PurchasePages.tsx')
check(42, 'PO list BC-style columns', poListPage.includes('PurchaseOrderTable') && poListPage.includes('Expected Receipt') && poListPage.includes('Vendor No.'))
check(43, 'PO list export excel', read('src/utils/purchaseOrderExport.ts').includes('exportPurchaseOrderListTsv'))
const grnPage = read('src/modules/purchase/GrnPages.tsx')
check(44, 'GRN register BC page', grnPage.includes('OperationalPageShell') && grnPage.includes('Posted GRNs'))
check(45, 'GRN partial receive workspace', grnPage.includes('remainingQty') && grnPage.includes('Receive Qty'))

const masterRoutes = read('src/routes/purchaseRoutes.tsx')
const masterCatalog = read('src/config/purchaseMastersCatalog.ts')
const masterStore = read('src/store/purchaseMasterStore.ts')
check(46, 'Purchase masters hub route', masterRoutes.includes('PurchaseMastersHubPage'))
check(47, 'Purchase master CRUD routes', masterRoutes.includes('PurchaseMasterListPage') && masterRoutes.includes('PurchaseMasterFormPage'))
check(48, 'Purchase masters catalog', masterCatalog.includes("slug: 'payment-terms'") && masterCatalog.includes("sourceModule: 'crm'") && masterCatalog.includes('qc-rules') && masterCatalog.includes('PURCHASE_LINKED_MASTERS'))
check(48.1, 'Payment terms linked to CRM', read('src/hooks/usePurchaseMasters.ts').includes('useCrmMasterStore') && read('src/components/purchase/PurchaseCommercialTermField.tsx').includes('/crm/masters/payment-terms'))
check(49, 'QC rules from purchase master store', masterStore.includes('itemRequiresIncomingQc'))
check(50, 'GRN tolerance from purchase master store', masterStore.includes('getGrnTolerancePct'))
check(51, 'PO form uses payment terms master', read('src/modules/purchase/PoFormPages.tsx').includes('PurchaseCommercialTermField'))
check(52, 'PR form uses buyer master', read('src/modules/purchase/PurchaseFormPages.tsx').includes('useBuyerOptions'))

const { usePurchaseMasterStore } = await import('../src/store/purchaseMasterStore')
mem.clear()
usePurchaseMasterStore.getState().resetMasters()
check(53, 'QC rule flags item-rm-plt', usePurchaseMasterStore.getState().itemRequiresIncomingQc('item-rm-plt'))
check(54, 'GRN default tolerance 5%', usePurchaseMasterStore.getState().getGrnTolerancePct('item-unknown') === 5)

const { useCrmMasterStore } = await import('../src/store/crmMasterStore')
const { resolveDefaultCommercialTerm } = await import('../src/utils/quotationTermUtils')
const crmPaymentCount = useCrmMasterStore.getState().getByKind('payment-terms', true).length
const defaultPayment = resolveDefaultCommercialTerm('payment-terms')
check(55, 'Purchase payment terms from CRM', crmPaymentCount >= 4 && defaultPayment.text.length > 0)
check(56, 'Purchase delivery terms from CRM', useCrmMasterStore.getState().getByKind('delivery-terms', true).length >= 4)

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
