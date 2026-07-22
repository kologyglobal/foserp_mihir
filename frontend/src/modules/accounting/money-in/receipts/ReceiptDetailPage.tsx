import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  cancelCustomerReceipt,
  getCustomerReceipt,
  listReceiptAllocations,
  markCustomerReceiptReady,
  postCustomerReceipt,
  reverseCustomerReceipt,
  reverseReceiptAllocation,
  validateCustomerReceipt,
} from '@/services/bridges/receivablesApiBridge'
import type { CustomerReceiptDto, CustomerReceiptValidationPreview, ReceiptAllocationHistoryRow } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { RECEIPT_STATUS_LABELS, receiptDisplayNumber, receiptStatusTone, parseDecimal } from '../moneyInUi'
import { ValidationDrawer } from '../components/ValidationDrawer'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

export function ReceiptDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [receipt, setReceipt] = useState<CustomerReceiptDto | null>(null)
  const [report, setReport] = useState<CustomerReceiptValidationPreview | null>(null)
  const [history, setHistory] = useState<ReceiptAllocationHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [showValidate, setShowValidate] = useState(false)
  const [showPost, setShowPost] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showReverse, setShowReverse] = useState(false)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseBatchId, setReverseBatchId] = useState<string | null>(null)
  const [allocReverseReason, setAllocReverseReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getCustomerReceipt(id)
      setReceipt(data)
      if (data.status === 'POSTED' && data.allowedActions?.viewAllocations) {
        try {
          setHistory(await listReceiptAllocations(id))
        } catch {
          setHistory([])
        }
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load receipt')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canViewReceipt) void load()
  }, [load, perms.canViewReceipt])

  const runValidate = async () => {
    if (!id) return
    try {
      const r = await validateCustomerReceipt(id)
      setReport(r)
      setShowValidate(true)
      if (r.valid) notify.success('Validation passed')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
    }
  }

  const runMarkReady = async () => {
    if (!id) return
    setActing(true)
    try {
      const updated = await markCustomerReceiptReady(id)
      setReceipt(updated)
      notify.success('Marked ready to post')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Mark ready failed')
    } finally {
      setActing(false)
    }
  }

  const runPost = async () => {
    if (!id) return
    setActing(true)
    try {
      const result = await postCustomerReceipt(id)
      setReceipt(result.receipt)
      setShowPost(false)
      notify.success(result.idempotentReplay ? 'Post replayed (idempotent)' : 'Customer receipt posted')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Post failed')
    } finally {
      setActing(false)
    }
  }

  const runCancel = async () => {
    if (!id || !cancelReason.trim()) {
      notify.error('Cancellation reason is required')
      return
    }
    setActing(true)
    try {
      const updated = await cancelCustomerReceipt(id, cancelReason.trim())
      setReceipt(updated)
      setShowCancel(false)
      notify.success('Customer receipt cancelled')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setActing(false)
    }
  }

  const runReverse = async () => {
    if (!id || !reverseReason.trim()) {
      notify.error('Reversal reason is required')
      return
    }
    setActing(true)
    try {
      const result = await reverseCustomerReceipt(id, reverseReason.trim(), crypto.randomUUID())
      setReceipt(result.receipt)
      setShowReverse(false)
      setReverseReason('')
      notify.success(result.idempotentReplay ? 'Reversal replayed (idempotent)' : 'Customer receipt reversed')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reverse failed')
    } finally {
      setActing(false)
    }
  }

  const runReverseAllocation = async () => {
    if (!id || !reverseBatchId || !allocReverseReason.trim()) {
      notify.error('Reversal reason is required')
      return
    }
    setActing(true)
    try {
      await reverseReceiptAllocation(id, reverseBatchId, allocReverseReason.trim(), crypto.randomUUID())
      setReverseBatchId(null)
      setAllocReverseReason('')
      notify.success('Allocation batch reversed')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Allocation reverse failed')
    } finally {
      setActing(false)
    }
  }

  if (!perms.canViewReceipt) {
    return (
      <MoneyInWorkspaceShell title="Receipt">
        <p className="text-[13px] text-erp-muted">You do not have permission to view customer receipts.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (loading || !receipt) {
    return (
      <MoneyInWorkspaceShell title="Receipt">
        <LoadingState variant="card" />
      </MoneyInWorkspaceShell>
    )
  }

  const actions = receipt.allowedActions
  const statusBanner =
    receipt.status === 'POSTED'
      ? 'Posted to GL — read-only. Allocate against open invoices or view the accounting voucher.'
      : receipt.status === 'READY_TO_POST'
        ? 'Ready to post — validate then post when the period is open.'
        : receipt.status === 'CANCELLED'
          ? 'Cancelled — read-only.'
          : receipt.status === 'REVERSED'
            ? 'Reversed — a reversing voucher was posted and the receipt credit was closed. Read-only.'
            : null

  return (
    <MoneyInWorkspaceShell
      title={receiptDisplayNumber(receipt)}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canEditReceipt, actions?.edit) && (
            <ErpButton variant="secondary" icon={Pencil} onClick={() => navigate(`/accounting/money-in/receipts/${id}/edit`)}>
              Edit
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canViewReceipt, actions?.validate) && (
            <ErpButton variant="secondary" onClick={() => void runValidate()}>
              Validate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canEditReceipt, actions?.markReady) && (
            <ErpButton variant="secondary" onClick={() => void runMarkReady()} disabled={acting}>
              Mark Ready
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canPostReceipt, actions?.post) && (
            <ErpButton variant="primary" onClick={() => setShowPost(true)} disabled={acting}>
              Post
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canCancelReceipt, actions?.cancel) && (
            <ErpButton variant="ghost" onClick={() => setShowCancel(true)}>
              Cancel
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canAllocate, actions?.allocate) && (
            <ErpButton variant="primary" onClick={() => navigate(`/accounting/money-in/receipts/${id}/allocate`)}>
              Allocate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canReverseReceipt, actions?.reverse) && (
            <ErpButton variant="ghost" onClick={() => setShowReverse(true)} disabled={acting}>
              Reverse Document
            </ErpButton>
          )}
          {(receipt.status === 'POSTED' || receipt.status === 'REVERSED') && receipt.accountingVoucherId && (
            <Link to={`/accounting/ledger-entries/voucher/${receipt.accountingVoucherId}`}>
              <ErpButton variant="secondary">View Accounting</ErpButton>
            </Link>
          )}
        </div>
      }
    >
      {statusBanner && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">{statusBanner}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ErpStatusChip label={RECEIPT_STATUS_LABELS[receipt.status]} tone={receiptStatusTone(receipt.status)} />
        <span className="text-[13px] text-erp-muted">{receipt.customerNameSnapshot}</span>
        <span className="text-[13px] text-erp-muted">{receipt.paymentMethod.replace(/_/g, ' ')}</span>
        <span className="text-[13px] tabular-nums text-erp-muted">Receipt date: {receipt.receiptDate}</span>
        {receipt.paymentMethod === 'CHEQUE' && receipt.chequeNumber && (
          <span className="text-[13px] text-erp-muted">Cheque: {receipt.chequeNumber} ({receipt.chequeDate})</span>
        )}
        {receipt.transactionReference && (
          <span className="text-[13px] text-erp-muted">Txn ref: {receipt.transactionReference}</span>
        )}
      </div>

      <div className="rounded border border-erp-border bg-slate-50 p-3">
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Amounts</h3>
        <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
          <div>
            <dt className="text-erp-muted">Bank/cash amount</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(receipt.bankCashAmount))}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Customer TDS</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(receipt.customerTdsAmount))}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Bank charges</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(receipt.bankChargeAmount))}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Other deductions</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(receipt.otherDeductionAmount))}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Gross receipt amount</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(parseDecimal(receipt.grossReceiptAmount))}</dd>
          </div>
        </dl>
        {receipt.narration && <p className="mt-3 text-[12px] text-erp-muted">Narration: {receipt.narration}</p>}
      </div>

      {receipt.status === 'POSTED' && (
        <div className="mt-4 rounded border border-erp-border bg-slate-50 p-3">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Allocation</h3>
          <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
            <div>
              <dt className="text-erp-muted">Allocatable</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(receipt.allocatableAmount))}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Allocated</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(receipt.allocatedAmount))}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Unallocated (customer advance)</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(receipt.unallocatedAmount))}</dd>
            </div>
          </dl>

          {actions?.viewAllocations && history.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Allocation history</h4>
              <table className="w-full min-w-[560px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-erp-border text-erp-muted">
                    <th className="py-1.5 pr-2">Date</th>
                    <th className="py-1.5 pr-2">Invoice</th>
                    <th className="py-1.5 pr-2 text-right">Amount</th>
                    <th className="py-1.5 pr-2 text-right">Invoice outstanding after</th>
                    <th className="py-1.5 pr-2">Status</th>
                    {perms.canReverseAllocation && <th className="py-1.5">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.allocationId} className="border-b border-erp-border/60">
                      <td className="py-1.5 pr-2 tabular-nums">{row.allocationDate}</td>
                      <td className="py-1.5 pr-2">{row.invoiceNumber ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(row.allocatedAmount))}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {row.invoiceOutstandingAfter ? formatCurrency(parseDecimal(row.invoiceOutstandingAfter)) : '—'}
                      </td>
                      <td className="py-1.5 pr-2">{row.status}</td>
                      {perms.canReverseAllocation && (
                        <td className="py-1.5">
                          {row.status === 'POSTED' && row.batchId && (
                            <button
                              type="button"
                              className="text-[12px] font-medium text-rose-700 hover:underline"
                              onClick={() => {
                                setReverseBatchId(row.batchId)
                                setAllocReverseReason('')
                              }}
                              disabled={acting}
                            >
                              Reverse batch
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ValidationDrawer open={showValidate} onClose={() => setShowValidate(false)} report={report} />

      {showPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-5 shadow-lg">
            <h2 className="text-[15px] font-semibold text-erp-text">Post customer receipt?</h2>
            <p className="mt-2 text-[13px] text-erp-muted">
              Posting <strong>{receiptDisplayNumber(receipt)}</strong> for{' '}
              <strong>₹{Number(receipt.grossReceiptAmount).toLocaleString('en-IN')}</strong> will create a system
              voucher, GL entries, and a credit open item that can be allocated to open invoices. If needed later, a
              posted receipt can be reversed (after reversing any allocations), which posts a reversing voucher.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowPost(false)} disabled={acting}>
                Cancel
              </ErpButton>
              <ErpButton variant="primary" onClick={() => void runPost()} disabled={acting}>
                {acting ? 'Posting…' : 'Post to GL'}
              </ErpButton>
            </div>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Cancel customer receipt</h3>
            <Textarea className="mt-2" rows={3} placeholder="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowCancel(false)}>
                Close
              </ErpButton>
              <ErpButton variant="primary" onClick={() => void runCancel()} disabled={acting}>
                Confirm cancel
              </ErpButton>
            </div>
          </div>
        </div>
      )}

      {showReverse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-5 shadow-lg">
            <h3 className="text-[15px] font-semibold text-erp-text">Reverse customer receipt?</h3>
            <p className="mt-2 text-[13px] text-erp-muted">
              Reversing <strong>{receiptDisplayNumber(receipt)}</strong> posts a reversing voucher, closes the receipt
              credit open item, and marks the receipt REVERSED. All posted allocations must be reversed first.
            </p>
            <Textarea
              className="mt-3"
              rows={3}
              placeholder="Reason for reversal"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowReverse(false)} disabled={acting}>
                Close
              </ErpButton>
              <ErpButton variant="primary" onClick={() => void runReverse()} disabled={acting}>
                {acting ? 'Reversing…' : 'Reverse to GL'}
              </ErpButton>
            </div>
          </div>
        </div>
      )}

      {reverseBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-5 shadow-lg">
            <h3 className="text-[15px] font-semibold text-erp-text">Reverse allocation batch?</h3>
            <p className="mt-2 text-[13px] text-erp-muted">
              This restores invoice outstanding balances and the receipt&apos;s unallocated advance. No GL entries are
              created (subledger-only).
            </p>
            <Textarea
              className="mt-3"
              rows={3}
              placeholder="Reason for reversal"
              value={allocReverseReason}
              onChange={(e) => setAllocReverseReason(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setReverseBatchId(null)} disabled={acting}>
                Close
              </ErpButton>
              <ErpButton variant="primary" onClick={() => void runReverseAllocation()} disabled={acting}>
                {acting ? 'Reversing…' : 'Reverse batch'}
              </ErpButton>
            </div>
          </div>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
