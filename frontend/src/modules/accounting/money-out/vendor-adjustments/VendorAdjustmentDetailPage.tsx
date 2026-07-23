import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  approveVendorAdjustment,
  cancelVendorAdjustment,
  getVendorAdjustment,
  getVendorAdjustmentApproval,
  listVendorAdjustmentAllocations,
  markVendorAdjustmentReady,
  postVendorAdjustment,
  rejectVendorAdjustment,
  reviseVendorAdjustment,
  submitVendorAdjustment,
  validateVendorAdjustment,
} from '@/services/bridges/payablesApiBridge'
import type {
  PayableAllocationHistoryRow,
  PostVendorAdjustmentResult,
  VendorAdjustmentApprovalDetail,
  VendorAdjustmentDto,
} from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { PayableAllocationHistoryTable } from '../components/PayableAllocationHistoryTable'
import { VendorInvoicePostConfirmModal } from '../components/VendorInvoicePostConfirmModal'
import { VendorInvoiceTotalsPanel } from '../components/VendorInvoiceTotalsPanel'
import {
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_TYPE_LABELS,
  groupValidationIssues,
  MONEY_OUT_STATUS_LABELS,
  moneyOutStatusTone,
  parseDecimal,
  vendorAdjustmentDisplayNumber,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

type DetailTab = 'overview' | 'lines' | 'validation' | 'approval' | 'accounting' | 'allocation'

function canAllocateDebitNote(adj: VendorAdjustmentDto, canCreateAllocation: boolean) {
  return (
    canCreateAllocation &&
    adj.adjustmentType === 'VENDOR_DEBIT_NOTE' &&
    adj.status === 'POSTED' &&
    parseDecimal(adj.payableOutstandingAmount ?? '0') > 0
  )
}

export function VendorAdjustmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [adjustment, setAdjustment] = useState<VendorAdjustmentDto | null>(null)
  const [approval, setApproval] = useState<VendorAdjustmentApprovalDetail | null>(null)
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
  const [postResult, setPostResult] = useState<PostVendorAdjustmentResult | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const adj = await getVendorAdjustment(id)
      setAdjustment(adj)
      if (adj.approvalRequestId || adj.status === 'PENDING_APPROVAL' || adj.status === 'REJECTED') {
        try {
          setApproval(await getVendorAdjustmentApproval(id))
        } catch {
          setApproval(null)
        }
      }
      if (adj.status === 'POSTED' && adj.adjustmentType === 'VENDOR_DEBIT_NOTE') {
        try {
          setHistory(await listVendorAdjustmentAllocations(id))
        } catch {
          setHistory([])
        }
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load vendor adjustment')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canViewAdjustment && isApiMode()) void load()
  }, [load, perms.canViewAdjustment])

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
      const updated = await validateVendorAdjustment(id)
      setAdjustment(updated)
      notify.success(updated.validation?.isValid ? 'Validation passed' : 'Validation completed with issues')
    })

  const runSubmit = () =>
    void withActing(async () => {
      if (!id || !adjustment) return
      const updated = await submitVendorAdjustment(id, adjustment.updatedAt, comments.trim() || undefined)
      setAdjustment(updated)
      setShowSubmit(false)
      setComments('')
      notify.success('Submitted for approval')
      await load()
    })

  const runMarkReady = () =>
    void withActing(async () => {
      if (!id || !adjustment) return
      const updated = await markVendorAdjustmentReady(id, adjustment.updatedAt)
      setAdjustment(updated)
      notify.success('Marked ready to post')
    })

  const runApprove = () =>
    void withActing(async () => {
      if (!id || !adjustment) return
      const updated = await approveVendorAdjustment(id, adjustment.updatedAt, comments.trim() || undefined)
      setAdjustment(updated)
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
      if (!id || !adjustment) return
      const updated = await rejectVendorAdjustment(id, reason.trim(), adjustment.updatedAt)
      setAdjustment(updated)
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
      if (!id || !adjustment) return
      const updated = await reviseVendorAdjustment(id, reason.trim(), adjustment.updatedAt)
      setShowRevise(false)
      setReason('')
      notify.success('Returned to Draft')
      navigate(`/accounting/money-out/vendor-adjustments/${updated.id}/edit`)
    })
  }

  const runCancel = () => {
    if (!reason.trim()) {
      notify.error('Cancellation reason is required')
      return
    }
    void withActing(async () => {
      if (!id || !adjustment) return
      const updated = await cancelVendorAdjustment(id, reason.trim(), adjustment.updatedAt)
      setAdjustment(updated)
      setShowCancel(false)
      setReason('')
      notify.success('Adjustment cancelled')
    })
  }

  const runPost = () =>
    void withActing(async () => {
      if (!id || !adjustment) return
      const result = await postVendorAdjustment(id, adjustment.updatedAt)
      setPostResult(result)
      setShowPost(false)
      notify.success(result.idempotentReplay ? 'Already posted' : `Posted — ${result.vendorAdjustmentNumber}`)
      await load()
    })

  if (!perms.canViewAdjustment) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Adjustment">
        <p className="text-[13px] text-erp-muted">You do not have permission to view vendor adjustments.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Adjustment">
        <p className="text-[13px] text-erp-muted">Vendor adjustments require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading || !adjustment) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Adjustment">
        <LoadingState variant="card" />
      </MoneyOutWorkspaceShell>
    )
  }

  const actions = adjustment.allowedActions
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'lines', label: 'Lines' },
    { id: 'validation', label: 'Validation' },
    { id: 'approval', label: 'Approval' },
    { id: 'accounting', label: 'Accounting' },
    ...(adjustment.adjustmentType === 'VENDOR_DEBIT_NOTE' ? [{ id: 'allocation' as const, label: 'Allocation' }] : []),
  ]

  return (
    <MoneyOutWorkspaceShell
      title={vendorAdjustmentDisplayNumber(adjustment)}
      actions={
        <div className="flex flex-wrap gap-2">
          <ErpButton
            variant="secondary"
            icon={Printer}
            onClick={() => navigate(`/accounting/money-out/vendor-adjustments/${id}/print`)}
          >
            Print
          </ErpButton>
          <ErpButton
            variant="secondary"
            icon={Download}
            onClick={() => navigate(`/accounting/money-out/vendor-adjustments/${id}/print`)}
          >
            Download PDF
          </ErpButton>
          {mergeAllowedAction(perms.canEditAdjustment, actions?.edit) && (
            <ErpButton variant="secondary" icon={Pencil} onClick={() => navigate(`/accounting/money-out/vendor-adjustments/${id}/edit`)}>
              Edit
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canViewAdjustment, actions?.validate) && (
            <ErpButton variant="secondary" onClick={() => void runValidate()} disabled={acting}>
              Validate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canSubmitAdjustment, actions?.submit) && (
            <ErpButton variant="secondary" onClick={() => setShowSubmit(true)} disabled={acting}>
              Submit
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canMarkReadyAdjustment, actions?.markReady) && (
            <ErpButton variant="secondary" onClick={() => void runMarkReady()} disabled={acting}>
              Mark Ready
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canApproveAdjustment, actions?.approve) && (
            <ErpButton variant="secondary" onClick={() => void runApprove()} disabled={acting}>
              Approve
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canApproveAdjustment, actions?.reject) && (
            <ErpButton variant="ghost" onClick={() => setShowReject(true)} disabled={acting}>
              Reject
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canEditAdjustment, actions?.revise) && (
            <ErpButton variant="ghost" onClick={() => setShowRevise(true)} disabled={acting}>
              Revise
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canPostAdjustment, actions?.post) && (
            <ErpButton variant="primary" onClick={() => setShowPost(true)} disabled={acting}>
              Post Adjustment
            </ErpButton>
          )}
          {mergeAllowedAction(
            canAllocateDebitNote(adjustment, perms.canCreateAllocation),
            actions?.allocate,
          ) && (
            <ErpButton variant="primary" onClick={() => navigate(`/accounting/money-out/vendor-adjustments/${id}/allocate`)}>
              Allocate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canReverseAdjustment, actions?.reverse) && (
            <ErpButton variant="ghost" onClick={() => navigate(`/accounting/money-out/reversals/adjustment/${id}`)}>
              Reverse
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canCancelAdjustment, actions?.cancel) && (
            <ErpButton variant="ghost" onClick={() => setShowCancel(true)}>
              Cancel
            </ErpButton>
          )}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ErpStatusChip label={MONEY_OUT_STATUS_LABELS[adjustment.status]} tone={moneyOutStatusTone(adjustment.status)} />
        <span className="text-[12px] text-erp-muted">{ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType]}</span>
        <span className="text-[12px] text-erp-muted">{ADJUSTMENT_REASON_LABELS[adjustment.reason] ?? adjustment.reason}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-erp-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-3 py-2 text-[12px] ${tab === t.id ? 'border-b-2 border-erp-accent font-semibold text-erp-accent' : 'text-erp-muted'}`}
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
              <dt className="text-erp-muted">Vendor</dt>
              <dd className="font-medium">{adjustment.vendorNameSnapshot}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Supplier reference</dt>
              <dd>{adjustment.supplierReferenceNumber}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Document date</dt>
              <dd className="tabular-nums">{adjustment.documentDate}</dd>
            </div>
            {adjustment.status === 'POSTED' && adjustment.payableOutstandingAmount && (
              <div className="flex justify-between gap-4">
                <dt className="text-erp-muted">Outstanding</dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(parseDecimal(adjustment.payableOutstandingAmount))}</dd>
              </div>
            )}
          </dl>
          <VendorInvoiceTotalsPanel
            taxable={adjustment.taxableAmount}
            cgst={adjustment.inputCgstAmount}
            sgst={adjustment.inputSgstAmount}
            igst={adjustment.inputIgstAmount}
            grandTotal={adjustment.adjustmentGrandTotal}
            tds={adjustment.tdsAmount}
            vendorPayable={adjustment.vendorPayableAmount}
          />
        </div>
      )}

      {tab === 'lines' && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="py-2 pr-3 text-right font-medium">Taxable</th>
                <th className="py-2 text-right font-medium">Line total</th>
              </tr>
            </thead>
            <tbody>
              {adjustment.lines.map((line) => (
                <tr key={line.id} className="border-b border-erp-border/60">
                  <td className="py-2 pr-3">{line.lineNumber}</td>
                  <td className="py-2 pr-3">{line.description}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(line.taxableAmount))}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(parseDecimal(line.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'validation' && adjustment.validation && (
        <div className="space-y-3 text-[12px]">
          <p className={adjustment.validation.isValid ? 'text-emerald-700' : 'text-rose-700'}>
            {adjustment.validation.isValid ? 'Validation passed' : 'Validation has blocking issues'}
          </p>
          {adjustment.validation.errors.length > 0 && (
            <ul className="list-disc pl-4 text-red-700">
              {adjustment.validation.errors.map((e) => (
                <li key={`${e.code}-${e.field ?? e.message}`}>{e.message}</li>
              ))}
            </ul>
          )}
          {adjustment.validation.warnings.length > 0 && (
            <ul className="list-disc pl-4 text-amber-800">
              {adjustment.validation.warnings.map((w) => (
                <li key={`${w.code}-${w.field ?? w.message}`}>{w.message}</li>
              ))}
            </ul>
          )}
          {adjustment.validation.duplicateAssessment?.isBlocking && (
            <p className="text-red-700">{adjustment.validation.duplicateAssessment.message ?? 'Duplicate supplier reference blocked'}</p>
          )}
          {!adjustment.validation.isValid && groupValidationIssues(adjustment.validation.errors).errors.length === 0 && (
            <p className="text-erp-muted">Review warnings before continuing.</p>
          )}
        </div>
      )}

      {tab === 'approval' && (
        <div className="text-[12px]">
          {approval?.approvalRequest ? (
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-erp-muted">Status</dt>
                <dd>{approval.approvalRequest.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-erp-muted">Level</dt>
                <dd>
                  {approval.approvalRequest.currentLevel} / {approval.approvalRequest.totalLevels}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-erp-muted">No approval workflow for this adjustment.</p>
          )}
        </div>
      )}

      {tab === 'accounting' && adjustment.status === 'POSTED' && (
        <dl className="space-y-2 text-[12px]">
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Voucher</dt>
            <dd>
              {adjustment.accountingVoucherId ? (
                <Link to={`/accounting/ledger-entries/voucher/${adjustment.accountingVoucherId}`} className="text-erp-accent hover:underline">
                  {adjustment.accountingVoucherNumber}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Ledger entries</dt>
            <dd>{adjustment.ledgerEntryCount ?? 0}</dd>
          </div>
        </dl>
      )}

      {tab === 'allocation' && (
        <PayableAllocationHistoryTable rows={history} emptyLabel="No debit note allocations yet." />
      )}

      {postResult && (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-950">
          Posted as <strong>{postResult.vendorAdjustmentNumber}</strong> — open item outstanding{' '}
          {formatCurrency(parseDecimal(postResult.payableOutstandingAmount))}
        </div>
      )}

      <VendorInvoicePostConfirmModal
        open={showPost}
        invoiceLabel={vendorAdjustmentDisplayNumber(adjustment)}
        supplierInvoiceNumber={adjustment.supplierReferenceNumber}
        vendorName={adjustment.vendorNameSnapshot}
        postingDate={adjustment.postingDate ?? adjustment.documentDate}
        grandTotal={adjustment.adjustmentGrandTotal}
        tdsAmount={adjustment.tdsAmount}
        vendorPayable={adjustment.vendorPayableAmount}
        posting={acting}
        onConfirm={() => void runPost()}
        onCancel={() => setShowPost(false)}
      />

      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Submit for approval</h3>
            <Textarea className="mt-2" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Comments (optional)" rows={3} />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowSubmit(false)}>Cancel</ErpButton>
              <ErpButton variant="primary" onClick={() => void runSubmit()} disabled={acting}>Submit</ErpButton>
            </div>
          </div>
        </div>
      )}

      {(showReject || showRevise || showCancel) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">{showReject ? 'Reject' : showRevise ? 'Revise' : 'Cancel'} adjustment</h3>
            <Textarea className="mt-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" rows={3} />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => { setShowReject(false); setShowRevise(false); setShowCancel(false) }}>Close</ErpButton>
              <ErpButton variant="primary" onClick={() => { if (showReject) runReject(); else if (showRevise) runRevise(); else runCancel() }} disabled={acting}>Confirm</ErpButton>
            </div>
          </div>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
