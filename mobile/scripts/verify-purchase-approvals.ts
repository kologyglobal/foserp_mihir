/**
 * Purchase approval client helpers (no network).
 * Run: npx tsx scripts/verify-purchase-approvals.ts
 */
import assert from 'node:assert/strict'
import {
  buildApproveBody,
  buildRejectBody,
  canAccessPurchaseApprovals,
  canApprovePurchaseDocument,
  canRejectPurchaseDocument,
  shouldShowApproveAction,
  shouldShowRejectAction,
  type PurchaseApprovalQueueRow,
} from '../src/features/purchase/api.ts'

// Access — view queue
assert.equal(canAccessPurchaseApprovals(['purchase.pr.view']), true)
assert.equal(canAccessPurchaseApprovals(['purchase.po.approve']), true)
assert.equal(canAccessPurchaseApprovals(['crm.lead.view']), false)
assert.equal(canAccessPurchaseApprovals([]), false)

// Act perms
assert.equal(canApprovePurchaseDocument('purchase_requisition', ['purchase.pr.approve']), true)
assert.equal(canApprovePurchaseDocument('purchase_requisition', ['purchase.pr.view']), false)
assert.equal(canApprovePurchaseDocument('purchase_order', ['purchase.po.approve']), true)
assert.equal(
  canApprovePurchaseDocument('goods_receipt_note', ['purchase.grn.post']),
  true,
)
assert.equal(
  canApprovePurchaseDocument('goods_receipt_note', ['purchase.po.approve']),
  true,
)
assert.equal(
  canApprovePurchaseDocument('goods_receipt_note', ['purchase.grn.view']),
  false,
)

assert.equal(canRejectPurchaseDocument('purchase_requisition', ['purchase.pr.reject']), true)
assert.equal(canRejectPurchaseDocument('purchase_order', ['purchase.po.approve']), true)

// canAct + pending gates
const pendingPr: PurchaseApprovalQueueRow = {
  approvalId: 'a1',
  documentType: 'purchase_requisition',
  documentTypeLabel: 'PR',
  documentId: 'd1',
  documentNumber: 'PR-1',
  requestedBy: 'Ada',
  amount: 1000,
  status: 'pending',
  canAct: true,
}
assert.equal(shouldShowApproveAction(pendingPr, ['purchase.pr.approve']), true)
assert.equal(shouldShowApproveAction({ ...pendingPr, canAct: false }, ['purchase.pr.approve']), false)
assert.equal(shouldShowApproveAction({ ...pendingPr, status: 'approved' }, ['purchase.pr.approve']), false)
assert.equal(shouldShowRejectAction(pendingPr, ['purchase.pr.reject']), true)

// Bodies
assert.deepEqual(buildApproveBody(), { remarks: 'Approved from mobile' })
assert.deepEqual(buildApproveBody('  ok  '), { remarks: 'ok' })
assert.deepEqual(buildRejectBody('purchase_requisition', 'bad numbers'), {
  reason: 'bad numbers',
  remarks: 'bad numbers',
})
assert.deepEqual(buildRejectBody('purchase_order', 'over budget'), {
  reason: 'over budget',
  remarks: 'over budget',
})
assert.deepEqual(buildRejectBody('goods_receipt_note', 'qty wrong'), { remarks: 'qty wrong' })
assert.throws(() => buildRejectBody('purchase_order', '   '), /mandatory/i)

// tenant.manage wildcards through can()
assert.equal(canApprovePurchaseDocument('purchase_order', ['tenant.manage']), true)
assert.equal(canAccessPurchaseApprovals(['tenant.manage']), true)

console.log('verify-purchase-approvals: all assertions passed')
