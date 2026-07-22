import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FileText, HandCoins, Mail, Pencil, Printer, RotateCcw, Send } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  PaymentAdvicePreview,
  PaymentAllocationGrid,
  PaymentAllocationSummary,
  PaymentPostingPreviewModal,
  PayableConfirmModal,
  PaymentAllocationStatusBadge,
  VendorPaymentStatusBadge,
  type PaymentAllocationMap,
} from '@/components/accounting/payables'
import {
  allocatePaymentDemo,
  approveVendorPayment,
  getPayablesAuditTrail,
  getPaymentPostingPreview,
  getVendorPaymentById,
  postPaymentDemo,
  reversePaymentDemo,
  submitVendorPayment,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { PayablesAuditEntry, PaymentPostingPreview, VendorPayment } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
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

export function VendorPaymentDetailPage() {
  const { paymentId } = useParams<{ paymentId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [payment, setPayment] = useState<VendorPayment | null>(null)
  const [audit, setAudit] = useState<PayablesAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [supportTab, setSupportTab] = useState<SupportTab>('allocations')
  const [postPreview, setPostPreview] = useState<PaymentPostingPreview | null>(null)
  const [postOpen, setPostOpen] = useState(false)
  const [reverseOpen, setReverseOpen] = useState(false)
  const [reverseReason, setReverseReason] = useState('')
  const [adviceOpen, setAdviceOpen] = useState(false)
  const [allocating, setAllocating] = useState(() => searchParams.get('allocate') === '1')
  const [allocDraft, setAllocDraft] = useState<PaymentAllocationMap>({})

  const reload = useCallback(async () => {
    if (!paymentId) return
    setLoading(true)
    try {
      const [p, a] = await Promise.all([
        getVendorPaymentById(paymentId),
        getPayablesAuditTrail('vendor_payment', paymentId),
      ])
      setPayment(p)
      setAudit(a)
      setAllocDraft(Object.fromEntries(p.allocationLines.map((l) => [l.invoiceId, l.allocationAmount])))
      if (searchParams.get('allocate') === '1') setAllocating(true)
    } catch {
      setPayment(null)
    } finally {
      setLoading(false)
    }
  }, [paymentId, searchParams])

  useEffect(() => {
    void reload()
  }, [reload])

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Payables', to: '/accounting/payables' },
    { label: 'Payments', to: '/accounting/payables/payments' },
    { label: payment?.paymentNumber ?? 'Detail' },
  ]

  const openPost = async () => {
    if (!payment) return
    try {
      const preview = await getPaymentPostingPreview(payment.id)
      setPostPreview(preview)
      setPostOpen(true)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Preview failed')
    }
  }

  const confirmPost = async () => {
    if (!payment) return
    setBusy(true)
    try {
      await postPaymentDemo(payment.id)
      notify.success('Payment marked as posted in demo mode. Backend accounting posting and bank disbursement are not connected.')
      setPostOpen(false)
      setPostPreview(null)
      await reload()
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Post failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmReverse = async () => {
    if (!payment || !reverseReason.trim()) return
    setBusy(true)
    try {
      await reversePaymentDemo(payment.id, reverseReason.trim())
      notify.success('Payment reversed in demo mode. No GL reversal or bank recall was posted.')
      setReverseOpen(false)
      setReverseReason('')
      await reload()
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Reverse failed')
    } finally {
      setBusy(false)
    }
  }

  const saveAllocation = async () => {
    if (!payment) return
    setBusy(true)
    try {
      const lines = Object.entries(allocDraft)
        .filter(([, amt]) => amt > 0)
        .map(([invoiceId, allocationAmount]) => ({ invoiceId, allocationAmount }))
      await allocatePaymentDemo(payment.id, lines)
      notify.success('Allocation updated (demo)')
      setAllocating(false)
      await reload()
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Allocation failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Payment" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={6} />
      </OperationalPageShell>
    )
  }

  if (!payment) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState
          icon={FileText}
          title="Payment not found"
          action={
            <Link to="/accounting/payables/payments" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">
              Back
            </Link>
          }
        />
      </OperationalPageShell>
    )
  }

  const canEdit = perms.canEditPayment && payment.status === 'Draft'
  const canAllocate =
    perms.canAllocatePayment &&
    payment.unallocatedAmount > 0 &&
    payment.status !== 'Reversed' &&
    payment.status !== 'Cancelled'
  const canRealloc = perms.canReallocatePayment && payment.status === 'Posted' && payment.unallocatedAmount > 0
  const canPost =
    perms.canPostPayment &&
    (payment.status === 'Draft' || payment.status === 'Submitted' || payment.status === 'Approved')
  const canReverse = perms.canReversePayment && payment.status === 'Posted'

  const secondary = [
    ...(canEdit ? [{ id: 'edit', label: 'Edit draft', icon: Pencil, onClick: () => navigate(`/accounting/payables/payments/${payment.id}/edit`) }] : []),
    ...(canAllocate && !allocating
      ? [{ id: 'alloc', label: 'Allocate', icon: HandCoins, onClick: () => setAllocating(true) }]
      : []),
    ...(allocating ? [{ id: 'save-alloc', label: busy ? 'Saving…' : 'Save allocation', icon: HandCoins, onClick: () => void saveAllocation() }] : []),
    ...(perms.canSubmitPayment && payment.status === 'Draft'
      ? [{
          id: 'submit',
          label: 'Submit',
          icon: Send,
          onClick: async () => {
            setBusy(true)
            try {
              await submitVendorPayment(payment.id)
              notify.success('Submitted for approval')
              await reload()
            } catch (e) {
              notify.error(e instanceof PayablesServiceError ? e.message : 'Submit failed')
            } finally {
              setBusy(false)
            }
          },
        }]
      : []),
    ...(perms.canApprovePayment && payment.status === 'Submitted'
      ? [{
          id: 'approve',
          label: 'Approve',
          icon: Send,
          onClick: async () => {
            setBusy(true)
            try {
              await approveVendorPayment(payment.id)
              notify.success('Payment approved')
              await reload()
            } catch (e) {
              notify.error(e instanceof PayablesServiceError ? e.message : 'Approve failed')
            } finally {
              setBusy(false)
            }
          },
        }]
      : []),
    ...(canPost ? [{ id: 'post', label: 'Post (Demo)', icon: FileText, onClick: () => void openPost() }] : []),
    ...(canReverse ? [{ id: 'reverse', label: 'Reverse', icon: RotateCcw, onClick: () => setReverseOpen(true) }] : []),
    ...(perms.canPrint ? [{ id: 'advice', label: 'Payment advice', icon: Mail, onClick: () => setAdviceOpen(true) }] : []),
    ...(perms.canPrint ? [{ id: 'print', label: 'Print', icon: Printer, onClick: () => notify.info('Print preview — demo only') }] : []),
  ]

  const allocMap: PaymentAllocationMap = allocating
    ? allocDraft
    : Object.fromEntries(payment.allocationLines.map((l) => [l.invoiceId, l.allocationAmount]))

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={payment.paymentNumber}
      description={`${payment.vendorName} · ${payment.paymentMode}`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/payables/payments/${payment.id}`}
      commandBar={<ErpCommandBar inline sticky secondaryActions={secondary} />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <VendorPaymentStatusBadge status={payment.status} />
        <PaymentAllocationStatusBadge status={payment.allocationStatus} />
        {payment.voucherId ? (
          <Link to={`/accounting/ledger-entries/voucher/${payment.voucherId}`} className="text-[12px] font-medium text-sky-700 hover:underline">
            Voucher {payment.voucherNumber ?? payment.voucherId}
          </Link>
        ) : null}
        {payment.ledgerEntryIds?.[0] ? (
          <Link to={`/accounting/ledger/${payment.ledgerEntryIds[0]}`} className="text-[12px] font-medium text-sky-700 hover:underline">
            Ledger entry
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-erp-border p-4 lg:col-span-2">
          <h3 className="mb-3 text-[13px] font-semibold">Payment information</h3>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Vendor" value={payment.vendorName} />
            <Field label="Payment date" value={payment.paymentDate} />
            <Field label="Posting date" value={payment.postingDate} />
            <Field label="Payment mode" value={payment.paymentMode} />
            <Field label="Bank account" value={payment.bankAccountName} />
            <Field label="Gross amount" value={formatCurrency(payment.grossAmount)} />
            <Field label="Net payment" value={formatCurrency(payment.netPayment)} />
            {perms.canViewTds ? <Field label="TDS" value={formatCurrency(payment.tdsDeducted)} /> : null}
            {payment.tdsSection ? <Field label="TDS section" value={payment.tdsSection} /> : null}
            <Field label="Other deductions" value={formatCurrency(payment.otherDeductions)} />
            <Field label="Bank charges" value={formatCurrency(payment.bankCharges)} />
            {payment.transactionReference ? <Field label="Transaction ref" value={payment.transactionReference} /> : null}
            {payment.chequeNumber ? <Field label="Cheque" value={`${payment.chequeNumber} · ${payment.chequeDate}`} /> : null}
            {payment.beneficiaryBankMasked ? <Field label="Beneficiary bank" value={payment.beneficiaryBankMasked} /> : null}
            {payment.currency !== 'INR' ? <Field label="Exchange rate" value={payment.exchangeRate} /> : null}
            <Field label="Narration" value={payment.narration} />
            <Field label="Created by" value={payment.createdBy} />
            {payment.postedBy ? (
              <Field label="Posted by" value={`${payment.postedBy} · ${payment.postedAt ? formatDateTime(payment.postedAt) : ''}`} />
            ) : null}
          </dl>
        </section>

        <aside className="rounded-lg border border-erp-border bg-erp-surface-alt/30 p-4">
          <PaymentAllocationSummary
            paymentAmount={payment.amount}
            tdsDeducted={payment.tdsDeducted}
            availableAmount={payment.amount}
            allocatedAmount={payment.allocatedAmount}
            unallocatedAmount={payment.unallocatedAmount}
            allocationStatus={payment.allocationStatus}
          />
          {canRealloc ? (
            <button
              type="button"
              className="erp-btn erp-btn-secondary mt-3 h-8 w-full px-3 text-[12px]"
              onClick={() => navigate(`/accounting/payables/payments/${payment.id}/edit`)}
            >
              Reallocate (edit draft flow)
            </button>
          ) : null}
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
          <>
            {allocating ? (
              <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-[13px] text-sky-900">
                Allocation mode — adjust amounts and save. Demo only; no bank settlement.
              </p>
            ) : null}
            <PaymentAllocationGrid
              invoices={payment.allocationLines.map((l) => ({
                id: l.invoiceId,
                invoiceNumber: l.invoiceNumber,
                invoiceDate: l.invoiceDate,
                dueDate: l.dueDate,
                outstandingBalance: l.outstandingBalance,
                overdueDays: l.overdueDays,
                status: 'Partially Paid',
                vendorId: payment.vendorId,
                vendorCode: payment.vendorCode,
                vendorName: payment.vendorName,
                vendorInvoiceNumber: '',
                postingDate: l.invoiceDate,
                originalAmount: l.originalAmount,
                taxableAmount: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                paidAmount: l.previousAllocation,
                debitNoteAmount: 0,
                matchStatus: 'Fully Matched',
                approvalStatus: 'Approved',
                paymentHold: null,
                ageingBucket: 'Not Due',
                plant: '',
                location: '',
                costCentre: '',
                buyer: '',
                poNumber: null,
                grnNumber: null,
                reference: null,
                tdsAmount: l.tdsDeducted,
                tdsSection: null,
                msmeVendor: false,
                duplicateWarning: false,
                gstRegistrationType: 'Regular',
                hasDispute: false,
                hasDebitNote: false,
                sourcePurchaseInvoiceId: null,
              }))}
              allocations={allocMap}
              availableAmount={payment.amount}
              readOnly={!allocating}
              onChange={allocating ? (id, amt) => setAllocDraft((m) => ({ ...m, [id]: amt })) : undefined}
            />
          </>
        ) : null}

        {supportTab === 'attachments' ? (
          <p className="rounded-lg border border-dashed border-erp-border px-4 py-8 text-center text-[13px] text-erp-muted">
            Attachments placeholder — upload integration not connected.
          </p>
        ) : null}

        {supportTab === 'approval' ? (
          <p className="text-[13px] text-erp-muted">
            {payment.status === 'Submitted'
              ? 'Awaiting approval — demo workflow only.'
              : payment.status === 'Posted'
                ? `Posted by ${payment.postedBy ?? '—'}`
                : payment.approvedBy
                  ? `Approved by ${payment.approvedBy}`
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

      <PaymentPostingPreviewModal
        open={postOpen}
        preview={postPreview}
        onClose={() => setPostOpen(false)}
        onConfirmPost={() => void confirmPost()}
        busy={busy}
      />

      <PaymentAdvicePreview open={adviceOpen} onClose={() => setAdviceOpen(false)} payment={payment} />

      <PayableConfirmModal
        open={reverseOpen}
        onClose={() => {
          setReverseOpen(false)
          setReverseReason('')
        }}
        title="Reverse payment (demo)"
        description="This will create a demo reversal entry. No GL reversal or bank recall is posted."
        confirmLabel={busy ? 'Reversing…' : 'Confirm reverse'}
        onConfirm={() => void confirmReverse()}
      >
        <textarea
          className="erp-input mt-3 w-full text-[13px]"
          rows={3}
          placeholder="Reason (required)"
          value={reverseReason}
          onChange={(e) => setReverseReason(e.target.value)}
        />
      </PayableConfirmModal>
    </OperationalPageShell>
  )
}
