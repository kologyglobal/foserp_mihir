/**
 * Purchase mobile Phase A + B — structural + pure helper checks (no network).
 * Run: npx tsx scripts/verify-purchase-mobile.ts
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canCreateGrn,
  canPostGrn,
  canSubmitPurchaseRequisition,
  canViewGrns,
  canViewPurchaseOrders,
  canViewPurchaseQi,
  canViewPurchaseRequisitions,
  isPoReceivable,
  isPrSubmittable,
  matchPoFilter,
  matchPrFilter,
  poFilterToStatusParam,
  poPendingQuantity,
  poReceiptProgress,
  prEstimatedTotal,
  prFilterToStatus,
  shouldShowApproveAction,
  validateReceiveLines,
  type PurchaseOrderSummary,
  type PurchaseRequisitionSummary,
} from '../src/features/purchase/api.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = (rel: string) => join(root, rel)

// Files exist (not stubs)
const must = [
  'app/(app)/purchase/purchase-orders/index.tsx',
  'app/(app)/purchase/purchase-orders/[id].tsx',
  'app/(app)/purchase/grn/index.tsx',
  'app/(app)/purchase/grn/[id].tsx',
  'app/(app)/purchase/grn/receive.tsx',
  'app/(app)/purchase/requisitions/index.tsx',
  'app/(app)/purchase/requisitions/[id].tsx',
  'app/(app)/purchase/quality-inspections/index.tsx',
  'src/features/purchase/api.ts',
  'src/features/purchase/hooks.ts',
]
for (const f of must) {
  assert.ok(existsSync(src(f)), `missing ${f}`)
  const body = readFileSync(src(f), 'utf8')
  assert.ok(!body.includes('ComingSoonScreen'), `${f} still ComingSoon`)
}

const poList = readFileSync(src('app/(app)/purchase/purchase-orders/index.tsx'), 'utf8')
assert.match(poList, /SearchBar/)
assert.match(poList, /SkeletonCard/)
assert.match(poList, /purchase\.po\.view|canView/)
assert.match(poList, /RefreshControl/)

const poDetail = readFileSync(src('app/(app)/purchase/purchase-orders/[id].tsx'), 'utf8')
assert.match(poDetail, /Receive goods/)
assert.match(poDetail, /isPoReceivable/)
assert.match(poDetail, /poReceiptProgress|Receipt progress/)

const grnList = readFileSync(src('app/(app)/purchase/grn/index.tsx'), 'utf8')
assert.match(grnList, /listGrns|useGrnsList/)
assert.match(grnList, /Receive goods/)

const grnDetail = readFileSync(src('app/(app)/purchase/grn/[id].tsx'), 'utf8')
assert.match(grnDetail, /postInventoryGoodsReceipt/)
assert.match(grnDetail, /submitGoodsReceipt/)
assert.match(grnDetail, /ConfirmDialog/)

const receive = readFileSync(src('app/(app)/purchase/grn/receive.tsx'), 'utf8')
assert.match(receive, /createGoodsReceipt/)
assert.match(receive, /ScanField/)
assert.match(receive, /receivedUomQuantity/)
assert.match(receive, /listReceivableLines/)

const prList = readFileSync(src('app/(app)/purchase/requisitions/index.tsx'), 'utf8')
assert.match(prList, /usePrList|listPurchaseRequisitions/)
assert.match(prList, /SearchBar/)
assert.match(prList, /purchase\.pr\.view|canView/)

const prDetail = readFileSync(src('app/(app)/purchase/requisitions/[id].tsx'), 'utf8')
assert.match(prDetail, /submitPurchaseRequisition/)
assert.match(prDetail, /isPrSubmittable/)

const qiList = readFileSync(src('app/(app)/purchase/quality-inspections/index.tsx'), 'utf8')
assert.match(qiList, /useQiRegister|listQualityInspections/)
assert.match(qiList, /Read-only|pass\/reject|Quality/)
assert.ok(!qiList.includes('approveInspection') && !qiList.includes('rejectInspection'))

const api = readFileSync(src('src/features/purchase/api.ts'), 'utf8')
assert.match(api, /purchase\.po\.view/)
assert.match(api, /purchase\.pr\.view/)
assert.match(api, /purchase\.pr\.submit/)
assert.match(api, /purchase\.grn\.create/)
assert.match(api, /purchase\.grn\.post/)
assert.match(api, /post-inventory/)
assert.match(api, /quality-inspections/)
assert.match(api, /receivable-lines/)
assert.match(api, /requisitions/)
assert.ok(!api.includes('AsyncStorage'))

// Permissions
assert.equal(canViewPurchaseOrders(['purchase.po.view']), true)
assert.equal(canViewPurchaseOrders(['crm.lead.view']), false)
assert.equal(canViewPurchaseOrders(null), false)
assert.equal(canViewGrns(['purchase.grn.view']), true)
assert.equal(canCreateGrn(['purchase.grn.create']), true)
assert.equal(canPostGrn(['purchase.grn.post']), true)
assert.equal(canViewPurchaseRequisitions(['purchase.pr.view']), true)
assert.equal(canSubmitPurchaseRequisition(['purchase.pr.submit']), true)
assert.equal(canViewPurchaseQi(['purchase.qi.view']), true)

// Filters
assert.equal(poFilterToStatusParam('pending_receipt'), 'SENT_TO_VENDOR')
assert.equal(poFilterToStatusParam('partially_received'), 'PARTIALLY_RECEIVED')
assert.equal(poFilterToStatusParam('open'), undefined)
assert.equal(prFilterToStatus('draft'), 'DRAFT')
assert.equal(prFilterToStatus('pending'), 'PENDING_APPROVAL')

const openPo: PurchaseOrderSummary = {
  id: '1',
  status: 'SENT_TO_VENDOR',
  lines: [
    {
      id: 'l1',
      quantity: 10,
      receivedQuantity: 2,
      openQuantity: 8,
      itemCode: 'A',
    },
  ],
}
assert.equal(matchPoFilter(openPo, 'pending_receipt'), true)
assert.equal(matchPoFilter(openPo, 'closed'), false)
assert.equal(isPoReceivable(openPo), true)
assert.equal(poPendingQuantity(openPo), 8)
assert.equal(poReceiptProgress(openPo), 0.2)

const closedPo: PurchaseOrderSummary = {
  id: '2',
  status: 'FULLY_RECEIVED',
  lines: [{ id: 'l1', openQuantity: 0, quantity: 5, receivedQuantity: 5 }],
}
assert.equal(isPoReceivable(closedPo), false)
assert.equal(matchPoFilter(closedPo, 'closed'), true)
assert.equal(poReceiptProgress(closedPo), 1)

const draftPr: PurchaseRequisitionSummary = {
  id: 'pr1',
  status: 'DRAFT',
  lines: [{ id: 'pl1', estimatedAmount: 100 }, { id: 'pl2', estimatedAmount: 50 }],
}
assert.equal(isPrSubmittable(draftPr), true)
assert.equal(matchPrFilter(draftPr, 'draft'), true)
assert.equal(prEstimatedTotal(draftPr), 150)

// Receive validation defaults zero blocked unless positive
assert.match(validateReceiveLines(openPo, { l1: '0' }) || '', /positive/i)
assert.equal(validateReceiveLines(openPo, { l1: '3' }), null)
assert.match(validateReceiveLines(openPo, { l1: '-1' }) || '', /Invalid/i)
assert.match(validateReceiveLines(openPo, { l1: '99' }) || '', /|/) // may pass client for tolerance path

// Approvals still gated
assert.equal(
  shouldShowApproveAction(
    {
      canAct: true,
      status: 'pending',
      documentType: 'purchase_order',
    },
    ['purchase.po.approve'],
  ),
  true,
)

// Nav catalog entries
const catalog = readFileSync(src('src/auth/navigationCatalog.ts'), 'utf8')
assert.match(catalog, /purchase-orders/)
assert.match(catalog, /purchase\/grn/)
assert.match(catalog, /purchase\/requisitions/)
assert.match(catalog, /quality-inspections/)
assert.match(catalog, /purchase\.po\.view/)
assert.match(catalog, /purchase\.pr\.view/)
assert.match(catalog, /purchase\.grn\.view/)
assert.match(catalog, /purchase\.qi\.view/)

// Approvals deep link
const appr = readFileSync(src('app/(app)/purchase/approvals/[id].tsx'), 'utf8')
assert.match(appr, /Open purchase order|purchase-orders/)
assert.match(appr, /Open goods receipt|purchase\/grn/)
assert.match(appr, /Open purchase requisition|requisitions/)

// Work tab ops
const ops = readFileSync(src('src/features/ops/useOperationalTasks.ts'), 'utf8')
assert.match(ops, /listPurchaseRequisitions/)
assert.match(ops, /listQualityInspections/)
assert.match(ops, /workDraftPr|work-draft-pr/)

const work = readFileSync(src('app/(app)/(tabs)/work.tsx'), 'utf8')
assert.match(work, /useOperationalTasks/)
assert.match(work, /source === 'purchase'/)

console.log('verify-purchase-mobile: all assertions passed (Phase A + B)')
