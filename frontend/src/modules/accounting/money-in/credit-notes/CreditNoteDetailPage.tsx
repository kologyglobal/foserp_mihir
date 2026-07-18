import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  approveCustomerCreditNote,
  cancelCustomerCreditNote,
  getCustomerCreditNote,
  listCreditNoteAllocations,
  markCustomerCreditNoteReady,
  postCustomerCreditNote,
  rejectCustomerCreditNote,
  submitCustomerCreditNote,
  validateCustomerCreditNote,
} from '@/services/bridges/receivablesApiBridge'
import type { CreditNoteAllocationHistoryRow, CreditNoteValidationPreview, CustomerCreditNoteDto } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { CREDIT_NOTE_STATUS_LABELS, creditNoteDisplayNumber, creditNoteStatusTone, parseDecimal } from '../moneyInUi'
import { TotalsPanel } from '../components/TotalsPanel'
import { ValidationDrawer } from '../components/ValidationDrawer'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

export function CreditNoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [note, setNote] = useState<CustomerCreditNoteDto | null>(null)
  const [report, setReport] = useState<CreditNoteValidationPreview | null>(null)
  const [history, setHistory] = useState<CreditNoteAllocationHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [showValidate, setShowValidate] = useState(false)
  const [showPost, setShowPost] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [comments, setComments] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getCustomerCreditNote(id)
      setNote(data)
      if (data.status === 'POSTED' && data.allowedActions?.viewAllocations) {
        try {
          setHistory(await listCreditNoteAllocations(id))
        } catch {
          setHistory([])
        }
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load credit note')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canViewCreditNote) void load()
  }, [load, perms.canViewCreditNote])

  const runValidate = async () => {
    if (!id) return
    try {
      const r = await validateCustomerCreditNote(id)
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
      const updated = await markCustomerCreditNoteReady(id)
      setNote(updated)
      notify.success('Marked ready to post')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Mark ready failed')
    } finally {
      setActing(false)
    }
  }

  const runSubmit = async () => {
    if (!id) return
    setActing(true)
    try {
      const updated = await submitCustomerCreditNote(id, comments.trim() || undefined)
      setNote(updated)
      setComments('')
      notify.success('Submitted for approval')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setActing(false)
    }
  }

  const runApprove = async () => {
    if (!id) return
    setActing(true)
    try {
      const updated = await approveCustomerCreditNote(id, comments.trim() || undefined)
      setNote(updated)
      setComments('')
      notify.success('Credit note approved — ready to post')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setActing(false)
    }
  }

  const runReject = async () => {
    if (!id) return
    setActing(true)
    try {
      const updated = await rejectCustomerCreditNote(id, comments.trim() || undefined)
      setNote(updated)
      setComments('')
      setShowReject(false)
      notify.success('Credit note rejected')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setActing(false)
    }
  }

  const runPost = async () => {
    if (!id) return
    setActing(true)
    try {
      const result = await postCustomerCreditNote(id)
      setNote(result.creditNote)
      setShowPost(false)
      notify.success(result.idempotentReplay ? 'Post replayed (idempotent)' : 'Credit note posted')
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
      const updated = await cancelCustomerCreditNote(id, cancelReason.trim())
      setNote(updated)
      setShowCancel(false)
      notify.success('Credit note cancelled')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setActing(false)
    }
  }

  if (!perms.canViewCreditNote) {
    return (
      <MoneyInWorkspaceShell title="Credit Note">
        <p className="text-[13px] text-erp-muted">You do not have permission to view credit notes.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (loading || !note) {
    return (
      <MoneyInWorkspaceShell title="Credit Note">
        <LoadingState variant="card" />
      </MoneyInWorkspaceShell>
    )
  }

  const actions = note.allowedActions
  const statusBanner =
    note.status === 'POSTED'
      ? 'Posted to GL — read-only. View accounting voucher from actions.'
      : note.status === 'READY_TO_POST'
        ? 'Ready to post — validate then post when period is open.'
        : note.status === 'PENDING_APPROVAL'
          ? 'Pending approval — awaiting an approver decision.'
          : note.status === 'REJECTED'
            ? 'Rejected — edit and resubmit, or cancel.'
            : null

  return (
    <MoneyInWorkspaceShell
      title={creditNoteDisplayNumber(note)}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canEditCreditNote, actions?.edit) && (
            <ErpButton variant="secondary" icon={Pencil} onClick={() => navigate(`/accounting/money-in/credit-notes/${id}/edit`)}>
              Edit
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canViewCreditNote, actions?.validate) && (
            <ErpButton variant="secondary" onClick={() => void runValidate()}>
              Validate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canMarkReadyCreditNote, actions?.markReady) && (
            <ErpButton variant="secondary" onClick={() => void runMarkReady()} disabled={acting}>
              Mark Ready
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canSubmitCreditNote, actions?.submit) && (
            <ErpButton variant="secondary" onClick={() => void runSubmit()} disabled={acting}>
              Submit for approval
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canApproveCreditNote, actions?.approve) && (
            <ErpButton variant="secondary" onClick={() => void runApprove()} disabled={acting}>
              Approve
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canApproveCreditNote, actions?.reject) && (
            <ErpButton variant="ghost" onClick={() => setShowReject(true)} disabled={acting}>
              Reject
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canPostCreditNote, actions?.post) && (
            <ErpButton variant="primary" onClick={() => setShowPost(true)} disabled={acting}>
              Post
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canCancelCreditNote, actions?.cancel) && (
            <ErpButton variant="ghost" onClick={() => setShowCancel(true)}>
              Cancel
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canAllocate, actions?.allocate) && (
            <ErpButton variant="primary" onClick={() => navigate(`/accounting/money-in/credit-notes/${id}/allocate`)}>
              Allocate
            </ErpButton>
          )}
          {note.status === 'POSTED' && note.accountingVoucherId && (
            <Link to={`/accounting/vouchers/${note.accountingVoucherId}`}>
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
        <ErpStatusChip label={CREDIT_NOTE_STATUS_LABELS[note.status]} tone={creditNoteStatusTone(note.status)} />
        <span className="text-[13px] text-erp-muted">{note.customerNameSnapshot}</span>
        <span className="text-[13px] text-erp-muted">{note.purpose.replace(/_/g, ' ')}</span>
        <span className="text-[13px] tabular-nums text-erp-muted">Credit note date: {note.creditNoteDate}</span>
        {note.sourceType === 'SALES_INVOICE' && note.originalInvoiceNumberSnapshot && (
          <span className="text-[13px] text-erp-muted">Against invoice: {note.originalInvoiceNumberSnapshot}</span>
        )}
      </div>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-erp-border text-erp-muted">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2">Adjustment</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Rate</th>
              <th className="py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {(note.lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-erp-border/60">
                <td className="py-2 pr-2">{l.lineNumber}</td>
                <td className="py-2 pr-2">{l.description ?? l.itemNameSnapshot}</td>
                <td className="py-2 pr-2">{l.adjustmentMode.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{l.quantity}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.unitRate))}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TotalsPanel
        taxable={note.taxableAmount}
        cgst={note.cgstAmount}
        sgst={note.sgstAmount}
        igst={note.igstAmount}
        freight={note.freightAmount}
        other={note.otherChargesAmount}
        roundOff={note.roundOffAmount}
        total={note.grandTotal}
      />

      {note.status === 'POSTED' && (
        <div className="mt-4 rounded border border-erp-border bg-slate-50 p-3">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Allocation</h3>
          <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
            <div>
              <dt className="text-erp-muted">Allocatable</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(note.allocatableAmount))}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Allocated</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(note.allocatedAmount))}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Unallocated (customer advance)</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(note.unallocatedAmount))}</dd>
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
                    <th className="py-1.5">Status</th>
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
                      <td className="py-1.5">{row.status}</td>
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
            <h2 className="text-[15px] font-semibold text-erp-text">Post credit note?</h2>
            <p className="mt-2 text-[13px] text-erp-muted">
              Posting <strong>{creditNoteDisplayNumber(note)}</strong> for{' '}
              <strong>₹{Number(note.grandTotal).toLocaleString('en-IN')}</strong> will create a system voucher, GL
              entries, and a credit open item that can be allocated to open invoices. This action cannot be undone
              from Money In.
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

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Reject credit note</h3>
            <Textarea className="mt-2" rows={3} placeholder="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowReject(false)}>
                Close
              </ErpButton>
              <ErpButton variant="primary" onClick={() => void runReject()} disabled={acting}>
                Confirm reject
              </ErpButton>
            </div>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Cancel credit note</h3>
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
    </MoneyInWorkspaceShell>
  )
}
