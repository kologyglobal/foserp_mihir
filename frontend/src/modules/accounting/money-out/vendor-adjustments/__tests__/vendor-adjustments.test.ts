/**
 * Phase 4C2 — vendor adjustments + AP corrections frontend unit-style checks.
 * Run via: npm run test:money-out-adjustments
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADJUSTMENT_TYPE_LABELS,
  AP_REVERSAL_TYPE_LABELS,
  MONEY_OUT_WORKSPACE_TABS,
  vendorAdjustmentDisplayNumber,
} from '../../moneyOutUi.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..')

function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

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

export function runVendorAdjustmentFrontendTests() {
  check('Debit note type label', ADJUSTMENT_TYPE_LABELS.VENDOR_DEBIT_NOTE === 'Vendor debit note')
  check('Credit adjustment type label', ADJUSTMENT_TYPE_LABELS.VENDOR_CREDIT_ADJUSTMENT === 'Vendor credit adjustment')
  check(
    'Draft display uses draftReference',
    vendorAdjustmentDisplayNumber({ vendorAdjustmentNumber: null, draftReference: 'VADJ-DRAFT-1' }) === 'VADJ-DRAFT-1',
  )
  check('Reversal type payment label', AP_REVERSAL_TYPE_LABELS.payment === 'Vendor payment')
  check('mergeAllowedAction gates server action', mergeAllowedAction(true, false) === false)
  check('mergeAllowedAction passes when server undefined', mergeAllowedAction(true, undefined) === true)

  const liveTab = (p: string) =>
    MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === p && !('preview' in t && t.preview))

  check('Vendor Adjustments tab live', liveTab('/accounting/money-out/vendor-adjustments'))
  check('Corrections tab live', liveTab('/accounting/money-out/corrections'))

  const permSrc = read('src/utils/permissions/moneyOut.ts')
  check('Permission adjustment.view', permSrc.includes("'finance.ap.adjustment.view'"))
  check('Permission adjustment.reverse', permSrc.includes("'finance.ap.adjustment.reverse'"))
  check('Permission corrections.view', permSrc.includes("'finance.ap.corrections.view'"))
  check('Permission invoice.reverse', permSrc.includes("'finance.ap.vendor_invoice.reverse'"))
  check('Permission allocation.reverse', permSrc.includes("'finance.ap.allocation.reverse'"))

  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Adjustments list route', routesSrc.includes("path: 'accounting/money-out/vendor-adjustments'"))
  check('Adjustments allocate route', routesSrc.includes("path: 'accounting/money-out/vendor-adjustments/:id/allocate'"))
  check('Corrections route', routesSrc.includes("path: 'accounting/money-out/corrections'"))
  check('Reversal preview route', routesSrc.includes("path: 'accounting/money-out/reversals/:type/:id'"))

  const apiSrc = read('src/services/api/payablesApi.ts')
  check('API listVendorAdjustments', apiSrc.includes('listVendorAdjustments'))
  check('API reverseVendorPayment', apiSrc.includes('reverseVendorPayment'))
  check('API reversePayableAllocation', apiSrc.includes('reversePayableAllocation'))
  check('API listApReversalHistory stub', apiSrc.includes('listApReversalHistory'))

  const detailSrc = read('src/modules/accounting/money-out/vendor-payments/VendorPaymentDetailPage.tsx')
  check('Payment detail reverse navigation', detailSrc.includes('/accounting/money-out/reversals/payment/'))

  const reversalSrc = read('src/modules/accounting/money-out/corrections/ReversalPreviewPage.tsx')
  check('Reversal preview idempotency ref', reversalSrc.includes('idempotencyRef'))
  check('Reversal preview cascade option', reversalSrc.includes('cascadeAllocationReversals'))

  return { passed, failed }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('vendor-adjustments.test.ts')) {
  console.log('═══════════════════════════════════════')
  console.log(' Money Out Adjustments (Phase 4C2) tests')
  console.log('═══════════════════════════════════════\n')
  const result = runVendorAdjustmentFrontendTests()
  console.log(`\n${result.passed} passed, ${result.failed} failed`)
  process.exit(result.failed > 0 ? 1 : 0)
}
