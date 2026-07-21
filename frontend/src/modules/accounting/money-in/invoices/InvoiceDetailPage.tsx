import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  cancelSalesInvoice,
  getSalesInvoice,
  markSalesInvoiceReady,
  postSalesInvoice,
  reverseSalesInvoice,
  validateSalesInvoice,
} from '@/services/bridges/receivablesApiBridge'
import type { SalesInvoiceDto, SalesInvoiceValidationPreview } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { invoiceDisplayNumber, moneyInStatusTone, MONEY_IN_STATUS_LABELS, parseDecimal } from '../moneyInUi'
import { PostConfirmModal } from '../components/PostConfirmModal'
import { TotalsPanel } from '../components/TotalsPanel'
import { ValidationDrawer } from '../components/ValidationDrawer'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

export function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [invoice, setInvoice] = useState<SalesInvoiceDto | null>(null)
  const [report, setReport] = useState<SalesInvoiceValidationPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [showValidate, setShowValidate] = useState(false)
  const [showPost, setShowPost] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showReverse, setShowReverse] = useState(false)
  const [reverseReason, setReverseReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      setInvoice(await getSalesInvoice(id))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canViewInvoice) void load()
  }, [load, perms.canViewInvoice])

  const runValidate = async () => {
    if (!id) return
    try {
      const r = await validateSalesInvoice(id)
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
      const updated = await markSalesInvoiceReady(id)
      setInvoice(updated)
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
      const result = await postSalesInvoice(id)
      setInvoice(result.invoice)
      setShowPost(false)
      notify.success(result.idempotentReplay ? 'Post replayed (idempotent)' : 'Invoice posted')
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
      const updated = await cancelSalesInvoice(id, cancelReason.trim())
      setInvoice(updated)
      setShowCancel(false)
      notify.success('Invoice cancelled')
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
      const result = await reverseSalesInvoice(id, reverseReason.trim(), crypto.randomUUID())
      setInvoice(result.invoice)
      setShowReverse(false)
      setReverseReason('')
      notify.success(result.idempotentReplay ? 'Reversal replayed (idempotent)' : 'Sales invoice reversed')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reverse failed')
    } finally {
      setActing(false)
    }
  }

  if (!perms.canViewInvoice) {
    return (
      <MoneyInWorkspaceShell title="Invoice">
        <p className="text-[13px] text-erp-muted">You do not have permission to view invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (loading || !invoice) {
    return (
      <MoneyInWorkspaceShell title="Invoice">
        <LoadingState variant="card" />
      </MoneyInWorkspaceShell>
    )
  }

  const actions = invoice.allowedActions
  const statusBanner =
    invoice.status === 'POSTED'
      ? actions?.reverse === false && perms.canReverseInvoice
        ? 'Posted to GL — reverse posted receipt/credit-note allocations first, then use Reverse Document.'
        : 'Posted to GL — read-only. View accounting voucher from actions.'
      : invoice.status === 'READY_TO_POST'
        ? 'Ready to post — validate then post when period is open.'
        : invoice.status === 'REVERSED'
          ? 'Reversed — a reversing voucher was posted and the invoice debit was closed. Read-only.'
          : invoice.status === 'CANCELLED'
            ? 'Cancelled — read-only.'
            : null

  return (
    <MoneyInWorkspaceShell
      title={invoiceDisplayNumber(invoice)}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canEditInvoice, actions?.edit) && (
            <ErpButton variant="secondary" icon={Pencil} onClick={() => navigate(`/accounting/money-in/invoices/${id}/edit`)}>
              Edit
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canViewInvoice, actions?.validate) && (
            <ErpButton variant="secondary" onClick={() => void runValidate()}>
              Validate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canEditInvoice, actions?.markReady) && (
            <ErpButton variant="secondary" onClick={() => void runMarkReady()} disabled={acting}>
              Mark Ready
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canPostInvoice, actions?.post) && (
            <ErpButton variant="primary" onClick={() => setShowPost(true)} disabled={acting}>
              Post
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canCancelInvoice, actions?.cancel) && (
            <ErpButton variant="ghost" onClick={() => setShowCancel(true)}>
              Cancel
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canReverseInvoice, actions?.reverse) && (
            <ErpButton variant="ghost" onClick={() => setShowReverse(true)} disabled={acting}>
              Reverse Document
            </ErpButton>
          )}
          {(invoice.status === 'POSTED' || invoice.status === 'REVERSED') && invoice.accountingVoucherId && (
            <Link to={`/accounting/ledger-entries/voucher/${invoice.accountingVoucherId}`}>
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
        <ErpStatusChip label={MONEY_IN_STATUS_LABELS[invoice.status]} tone={moneyInStatusTone(invoice.status)} />
        <span className="text-[13px] text-erp-muted">{invoice.customerNameSnapshot}</span>
        <span className="text-[13px] tabular-nums text-erp-muted">Invoice date: {invoice.invoiceDate}</span>
        {invoice.dueDate && <span className="text-[13px] tabular-nums text-erp-muted">Due: {invoice.dueDate}</span>}
      </div>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-erp-border text-erp-muted">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Rate</th>
              <th className="py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-erp-border/60">
                <td className="py-2 pr-2">{l.lineNumber}</td>
                <td className="py-2 pr-2">{l.description ?? l.itemNameSnapshot}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{l.quantity}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.unitRate))}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TotalsPanel
        subtotal={invoice.subtotalAmount}
        discount={invoice.discountAmount}
        taxable={invoice.taxableAmount}
        cgst={invoice.cgstAmount}
        sgst={invoice.sgstAmount}
        igst={invoice.igstAmount}
        freight={invoice.freightAmount}
        other={invoice.otherChargesAmount}
        roundOff={invoice.roundOffAmount}
        total={invoice.totalAmount}
      />

      {invoice.status === 'POSTED' && (
        <p className="mt-3 text-[12px] text-erp-muted">
          Outstanding: {formatCurrency(parseDecimal(invoice.outstandingAmount))} · Open item linked
        </p>
      )}

      {invoice.status === 'REVERSED' && invoice.reversalReason && (
        <p className="mt-3 text-[12px] text-erp-muted">
          Reversal reason: {invoice.reversalReason}
          {invoice.reversalVoucherId ? ` · Reversal voucher linked` : ''}
        </p>
      )}

      <ValidationDrawer open={showValidate} onClose={() => setShowValidate(false)} report={report} />
      <PostConfirmModal
        open={showPost}
        invoiceLabel={invoiceDisplayNumber(invoice)}
        totalAmount={invoice.totalAmount}
        posting={acting}
        onConfirm={() => void runPost()}
        onCancel={() => setShowPost(false)}
      />

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Cancel invoice</h3>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Reverse sales invoice</h3>
            <p className="mt-1 text-[12px] text-erp-muted">
              Posts a reversing voucher and closes the debit open item. Reverse all posted receipt and credit-note
              allocations first.
            </p>
            <Textarea
              className="mt-2"
              rows={3}
              placeholder="Reason"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowReverse(false)}>
                Close
              </ErpButton>
              <ErpButton variant="primary" onClick={() => void runReverse()} disabled={acting}>
                Confirm reverse
              </ErpButton>
            </div>
          </div>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
