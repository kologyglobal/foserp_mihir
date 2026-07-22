import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  approveVendorInvoice,
  cancelVendorInvoice,
  getVendorInvoice,
  getVendorInvoiceApproval,
  markVendorInvoiceReady,
  postVendorInvoice,
  rejectVendorInvoice,
  reviseVendorInvoice,
  submitVendorInvoice,
  validateVendorInvoice,
} from '@/services/bridges/payablesApiBridge'
import type { PostVendorInvoiceResult, VendorInvoiceApprovalDetail, VendorInvoiceDto } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { MasterRefreshModal, PartyMasterCard, SourceDocumentCard } from '@/modules/accounting/shared/invoices'
import { PayableOpenItemSummary } from '../components/PayableOpenItemSummary'
import { VendorInvoiceAccountingPreviewTable } from '../components/VendorInvoiceAccountingPreview'
import { VendorInvoicePostConfirmModal } from '../components/VendorInvoicePostConfirmModal'
import { VendorInvoiceTotalsPanel } from '../components/VendorInvoiceTotalsPanel'
import { VendorInvoiceValidationPanel } from '../components/VendorInvoiceValidationPanel'
import {
  MONEY_OUT_STATUS_LABELS,
  moneyOutStatusTone,
  parseDecimal,
  vendorInvoiceDisplayNumber,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

type DetailTab = 'overview' | 'lines' | 'vendor' | 'tax' | 'validation' | 'approval' | 'accounting' | 'sources'

export function VendorInvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [invoice, setInvoice] = useState<VendorInvoiceDto | null>(null)
  const [approval, setApproval] = useState<VendorInvoiceApprovalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [showValidate, setShowValidate] = useState(false)
  const [showPost, setShowPost] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showRevise, setShowRevise] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [reason, setReason] = useState('')
  const [comments, setComments] = useState('')
  const [postResult, setPostResult] = useState<PostVendorInvoiceResult | null>(null)
  const [showMasterRefresh, setShowMasterRefresh] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const inv = await getVendorInvoice(id)
      setInvoice(inv)
      if (inv.approvalRequestId || inv.status === 'PENDING_APPROVAL' || inv.status === 'REJECTED') {
        try {
          setApproval(await getVendorInvoiceApproval(id))
        } catch {
          setApproval(null)
        }
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load vendor invoice')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canViewInvoice && isApiMode()) void load()
  }, [load, perms.canViewInvoice])

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
      const updated = await validateVendorInvoice(id)
      setInvoice(updated)
      setShowValidate(true)
      notify.success(updated.validation?.isValid ? 'Validation passed' : 'Validation completed with issues')
    })

  const runSubmit = () =>
    void withActing(async () => {
      if (!id || !invoice) return
      const updated = await submitVendorInvoice(id, invoice.updatedAt, comments.trim() || undefined)
      setInvoice(updated)
      setShowSubmit(false)
      setComments('')
      notify.success('Submitted for approval')
      await load()
    })

  const runMarkReady = () =>
    void withActing(async () => {
      if (!id || !invoice) return
      const updated = await markVendorInvoiceReady(id, invoice.updatedAt)
      setInvoice(updated)
      notify.success('Marked ready to post')
    })

  const runApprove = () =>
    void withActing(async () => {
      if (!id || !invoice) return
      const updated = await approveVendorInvoice(id, invoice.updatedAt, comments.trim() || undefined)
      setInvoice(updated)
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
      if (!id || !invoice) return
      const updated = await rejectVendorInvoice(id, reason.trim(), invoice.updatedAt)
      setInvoice(updated)
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
      if (!id || !invoice) return
      const updated = await reviseVendorInvoice(id, reason.trim(), invoice.updatedAt)
      setShowRevise(false)
      setReason('')
      notify.success('Returned to Draft')
      navigate(`/accounting/money-out/vendor-invoices/${updated.id}/edit`)
    })
  }

  const runCancel = () => {
    if (!reason.trim()) {
      notify.error('Cancellation reason is required')
      return
    }
    void withActing(async () => {
      if (!id || !invoice) return
      const updated = await cancelVendorInvoice(id, reason.trim(), invoice.updatedAt)
      setInvoice(updated)
      setShowCancel(false)
      setReason('')
      notify.success('Invoice cancelled')
    })
  }

  const runPost = () =>
    void withActing(async () => {
      if (!id || !invoice) return
      try {
        const result = await postVendorInvoice(id, invoice.updatedAt)
        setPostResult(result)
        setShowPost(false)
        if (result.idempotentReplay) {
          notify.success('This invoice was already posted. The existing posting result has been loaded.')
        } else {
          notify.success(`Posted — ${result.vendorInvoiceNumber}`)
        }
        await load()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Post failed'
        if (msg.includes('changed by another user')) void load()
        throw e
      }
    })

  if (!perms.canViewInvoice) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Invoice">
        <p className="text-[13px] text-erp-muted">You do not have permission to view vendor invoices.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Invoice">
        <p className="text-[13px] text-erp-muted">Vendor invoices require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading || !invoice) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Invoice">
        <LoadingState variant="card" />
      </MoneyOutWorkspaceShell>
    )
  }

  const actions = invoice.allowedActions
  const statusBanner =
    invoice.status === 'POSTED'
      ? 'Posted to GL — read-only. Review voucher, ledger and payable open item below.'
      : invoice.status === 'READY_TO_POST'
        ? 'Ready to post — posting creates voucher, GL and vendor payable. No payment is created.'
        : invoice.status === 'PENDING_APPROVAL'
          ? 'Pending approval — editing is disabled until approve, reject, or revise.'
          : invoice.status === 'REJECTED'
            ? 'Rejected — revise to return to Draft before resubmission.'
            : invoice.status === 'CANCELLED'
              ? 'Cancelled — retained for audit history.'
              : null

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'lines', label: 'Lines' },
    { id: 'vendor', label: 'Vendor' },
    { id: 'tax', label: 'Tax & TDS' },
    { id: 'validation', label: 'Validation' },
    { id: 'approval', label: 'Approval' },
    { id: 'accounting', label: 'Accounting' },
    { id: 'sources', label: 'Source References' },
  ]

  return (
    <MoneyOutWorkspaceShell
      title={vendorInvoiceDisplayNumber(invoice)}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canEditInvoice, actions?.edit) && (
            <ErpButton
              variant="secondary"
              icon={Pencil}
              onClick={() => navigate(`/accounting/money-out/vendor-invoices/${id}/edit`)}
            >
              Edit
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canViewInvoice, actions?.validate) && (
            <ErpButton variant="secondary" onClick={() => void runValidate()} disabled={acting}>
              Validate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canSubmitInvoice, actions?.submit) && (
            <ErpButton variant="secondary" onClick={() => setShowSubmit(true)} disabled={acting}>
              Submit for Approval
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canMarkReady, actions?.markReady) && (
            <ErpButton variant="secondary" onClick={() => void runMarkReady()} disabled={acting}>
              Mark Ready
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canApproveInvoice, actions?.approve) && (
            <ErpButton variant="secondary" onClick={() => void runApprove()} disabled={acting}>
              Approve
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canApproveInvoice, actions?.reject) && (
            <ErpButton variant="ghost" onClick={() => setShowReject(true)} disabled={acting}>
              Reject
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canEditInvoice, actions?.revise) && (
            <ErpButton variant="ghost" onClick={() => setShowRevise(true)} disabled={acting}>
              Revise
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canPostInvoice, actions?.post) && (
            <ErpButton variant="primary" onClick={() => setShowPost(true)} disabled={acting}>
              Post Vendor Invoice
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canReverseInvoice, actions?.reverse) && (
            <ErpButton variant="ghost" onClick={() => navigate(`/accounting/money-out/reversals/invoice/${id}`)}>
              Reverse
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canCancelInvoice, actions?.cancel) && (
            <ErpButton variant="ghost" onClick={() => setShowCancel(true)}>
              Cancel Invoice
            </ErpButton>
          )}
          {invoice.status === 'POSTED' && invoice.accountingVoucherId && (
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

      {postResult && (
        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-[12px] text-emerald-950">
          <h3 className="font-semibold">{postResult.idempotentReplay ? 'Already posted' : 'Vendor Invoice Posted'}</h3>
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            <div>
              FOS number: <strong>{postResult.vendorInvoiceNumber}</strong>
            </div>
            <div>
              Voucher: <strong>{postResult.accountingVoucherNumber}</strong>
            </div>
            <div>Payable: {formatCurrency(parseDecimal(postResult.vendorPayableAmount))}</div>
            <div>Outstanding: {formatCurrency(parseDecimal(postResult.payableOutstandingAmount))}</div>
            <div>Ledger entries: {postResult.ledgerEntryCount}</div>
            <div>Posting date: {postResult.postingDate}</div>
          </dl>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to={`/accounting/ledger-entries/voucher/${postResult.accountingVoucherId}`} className="text-erp-accent hover:underline">
              View Accounting
            </Link>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ErpStatusChip label={MONEY_OUT_STATUS_LABELS[invoice.status]} tone={moneyOutStatusTone(invoice.status)} />
        <span className="text-[13px] text-erp-muted">{invoice.vendorNameSnapshot}</span>
        <span className="text-[13px] text-erp-muted">Supplier: {invoice.supplierInvoiceNumber}</span>
        <span className="text-[13px] tabular-nums text-erp-muted">Date: {invoice.supplierInvoiceDate}</span>
        {invoice.dueDate && <span className="text-[13px] tabular-nums text-erp-muted">Due: {invoice.dueDate}</span>}
        <span className="text-[13px] font-medium tabular-nums">
          Payable {formatCurrency(parseDecimal(invoice.vendorPayableAmount))}
        </span>
      </div>

      {invoice.validation?.duplicateAssessment && invoice.validation.duplicateAssessment.riskLevel !== 'NONE' && (
        <div
          className={`mb-3 rounded border px-3 py-2 text-[12px] ${
            invoice.validation.duplicateAssessment.isBlocking
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <strong>
            {invoice.validation.duplicateAssessment.isBlocking ? 'Exact duplicate blocked' : 'Similar invoice warning'}
          </strong>
          <p className="mt-1">
            {invoice.validation.duplicateAssessment.message ??
              (invoice.validation.duplicateAssessment.isBlocking
                ? 'A vendor invoice with this supplier invoice number already exists for this vendor.'
                : 'A similar vendor invoice may already exist. Review before continuing.')}
          </p>
          {(invoice.validation.duplicateAssessment.matches ?? []).map((m) => (
            <div key={m.vendorInvoiceId} className="mt-1">
              <Link to={`/accounting/money-out/vendor-invoices/${m.vendorInvoiceId}`} className="underline">
                Open existing: {m.vendorInvoiceNumber ?? m.draftReference ?? m.vendorInvoiceId}
              </Link>
            </div>
          ))}
        </div>
      )}

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
              <dd className="font-medium">{invoice.draftReference}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">FOS invoice number</dt>
              <dd className="font-medium">{invoice.vendorInvoiceNumber ?? 'Assigned on post'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Invoice type</dt>
              <dd>{invoice.invoiceType}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Currency</dt>
              <dd>
                {invoice.currencyCode} @ {invoice.exchangeRate}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Vendor GSTIN</dt>
              <dd>{invoice.vendorGstinSnapshot ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-erp-muted">Posting date</dt>
              <dd className="tabular-nums">{invoice.postingDate ?? '—'}</dd>
            </div>
          </dl>
          <VendorInvoiceTotalsPanel
            taxable={invoice.taxableAmount}
            cgst={invoice.inputCgstAmount}
            sgst={invoice.inputSgstAmount}
            igst={invoice.inputIgstAmount}
            cess={invoice.inputCessAmount}
            nonRecoverable={invoice.nonRecoverableTaxAmount}
            freight={invoice.freightAmount}
            other={invoice.otherChargeAmount}
            roundOff={invoice.roundOffAmount}
            grandTotal={invoice.invoiceGrandTotal}
            tds={invoice.tdsAmount}
            vendorPayable={invoice.vendorPayableAmount}
          />
        </div>
      )}

      {tab === 'lines' && (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-erp-muted">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  <th className="py-2 pr-2 text-right">Rate</th>
                  <th className="py-2 pr-2 text-right">Taxable</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.lines ?? []).map((l) => (
                  <tr key={l.id} className="border-b border-erp-border/60">
                    <td className="py-2 pr-2">{l.lineNumber}</td>
                    <td className="py-2 pr-2">{l.lineType}</td>
                    <td className="py-2 pr-2">{l.description}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{l.quantity}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.unitPrice))}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.taxableAmount))}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.lineTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {(invoice.lines ?? []).map((l) => (
              <div key={l.id} className="rounded border border-erp-border p-3 text-[12px]">
                <div className="font-medium">{l.description}</div>
                <div className="mt-1 text-erp-muted">
                  {l.quantity} × {formatCurrency(parseDecimal(l.unitPrice))}
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Taxable {formatCurrency(parseDecimal(l.taxableAmount))}</span>
                  <span className="font-semibold">{formatCurrency(parseDecimal(l.lineTotal))}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'vendor' && (
        <div className="text-[12px]">
          <h3 className="mb-1 font-semibold uppercase tracking-wide text-erp-muted">Document snapshot</h3>
          <dl className="grid gap-1 sm:grid-cols-2">
            <div>
              Name: <span className="text-erp-text">{invoice.vendorNameSnapshot}</span>
            </div>
            <div>
              Code: <span className="text-erp-text">{invoice.vendorCodeSnapshot}</span>
            </div>
            <div>
              GSTIN: <span className="text-erp-text">{invoice.vendorGstinSnapshot ?? '—'}</span>
            </div>
            <div>
              State code: <span className="text-erp-text">{invoice.vendorStateCodeSnapshot ?? '—'}</span>
            </div>
          </dl>
          <PartyMasterCard
            variant="purchase"
            partyId={invoice.vendorId}
            snapshot={{
              name: invoice.vendorNameSnapshot,
              code: invoice.vendorCodeSnapshot,
              gstin: invoice.vendorGstinSnapshot,
              pan: invoice.vendorPanSnapshot,
            }}
            onRefreshFromMaster={
              invoice.status === 'DRAFT' && mergeAllowedAction(perms.canEditInvoice, actions?.edit)
                ? () => setShowMasterRefresh(true)
                : undefined
            }
          />
          <p className="mt-2 text-[11px] text-erp-muted">
            Posted vendor invoices always render the snapshot captured at posting time.
          </p>
        </div>
      )}

      {tab === 'tax' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-erp-border p-3 text-[12px]">
            <h3 className="mb-2 font-semibold uppercase tracking-wide text-erp-muted">Input GST / ITC</h3>
            <dl className="space-y-1.5">
              <div className="flex justify-between">
                <dt>ITC eligibility</dt>
                <dd>{invoice.itcEligibility.replace(/_/g, ' ')}</dd>
              </div>
              <div className="flex justify-between">
                <dt>CGST</dt>
                <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.inputCgstAmount))}</dd>
              </div>
              <div className="flex justify-between">
                <dt>SGST</dt>
                <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.inputSgstAmount))}</dd>
              </div>
              <div className="flex justify-between">
                <dt>IGST</dt>
                <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.inputIgstAmount))}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Non-recoverable</dt>
                <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.nonRecoverableTaxAmount))}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-erp-muted">
              ITC classification controls accounting treatment. It does not submit or claim GST returns.
            </p>
          </div>
          <div className="rounded border border-erp-border p-3 text-[12px]">
            <h3 className="mb-2 font-semibold uppercase tracking-wide text-erp-muted">TDS</h3>
            <dl className="space-y-1.5">
              <div className="flex justify-between">
                <dt>Mode</dt>
                <dd>{invoice.tdsRecognitionMode.replace(/_/g, ' ')}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Section</dt>
                <dd>{invoice.tdsSectionCode ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Rate</dt>
                <dd className="tabular-nums">{invoice.tdsRate}%</dd>
              </div>
              <div className="flex justify-between">
                <dt>Base</dt>
                <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.tdsBaseAmount))}</dd>
              </div>
              <div className="flex justify-between">
                <dt>TDS amount</dt>
                <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.tdsAmount))}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Vendor payable after TDS</dt>
                <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.vendorPayableAmount))}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {tab === 'validation' && (
        <div className="space-y-3 text-[12px]">
          <ErpButton variant="secondary" onClick={() => void runValidate()} disabled={acting}>
            Run validation
          </ErpButton>
          <p>
            Status:{' '}
            <span className={invoice.validation?.isValid ? 'text-emerald-700' : 'text-rose-700'}>
              {invoice.validation
                ? invoice.validation.isValid
                  ? 'Ready / valid'
                  : 'Needs attention'
                : 'Not yet validated'}
            </span>
          </p>
          <p className="text-erp-muted">
            Errors: {invoice.validation?.errors?.length ?? 0} · Warnings: {invoice.validation?.warnings?.length ?? 0}
          </p>
          <VendorInvoiceAccountingPreviewTable preview={invoice.accountingPreviewSnapshot} />
        </div>
      )}

      {tab === 'approval' && (
        <div className="space-y-3 text-[12px]">
          {invoice.approvalRequest || approval?.approvalRequest ? (
            <>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-erp-muted">Status</dt>
                  <dd className="font-medium">
                    {(approval?.approvalRequest ?? invoice.approvalRequest)?.status ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Level</dt>
                  <dd>
                    {(approval?.approvalRequest ?? invoice.approvalRequest)?.currentLevel ?? '—'} /{' '}
                    {(approval?.approvalRequest ?? invoice.approvalRequest)?.totalLevels ?? '—'}
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
              {!(approval?.steps?.length) && (
                <p className="text-erp-muted">Approval timeline will appear after submission.</p>
              )}
            </>
          ) : (
            <p className="text-erp-muted">
              {invoice.approvalRequired
                ? 'Approval is required — submit when validation passes.'
                : 'No approval required for this invoice — use Mark Ready when eligible.'}
            </p>
          )}
          {invoice.cancellationReason && (
            <p className="text-rose-700">Cancellation reason: {invoice.cancellationReason}</p>
          )}
        </div>
      )}

      {tab === 'accounting' && (
        <div className="space-y-4">
          {invoice.status !== 'POSTED' && (
            <VendorInvoiceAccountingPreviewTable preview={invoice.accountingPreviewSnapshot} />
          )}
          {invoice.status === 'POSTED' && (
            <div className="rounded border border-erp-border p-3 text-[12px]">
              <h3 className="mb-2 font-semibold uppercase tracking-wide text-erp-muted">Posted accounting</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-erp-muted">Voucher</dt>
                  <dd>
                    {invoice.accountingVoucherId ? (
                      <Link
                        to={`/accounting/ledger-entries/voucher/${invoice.accountingVoucherId}`}
                        className="text-erp-accent hover:underline"
                      >
                        {invoice.accountingVoucherNumber ?? invoice.accountingVoucherId}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Ledger entries</dt>
                  <dd>{invoice.ledgerEntryCount ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Posted at</dt>
                  <dd>{invoice.postedAt ? new Date(invoice.postedAt).toLocaleString() : '—'}</dd>
                </div>
              </dl>
            </div>
          )}
          {perms.canViewOpenItem ? (
            <PayableOpenItemSummary invoice={invoice} />
          ) : (
            <p className="text-[12px] text-erp-muted">You do not have permission to view payable open items.</p>
          )}
        </div>
      )}

      {tab === 'sources' && (
        <div className="text-[12px]">
          <SourceDocumentCard
            sources={(invoice.sourceLinks ?? []).map((s) => ({
              sourceType: s.sourceType,
              sourceDocumentId: s.sourceDocumentId,
              documentNumber: s.sourceDocumentNumberSnapshot,
              documentDate: s.sourceDocumentDateSnapshot,
            }))}
            emptyText="This invoice was entered directly without a Purchase reference."
          />
          <p className="mt-2 text-[11px] text-erp-muted">
            Quantity/price matching against PO and GRN is not enforced in the current phase.
          </p>
        </div>
      )}

      <MasterRefreshModal
        open={showMasterRefresh}
        onClose={() => setShowMasterRefresh(false)}
        variant="purchase"
        documentId={invoice.id}
        partyId={invoice.vendorId}
        snapshot={{
          name: invoice.vendorNameSnapshot,
          code: invoice.vendorCodeSnapshot,
          gstin: invoice.vendorGstinSnapshot,
          pan: invoice.vendorPanSnapshot,
        }}
        onApplied={() => void load()}
      />

      <VendorInvoiceValidationPanel open={showValidate} onClose={() => setShowValidate(false)} invoice={invoice} />
      <VendorInvoicePostConfirmModal
        open={showPost}
        invoiceLabel={vendorInvoiceDisplayNumber(invoice)}
        supplierInvoiceNumber={invoice.supplierInvoiceNumber}
        vendorName={invoice.vendorNameSnapshot}
        postingDate={invoice.postingDate ?? invoice.documentDate}
        grandTotal={invoice.invoiceGrandTotal}
        tdsAmount={invoice.tdsAmount}
        vendorPayable={invoice.vendorPayableAmount}
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
          summary={`${invoice.vendorNameSnapshot} · ${invoice.supplierInvoiceNumber} · ${formatCurrency(parseDecimal(invoice.vendorPayableAmount))}`}
        />
      )}
      {showReject && (
        <ReasonModal
          title="Reject vendor invoice"
          confirmLabel="Reject"
          acting={acting}
          value={reason}
          onChange={setReason}
          onCancel={() => setShowReject(false)}
          onConfirm={() => void runReject()}
          notice="The vendor invoice will move to Rejected and must be revised before resubmission."
        />
      )}
      {showRevise && (
        <ReasonModal
          title="Revise vendor invoice"
          confirmLabel="Revise"
          acting={acting}
          value={reason}
          onChange={setReason}
          onCancel={() => setShowRevise(false)}
          onConfirm={() => void runRevise()}
          notice="Revision returns the invoice to Draft and invalidates current approval/readiness."
        />
      )}
      {showCancel && (
        <ReasonModal
          title="Cancel vendor invoice"
          confirmLabel="Cancel invoice"
          acting={acting}
          value={reason}
          onChange={setReason}
          onCancel={() => setShowCancel(false)}
          onConfirm={() => void runCancel()}
          notice="This action does not delete the invoice. It remains available for audit history."
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
