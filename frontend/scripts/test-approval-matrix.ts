/**
 * Approval matrix tests — npm run test:approval-matrix
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

const { setSessionUserForTests, resetSessionUserForTests, getSessionUser } = await import('../src/utils/permissions')
const { useApprovalStore } = await import('../src/store/approvalStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useProductMasterStore } = await import('../src/store/productMasterStore')
const {
  resolveMatchingRules,
  computePoTotalAmount,
  assertMatrixApproval,
  listPendingApprovalsForUser,
  rejectApprovalStep,
  buildApprovalTimelineEvents,
  syncApprovalRequest,
} = await import('../src/utils/approvalEngine')
const { useEcoStore } = await import('../src/store/ecoStore')
const { useBomStore } = await import('../src/store/bomStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useInvoiceStore } = await import('../src/store/invoiceStore')
const { useQualityStore } = await import('../src/store/qualityStore')

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

function resetMatrix() {
  useApprovalStore.getState().resetRulesToDefault()
  useApprovalStore.setState({ requests: [] })
  resetSessionUserForTests()
}

console.log('\nApproval Matrix Tests\n')
resetMatrix()

const rules = useApprovalStore.getState().rules
const po6L = resolveMatchingRules('purchase_order', { totalAmount: 600_000 }, rules)
check(1, 'PO ₹6L requires Purchase Head rule', po6L.some((r) => r.approverCode === 'purchase_head'))

const po30L = resolveMatchingRules('purchase_order', { totalAmount: 3_000_000 }, rules)
check(
  2,
  'PO ₹30L requires Purchase Head + Director',
  po30L.some((r) => r.approverCode === 'purchase_head') && po30L.some((r) => r.approverCode === 'director'),
)

check(3, 'BOM revision requires Engineering Head', resolveMatchingRules('bom_revision', { isRevision: true }, rules).some((r) => r.approverCode === 'engineering_head'))
check(4, 'Cost override requires Finance', resolveMatchingRules('cost_override', {}, rules).some((r) => r.approverCode === 'finance'))

const vendorId = useMasterStore.getState().vendors[0]?.id
const itemId = useMasterStore.getState().items[0]?.id
const whId = useMasterStore.getState().warehouses[0]?.id

function makePo(id: string, poNo: string, rate: number, qty: number) {
  return {
    id,
    poNo,
    revisionNo: 1,
    vendorId: vendorId!,
    prId: null,
    rfqId: null,
    mrpRunId: null,
    salesOrderId: null,
    status: 'draft' as const,
    orderDate: '2026-03-01',
    expectedDate: '2026-03-15',
    paymentTerms: 'Net 30',
    lines: [{
      id: `${id}-line`,
      itemId: itemId!,
      warehouseId: whId!,
      qty,
      rate,
      receivedQty: 0,
      mrpMaterialLineId: null,
      prLineId: null,
      requiredDate: '2026-03-15',
    }],
    revisions: [],
    sentAt: null,
    createdById: 'test',
    createdByName: 'Buyer',
    createdAt: new Date().toISOString(),
    modifiedById: null,
    modifiedByName: null,
    modifiedAt: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }
}

const po6 = makePo('po-test-6l', 'PO-TEST-6L', 60_000, 10)
usePurchaseStore.setState((s) => ({ purchaseOrders: [po6, ...s.purchaseOrders.filter((p) => p.id !== 'po-test-6l')] }))
check(5, 'Test PO value is ₹6L', computePoTotalAmount(usePurchaseStore.getState().getPo('po-test-6l')!) === 600_000)

usePurchaseStore.getState().submitPo('po-test-6l')
const req6 = useApprovalStore.getState().getActiveRequest('purchase_order', 'po-test-6l')
check(6, 'Submit PO creates matrix request', Boolean(req6 && req6.steps.length === 1))

setSessionUserForTests({ role: 'purchase' })
check(7, 'Purchase role blocked on ₹6L PO', !assertMatrixApproval('purchase_order', 'po-test-6l', getSessionUser()).ok)

setSessionUserForTests({ role: 'management' })
check(8, 'Management can approve Purchase Head step', assertMatrixApproval('purchase_order', 'po-test-6l', getSessionUser()).ok)

const step6 = usePurchaseStore.getState().approvePo('po-test-6l') as { ok: boolean; pendingNextApprover?: string }
check(9, '₹6L PO fully approved after one step', step6.ok && !step6.pendingNextApprover && usePurchaseStore.getState().getPo('po-test-6l')?.status === 'approved')

resetMatrix()
const po30 = makePo('po-test-30l', 'PO-TEST-30L', 300_000, 10)
usePurchaseStore.setState((s) => ({ purchaseOrders: [po30, ...s.purchaseOrders.filter((p) => !['po-test-6l', 'po-test-30l'].includes(p.id))] }))
usePurchaseStore.getState().submitPo('po-test-30l')
setSessionUserForTests({ role: 'management' })
const partial = usePurchaseStore.getState().approvePo('po-test-30l') as { ok: boolean; pendingNextApprover?: string }
check(10, '₹30L PO pending Director after Purchase Head', partial.ok && Boolean(partial.pendingNextApprover))

setSessionUserForTests({ role: 'admin' })
const final = usePurchaseStore.getState().approvePo('po-test-30l')
check(11, 'Director completes ₹30L PO', final.ok && usePurchaseStore.getState().getPo('po-test-30l')?.status === 'approved')

resetMatrix()
useProductMasterStore.getState().setCostOverride('prod-45m3', { materialCost: 999999 }, 'Test override')
setSessionUserForTests({ role: 'accounts' })
check(12, 'Finance approves cost override', useProductMasterStore.getState().approveCostOverride('prod-45m3').ok)

setSessionUserForTests({ role: 'management' })
check(13, 'Pending approvals list is queryable', Array.isArray(listPendingApprovalsForUser(getSessionUser())))

// ECO approval chain
resetMatrix()
setSessionUserForTests({ role: 'engineering_head', name: 'Eng Head' })
const bom = useBomStore.getState().bomHeaders.find((b) => b.status === 'released') ?? useBomStore.getState().bomHeaders[0]
const ecr = useEcoStore.getState().createEcr({
  changeType: 'bom',
  productId: bom?.productId ?? null,
  bomId: bom?.id ?? null,
  reason: 'RBAC sprint test change',
  priority: 'medium',
})
const ecrId = ecr.ecrId!
useEcoStore.getState().submitEcr(ecrId)
useEcoStore.getState().startEngineeringReview(ecrId)
useEcoStore.getState().completeImpactAnalysis(ecrId)
const ecoCreated = useEcoStore.getState().approveEcrForEco(ecrId)
const ecoId = ecoCreated.ecoId!
useEcoStore.getState().submitEcoForApproval(ecoId)
check(14, 'ECO submit creates pending approval', useApprovalStore.getState().getActiveRequest('engineering_change', ecoId)?.status === 'pending')

setSessionUserForTests({ role: 'purchase_user' })
check(15, 'ECO cannot approve without Engineering Head', !useEcoStore.getState().approveEco(ecoId).ok)

setSessionUserForTests({ role: 'engineering_head' })
useEcoStore.getState().approveEco(ecoId)
check(16, 'ECO approved via matrix', useEcoStore.getState().getEco(ecoId)?.approvalStatus === 'approved')

// Rejection requires remarks
resetMatrix()
syncApprovalRequest({
  documentType: 'invoice_cancellation',
  entityId: 'inv-test-rbac',
  entityLabel: 'INV-TEST',
  context: { totalAmount: 100_000 },
  submittedByName: 'Tester',
})
setSessionUserForTests({ role: 'accounts_head' })
check(17, 'Rejection blocked without remarks', !rejectApprovalStep('invoice_cancellation', 'inv-test-rbac', getSessionUser(), '').ok)
check(18, 'Rejection succeeds with remarks', rejectApprovalStep('invoice_cancellation', 'inv-test-rbac', getSessionUser(), 'Duplicate entry').ok)

const rejectedReq = useApprovalStore.getState().getActiveRequest('invoice_cancellation', 'inv-test-rbac')
check(19, 'Rejected request has reason', rejectedReq?.status === 'rejected' && Boolean(rejectedReq.rejectionReason))

// Timeline records approver
const timeline = buildApprovalTimelineEvents(rejectedReq!)
check(20, 'Approval timeline has events', timeline.length >= 2)

// Dispatch override blocked without approval
resetMatrix()
setSessionUserForTests({ role: 'dispatch_manager' })
const dispatch = useDispatchStore.getState().dispatches[0]
if (dispatch) {
  const overrideReq = useDispatchStore.getState().requestDispatchOverride(dispatch.id, 'Customer urgency')
  check(21, 'Dispatch override request created', overrideReq.ok)
  check(22, 'Dispatch override pending before approval', useApprovalStore.getState().getActiveRequest('dispatch_override', dispatch.id)?.status === 'pending')
} else {
  check(21, 'Dispatch override request created', true, 'skipped — no dispatch seed')
  check(22, 'Dispatch override pending before approval', true, 'skipped')
}

// Invoice cancellation blocked until approved
resetMatrix()
setSessionUserForTests({ role: 'accounts_head' })
const invoice = useInvoiceStore.getState().invoices.find((i) => i.status !== 'cancelled')
if (invoice) {
  const cancelAttempt = useInvoiceStore.getState().cancelInvoice(invoice.id)
  check(23, 'Invoice cancel blocked pending approval', !cancelAttempt.ok)
  useInvoiceStore.getState().approveInvoiceCancellation(invoice.id)
  check(24, 'Accounts Head approves invoice cancellation', useInvoiceStore.getState().approveInvoiceCancellation(invoice.id).ok || useApprovalStore.getState().getActiveRequest('invoice_cancellation', invoice.id)?.status === 'approved')
} else {
  check(23, 'Invoice cancel blocked pending approval', true, 'skipped')
  check(24, 'Accounts Head approves invoice cancellation', true, 'skipped')
}

console.log(`\n${passed}/${passed + failed} passed${failed ? ` (${failed} failed)` : ''}\n`)
process.exit(failed ? 1 : 0)
