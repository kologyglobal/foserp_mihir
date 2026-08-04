import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Pencil,
  Printer,
  RefreshCw,
  Send,
  Undo2,
  XCircle,
} from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { entity360CustomerPath } from '@/config/entity360Routes'
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
import { formatDate } from '@/utils/dates/format'
import { downloadSalesInvoicePdf, printSalesInvoiceDocument, salesInvoicePdfFileName } from '@/utils/salesInvoiceExport'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  MasterRefreshModal,
  sourceTypeLabel,
} from '@/modules/accounting/shared/invoices'
import {
  invoiceDisplayNumber,
  moneyInStatusTone,
  MONEY_IN_STATUS_LABELS,
  parseDecimal,
  resolveSettlementStatus,
  SETTLEMENT_STATUS_LABELS,
  settlementStatusTone,
  summarizeReceiptValidationToast,
} from '../moneyInUi'
import { PostConfirmModal } from '../components/PostConfirmModal'
import { ValidationDrawer } from '../components/ValidationDrawer'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'
import { SalesInvoiceDocument } from './SalesInvoiceDocument'

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

export function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [invoice, setInvoice] = useState<SalesInvoiceDto | null>(null)
  const [report, setReport] = useState<SalesInvoiceValidationPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showValidate, setShowValidate] = useState(false)
  const [showPost, setShowPost] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showReverse, setShowReverse] = useState(false)
  const [reverseReason, setReverseReason] = useState('')
  const [showMasterRefresh, setShowMasterRefresh] = useState(false)

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
      else {
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
      setInvoice(await markSalesInvoiceReady(id))
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
      setInvoice(await cancelSalesInvoice(id, cancelReason.trim()))
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

  const handlePdf = async () => {
    if (!invoice) return
    setExporting(true)
    try {
      const result = await downloadSalesInvoicePdf(invoice)
      if (!result.ok) notify.error(result.error || 'PDF export failed')
      else notify.success('PDF downloaded')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setExporting(false)
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
  const invNo = invoiceDisplayNumber(invoice)
  const settlement = resolveSettlementStatus(invoice)
  const canEdit = mergeAllowedAction(perms.canEditInvoice, actions?.edit)
  const canValidate = mergeAllowedAction(perms.canViewInvoice, actions?.validate)
  const canMarkReady = mergeAllowedAction(perms.canEditInvoice, actions?.markReady)
  const canPost = mergeAllowedAction(perms.canPostInvoice, actions?.post)
  const canCancel = mergeAllowedAction(perms.canCancelInvoice, actions?.cancel)
  const canReverse = mergeAllowedAction(perms.canReverseInvoice, actions?.reverse)
  const hasAccountingLink =
    (invoice.status === 'POSTED' || invoice.status === 'REVERSED') && Boolean(invoice.accountingVoucherId)
  const outstanding = parseDecimal(invoice.outstandingAmount)
  const amountDue =
    invoice.status === 'POSTED' || invoice.status === 'REVERSED'
      ? outstanding
      : parseDecimal(invoice.totalAmount)

  const sourceSnap = invoice.sourceDocumentSnapshot as {
    salesOrderNo?: string
    documentNumber?: string
    invoiceNo?: string
  } | null
  const sourceDocNo = sourceSnap?.salesOrderNo ?? sourceSnap?.documentNumber ?? sourceSnap?.invoiceNo ?? null

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

  const primaryAction = canPost
    ? {
        id: 'post',
        label: 'Post',
        icon: Send,
        onClick: () => setShowPost(true),
        disabled: acting,
      }
    : {
        id: 'pdf',
        label: 'Export PDF',
        icon: Download,
        onClick: () => void handlePdf(),
        disabled: exporting,
      }

  return (
    <MoneyInWorkspaceShell title={invNo} contentClassName="border-0 bg-transparent p-0 shadow-none">
      <div className="mi-receipt-detail-page mi-si-detail-page">
        <PageBackLink to="/accounting/money-in/invoices" label="Back to Invoices" className="no-print" />

        {statusBanner ? (
          <div className="mi-receipt-detail-banner no-print" role="status">
            {statusBanner}
          </div>
        ) : null}

        {invoice.createdChannel === 'CRM' || invoice.sourceType === 'CRM_TAX_INVOICE' ? (
          <div className="mi-receipt-detail-source no-print">
            <div className="mi-receipt-detail-source__title">Unified sales invoice</div>
            <div className="mi-receipt-detail-source__body">
              {invoice.legacyCrmInvoiceNo
                ? `Legacy commercial ref ${invoice.legacyCrmInvoiceNo} · same document as CRM / Sales`
                : 'Created from CRM commercial workflow — one Accounting sales invoice'}
              {invoice.legacyCrmTaxInvoiceId ? (
                <>
                  {' · '}
                  <Link
                    className="mi-receipt-detail-source__link"
                    to={`/sales/invoices/${invoice.id}`}
                  >
                    Open Sales view
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <header className="mi-receipt-detail-toolbar no-print">
          <div className="mi-receipt-detail-toolbar__identity">
            <div className="mi-receipt-detail-toolbar__title-row">
              <h1 className="mi-receipt-detail-toolbar__title">{invNo}</h1>
              <ErpStatusChip label={MONEY_IN_STATUS_LABELS[invoice.status]} tone={moneyInStatusTone(invoice.status)} />
              {settlement ? (
                <ErpStatusChip label={SETTLEMENT_STATUS_LABELS[settlement]} tone={settlementStatusTone(settlement)} />
              ) : null}
            </div>
            <p className="mi-receipt-detail-toolbar__subtitle">
              {invoice.customerNameSnapshot}
              <span aria-hidden> · </span>
              {sourceTypeLabel(invoice.sourceType)}
              <span aria-hidden> · </span>
              {formatDate(invoice.invoiceDate)}
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
                      onClick: () => navigate(`/accounting/money-in/invoices/${id}/edit`),
                    },
                  ]
                : []),
              {
                id: 'print',
                label: 'Print',
                icon: Printer,
                pin: true,
                onClick: () => printSalesInvoiceDocument({ fileName: salesInvoicePdfFileName(invoice) }),
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
                        navigate(`/accounting/ledger-entries/voucher/${invoice.accountingVoucherId}`),
                    },
                  ]
                : []),
              ...(canEdit && invoice.status === 'DRAFT'
                ? [
                    {
                      id: 'refresh-master',
                      label: 'Refresh customer',
                      icon: RefreshCw,
                      onClick: () => setShowMasterRefresh(true),
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
                      label: 'Reverse',
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
                <SalesInvoiceDocument invoice={invoice} />
              </div>
            </div>
          </main>

          <aside className="mi-receipt-detail-rail no-print">
            <SideCard className="mi-receipt-detail-amount-card">
              <p className="mi-receipt-detail-amount-card__label">
                {invoice.status === 'POSTED' || invoice.status === 'REVERSED' ? 'Amount Due' : 'Invoice Total'}
              </p>
              <p className="mi-receipt-detail-amount-card__amount">{formatCurrency(amountDue)}</p>
              {(invoice.status === 'POSTED' || invoice.status === 'REVERSED') && (
                <p className="mi-receipt-detail-amount-card__meta">
                  Paid {formatCurrency(parseDecimal(invoice.amountPaid))}
                  {parseDecimal(invoice.amountAdjusted) > 0
                    ? ` · Adjusted ${formatCurrency(parseDecimal(invoice.amountAdjusted))}`
                    : ''}
                </p>
              )}
            </SideCard>

            <SideCard title="Customer">
              <Link className="mi-receipt-detail-customer-link" to={entity360CustomerPath(invoice.customerId)}>
                {invoice.customerNameSnapshot}
              </Link>
              {invoice.customerCodeSnapshot ? (
                <p className="mi-receipt-detail-muted">{invoice.customerCodeSnapshot}</p>
              ) : null}
              {invoice.customerGstinSnapshot ? (
                <p className="mi-receipt-detail-muted">GSTIN {invoice.customerGstinSnapshot}</p>
              ) : null}
            </SideCard>

            <SideCard title="Invoice details">
              <dl className="mi-receipt-detail-meta-list">
                <SideMeta label="Invoice date">{formatDate(invoice.invoiceDate)}</SideMeta>
                <SideMeta label="Posting date">{invoice.postingDate ? formatDate(invoice.postingDate) : '—'}</SideMeta>
                <SideMeta label="Due date">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</SideMeta>
                <SideMeta label="Payment terms">
                  {invoice.paymentTermsDays != null ? `${invoice.paymentTermsDays} days` : invoice.paymentTerms ?? '—'}
                </SideMeta>
                <SideMeta label="Customer PO">{invoice.customerPoNumber ?? '—'}</SideMeta>
                <SideMeta label="Currency">
                  {invoice.currencyCode} @ {invoice.exchangeRate}
                </SideMeta>
                <SideMeta label="Place of supply">{invoice.placeOfSupply ?? '—'}</SideMeta>
              </dl>
            </SideCard>

            <SideCard title="Source & links">
              <dl className="mi-receipt-detail-meta-list">
                <SideMeta label="Source">{sourceTypeLabel(invoice.sourceType)}</SideMeta>
                {sourceDocNo ? <SideMeta label="Source no.">{sourceDocNo}</SideMeta> : null}
                {invoice.salesOrderNo ? (
                  <SideMeta label="Sales order">
                    {invoice.salesOrderId ? (
                      <Link to={`/sales/orders/${invoice.salesOrderId}`}>{invoice.salesOrderNo}</Link>
                    ) : (
                      invoice.salesOrderNo
                    )}
                  </SideMeta>
                ) : null}
                {invoice.proformaNo ? <SideMeta label="Proforma">{invoice.proformaNo}</SideMeta> : null}
                {invoice.quotationNo ? <SideMeta label="Quotation">{invoice.quotationNo}</SideMeta> : null}
                {hasAccountingLink ? (
                  <SideMeta label="Accounting">
                    <Link to={`/accounting/ledger-entries/voucher/${invoice.accountingVoucherId}`}>
                      View voucher
                    </Link>
                  </SideMeta>
                ) : null}
              </dl>
            </SideCard>

            {invoice.reversalReason ? (
              <SideCard title="Reversal">
                <p className="mi-receipt-detail-muted">{invoice.reversalReason}</p>
              </SideCard>
            ) : null}
          </aside>
        </div>
      </div>

      <MasterRefreshModal
        open={showMasterRefresh}
        onClose={() => setShowMasterRefresh(false)}
        variant="crm"
        documentId={invoice.id}
        partyId={invoice.customerId}
        snapshot={{
          name: invoice.customerNameSnapshot,
          code: invoice.customerCodeSnapshot,
          gstin: invoice.customerGstinSnapshot,
          pan: invoice.customerPanSnapshot,
        }}
        onApplied={() => void load()}
      />

      <ValidationDrawer open={showValidate} onClose={() => setShowValidate(false)} report={report} />
      <PostConfirmModal
        open={showPost}
        invoiceLabel={invNo}
        totalAmount={invoice.totalAmount}
        posting={acting}
        onConfirm={() => void runPost()}
        onCancel={() => setShowPost(false)}
      />

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 no-print">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Cancel invoice</h3>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 no-print">
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
