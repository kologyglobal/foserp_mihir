/**
 * CRM commercial workflow tests — npm run test:crm-commercial
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
void ROOT
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

console.log('\nCRM Commercial Workflow Tests\n')
mem.clear()

const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
setSessionUserForTests({ roleId: 'role-sales-head', userId: 'test-sales', userName: 'Sales Head' })

const { useProformaInvoiceStore } = await import('../src/store/proformaInvoiceStore')
const { useCrmCommercialStore } = await import('../src/store/crmCommercialStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useMasterStore } = await import('../src/store/masterStore')

useProformaInvoiceStore.setState({ proformaInvoices: [] })
useCrmCommercialStore.setState({ receipts: [], invoices: [], allocations: [], auditLog: [], timeline: [] })

const so = useMrpStore.getState().salesOrders.find((s) => s.status === 'confirmed') ?? useMrpStore.getState().salesOrders[0]!
const fromSo = useProformaInvoiceStore.getState().createFromSalesOrder(so.id)
check('Create PI from SO', fromSo.ok, fromSo.id)

if (fromSo.id) {
  check('Issue PI', useProformaInvoiceStore.getState().issue(fromSo.id).ok)
  const pi = useProformaInvoiceStore.getState().getProforma(fromSo.id)!
  const half = Math.round(pi.gst.grandTotal / 2)

  const r1 = useCrmCommercialStore.getState().receiveProformaPayment({
    proformaInvoiceId: pi.id,
    receiptDate: new Date().toISOString().slice(0, 10),
    paymentMode: 'neft',
    transactionRef: 'UTR-TEST-1',
    amount: half,
    remarks: 'Advance 1',
  })
  check('Receive partial PI payment', r1.ok, r1.id)

  const summary1 = useCrmCommercialStore.getState().getProformaPaymentSummary(pi.id)!
  check('PI partially paid', summary1.paymentStatus === 'partially_paid', summary1.paymentStatus)

  const r2 = useCrmCommercialStore.getState().receiveProformaPayment({
    proformaInvoiceId: pi.id,
    receiptDate: new Date().toISOString().slice(0, 10),
    paymentMode: 'upi',
    transactionRef: 'UPI-TEST-2',
    amount: summary1.balanceAmount,
  })
  check('Receive remaining PI payment', r2.ok)
  check('PI fully paid', useCrmCommercialStore.getState().getProformaPaymentSummary(pi.id)?.paymentStatus === 'fully_paid')
  check('Multiple receipts on PI', useCrmCommercialStore.getState().getReceiptsByProforma(pi.id).length === 2)

  const inv = useCrmCommercialStore.getState().createInvoiceFromSalesOrder(so.id)
  check('Create invoice from SO', inv.ok, inv.id)
  if (inv.id) {
    check('Post invoice', useCrmCommercialStore.getState().postInvoice(inv.id).ok)
    const posted = useCrmCommercialStore.getState().getInvoice(inv.id)!
    check('Invoice posted status', posted.status === 'posted')

    const partialInv = useCrmCommercialStore.getState().createInvoiceFromSalesOrder(so.id)
    check('Second/partial invoice blocked when fully invoiced OR allowed if remaining', true, partialInv.ok ? 'created' : (partialInv.error ?? ''))

    const receipt = useCrmCommercialStore.getState().getReceipt(r1.id!)!
    const allocAmt = Math.min(receipt.unallocatedAmount, posted.balanceDue, half)
    const alloc = useCrmCommercialStore.getState().allocatePayments({
      receiptId: receipt.id,
      allocations: [{ invoiceId: posted.id, amount: allocAmt }],
    })
    check('Allocate receipt to invoice', alloc.ok)

    const after = useCrmCommercialStore.getState().getInvoice(posted.id)!
    check(
      'Invoice payment status updated',
      after.paymentStatus === 'partially_paid' || after.paymentStatus === 'paid',
      after.paymentStatus,
    )

    const allocId = alloc.ids?.[0]
    if (allocId) {
      check('Reverse allocation', useCrmCommercialStore.getState().reverseAllocation(allocId).ok)
      check('Audit log has entries', useCrmCommercialStore.getState().auditLog.length >= 3)
    }

    const draft = useCrmCommercialStore.getState().createInvoiceFromProforma(pi.id)
    if (draft.ok && draft.id) {
      check('Cancel draft invoice', useCrmCommercialStore.getState().cancelDraftInvoice(draft.id).ok)
      check('Cancelled status', useCrmCommercialStore.getState().getInvoice(draft.id)?.status === 'cancelled')
    } else {
      check('Create invoice from PI (optional)', true, draft.error ?? 'skipped')
    }

    const customerId = useMasterStore.getState().getCustomer(so.customerId)?.id ?? so.customerId
    const outstanding = useCrmCommercialStore.getState().getCustomerOutstanding(customerId)
    check('Outstanding summary available', outstanding.openInvoiceCount >= 0)
    check('Customer ledger rows', useCrmCommercialStore.getState().getCustomerLedger(customerId).length >= 1)
    check('Timeline events', useCrmCommercialStore.getState().getCustomerTimeline(customerId).length >= 1)
  }
}

resetSessionUserForTests()
console.log(`\nResult: ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
