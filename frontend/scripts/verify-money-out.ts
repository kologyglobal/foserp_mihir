/**
 * Phase 4A5 Money Out — route, permission, UI helper and no-payment-UI verification.
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

async function main() {
  console.log('═══════════════════════════════════════')
  console.log(' Money Out (Phase 4A5) verification')
  console.log('═══════════════════════════════════════\n')

  const {
    MONEY_OUT_ERROR_MESSAGES,
    MONEY_OUT_STATUS_LABELS,
    MONEY_OUT_WORKSPACE_TABS,
    mapMoneyOutError,
    vendorInvoiceDisplayNumber,
  } = await import('../src/modules/accounting/money-out/moneyOutUi.ts')

  check('Status label DRAFT', MONEY_OUT_STATUS_LABELS.DRAFT === 'Draft')
  check('Status label PENDING_APPROVAL', MONEY_OUT_STATUS_LABELS.PENDING_APPROVAL === 'Pending Approval')
  check('Status label READY_TO_POST', MONEY_OUT_STATUS_LABELS.READY_TO_POST === 'Ready to Post')
  check('Status label POSTED', MONEY_OUT_STATUS_LABELS.POSTED === 'Posted')
  check('Error map STALE_VERSION', mapMoneyOutError('VENDOR_INVOICE_STALE_VERSION').includes('changed'))
  check('Error map EXACT_DUPLICATE', mapMoneyOutError('VENDOR_INVOICE_EXACT_DUPLICATE').toLowerCase().includes('already'))
  check('Error registry has PERIOD_CLOSED', Boolean(MONEY_OUT_ERROR_MESSAGES.VENDOR_INVOICE_POSTING_PERIOD_CLOSED))
  check(
    'Draft display uses draftReference',
    vendorInvoiceDisplayNumber({ vendorInvoiceNumber: null, draftReference: 'VI-DRAFT-1' }) === 'VI-DRAFT-1',
  )
  check(
    'Posted display uses FOS number',
    vendorInvoiceDisplayNumber({ vendorInvoiceNumber: 'VI-2026-0001', draftReference: 'VI-DRAFT-1' }) ===
      'VI-2026-0001',
  )

  const permSrc = read('src/utils/permissions/moneyOut.ts')
  check('Permission finance.ap.view', permSrc.includes("'finance.ap.view'"))
  check('Permission finance.ap.vendor_invoice.view', permSrc.includes("'finance.ap.vendor_invoice.view'"))
  check('Permission finance.ap.vendor_invoice.create', permSrc.includes("'finance.ap.vendor_invoice.create'"))
  check('Permission finance.ap.vendor_invoice.edit', permSrc.includes("'finance.ap.vendor_invoice.edit'"))
  check('Permission finance.ap.vendor_invoice.submit', permSrc.includes("'finance.ap.vendor_invoice.submit'"))
  check('Permission finance.ap.vendor_invoice.approve', permSrc.includes("'finance.ap.vendor_invoice.approve'"))
  check('Permission finance.ap.vendor_invoice.post', permSrc.includes("'finance.ap.vendor_invoice.post'"))
  check('Permission finance.ap.vendor_invoice.cancel', permSrc.includes("'finance.ap.vendor_invoice.cancel'"))
  check('Permission finance.ap.open_item.view', permSrc.includes("'finance.ap.open_item.view'"))
  check('mergeAllowedAction helper', permSrc.includes('mergeAllowedAction'))
  check('useMoneyOutPermissions hook', permSrc.includes('useMoneyOutPermissions'))

  check('Overview tab', MONEY_OUT_WORKSPACE_TABS[0].path === '/accounting/money-out')
  check(
    'Vendor invoices tab',
    MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === '/accounting/money-out/vendor-invoices'),
  )
  check(
    'Approvals tab live',
    MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === '/accounting/money-out/approvals' && !('preview' in t && t.preview)),
  )
  check(
    'Payments tab live',
    MONEY_OUT_WORKSPACE_TABS.some(
      (t) => t.path === '/accounting/money-out/vendor-payments' && !('preview' in t && t.preview),
    ),
  )
  check(
    'Ageing tab live',
    MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === '/accounting/money-out/ageing' && !('preview' in t && t.preview)),
  )

  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Money Out overview route', routesSrc.includes("path: 'accounting/money-out'"))
  check('Vendor invoices list route', routesSrc.includes("path: 'accounting/money-out/vendor-invoices'"))
  check('Vendor invoices new route', routesSrc.includes("path: 'accounting/money-out/vendor-invoices/new'"))
  check('Vendor invoices detail route', routesSrc.includes("path: 'accounting/money-out/vendor-invoices/:id'"))
  check('Vendor invoices edit route', routesSrc.includes("path: 'accounting/money-out/vendor-invoices/:id/edit'"))
  check('Approvals list route', routesSrc.includes("path: 'accounting/money-out/approvals'"))
  check('Approvals detail route', routesSrc.includes("path: 'accounting/money-out/approvals/:id'"))

  const navSrc = read('src/config/navigation.ts')
  check('Money Out nav entry', navSrc.includes("path: '/accounting/money-out'"))

  const bridgeSrc = read('src/services/bridges/payablesApiBridge.ts')
  check('Bridge requires API mode', bridgeSrc.includes('requireApiMode'))
  check('Bridge has postVendorInvoice', bridgeSrc.includes('postVendorInvoice'))
  check('Bridge has expectedUpdatedAt concurrency', bridgeSrc.includes('expectedUpdatedAt'))
  check('No demo store fallback', !bridgeSrc.includes('payablesDemo') && !bridgeSrc.includes('DemoStore'))

  const apiSrc = read('src/services/api/payablesApi.ts')
  check('Post body only expectedUpdatedAt', apiSrc.includes('expectedUpdatedAt: string'))
  check('PATCH update draft', apiSrc.includes("method: 'PATCH'"))

  const detailSrc = read('src/modules/accounting/money-out/vendor-invoices/VendorInvoiceDetailPage.tsx')
  check('Detail uses allowedActions.post', detailSrc.includes('actions?.post'))
  check('Detail does not invent post from status alone', !detailSrc.includes("status === 'READY_TO_POST') && (\n            <ErpButton variant=\"primary\""))
  check('No Pay Vendor action', !detailSrc.includes('Pay Vendor') && !detailSrc.includes('Create Payment'))
  check('No Allocate Payment action', !detailSrc.includes('Allocate Payment'))
  check('Idempotent replay message', detailSrc.includes('already posted'))

  const formSrc = read('src/modules/accounting/money-out/vendor-invoices/VendorInvoiceFormPage.tsx')
  check('Quick expense mode', formSrc.includes('Quick expense'))
  check('Unsaved change blocker', formSrc.includes('useBlocker'))
  check('Sends expectedUpdatedAt on edit', formSrc.includes('expectedUpdatedAt: updatedAt'))
  check('Optional purchase refs', formSrc.includes('Purchase matching is not enforced'))
  check('No inventory / GRN create', !formSrc.includes('createGoodsReceipt') && !formSrc.includes('createPurchaseOrder'))

  const overviewSrc = read('src/modules/accounting/money-out/MoneyOutOverviewPage.tsx')
  const moneyOutUiSrc = read('src/modules/accounting/money-out/moneyOutUi.ts')
  check(
    'Live payments workspace tab',
    moneyOutUiSrc.includes("path: '/accounting/money-out/vendor-payments'") &&
      overviewSrc.includes('/accounting/money-out/ageing'),
  )
  check('Live ageing overview', overviewSrc.includes('Ageing (due date)') && overviewSrc.includes('View Ageing'))

  const payableSrc = read('src/modules/accounting/money-out/components/PayableOpenItemSummary.tsx')
  check('Payable summary defers payments', payableSrc.includes('Vendor Payments phase'))
  check('No payment create from payable summary', !payableSrc.includes('Create Payment'))

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
