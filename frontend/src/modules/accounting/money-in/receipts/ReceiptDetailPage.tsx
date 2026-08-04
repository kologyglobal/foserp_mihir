import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Pencil,
  Printer,
  Send,
  Undo2,
  XCircle,
} from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { TableLink } from '@/components/ui/AppLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { entity360CustomerPath } from '@/config/entity360Routes'
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
import { formatDate } from '@/utils/dates/format'
import { downloadCustomerReceiptPdf, printCustomerReceiptDocument } from '@/utils/customerReceiptExport'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  RECEIPT_STATUS_LABELS,
  receiptDisplayNumber,
  receiptStatusTone,
  parseDecimal,
  summarizeReceiptValidationToast,
} from '../moneyInUi'
import { ValidationDrawer } from '../components/ValidationDrawer'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'
import {
  CUSTOMER_RECEIPT_PAYMENT_METHOD_LABELS,
  CustomerReceiptDocument,
} from './CustomerReceiptDocument'

function SideMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mi-receipt-detail-meta">
      <dt className="mi-receipt-detail-meta__label">{label}</dt>
      <dd className="mi-receipt-detail-meta__value">{children}</dd>
    </div>
  )
}

function SideCard({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mi-receipt-detail-side-card', className)}>
      {title ? <h3 className="mi-receipt-detail-side-card__title">{title}</h3> : null}
      {children}
    </section>
  )
}

export function ReceiptDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [receipt, setReceipt] = useState<CustomerReceiptDto | null>(null)
  const [report, setReport] = useState<CustomerReceiptValidationPreview | null>(null)
  const [history, setHistory] = useState<ReceiptAllocationHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [exporting, setExporting] = useState(false)
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
      } else {
        setHistory([])
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
      if (r.valid) {
        notify.success('Validation passed')
      } else {
        const toast = summarizeReceiptValidationToast(r)
        if (toast) notify.error(toast)
      }
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

  const handlePdf = async () => {
    if (!receipt) return
    setExporting(true)
    try {
      notify.info('Preparing PDF…')
      const result = await downloadCustomerReceiptPdf(receipt)
      if (result.ok) notify.success(`Downloaded ${result.fileName}`)
      else notify.error(result.error ?? 'PDF download failed')
    } finally {
      setExporting(false)
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
  const receiptNo = receiptDisplayNumber(receipt)
  const canEdit = mergeAllowedAction(perms.canEditReceipt, actions?.edit)
  const canAllocate = mergeAllowedAction(perms.canAllocate, actions?.allocate)
  const canValidate = mergeAllowedAction(perms.canViewReceipt, actions?.validate)
  const canMarkReady = mergeAllowedAction(perms.canEditReceipt, actions?.markReady)
  const canPost = mergeAllowedAction(perms.canPostReceipt, actions?.post)
  const canCancel = mergeAllowedAction(perms.canCancelReceipt, actions?.cancel)
  const canReverse = mergeAllowedAction(perms.canReverseReceipt, actions?.reverse)
  const hasAccountingLink =
    (receipt.status === 'POSTED' || receipt.status === 'REVERSED') && Boolean(receipt.accountingVoucherId)

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

  const primaryAction = canPost
    ? {
        id: 'post',
        label: 'Post',
        icon: Send,
        onClick: () => setShowPost(true),
        disabled: acting,
      }
    : canAllocate
      ? {
          id: 'allocate',
          label: 'Allocate',
          icon: ArrowLeftRight,
          onClick: () => navigate(`/accounting/money-in/receipts/${id}/allocate`),
        }
      : {
          id: 'pdf',
          label: 'Export PDF',
          icon: Download,
          onClick: () => void handlePdf(),
          disabled: exporting,
        }

  return (
    <MoneyInWorkspaceShell
      title={receiptNo}
      contentClassName="border-0 bg-transparent p-0 shadow-none"
    >
      <div className="mi-receipt-detail-page">
        <PageBackLink to="/accounting/money-in/receipts" label="Back to Receipts" className="no-print" />

        {statusBanner ? (
          <div className="mi-receipt-detail-banner no-print" role="status">
            {statusBanner}
          </div>
        ) : null}

        {receipt.sourceType === 'CRM_PAYMENT_RECEIPT' && receipt.sourceDocumentId ? (
          <div className="mi-receipt-detail-source no-print">
            <div className="mi-receipt-detail-source__title">Source: CRM Payment Receipt</div>
            <div className="mi-receipt-detail-source__body">
              CRM document: {receipt.sourceDocumentNumberSnapshot || receipt.sourceDocumentId}
              {' · '}
              <Link className="mi-receipt-detail-source__link" to={`/sales/receipts/${receipt.sourceDocumentId}`}>
                Open CRM Receipt
              </Link>
            </div>
          </div>
        ) : null}

        <header className="mi-receipt-detail-toolbar no-print">
          <div className="mi-receipt-detail-toolbar__identity">
            <div className="mi-receipt-detail-toolbar__title-row">
              <h1 className="mi-receipt-detail-toolbar__title">{receiptNo}</h1>
              <ErpStatusChip label={RECEIPT_STATUS_LABELS[receipt.status]} tone={receiptStatusTone(receipt.status)} />
            </div>
            <p className="mi-receipt-detail-toolbar__subtitle">
              {receipt.customerNameSnapshot}
              <span aria-hidden> · </span>
              {CUSTOMER_RECEIPT_PAYMENT_METHOD_LABELS[receipt.paymentMethod]}
              <span aria-hidden> · </span>
              {formatDate(receipt.receiptDate)}
            </p>
          </div>

          <ErpCommandBar
            sticky={false}
            className="mi-receipt-detail-toolbar__actions"
            maxHeaderActions={4}
            primaryAction={primaryAction}
            secondaryActions={[
              ...(canEdit
                ? [
                    {
                      id: 'edit',
                      label: 'Edit',
                      icon: Pencil,
                      pin: true,
                      onClick: () => navigate(`/accounting/money-in/receipts/${id}/edit`),
                    },
                  ]
                : []),
              ...(canAllocate && primaryAction.id !== 'allocate'
                ? [
                    {
                      id: 'allocate-secondary',
                      label: 'Allocate',
                      icon: ArrowLeftRight,
                      pin: true,
                      onClick: () => navigate(`/accounting/money-in/receipts/${id}/allocate`),
                    },
                  ]
                : []),
              {
                id: 'print',
                label: 'Print',
                icon: Printer,
                pin: true,
                onClick: () => printCustomerReceiptDocument({ fileName: receiptNo }),
              },
              ...(primaryAction.id !== 'pdf'
                ? [
                    {
                      id: 'pdf-secondary',
                      label: 'PDF',
                      icon: Download,
                      pin: true,
                      onClick: () => void handlePdf(),
                      disabled: exporting,
                    },
                  ]
                : []),
              ...(canValidate
                ? [
                    {
                      id: 'validate',
                      label: 'Validate',
                      icon: ClipboardCheck,
                      onClick: () => void runValidate(),
                    },
                  ]
                : []),
              ...(canMarkReady
                ? [
                    {
                      id: 'mark-ready',
                      label: 'Mark Ready',
                      icon: CheckCircle2,
                      onClick: () => void runMarkReady(),
                      disabled: acting,
                    },
                  ]
                : []),
              ...(hasAccountingLink
                ? [
                    {
                      id: 'accounting',
                      label: 'View Accounting',
                      icon: FileText,
                      onClick: () =>
                        navigate(`/accounting/ledger-entries/voucher/${receipt.accountingVoucherId}`),
                    },
                  ]
                : []),
            ]}
            destructiveActions={[
              ...(canCancel
                ? [
                    {
                      id: 'cancel',
                      label: 'Cancel',
                      icon: XCircle,
                      onClick: () => setShowCancel(true),
                    },
                  ]
                : []),
              ...(canReverse
                ? [
                    {
                      id: 'reverse',
                      label: 'Reverse Document',
                      icon: Undo2,
                      onClick: () => setShowReverse(true),
                      disabled: acting,
                    },
                  ]
                : []),
            ]}
          />
        </header>

        <div className="mi-receipt-detail-layout">
          <main className="mi-receipt-detail-main">
            <div className="ti-preview-canvas">
              <div className="ti-preview-canvas__sheet">
                <CustomerReceiptDocument receipt={receipt} allocations={history} />
              </div>
            </div>

            {receipt.status === 'POSTED' && actions?.viewAllocations && history.length > 0 ? (
              <SideCard title="Allocation history" className="mi-receipt-detail-history no-print">
                <div className="mi-receipt-detail-history__scroll">
                  <table className="mi-receipt-detail-history__table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice</th>
                        <th className="mi-receipt-detail-history__num">Amount</th>
                        <th className="mi-receipt-detail-history__num">Outstanding after</th>
                        <th>Status</th>
                        {perms.canReverseAllocation ? <th>Action</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.allocationId}>
                          <td className="tabular-nums">{row.allocationDate}</td>
                          <td>{row.invoiceNumber ?? '—'}</td>
                          <td className="mi-receipt-detail-history__num tabular-nums">
                            {formatCurrency(parseDecimal(row.allocatedAmount))}
                          </td>
                          <td className="mi-receipt-detail-history__num tabular-nums">
                            {row.invoiceOutstandingAfter
                              ? formatCurrency(parseDecimal(row.invoiceOutstandingAfter))
                              : '—'}
                          </td>
                          <td>{row.status}</td>
                          {perms.canReverseAllocation ? (
                            <td>
                              {row.status === 'POSTED' && row.batchId ? (
                                <button
                                  type="button"
                                  className="mi-receipt-detail-history__reverse"
                                  onClick={() => {
                                    setReverseBatchId(row.batchId)
                                    setAllocReverseReason('')
                                  }}
                                  disabled={acting}
                                >
                                  Reverse batch
                                </button>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SideCard>
            ) : null}
          </main>

          <aside className="mi-receipt-detail-rail no-print">
            <SideCard className="mi-receipt-detail-amount-card">
              <p className="mi-receipt-detail-amount-card__label">Gross receipt</p>
              <p className="mi-receipt-detail-amount-card__amount">
                {formatCurrency(parseDecimal(receipt.grossReceiptAmount))}
              </p>
              <p className="mi-receipt-detail-amount-card__meta">
                Bank {formatCurrency(parseDecimal(receipt.bankCashAmount))}
                {parseDecimal(receipt.customerTdsAmount) > 0
                  ? ` · TDS ${formatCurrency(parseDecimal(receipt.customerTdsAmount))}`
                  : ''}
              </p>
              {receipt.status === 'POSTED' ? (
                <p className="mi-receipt-detail-amount-card__meta">
                  Unallocated {formatCurrency(parseDecimal(receipt.unallocatedAmount))}
                </p>
              ) : null}
            </SideCard>

            <SideCard title="Customer">
              <TableLink to={entity360CustomerPath(receipt.customerId)} className="mi-receipt-detail-customer-link">
                {receipt.customerNameSnapshot}
              </TableLink>
              {receipt.customerGstinSnapshot ? (
                <p className="mi-receipt-detail-muted">GSTIN {receipt.customerGstinSnapshot}</p>
              ) : null}
              {receipt.customerCodeSnapshot ? (
                <p className="mi-receipt-detail-muted">Code {receipt.customerCodeSnapshot}</p>
              ) : null}
            </SideCard>

            <SideCard title="Receipt details">
              <dl className="mi-receipt-detail-meta-list">
                <SideMeta label="Receipt date">{formatDate(receipt.receiptDate)}</SideMeta>
                <SideMeta label="Posting date">
                  {receipt.postingDate ? formatDate(receipt.postingDate) : '—'}
                </SideMeta>
                <SideMeta label="Payment method">
                  {CUSTOMER_RECEIPT_PAYMENT_METHOD_LABELS[receipt.paymentMethod]}
                </SideMeta>
                <SideMeta label="Currency">{receipt.currencyCode}</SideMeta>
                <SideMeta label="Transaction ref">{receipt.transactionReference || '—'}</SideMeta>
                {receipt.paymentMethod === 'CHEQUE' ? (
                  <SideMeta label="Cheque">
                    {receipt.chequeNumber || '—'}
                    {receipt.chequeDate ? ` · ${formatDate(receipt.chequeDate)}` : ''}
                  </SideMeta>
                ) : null}
              </dl>
            </SideCard>

            {receipt.status === 'POSTED' ? (
              <SideCard title="Allocation summary">
                <dl className="mi-receipt-detail-meta-list">
                  <SideMeta label="Allocatable">
                    {formatCurrency(parseDecimal(receipt.allocatableAmount))}
                  </SideMeta>
                  <SideMeta label="Allocated">
                    {formatCurrency(parseDecimal(receipt.allocatedAmount))}
                  </SideMeta>
                  <SideMeta label="Unallocated">
                    {formatCurrency(parseDecimal(receipt.unallocatedAmount))}
                  </SideMeta>
                </dl>
              </SideCard>
            ) : null}

            <SideCard title="Linked documents">
              <dl className="mi-receipt-detail-meta-list">
                {receipt.sourceType === 'CRM_PAYMENT_RECEIPT' && receipt.sourceDocumentId ? (
                  <SideMeta label="CRM receipt">
                    <TableLink to={`/sales/receipts/${receipt.sourceDocumentId}`}>
                      {receipt.sourceDocumentNumberSnapshot || 'Open'}
                    </TableLink>
                  </SideMeta>
                ) : null}
                {hasAccountingLink ? (
                  <SideMeta label="Accounting voucher">
                    <TableLink to={`/accounting/ledger-entries/voucher/${receipt.accountingVoucherId}`}>
                      Open voucher
                    </TableLink>
                  </SideMeta>
                ) : null}
                {receipt.reversalVoucherId ? (
                  <SideMeta label="Reversal voucher">
                    <TableLink to={`/accounting/ledger-entries/voucher/${receipt.reversalVoucherId}`}>
                      Open reversal
                    </TableLink>
                  </SideMeta>
                ) : null}
                {receipt.sourceType !== 'CRM_PAYMENT_RECEIPT' && !hasAccountingLink && !receipt.reversalVoucherId ? (
                  <p className="mi-receipt-detail-muted">No linked documents</p>
                ) : null}
              </dl>
            </SideCard>

            <SideCard title="More actions">
              <div className="mi-receipt-detail-actions">
                {canEdit ? (
                  <ErpButton
                    variant="secondary"
                    icon={Pencil}
                    className="w-full justify-center"
                    onClick={() => navigate(`/accounting/money-in/receipts/${id}/edit`)}
                  >
                    Edit
                  </ErpButton>
                ) : null}
                {canAllocate ? (
                  <ErpButton
                    variant="secondary"
                    icon={ArrowLeftRight}
                    className="w-full justify-center"
                    onClick={() => navigate(`/accounting/money-in/receipts/${id}/allocate`)}
                  >
                    Allocate
                  </ErpButton>
                ) : null}
                <ErpButton
                  variant="secondary"
                  icon={Printer}
                  className="w-full justify-center"
                  onClick={() => printCustomerReceiptDocument({ fileName: receiptNo })}
                >
                  Print
                </ErpButton>
                <ErpButton
                  variant="secondary"
                  icon={Download}
                  className="w-full justify-center"
                  onClick={() => void handlePdf()}
                  disabled={exporting}
                >
                  Download PDF
                </ErpButton>
                <ErpButton
                  variant="ghost"
                  icon={FileText}
                  className="w-full justify-center"
                  onClick={() => navigate(entity360CustomerPath(receipt.customerId))}
                >
                  Customer 360
                </ErpButton>
              </div>
            </SideCard>
          </aside>
        </div>
      </div>

      <ValidationDrawer open={showValidate} onClose={() => setShowValidate(false)} report={report} />

      {showPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-5 shadow-lg">
            <h2 className="text-[15px] font-semibold text-erp-text">Post customer receipt?</h2>
            <p className="mt-2 text-[13px] text-erp-muted">
              Posting <strong>{receiptNo}</strong> for{' '}
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
            <Textarea
              className="mt-2"
              rows={3}
              placeholder="Reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
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
              Reversing <strong>{receiptNo}</strong> posts a reversing voucher, closes the receipt credit open item,
              and marks the receipt REVERSED. All posted allocations must be reversed first.
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
