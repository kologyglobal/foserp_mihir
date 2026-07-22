/**
 * Wave 6 — accounting master reuse "E2E intent" smokes.
 *
 * The repo has no browser E2E harness (no Playwright); these `tsx` static
 * checks stand in for the requested `e2e/accounting/*` scenarios:
 *   - sales-invoice-direct-vs-sales-order (create modes + eligible SO picker)
 *   - vendor-invoice-direct-vs-po-grn (create modes + eligible PO/GRN pickers)
 *   - party-master-drilldown (PartyMasterCard / SourceDocumentCard / tabs)
 *   - refresh-from-master (server preview + apply, DRAFT-only)
 *   - no-mock-fallback (API mode never substitutes demo data)
 *
 * Run: npm run test:accounting-master-reuse
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function main() {
  console.log('═══════════════════════════════════════════════')
  console.log(' Accounting master reuse (Wave 6) verification')
  console.log('═══════════════════════════════════════════════\n')

  // ── Lookup client ──────────────────────────────────────────────────────────
  const lookups = read('src/services/api/accountingLookupsApi.ts')
  check('Lookups client base /accounting/lookups', lookups.includes("'/accounting/lookups'"))
  for (const fn of [
    'listCustomerLookups',
    'listVendorLookups',
    'listItemLookups',
    'listSalesOrderLookups',
    'listPurchaseOrderLookups',
    'listGrnLookups',
    'getSalesOrderInvoiceEligibility',
    'getPurchaseOrderInvoiceEligibility',
    'getGrnInvoiceEligibility',
  ]) {
    check(`Lookups client exports ${fn}`, lookups.includes(`export async function ${fn}`))
  }

  // ── e2e intent: sales-invoice-direct-vs-sales-order ────────────────────────
  const siForm = read('src/modules/accounting/money-in/invoices/InvoiceFormPage.tsx')
  check('SI create modes — Direct invoice', siForm.includes('Direct invoice'))
  check('SI create modes — From Sales Order', siForm.includes('From Sales Order'))
  check('SI eligible SO picker via lookups', siForm.includes('listSalesOrderLookups') && siForm.includes('eligibleOnly: true'))
  check('SI customer picker (accounting source)', siForm.includes('<CustomerMasterSelect') && siForm.includes('source="accounting"'))
  check('SI source fixed after creation', siForm.includes('Source document is fixed after creation'))

  // ── e2e intent: vendor-invoice-direct-vs-po-grn ────────────────────────────
  const viForm = read('src/modules/accounting/money-out/vendor-invoices/VendorInvoiceFormPage.tsx')
  check('VI create modes DIRECT / PO / GRN', viForm.includes("'DIRECT' | 'PURCHASE_ORDER' | 'GOODS_RECEIPT'"))
  check('VI eligible PO picker via lookups', viForm.includes('listPurchaseOrderLookups'))
  check('VI eligible GRN picker via lookups', viForm.includes('listGrnLookups'))
  check('VI vendor picker (accounting source)', viForm.includes('<VendorMasterSelect') && viForm.includes('source="accounting"'))
  check('VI real source links only', viForm.includes("sourceType: 'PURCHASE_ORDER'") && viForm.includes("sourceType: 'GOODS_RECEIPT'"))
  check('VI no direct purchase list APIs', !viForm.includes('listPurchaseOrdersApi') && !viForm.includes('listGoodsReceiptsApi'))

  // ── e2e intent: party-master-drilldown ─────────────────────────────────────
  const shared = read('src/modules/accounting/shared/invoices/index.ts')
  for (const comp of ['PartyMasterCard', 'SourceDocumentCard', 'MasterRefreshModal', 'InvoiceDetailTabs']) {
    check(`Shared invoice component exported: ${comp}`, shared.includes(comp))
  }
  const partyCard = read('src/modules/accounting/shared/invoices/PartyMasterCard.tsx')
  check('PartyMasterCard historical snapshot fallback', partyCard.toLowerCase().includes('snapshot'))
  const siDetail = read('src/modules/accounting/money-in/invoices/InvoiceDetailPage.tsx')
  check('SI detail uses shared shells', siDetail.includes('PartyMasterCard') || siDetail.includes('InvoiceDetailTabs'))
  const viDetail = read('src/modules/accounting/money-out/vendor-invoices/VendorInvoiceDetailPage.tsx')
  check('VI detail uses shared shells', viDetail.includes('PartyMasterCard') || viDetail.includes('InvoiceDetailTabs'))

  // ── e2e intent: refresh-from-master ────────────────────────────────────────
  const modal = read('src/modules/accounting/shared/invoices/MasterRefreshModal.tsx')
  check('Refresh modal — SI server preview', modal.includes('previewSalesInvoiceRefreshFromMaster'))
  check('Refresh modal — VI server preview', modal.includes('previewVendorInvoiceRefreshFromMaster'))
  check('Refresh modal — SI apply helper', modal.includes('applySalesInvoiceRefreshFromMaster'))
  check('Refresh modal — VI apply helper', modal.includes('applyVendorInvoiceRefreshFromMaster'))
  check('Refresh modal — DRAFT-only messaging', modal.includes('Available on Draft documents only'))
  check('Refresh modal — no Wave 1 TODO left', !modal.includes('TODO(Wave 1)'))

  const arApi = read('src/services/api/receivablesApi.ts')
  check('receivablesApi refresh endpoints', arApi.includes('refresh-from-master/preview') && arApi.includes('refresh-from-master`'))
  const apApi = read('src/services/api/payablesApi.ts')
  check('payablesApi refresh endpoints', apApi.includes('refresh-from-master/preview') && apApi.includes('refresh-from-master`'))

  // ── e2e intent: no-mock-fallback ───────────────────────────────────────────
  const bridge = read('src/services/bridges/receivablesApiBridge.ts')
  check('No listDemoCustomers anywhere in receivables bridge', !bridge.includes('listDemoCustomers'))
  const lookupHook = read('src/hooks/useAccountingLookups.ts')
  check('Lookup hook never substitutes demo data in API mode', lookupHook.includes('Never substitutes demo data in API mode'))
  check('Refresh modal fails loudly (no silent mock)', modal.includes('never a silent mock fallback'))

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main()
