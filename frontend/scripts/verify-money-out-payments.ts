/**
 * Phase 4B5 Money Out — vendor payment, advance and allocation frontend verification.
 *
 * Static checks (no live server) mirroring scripts/verify-money-out.ts:
 *  - tabs live for payments/advances/payables
 *  - routes registered
 *  - bridge + api client methods present
 *  - permissions present
 *  - allocate page uses a stable idempotencyKey + concurrency timestamps
 *  - no reversal / delete-allocation UI in live actions, no Ant Design imports
 *  - no UI recalculation of settlement / cash outflow / TDS (server-authoritative)
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

const PAYMENT_DIR = 'src/modules/accounting/money-out/vendor-payments'
const COMPONENT_DIR = 'src/modules/accounting/money-out/components'

async function main() {
  console.log('═══════════════════════════════════════')
  console.log(' Money Out Payments (Phase 4B5) verification')
  console.log('═══════════════════════════════════════\n')

  // ── Tabs / UI helpers ────────────────────────────────────────────────
  const {
    MONEY_OUT_WORKSPACE_TABS,
    PAYMENT_PURPOSE_LABELS,
    PAYMENT_METHOD_LABELS,
    PAYMENT_ALLOCATION_STATE_LABELS,
    mapMoneyOutError,
    vendorPaymentDisplayNumber,
  } = await import('../src/modules/accounting/money-out/moneyOutUi.ts')

  const liveTab = (p: string) =>
    MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === p && !('preview' in t && t.preview))
  const previewTab = (p: string) =>
    MONEY_OUT_WORKSPACE_TABS.some((t) => t.path === p && 'preview' in t && t.preview)

  check('Vendor Payments tab live', liveTab('/accounting/money-out/vendor-payments'))
  check('Vendor Advances tab live', liveTab('/accounting/money-out/vendor-advances'))
  check('Payables tab live', liveTab('/accounting/money-out/payables'))
  check('Approvals tab live', liveTab('/accounting/money-out/approvals'))
  check('Ageing tab live', liveTab('/accounting/money-out/ageing'))
  check('Reconciliation tab live', liveTab('/accounting/money-out/reconciliation'))

  check('Purpose labels present', Boolean(PAYMENT_PURPOSE_LABELS.ADVANCE && PAYMENT_PURPOSE_LABELS.INVOICE_SETTLEMENT))
  check('Method labels present', Boolean(PAYMENT_METHOD_LABELS.BANK_TRANSFER && PAYMENT_METHOD_LABELS.CASH))
  check('Allocation state labels present', Boolean(PAYMENT_ALLOCATION_STATE_LABELS.FULLY_ALLOCATED))
  check('Payment error map STALE_VERSION', mapMoneyOutError('VENDOR_PAYMENT_STALE_VERSION').includes('changed'))
  check(
    'Allocation error map OVER_TARGET',
    mapMoneyOutError('PAYABLE_ALLOCATION_OVER_TARGET').toLowerCase().includes('outstanding'),
  )
  check(
    'Payment draft display uses draftReference',
    vendorPaymentDisplayNumber({ vendorPaymentNumber: null, draftReference: 'VP-DRAFT-1' }) === 'VP-DRAFT-1',
  )

  // ── Routes ───────────────────────────────────────────────────────────
  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Payments list route', routesSrc.includes("path: 'accounting/money-out/vendor-payments'"))
  check('Payments new route', routesSrc.includes("path: 'accounting/money-out/vendor-payments/new'"))
  check('Payments detail route', routesSrc.includes("path: 'accounting/money-out/vendor-payments/:id'"))
  check('Payments edit route', routesSrc.includes("path: 'accounting/money-out/vendor-payments/:id/edit'"))
  check('Payments allocate route', routesSrc.includes("path: 'accounting/money-out/vendor-payments/:id/allocate'"))
  check('Advances route', routesSrc.includes("path: 'accounting/money-out/vendor-advances'"))
  check('Payables route', routesSrc.includes("path: 'accounting/money-out/payables'"))
  check('Allocation detail route', routesSrc.includes("path: 'accounting/money-out/allocations/:allocationId'"))

  // ── Permissions ──────────────────────────────────────────────────────
  const permSrc = read('src/utils/permissions/moneyOut.ts')
  check('Permission payment.view', permSrc.includes("'finance.ap.payment.view'"))
  check('Permission payment.create', permSrc.includes("'finance.ap.payment.create'"))
  check('Permission payment.edit', permSrc.includes("'finance.ap.payment.edit'"))
  check('Permission payment.submit', permSrc.includes("'finance.ap.payment.submit'"))
  check('Permission payment.approve', permSrc.includes("'finance.ap.payment.approve'"))
  check('Permission payment.post', permSrc.includes("'finance.ap.payment.post'"))
  check('Permission payment.cancel', permSrc.includes("'finance.ap.payment.cancel'"))
  check('Permission allocation.view', permSrc.includes("'finance.ap.allocation.view'"))
  check('Permission allocation.create', permSrc.includes("'finance.ap.allocation.create'"))
  check('Permission advance.view', permSrc.includes("'finance.ap.advance.view'"))
  check('Hook exposes canCreatePayment', permSrc.includes('canCreatePayment'))
  check('Hook exposes canApprovePayment', permSrc.includes('canApprovePayment'))
  check('Hook exposes canPostPayment', permSrc.includes('canPostPayment'))
  check('Hook exposes canCreateAllocation', permSrc.includes('canCreateAllocation'))
  check('Hook exposes canViewAdvance', permSrc.includes('canViewAdvance'))
  check('Hook exposes canViewOpenItem', permSrc.includes('canViewOpenItem'))

  // ── Bridge + API client ──────────────────────────────────────────────
  const bridgeSrc = read('src/services/bridges/payablesApiBridge.ts')
  check('Bridge listVendorPayments', bridgeSrc.includes('listVendorPayments'))
  check('Bridge getVendorPayment', bridgeSrc.includes('getVendorPayment'))
  check('Bridge createVendorPaymentDraft', bridgeSrc.includes('createVendorPaymentDraft'))
  check('Bridge postVendorPayment', bridgeSrc.includes('postVendorPayment'))
  check('Bridge getAllocatableVendorInvoices', bridgeSrc.includes('getAllocatableVendorInvoices'))
  check('Bridge createVendorPaymentAllocation', bridgeSrc.includes('createVendorPaymentAllocation'))
  check('Bridge getPayableAllocation', bridgeSrc.includes('getPayableAllocation'))
  check('Bridge requires API mode', bridgeSrc.includes('requireApiMode'))
  check('Bridge no demo fallback', !bridgeSrc.includes('payablesDemo') && !bridgeSrc.includes('DemoStore'))

  const apiSrc = read('src/services/api/payablesApi.ts')
  check('API createVendorPaymentDraft', apiSrc.includes('createVendorPaymentDraft'))
  check('API postVendorPayment', apiSrc.includes('postVendorPayment'))
  check('API createVendorPaymentAllocation', apiSrc.includes('createVendorPaymentAllocation'))
  check('API getAllocatableVendorInvoices', apiSrc.includes('getAllocatableVendorInvoices'))

  // ── Pages exist ──────────────────────────────────────────────────────
  const listSrc = read(`${PAYMENT_DIR}/VendorPaymentListPage.tsx`)
  const formSrc = read(`${PAYMENT_DIR}/VendorPaymentFormPage.tsx`)
  const detailSrc = read(`${PAYMENT_DIR}/VendorPaymentDetailPage.tsx`)
  const allocateSrc = read(`${PAYMENT_DIR}/VendorPaymentAllocatePage.tsx`)
  const advanceSrc = read('src/modules/accounting/money-out/vendor-advances/VendorAdvanceListPage.tsx')
  const payablesSrc = read('src/modules/accounting/money-out/payables/PayablesPage.tsx')
  const allocationDetailSrc = read('src/modules/accounting/money-out/allocations/PayableAllocationDetailPage.tsx')

  check('List page uses server pagination', listSrc.includes('limit') && listSrc.includes('page'))
  check('Advances list fixes ADVANCE purpose', advanceSrc.includes("fixedPurpose=\"ADVANCE\""))

  // ── Form: raw inputs, expectedUpdatedAt, no client recalculation ─────
  check('Form has paymentPurpose field', formSrc.includes('paymentPurpose'))
  check('Form has paymentMethod field', formSrc.includes('paymentMethod'))
  check('Form has adjustments section', formSrc.includes('VendorPaymentAdjustmentSection'))
  check('Form sends expectedUpdatedAt on edit', formSrc.includes('expectedUpdatedAt'))
  check('Form has unsaved change blocker', formSrc.includes('useBlocker'))

  // ── Detail: lifecycle from allowedActions, no reversal UI ────────────
  check('Detail uses allowedActions', detailSrc.includes('allowedActions') || detailSrc.includes('actions?.'))
  check('Detail has post confirm modal', detailSrc.includes('VendorPaymentPostConfirmModal'))
  check('Detail has allocation history', detailSrc.includes('PayableAllocationHistoryTable'))
  check('Detail has open item summary', detailSrc.includes('VendorPaymentOpenItemSummary'))

  // ── Allocation UX ────────────────────────────────────────────────────
  check('Allocate page uses idempotencyKey', allocateSrc.includes('idempotencyKey'))
  check('Allocate page uses stable key signature', allocateSrc.includes('keySignature'))
  check('Allocate page uses crypto.randomUUID', allocateSrc.includes('crypto.randomUUID'))
  check(
    'Allocate sends expectedSourceOpenItemUpdatedAt',
    allocateSrc.includes('expectedSourceOpenItemUpdatedAt'),
  )
  check('Allocate sends per-line expectedTargetUpdatedAt', allocateSrc.includes('expectedTargetUpdatedAt'))
  check('Allocate explains no GL', allocateSrc.toLowerCase().includes('no journal entry'))
  check('Allocate handles idempotentReplay', allocateSrc.includes('idempotentReplay'))

  // ── No reversal / delete-allocation UI in live actions ───────────────
  const liveFiles = [listSrc, formSrc, detailSrc, allocateSrc, advanceSrc, payablesSrc, allocationDetailSrc]
  const forbidden = ['Reverse Payment', 'Reverse Allocation', 'Delete Allocation']
  for (const phrase of forbidden) {
    check(`No "${phrase}" UI`, liveFiles.every((f) => !f.includes(phrase)))
  }
  // "Unallocate" as an action verb (but "Unallocated" balance label is allowed).
  check('No "Unallocate" action', liveFiles.every((f) => !/Unallocate(?!d)/.test(f)))

  // ── No Ant Design in new files ───────────────────────────────────────
  const componentFiles = [
    'VendorPaymentTotalsPanel',
    'VendorPaymentPositionPanel',
    'VendorPaymentAccountingPreview',
    'VendorPaymentAdjustmentSection',
    'VendorPaymentOpenItemSummary',
    'VendorPaymentPostConfirmModal',
    'PayableAllocationHistoryTable',
  ].map((name) => read(`${COMPONENT_DIR}/${name}.tsx`))
  const allNewFiles = [...liveFiles, ...componentFiles]
  check('No Ant Design imports', allNewFiles.every((f) => !f.includes('antd') && !f.includes('@ant-design')))

  // ── Server-authoritative amounts (no UI recalculation of totals) ─────
  check(
    'Totals panel reads server amounts',
    componentFiles[0].includes('vendorSettlementAmount') && componentFiles[0].includes('cashOutflowAmount'),
  )

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
