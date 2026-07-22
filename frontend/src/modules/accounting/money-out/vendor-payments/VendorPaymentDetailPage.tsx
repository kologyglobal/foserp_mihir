import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  approveVendorPayment,
  cancelVendorPayment,
  getVendorPayment,
  getVendorPaymentApproval,
  listVendorPaymentAllocations,
  markVendorPaymentReady,
  postVendorPayment,
  rejectVendorPayment,
  reviseVendorPayment,
  submitVendorPayment,
  validateVendorPayment,
} from '@/services/bridges/payablesApiBridge'
import type {
  PayableAllocationHistoryRow,
  PostVendorPaymentResult,
  VendorPaymentApprovalDetail,
  VendorPaymentDto,
} from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { VendorPaymentTotalsPanel } from '../components/VendorPaymentTotalsPanel'
import { VendorPaymentPositionPanel } from '../components/VendorPaymentPositionPanel'
import { VendorPaymentAccountingPreviewTable } from '../components/VendorPaymentAccountingPreview'
import { VendorPaymentOpenItemSummary } from '../components/VendorPaymentOpenItemSummary'
import { VendorPaymentPostConfirmModal } from '../components/VendorPaymentPostConfirmModal'
import { PayableAllocationHistoryTable } from '../components/PayableAllocationHistoryTable'
import {
  MONEY_OUT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_PURPOSE_LABELS,
  moneyOutStatusTone,
  parseDecimal,
  vendorPaymentDisplayNumber,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

type DetailTab = 'overview' | 'adjustments' | 'validation' | 'approval' | 'accounting' | 'allocation'

export function VendorPaymentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [payment, setPayment] = useState<VendorPaymentDto | null>(null)
  const [approval, setApproval] = useState<VendorPaymentApprovalDetail | null>(null)
  const [history, setHistory] = useState<PayableAllocationHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [showPost, setShowPost] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showRevise, setShowRevise] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [reason, setReason] = useState('')
  const [comments, setComments] = useState('')
  const [postResult, setPostResult] = useState<PostVendorPaymentResult | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const pmt = await getVendorPayment(id)
      setPayment(pmt)
      if (pmt.approvalRequestId || pmt.status === 'PENDING_APPROVAL' || pmt.status === 'REJECTED') {
        try {
          setApproval(await getVendorPaymentApproval(id))
        } catch {
          setApproval(null)
        }
      }
      if (pmt.status === 'POSTED' && pmt.allowedActions?.viewPayableOpenItem) {
        try {
          setHistory(await listVendorPaymentAllocations(id))
        } catch {
          setHistory([])
        }
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load vendor payment')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canViewPayment && isApiMode()) void load()
  }, [load, perms.canViewPayment])

  const withActing = async (fn: () => Promise<void>) => {
    setActing(true)
    try {
      await fn()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(false)
    }
  }

  const runValidate = () =>
    void withActing(async () => {
      if (!id) return
      const updated = await validateVendorPayment(id)
      setPayment(updated)
      notify.success(updated.validation?.isValid ? 'Validation passed' : 'Validation completed with issues')
    })

  const runSubmit = () =>
    void withActing(async () => {
      if (!id || !payment) return
      const updated = await submitVendorPayment(id, payment.updatedAt, comments.trim() || undefined)
      setPayment(updated)
      setShowSubmit(false)
      setComments('')
      notify.success('Submitted for approval')
      await load()
    })

  const runMarkReady = () =>
    void withActing(async () => {
      if (!id || !payment) return
      const updated = await markVendorPaymentReady(id, payment.updatedAt)
      setPayment(updated)
      notify.success('Marked ready to post')
    })

  const runApprove = () =>
    void withActing(async () => {
      if (!id || !payment) return
      const updated = await approveVendorPayment(id, payment.updatedAt, comments.trim() || undefined)
      setPayment(updated)
      setComments('')
      notify.success('Approved')
      await load()
    })

  const runReject = () => {
    if (!reason.trim()) {
      notify.error('Rejection reason is required')
      return
    }
    void withActing(async () => {
      if (!id || !payment) return
      const updated = await rejectVendorPayment(id, reason.trim(), payment.updatedAt)
      setPayment(updated)
      setShowReject(false)
      setReason('')
      notify.success('Rejected — revise before resubmission')
      await load()
    })
  }

  const runRevise = () => {
    if (!reason.trim()) {
      notify.error('Revision reason is required')
      return
    }
    void withActing(async () => {
      if (!id || !payment) return
      const updated = await reviseVendorPayment(id, reason.trim(), payment.updatedAt)
      setShowRevise(false)
      setReason('')
      notify.success('Returned to Draft')
      navigate(`/accounting/money-out/vendor-payments/${updated.id}/edit`)
    })
  }

  const runCancel = () => {
    if (!reason.trim()) {
      notify.error('Cancellation reason is required')
      return
    }
    void withActing(async () => {
      if (!id || !payment) return
      const updated = await cancelVendorPayment(id, reason.trim(), payment.updatedAt)
      setPayment(updated)
      setShowCancel(false)
      setReason('')
      notify.success('Payment cancelled')
    })
  }

  const runPost = () =>
    void withActing(async () => {
      if (!id || !payment) return
      try {
        const result = await postVendorPayment(id, payment.updatedAt)
        setPostResult(result)
        setShowPost(false)
        if (result.idempotentReplay) {
          notify.success('This payment was already posted. The existing posting result has been loaded.')
        } else {
          notify.success(`Posted — ${result.vendorPaymentNumber}`)
        }
        await load()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Post failed'
        if (msg.includes('changed by another user')) void load()
        throw e
      }
    })

  if (!perms.canViewPayment) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Payment">
        <p className="text-[13px] text-erp-muted">You do not have permission to view vendor payments.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Payment">
        <p className="text-[13px] text-erp-muted">Vendor payments require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading || !payment) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Payment">
        <LoadingState variant="card" />
      </MoneyOutWorkspaceShell>
    )
  }

  const actions = payment.allowedActions
  const statusBanner =
    payment.status === 'POSTED'
      ? 'Posted to GL — read-only. Allocate the payment against invoices below (allocation creates no GL).'
      : payment.status === 'READY_TO_POST'
        ? 'Ready to post — posting creates a voucher, GL and a DEBIT payment open item.'
        : payment.status === 'PENDING_APPROVAL'
          ? 'Pending approval — editing is disabled until approve, reject, or revise.'
          : payment.status === 'REJECTED'
            ? 'Rejected — revise to return to Draft before resubmission.'
            : payment.status === 'CANCELLED'
              ? 'Cancelled — retained for audit history.'
              : null

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'adjustments', label: 'Adjustments' },
    { id: 'validation', label: 'Validation' },
    { id: 'approval', label: 'Approval' },
    { id: 'accounting', label: 'Accounting' },
    { id: 'allocation', label: 'Allocation' },
  ]

  return (
    <MoneyOutWorkspaceShell
      title={vendorPaymentDisplayNumber(payment)}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canEditPayment, actions?.edit) && (
            <ErpButton
              variant="secondary"
              icon={Pencil}
              onClick={() => navigate(`/accounting/money-out/vendor-payments/${id}/edit`)}
            >
              Edit
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canViewPayment, actions?.validate) && (
            <ErpButton variant="secondary" onClick={() => void runValidate()} disabled={acting}>
              Validate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canSubmitPayment, actions?.submit) && (
            <ErpButton variant="secondary" onClick={() => setShowSubmit(true)} disabled={acting}>
              Submit for Approval
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canMarkReadyPayment, actions?.markReady) && (
            <ErpButton variant="secondary" onClick={() => void runMarkReady()} disabled={acting}>
              Mark Ready
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canApprovePayment, actions?.approve) && (
            <ErpButton variant="secondary" onClick={() => void runApprove()} disabled={acting}>
              Approve
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canApprovePayment, actions?.reject) && (
            <ErpButton variant="ghost" onClick={() => setShowReject(true)} disabled={acting}>
              Reject
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canEditPayment, actions?.revise) && (
            <ErpButton variant="ghost" onClick={() => setShowRevise(true)} disabled={acting}>
              Revise
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canPostPayment, actions?.post) && (
            <ErpButton variant="primary" onClick={() => setShowPost(true)} disabled={acting}>
              Post Vendor Payment
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canCreateAllocation, actions?.allocate) && (
            <ErpButton
              variant="primary"
              onClick={() => navigate(`/accounting/money-out/vendor-payments/${id}/allocate`)}
            >
              Allocate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canReversePayment, actions?.reverse) && (
            <ErpButton variant="ghost" onClick={() => navigate(`/accounting/money-out/reversals/payment/${id}`)}>
              Reverse
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canCancelPayment, actions?.cancel) && (
            <ErpButton variant="ghost" onClick={() => setShowCancel(true)}>
              Cancel Payment
            </ErpButton>
          )}
          {payment.status === 'POSTED' && payment.accountingVoucherId && (
            <Link to={`/accounting/ledger-entries/voucher/${payment.accountingVoucherId}`}>
              <ErpButton variant="secondary">View Accounting</ErpButton>
            </Link>
          )}
        </div>
      }
    >
      {statusBanner && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
          {statusBanner}
        </div>
      )}

      {postResult && (
        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-[12px] text-emerald-950">
          <h3 className="font-semibold">{postResult.idempotentReplay ? 'Already posted' : 'Vendor Payment Posted'}</h3>
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            <div>
              FOS number: <strong>{postResult.vendorPaymentNumber}</strong>
            </div>
            <div>
              Voucher: <strong>{postResult.accountingVoucherNumber}</strong>
            </div>
            <div>Cash outflow: {formatCurrency(parseDecimal(postResult.cashOutflowAmount))}</div>
            <div>Settlement: {formatCurrency(parseDecimal(postResult.vendorSettlementAmount))}</div>
            <div>Unallocated: {formatCurrency(parseDecimal(postResult.payableOutstandingAmount))}</div>
            <div>Posting date: {postResult.postingDate}</div>
          </dl>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              to={`/accounting/ledger-entries/voucher/${postResult.accountingVoucherId}`}
              className="text-erp-accent hover:underline"
            >
              View Accounting
            </Link>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ErpStatusChip label={MONEY_OUT_STATUS_LABELS[payment.status]} tone={moneyOutStatusTone(payment.status)} />
        <span className="text-[13px] text-erp-muted">{payment.vendorNameSnapshot}</span>
        <span className="text-[13px] text-erp-muted">{PAYMENT_PURPOSE_LABELS[payment.paymentPurpose]}</span>
        <span className="text-[13px] text-erp-muted">{PAYMENT_METHOD_LABELS[payment.paymentMethod]}</span>
        <span className="text-[13px] tabular-nums text-erp-muted">Date: {payment.paymentDate}</span>
        <span className="text-[13px] font-medium tabular-nums">
          Cash outflow {formatCurrency(parseDecimal(payment.cashOutflowAmount))}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-erp-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded px-2.5 py-1.5 text-[12px] ${
              tab === t.id ? 'bg-slate-900 text-white' : 'text-erp-muted hover:bg-slate-100'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <dl className="space-y-2 text-[12px]">
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Draft reference</dt>
              <dd className="font-medium">{payment.draftReference}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">FOS payment number</dt>
              <dd className="font-medium">{payment.vendorPaymentNumber ?? 'Assigned on post'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Currency</dt>
              <dd>
                {payment.currencyCode} @ {payment.exchangeRate}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Reference</dt>
              <dd>{payment.paymentReference ?? payment.chequeNumber ?? payment.bankReference ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Proposed posting date</dt>
              <dd className="tabular-nums">{payment.proposedPostingDate ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Narration</dt>
              <dd className="max-w-[220px] truncate" title={payment.narration ?? ''}>
                {payment.narration ?? '—'}
              </dd>
            </div>
          </dl>
          <VendorPaymentTotalsPanel payment={payment} />
        </div>
      )}

      {tab === 'adjustments' && (
        <>
          {(payment.adjustmentLines ?? []).length === 0 ? (
            <p className="text-[12px] text-erp-muted">No adjustments on this payment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-erp-border text-erp-muted">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Description</th>
                    <th className="py-2 pr-2">Role</th>
                    <th className="py-2 pr-2 text-right">Rate</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payment.adjustmentLines.map((a) => (
                    <tr key={a.id} className="border-b border-erp-border/60">
                      <td className="py-2 pr-2">{a.lineNumber}</td>
                      <td className="py-2 pr-2">{a.adjustmentType}</td>
                      <td className="py-2 pr-2">{a.description}</td>
                      <td className="py-2 pr-2">{a.accountingRole.replace(/_/g, ' ')}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{a.rate ? `${a.rate}%` : '—'}</td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(parseDecimal(a.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'validation' && (
        <div className="space-y-3 text-[12px]">
          <ErpButton variant="secondary" onClick={() => void runValidate()} disabled={acting}>
            Run validation
          </ErpButton>
          <p>
            Status:{' '}
            <span className={payment.validation?.isValid ? 'text-emerald-700' : 'text-rose-700'}>
              {payment.validation ? (payment.validation.isValid ? 'Ready / valid' : 'Needs attention') : 'Not yet validated'}
            </span>
          </p>
          <p className="text-erp-muted">
            Errors: {payment.validation?.errors?.length ?? 0} · Warnings: {payment.validation?.warnings?.length ?? 0}
          </p>
          {(payment.validation?.errors ?? []).length > 0 && (
            <ul className="list-inside list-disc text-rose-700">
              {payment.validation!.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          )}
          <VendorPaymentPositionPanel position={payment.validation?.paymentPosition} />
          <VendorPaymentAccountingPreviewTable preview={payment.validation?.accountingPreview} />
        </div>
      )}

      {tab === 'approval' && (
        <div className="space-y-3 text-[12px]">
          {payment.approvalRequest || approval?.approvalRequest ? (
            <>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-erp-muted">Status</dt>
                  <dd className="font-medium">{(approval?.approvalRequest ?? payment.approvalRequest)?.status ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Level</dt>
                  <dd>
                    {(approval?.approvalRequest ?? payment.approvalRequest)?.currentLevel ?? '—'} /{' '}
                    {(approval?.approvalRequest ?? payment.approvalRequest)?.totalLevels ?? '—'}
                  </dd>
                </div>
              </dl>
              <ul className="space-y-2">
                {(approval?.steps ?? []).map((s) => (
                  <li key={s.id} className="rounded border border-erp-border px-3 py-2">
                    Level {s.level}: {s.status}
                    {s.comments ? ` — ${s.comments}` : ''}
                    {s.actedAt ? ` · ${new Date(s.actedAt).toLocaleString()}` : ''}
                  </li>
                ))}
              </ul>
              {!approval?.steps?.length && (
                <p className="text-erp-muted">Approval timeline will appear after submission.</p>
              )}
            </>
          ) : (
            <p className="text-erp-muted">
              {payment.approvalRequired
                ? 'Approval is required — submit when validation passes.'
                : 'No approval required for this payment — use Mark Ready when eligible.'}
            </p>
          )}
          {payment.cancellationReason && (
            <p className="text-rose-700">Cancellation reason: {payment.cancellationReason}</p>
          )}
        </div>
      )}

      {tab === 'accounting' && (
        <div className="space-y-4">
          {payment.status !== 'POSTED' && (
            <VendorPaymentAccountingPreviewTable preview={payment.validation?.accountingPreview} />
          )}
          {payment.status === 'POSTED' && (
            <div className="rounded border border-erp-border p-3 text-[12px]">
              <h3 className="mb-2 font-semibold uppercase tracking-wide text-erp-muted">Posted accounting</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-erp-muted">Voucher</dt>
                  <dd>
                    {payment.accountingVoucherId ? (
                      <Link
                        to={`/accounting/ledger-entries/voucher/${payment.accountingVoucherId}`}
                        className="text-erp-accent hover:underline"
                      >
                        {payment.accountingVoucherNumber ?? payment.accountingVoucherId}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Ledger entries</dt>
                  <dd>{payment.ledgerEntryCount ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Posted at</dt>
                  <dd>{payment.postedAt ? new Date(payment.postedAt).toLocaleString() : '—'}</dd>
                </div>
              </dl>
            </div>
          )}
          {perms.canViewOpenItem ? (
            <VendorPaymentOpenItemSummary payment={payment} />
          ) : (
            <p className="text-[12px] text-erp-muted">You do not have permission to view payable open items.</p>
          )}
        </div>
      )}

      {tab === 'allocation' && (
        <div className="space-y-4">
          <VendorPaymentOpenItemSummary payment={payment} />
          {mergeAllowedAction(perms.canCreateAllocation, actions?.allocate) && (
            <ErpButton
              variant="primary"
              onClick={() => navigate(`/accounting/money-out/vendor-payments/${id}/allocate`)}
            >
              Allocate to invoices
            </ErpButton>
          )}
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Allocation history</h3>
            {perms.canViewAllocation ? (
              <PayableAllocationHistoryTable
                rows={history}
                emptyLabel={
                  payment.status === 'POSTED'
                    ? 'This payment has not been allocated to any invoices yet.'
                    : 'Allocation is available after the payment is posted.'
                }
              />
            ) : (
              <p className="text-[12px] text-erp-muted">You do not have permission to view allocations.</p>
            )}
          </div>
        </div>
      )}

      <VendorPaymentPostConfirmModal
        open={showPost}
        paymentLabel={vendorPaymentDisplayNumber(payment)}
        vendorName={payment.vendorNameSnapshot}
        paymentPurpose={payment.paymentPurpose}
        postingDate={payment.proposedPostingDate ?? payment.documentDate}
        cashPaid={payment.paymentAmount}
        settlement={payment.vendorSettlementAmount}
        cashOutflow={payment.cashOutflowAmount}
        tdsAmount={payment.tdsAmount}
        posting={acting}
        onConfirm={() => void runPost()}
        onCancel={() => setShowPost(false)}
      />

      {showSubmit && (
        <ReasonModal
          title="Submit for approval"
          confirmLabel="Submit"
          acting={acting}
          value={comments}
          onChange={setComments}
          onCancel={() => setShowSubmit(false)}
          onConfirm={() => void runSubmit()}
          optional
          summary={`${payment.vendorNameSnapshot} · ${formatCurrency(parseDecimal(payment.cashOutflowAmount))}`}
        />
      )}
      {showReject && (
        <ReasonModal
          title="Reject vendor payment"
          confirmLabel="Reject"
          acting={acting}
          value={reason}
          onChange={setReason}
          onCancel={() => setShowReject(false)}
          onConfirm={() => void runReject()}
          notice="The payment will move to Rejected and must be revised before resubmission."
        />
      )}
      {showRevise && (
        <ReasonModal
          title="Revise vendor payment"
          confirmLabel="Revise"
          acting={acting}
          value={reason}
          onChange={setReason}
          onCancel={() => setShowRevise(false)}
          onConfirm={() => void runRevise()}
          notice="Revision returns the payment to Draft and invalidates current approval/readiness."
        />
      )}
      {showCancel && (
        <ReasonModal
          title="Cancel vendor payment"
          confirmLabel="Cancel payment"
          acting={acting}
          value={reason}
          onChange={setReason}
          onCancel={() => setShowCancel(false)}
          onConfirm={() => void runCancel()}
          notice="This action does not delete the payment. It remains available for audit history."
        />
      )}
    </MoneyOutWorkspaceShell>
  )
}

function ReasonModal({
  title,
  confirmLabel,
  acting,
  value,
  onChange,
  onCancel,
  onConfirm,
  notice,
  summary,
  optional,
}: {
  title: string
  confirmLabel: string
  acting: boolean
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
  notice?: string
  summary?: string
  optional?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {summary && <p className="mt-2 text-[12px] text-erp-muted">{summary}</p>}
        {notice && <p className="mt-2 text-[12px] text-erp-muted">{notice}</p>}
        <Textarea
          className="mt-2"
          rows={3}
          placeholder={optional ? 'Comment (optional)' : 'Reason (required)'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={optional ? 'Comment' : 'Reason'}
        />
        <div className="mt-3 flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onCancel} disabled={acting}>
            Close
          </ErpButton>
          <ErpButton variant="primary" onClick={onConfirm} disabled={acting}>
            {acting ? 'Working…' : confirmLabel}
          </ErpButton>
        </div>
      </div>
    </div>
  )
}
