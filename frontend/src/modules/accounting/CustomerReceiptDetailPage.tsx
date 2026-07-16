import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FileText, HandCoins, Pencil, Printer, RotateCcw, Send } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableLink } from '@/components/ui/AppLink'
import {
  AllocationStatusBadge,
  ReceiptAllocationGrid,
  ReceiptAllocationSummary,
  ReceiptPostingPreviewModal,
  ReceiptStatusBadge,
  ReceivableConfirmModal,
  type AllocationMap,
} from '@/components/accounting/receivables'
import {
  getCustomerReceiptById,
  getReceiptPostingPreview,
  getReceivableAuditTrail,
  postReceiptDemo,
  reverseReceiptDemo,
  updateCustomerReceipt,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'
import type { CustomerReceipt, ReceiptPostingPreview, ReceivableAuditEntry } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type SupportTab = 'allocations' | 'attachments' | 'approval' | 'audit'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

export function CustomerReceiptDetailPage() {
  const { receiptId } = useParams<{ receiptId: string }>()
  const navigate = useNavigate()
  const perms = useReceivablesPermissions()
  const [receipt, setReceipt] = useState<CustomerReceipt | null>(null)
  const [audit, setAudit] = useState<ReceivableAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [supportTab, setSupportTab] = useState<SupportTab>('allocations')
  const [postPreview, setPostPreview] = useState<ReceiptPostingPreview | null>(null)
  const [postOpen, setPostOpen] = useState(false)
  const [reverseOpen, setReverseOpen] = useState(false)
  const [reverseReason, setReverseReason] = useState('')

  const reload = useCallback(async () => {
    if (!receiptId) return
    setLoading(true)
    try {
      const [r, a] = await Promise.all([getCustomerReceiptById(receiptId), getReceivableAuditTrail(receiptId)])
      setReceipt(r)
      setAudit(a)
    } catch {
      setReceipt(null)
    } finally {
      setLoading(false)
    }
  }, [receiptId])

  useEffect(() => {
    void reload()
  }, [reload])

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Receivables', to: '/accounting/receivables' },
    { label: 'Receipts', to: '/accounting/receivables/receipts' },
    { label: receipt?.receiptNumber ?? 'Detail' },
  ]

  const openPost = async () => {
    if (!receipt) return
    try {
      const preview = await getReceiptPostingPreview(receipt.id)
      setPostPreview(preview)
      setPostOpen(true)
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Preview failed')
    }
  }

  const confirmPost = async () => {
    if (!receipt) return
    setBusy(true)
    try {
      await postReceiptDemo(receipt.id)
      notify.success('Receipt marked as posted in demo mode. Backend accounting posting is not connected.')
      setPostOpen(false)
      setPostPreview(null)
      await reload()
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Post failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmReverse = async () => {
    if (!receipt || !reverseReason.trim()) return
    setBusy(true)
    try {
      await reverseReceiptDemo(receipt.id, reverseReason.trim())
      notify.success('Receipt reversed in demo mode.')
      setReverseOpen(false)
      setReverseReason('')
      await reload()
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Reverse failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Receipt" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={6} />
      </OperationalPageShell>
    )
  }

  if (!receipt) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={FileText} title="Receipt not found" action={<Link to="/accounting/receivables/receipts" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">Back</Link>} />
      </OperationalPageShell>
    )
  }

  const allocMap: AllocationMap = Object.fromEntries(receipt.allocationLines.map((l) => [l.invoiceId, l.allocationAmount]))
  const canEdit = perms.canEditReceipt && receipt.voucherStatus === 'Draft'
  const canPost =
    perms.canPostReceipt &&
    (receipt.voucherStatus === 'Draft' || receipt.voucherStatus === 'Pending Approval' || receipt.voucherStatus === 'Approved')
  const canReverse = perms.canReverseReceipt && receipt.voucherStatus === 'Posted'
  const canRealloc = perms.canReallocate && receipt.voucherStatus === 'Posted' && receipt.unallocatedAmount > 0

  const secondary = [
    ...(canEdit ? [{ id: 'edit', label: 'Edit draft', icon: Pencil, onClick: () => navigate(`/accounting/receivables/receipts/${receipt.id}/edit`) }] : []),
    ...(canRealloc ? [{ id: 'realloc', label: 'Reallocate', icon: HandCoins, onClick: () => navigate(`/accounting/receivables/receipts/${receipt.id}/edit`) }] : []),
    ...(perms.canSubmitReceipt && receipt.voucherStatus === 'Draft'
      ? [{
          id: 'submit',
          label: 'Submit',
          icon: Send,
          onClick: async () => {
            setBusy(true)
            try {
              await updateCustomerReceipt(receipt.id, { voucherStatus: 'Pending Approval' })
              notify.success('Submitted for approval')
              await reload()
            } catch (e) {
              notify.error(e instanceof ReceivablesServiceError ? e.message : 'Submit failed')
            } finally {
              setBusy(false)
            }
          },
        }]
      : []),
    ...(canPost ? [{ id: 'post', label: 'Post (Demo)', icon: FileText, onClick: () => void openPost() }] : []),
    ...(canReverse ? [{ id: 'reverse', label: 'Reverse', icon: RotateCcw, onClick: () => setReverseOpen(true) }] : []),
    ...(perms.canPrint ? [{ id: 'print', label: 'Print', icon: Printer, onClick: () => notify.info('Print preview — demo only') }] : []),
  ]

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={receipt.receiptNumber}
      description={`${receipt.customerName} · ${receipt.paymentMode}`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/receivables/receipts/${receipt.id}`}
      commandBar={<ErpCommandBar inline sticky secondaryActions={secondary} />}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <ReceiptStatusBadge status={receipt.voucherStatus} />
        <AllocationStatusBadge status={receipt.allocationStatus} />
        {receipt.relatedVoucherId ? (
          <Link to={`/accounting/vouchers/${receipt.relatedVoucherId}`} className="text-[12px] font-medium text-sky-700 hover:underline">
            Voucher {receipt.relatedVoucherNumber ?? receipt.relatedVoucherId}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-erp-border p-4 lg:col-span-2">
          <h3 className="mb-3 text-[13px] font-semibold">Receipt information</h3>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Customer" value={<TableLink to={`/accounting/receivables/customer/${receipt.customerId}`}>{receipt.customerName}</TableLink>} />
            <Field label="Receipt date" value={receipt.receiptDate} />
            <Field label="Posting date" value={receipt.postingDate} />
            <Field label="Payment mode" value={receipt.paymentMode} />
            <Field label="Bank / Cash" value={receipt.bankOrCashAccountName} />
            <Field label="Receipt amount" value={formatCurrency(receipt.receiptAmount)} />
            <Field label="TDS" value={formatCurrency(receipt.tdsDeducted)} />
            <Field label="Bank charges" value={formatCurrency(receipt.bankCharges)} />
            <Field label="Net received" value={formatCurrency(receipt.netAmountReceived)} />
            {receipt.transactionReference ? <Field label="Transaction ref" value={receipt.transactionReference} /> : null}
            {receipt.chequeNumber ? <Field label="Cheque" value={`${receipt.chequeNumber} · ${receipt.chequeDate}`} /> : null}
            {receipt.currency !== 'INR' ? <Field label="Exchange rate" value={receipt.exchangeRate} /> : null}
            <Field label="Narration" value={receipt.narration} />
            <Field label="Created by" value={receipt.createdBy} />
            {receipt.postedBy ? <Field label="Posted by" value={`${receipt.postedBy} · ${receipt.postedAt ? formatDateTime(receipt.postedAt) : ''}`} /> : null}
          </dl>
        </section>

        <aside className="rounded-lg border border-erp-border bg-erp-surface-alt/30 p-4">
          <ReceiptAllocationSummary
            receiptAmount={receipt.receiptAmount}
            tdsDeducted={receipt.tdsDeducted}
            bankCharges={receipt.bankCharges}
            availableAmount={receipt.netAmountReceived}
            allocatedAmount={receipt.allocatedAmount}
            unallocatedAmount={receipt.unallocatedAmount}
            allocationStatus={receipt.allocationStatus}
          />
        </aside>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex gap-1 border-b border-erp-border" role="tablist">
          {(
            [
              ['allocations', 'Allocation lines'],
              ['attachments', 'Attachments'],
              ['approval', 'Approval history'],
              ['audit', 'Audit trail'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={supportTab === id}
              className={cn(
                'border-b-2 px-3 py-2 text-[12px] font-semibold',
                supportTab === id ? 'border-erp-primary text-erp-primary' : 'border-transparent text-erp-muted',
              )}
              onClick={() => setSupportTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {supportTab === 'allocations' ? (
          <ReceiptAllocationGrid
            invoices={receipt.allocationLines.map((l) => ({
              id: l.invoiceId,
              invoiceNumber: l.invoiceNumber,
              invoiceDate: l.invoiceDate,
              dueDate: l.dueDate,
              outstandingBalance: l.outstandingBalance,
              overdueDays: l.overdueDays,
              invoiceStatus: 'Partially Paid',
              customerId: receipt.customerId,
              customerCode: receipt.customerCode,
              customerName: receipt.customerName,
              customerGstNumber: null,
              salesOrderNumber: null,
              deliveryNumber: null,
              referenceNumber: null,
              paymentTerms: '',
              placeOfSupply: '',
              salesperson: '',
              territory: '',
              location: '',
              originalAmount: l.originalAmount,
              taxableAmount: 0,
              cgst: 0,
              sgst: 0,
              igst: 0,
              appliedAmount: l.previousAllocation,
              creditNoteAmount: 0,
              collectionStatus: 'Not Contacted',
              collectionOwner: '',
              gstStatus: '',
              eInvoiceStatus: '',
              eInvoiceIrn: null,
              eWayBillNumber: null,
              hasDispute: false,
              hasCreditNote: false,
              lastReminderDate: null,
              paymentPromiseDate: null,
              invoiceType: '',
              sourceSalesInvoiceId: null,
              postingDate: l.invoiceDate,
              ageingBucket: 'Not Due',
            }))}
            allocations={allocMap}
            availableAmount={receipt.netAmountReceived}
            readOnly
          />
        ) : null}

        {supportTab === 'attachments' ? (
          <p className="rounded-lg border border-dashed border-erp-border px-4 py-8 text-center text-[13px] text-erp-muted">
            Attachments placeholder — upload integration not connected.
          </p>
        ) : null}

        {supportTab === 'approval' ? (
          <p className="text-[13px] text-erp-muted">
            {receipt.voucherStatus === 'Pending Approval'
              ? 'Awaiting approval — demo workflow only.'
              : receipt.voucherStatus === 'Posted'
                ? `Posted by ${receipt.postedBy ?? '—'}`
                : 'No approval history yet.'}
          </p>
        ) : null}

        {supportTab === 'audit' && perms.canViewAudit ? (
          <ul className="space-y-2">
            {audit.map((a) => (
              <li key={a.id} className="rounded-md border border-erp-border px-3 py-2 text-[13px]">
                <span className="font-medium">{a.action}</span>
                <span className="text-erp-muted"> — {a.details}</span>
                <p className="text-[11px] text-erp-muted">
                  {a.performedBy} · {formatDateTime(a.performedAt)}
                  {a.isDemo ? ' · Demo' : ''}
                </p>
              </li>
            ))}
            {audit.length === 0 ? <p className="text-[13px] text-erp-muted">No audit entries.</p> : null}
          </ul>
        ) : null}
      </div>

      <ReceiptPostingPreviewModal open={postOpen} preview={postPreview} onClose={() => setPostOpen(false)} onConfirmPost={() => void confirmPost()} busy={busy} />

      <ReceivableConfirmModal
        open={reverseOpen}
        onClose={() => {
          setReverseOpen(false)
          setReverseReason('')
        }}
        title="Reverse receipt (demo)"
        description="This will create a demo reversal entry. No GL reversal is posted."
        confirmLabel={busy ? 'Reversing…' : 'Confirm reverse'}
        onConfirm={() => void confirmReverse()}
      >
        <textarea className="erp-input mt-3 w-full text-[13px]" rows={3} placeholder="Reason (required)" value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} />
      </ReceivableConfirmModal>
    </OperationalPageShell>
  )
}
