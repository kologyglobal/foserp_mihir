import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Ban,
  Building2,
  CheckCircle2,
  FileText,
  FileWarning,
  GitCompare,
  PauseCircle,
  Pencil,
  Printer,
  Send,
  ShieldAlert,
  Stamp,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { ErpCardSection, ErpViewField } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Badge } from '@/components/ui/Badge'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import { Textarea } from '@/components/forms/Inputs'
import {
  commercialTermsSummary,
  hasMeaningfulTaxTotals,
  notesSummary,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import {
  approveInvoiceMatchingException,
  approvePurchaseInvoice,
  computeInvoiceMatching,
  createDebitNoteFromInvoice,
  getPurchaseInvoiceById,
  holdPurchaseInvoice,
  postPurchaseInvoice,
  PurchaseServiceError,
  PURCHASE_INVOICE_ORIGIN_LABELS,
  PURCHASE_INVOICE_STATUS_LABELS,
  INVOICE_MATCHING_RESULT_STATUS_LABELS,
  rejectPurchaseInvoice,
  submitPurchaseInvoiceForApproval,
  verifyPurchaseInvoice,
} from '@/services/purchase'
import type { InvoiceMatchingResult, PurchaseInvoice } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { usePurchasePermissions } from '@/utils/permissions'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

function matchColor(
  status: InvoiceMatchingResult['overallStatus'],
): 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (status === 'fully_matched') return 'green'
  if (status === 'within_tolerance') return 'blue'
  if (status === 'duplicate_invoice' || status === 'missing_grn') return 'red'
  if (
    status === 'quantity_mismatch'
    || status === 'rate_mismatch'
    || status === 'tax_mismatch'
    || status === 'amount_mismatch'
  )
    return 'yellow'
  return 'gray'
}

export function PurchaseInvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [inv, setInv] = useState<PurchaseInvoice | null>(null)
  const [matching, setMatching] = useState<InvoiceMatchingResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [matchOpen, setMatchOpen] = useState(false)
  const [holdOpen, setHoldOpen] = useState(false)
  const [holdReason, setHoldReason] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const row = await getPurchaseInvoiceById(id)
      if (!row) {
        notify.error('Purchase invoice not found')
        navigate('/purchase/invoices')
        return
      }
      setInv(row)
      setMatching(await computeInvoiceMatching(row.id))
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (work: () => Promise<PurchaseInvoice>, success: string) => {
    setBusy(true)
    try {
      const updated = await work()
      setInv(updated)
      setMatching(await computeInvoiceMatching(updated.id))
      notify.success(success)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !inv) {
    return (
      <PurchaseCardFormShell
        title="Purchase Invoice"
        description="Loading…"
        status="…"
        favoritePath="/purchase/invoices"
        breadcrumbs={[
          { label: 'Invoices', to: '/purchase/invoices' },
          { label: 'Loading' },
        ]}
        backLink={{ to: '/purchase/invoices', label: 'Back to Invoices' }}
        footer={null}
        detailMode
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  const statusLabel = PURCHASE_INVOICE_STATUS_LABELS[inv.status]
  const matchLabel = INVOICE_MATCHING_RESULT_STATUS_LABELS[inv.matchingResultStatus]
  const originLabel = PURCHASE_INVOICE_ORIGIN_LABELS[inv.origin]

  const editable = ['draft', 'pending_verification', 'matched', 'mismatch', 'on_hold'].includes(
    inv.status,
  )
  const canVerify = ['draft', 'pending_verification', 'matched', 'mismatch', 'on_hold'].includes(
    inv.status,
  )
  const canSubmit = ['matched', 'mismatch', 'draft', 'pending_verification'].includes(inv.status)
  const canApprove = inv.status === 'pending_approval' || inv.status === 'mismatch'
  const canPost = ['approved', 'matched', 'mismatch'].includes(inv.status)
  const canHold = !['posted', 'paid', 'cancelled'].includes(inv.status)
  const canDebit = ['posted', 'approved', 'matched', 'mismatch', 'paid'].includes(inv.status)
  const postBlocked =
    Boolean(matching?.exceedsTolerance) && !inv.matchingExceptionApproved

  const showVerify = perms.canVerifyInvoice && canVerify
  const showSubmit = perms.canCreateInvoice && canSubmit
  const showApprove = perms.canApproveInvoice && canApprove
  const showPost = perms.canPostInvoice && canPost
  const showException =
    perms.canApproveInvoice
    && Boolean(matching?.exceedsTolerance)
    && !inv.matchingExceptionApproved

  const primaryAction =
    showApprove
      ? {
          id: 'approve',
          label: 'Approve',
          icon: CheckCircle2,
          onClick: () => void run(() => approvePurchaseInvoice(inv.id), 'Invoice approved'),
          disabled: busy,
        }
      : showPost
        ? {
            id: 'post',
            label: 'Post Invoice',
            icon: Stamp,
            onClick: () =>
              void run(
                () => postPurchaseInvoice(inv.id),
                'Invoice posted (AP/GL deferred — demo confirmation only)',
              ),
            disabled: busy || postBlocked,
            disabledReason: postBlocked
              ? 'Matching exceeds tolerance — approve exception first'
              : undefined,
          }
        : showVerify
          ? {
              id: 'verify',
              label: 'Verify Invoice',
              icon: CheckCircle2,
              onClick: () => void run(() => verifyPurchaseInvoice(inv.id), 'Invoice verified'),
              disabled: busy,
            }
          : showSubmit
            ? {
                id: 'submit',
                label: 'Send for Approval',
                icon: Send,
                onClick: () =>
                  void run(() => submitPurchaseInvoiceForApproval(inv.id), 'Sent for approval'),
                disabled: busy,
              }
            : undefined

  const matchExceptionCount =
    matching?.lines.filter((l) => !l.withinTolerance).length
    ?? (inv.matchStatus === 'mismatch' ? 1 : 0)

  const gstTotal = inv.cgst + inv.sgst + inv.igst
  const taxTotalsDefaultOpen = hasMeaningfulTaxTotals(inv.subtotal, gstTotal, inv.totalAmount)
  const commercialPeek = commercialTermsSummary({
    paymentTerms: inv.paymentTerms,
    deliveryTerms: inv.deliveryTerms,
    dueDate: inv.dueDate,
  })
  const taxPeek = taxTotalsSummary({
    subtotal: inv.taxableAmount ?? inv.subtotal,
    tax: gstTotal,
    total: inv.totalAmount,
  })
  const notesPeek = notesSummary(inv.remarks)
  const matchingPeek =
    matching
      ? `${matching.overallStatusLabel}${matchExceptionCount > 0 ? ` · ${matchExceptionCount} exception line(s)` : ''}`
      : 'PO · GRN · Invoice'

  const documentFactBox = (
    <PurchaseDocumentFactBox
      vendor={{
        id: inv.vendor.id,
        code: inv.vendor.code,
        name: inv.vendor.name,
        paymentTerms: inv.paymentTerms,
      }}
      purchaseHistory={{
        lastPurchasePrice: inv.lines[0]?.rate ?? null,
        lastVendorName: inv.vendor.name,
      }}
      documentStatus={{
        statusLabel,
        ...purchaseDocumentApprovalFact(inv.status, inv.approver?.name),
        createdBy: inv.createdBy,
        modifiedBy: inv.updatedBy,
        modifiedDate: inv.updatedAt ? formatDate(inv.updatedAt.slice(0, 10)) : null,
      }}
      related={buildPurchaseRelatedLinks({
        purchaseOrderId: inv.purchaseOrderId,
        purchaseOrderNumber: inv.purchaseOrderNumber,
        goodsReceiptId: inv.goodsReceiptId,
        goodsReceiptNumber: inv.goodsReceiptNumber,
      })}
    />
  )

  return (
    <>
      <PurchaseCardFormShell
        title={inv.documentNumber}
        description={`${inv.vendor.name} · ${originLabel}`}
        recordNo={inv.documentNumber}
        status={statusLabel}
        statusTone={purchaseStatusTone(inv.status)}
        company={inv.vendor.name}
        favoritePath={`/purchase/invoices/${inv.id}`}
        breadcrumbs={[
          { label: 'Invoices', to: '/purchase/invoices' },
          { label: inv.documentNumber },
        ]}
        backLink={{ to: '/purchase/invoices', label: 'Back to Invoices' }}
        createdBy={inv.createdBy}
        createdDate={formatDate(inv.createdAt.slice(0, 10))}
        modifiedBy={inv.updatedBy ?? undefined}
        modifiedDate={inv.updatedAt ? formatDate(inv.updatedAt.slice(0, 10)) : undefined}
        documentIdentity={{
          moduleLabel: 'PURCHASE INVOICE',
          title: inv.documentNumber,
          status: statusLabel,
          statusTone: purchaseStatusTone(inv.status),
        }}
        documentFacts={[
          { label: 'Invoice No', value: inv.documentNumber, emphasize: true },
          { label: 'Vendor', value: inv.vendor.name, emphasize: true },
          { label: 'Vendor Inv.', value: inv.vendorInvoiceNumber || '—' },
          { label: 'Posting Date', value: formatDate(inv.postingDate) },
          {
            label: 'Due Date',
            value: inv.dueDate ? formatDate(inv.dueDate) : '—',
            muted: !inv.dueDate,
          },
        ]}
        documentMetaChips={[
          originLabel,
          matchLabel,
          inv.currency || 'INR',
        ]}
        factBox={documentFactBox}
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={primaryAction}
            secondaryActions={[
              {
                id: 'edit',
                label: 'Edit',
                icon: Pencil,
                pin: true,
                onClick: () => navigate(`/purchase/invoices/${inv.id}/edit`),
                hidden: !perms.canCreateInvoice || !editable,
                disabled: busy,
              },
            ]}
            moreActions={[
              {
                id: 'verify',
                label: 'Verify Invoice',
                icon: CheckCircle2,
                onClick: () => void run(() => verifyPurchaseInvoice(inv.id), 'Invoice verified'),
                hidden: !showVerify || primaryAction?.id === 'verify',
                disabled: busy,
              },
              {
                id: 'submit',
                label: 'Send for Approval',
                icon: Send,
                onClick: () =>
                  void run(() => submitPurchaseInvoiceForApproval(inv.id), 'Sent for approval'),
                hidden: !showSubmit || primaryAction?.id === 'submit',
                disabled: busy,
              },
              {
                id: 'approve',
                label: 'Approve',
                icon: CheckCircle2,
                onClick: () => void run(() => approvePurchaseInvoice(inv.id), 'Invoice approved'),
                hidden: !showApprove || primaryAction?.id === 'approve',
                disabled: busy,
              },
              {
                id: 'hold',
                label: 'Put on Hold',
                icon: PauseCircle,
                onClick: () => setHoldOpen(true),
                hidden: !perms.canVerifyInvoice || !canHold,
                disabled: busy,
              },
              {
                id: 'exception',
                label: 'Approve Exception',
                icon: ShieldAlert,
                onClick: () =>
                  void run(
                    () => approveInvoiceMatchingException(inv.id, 'Authorized override'),
                    'Matching exception approved',
                  ),
                hidden: !showException,
                disabled: busy,
              },
              {
                id: 'post',
                label: 'Post Invoice',
                icon: Stamp,
                onClick: () =>
                  void run(
                    () => postPurchaseInvoice(inv.id),
                    'Invoice posted (AP/GL deferred — demo confirmation only)',
                  ),
                hidden: !showPost || primaryAction?.id === 'post',
                disabled: busy || postBlocked,
                disabledReason: postBlocked
                  ? 'Matching exceeds tolerance — approve exception first'
                  : undefined,
              },
              {
                id: 'debit',
                label: 'Create Debit Note',
                icon: FileWarning,
                onClick: async () => {
                  setBusy(true)
                  try {
                    const { invoice, debitNoteNumber } = await createDebitNoteFromInvoice(inv.id)
                    setInv(invoice)
                    notify.success(`Debit note ${debitNoteNumber} created (stub)`)
                  } catch (err) {
                    notify.error(err instanceof PurchaseServiceError ? err.message : 'Failed')
                  } finally {
                    setBusy(false)
                  }
                },
                hidden: !canDebit,
                disabled: busy,
              },
              {
                id: 'match',
                label: 'View Matching Details',
                icon: GitCompare,
                onClick: () => setMatchOpen(true),
              },
              {
                id: 'print',
                label: 'Print',
                icon: Printer,
                onClick: () => navigate(`/purchase/invoices/${inv.id}/print`),
              },
            ]}
            destructiveActions={[
              {
                id: 'reject',
                label: 'Reject',
                icon: Ban,
                onClick: () => setRejectOpen(true),
                hidden: !perms.canApproveInvoice || !canApprove,
                disabled: busy,
              },
            ]}
          />
        }
        footer={null}
        detailMode
      >
        {postBlocked && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Posting blocked</p>
              <p className="text-amber-800/90">
                Matching exceeds tolerance ({matching?.overallStatusLabel}). Approve a matching
                exception first.
              </p>
            </div>
          </div>
        )}

        <ErpCardSection
          title="General"
          subtitle="Vendor invoice identity and linked documents"
          icon={Building2}
          collapsible
          defaultOpen
        >
          <ErpViewField label="Invoice Number" value={inv.documentNumber} />
          <ErpViewField label="Document Date" value={formatDate(inv.documentDate)} />
          <ErpViewField
            label="Status"
            value={<StatusDot label={statusLabel} tone={statusToneFromLabel(inv.status)} />}
          />
          <ErpViewField label="Vendor Invoice No" value={inv.vendorInvoiceNumber} />
          <ErpViewField label="Vendor Invoice Date" value={formatDate(inv.vendorInvoiceDate)} />
          <ErpViewField label="Posting Date" value={formatDate(inv.postingDate)} />
          <ErpViewField label="Vendor" value={`${inv.vendor.code} — ${inv.vendor.name}`} />
          <ErpViewField label="GSTIN" value={inv.vendor.gstin} />
          <ErpViewField label="Vendor State" value={inv.vendor.state || '—'} />
          <ErpViewField
            label="PO Number"
            value={
              inv.purchaseOrderId ? (
                <Link
                  className="font-mono text-erp-primary"
                  to={`/purchase/orders/${inv.purchaseOrderId}`}
                >
                  {inv.purchaseOrderNumber}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <ErpViewField
            label="GRN Number"
            value={
              inv.goodsReceiptId ? (
                <Link
                  className="font-mono text-erp-primary"
                  to={`/purchase/grn/${inv.goodsReceiptId}`}
                >
                  {inv.goodsReceiptNumber}
                </Link>
              ) : (
                inv.goodsReceiptNumber ?? '—'
              )
            }
          />
          <ErpViewField label="Origin" value={originLabel} />
          <ErpViewField label="Location" value={inv.location.name} />
          <ErpViewField label="Department" value={inv.department || '—'} />
          <ErpViewField label="Requester" value={inv.requester.name} />
          <ErpViewField
            label="Matching"
            value={
              <Badge color={matchColor(inv.matchingResultStatus)}>{matchLabel}</Badge>
            }
          />
          <ErpViewField
            label="Exception"
            value={
              inv.matchingExceptionApproved
                ? `Approved by ${inv.exceptionApprovedBy ?? '—'}`
                : 'Not approved'
            }
          />
          {inv.debitNoteNumber ? (
            <ErpViewField label="Debit Note" value={inv.debitNoteNumber} />
          ) : null}
          {inv.onHoldReason ? (
            <ErpViewField label="Hold Reason" value={inv.onHoldReason} colSpan={3} />
          ) : null}
        </ErpCardSection>

        <ErpCardSection
          title="Commercial"
          subtitle="Payment, GST, and posting terms"
          collapsedSummary={commercialPeek || undefined}
          icon={FileText}
          collapsible
          defaultOpen={false}
        >
          <ErpViewField label="Currency" value={inv.currency} />
          <ErpViewField label="Payment Terms" value={inv.paymentTerms} />
          <ErpViewField label="Delivery Terms" value={inv.deliveryTerms || '—'} />
          <ErpViewField label="Due Date" value={inv.dueDate ? formatDate(inv.dueDate) : '—'} />
          <ErpViewField label="Place of Supply" value={inv.placeOfSupply || '—'} />
          <ErpViewField label="Reverse Charge" value={inv.reverseCharge ? 'Yes' : 'No'} />
          <ErpViewField
            label="GST Scheme"
            value={inv.gstScheme === 'igst' ? 'IGST' : 'CGST + SGST'}
          />
          <ErpViewField label="E-Invoice Ref" value={inv.eInvoiceReference ?? '—'} />
          <ErpViewField
            label="Verified"
            value={
              inv.verifiedAt
                ? `${formatDate(inv.verifiedAt.slice(0, 10))}${inv.verifiedBy ? ` · ${inv.verifiedBy}` : ''}`
                : '—'
            }
          />
          <ErpViewField
            label="Posted"
            value={inv.postedAt ? formatDate(inv.postedAt.slice(0, 10)) : '—'}
          />
          <ErpViewField
            label="Paid"
            value={inv.paidAt ? formatDate(inv.paidAt.slice(0, 10)) : '—'}
          />
        </ErpCardSection>

        <ErpCardSection
          title="Three-way Matching"
          subtitle={
            matching
              ? `${matching.overallStatusLabel}${matchExceptionCount > 0 ? ` · ${matchExceptionCount} exception line(s)` : ''}`
              : 'PO · GRN · Invoice'
          }
          collapsedSummary={matchingPeek}
          icon={GitCompare}
          columns={1}
          collapsible
          defaultOpen={false}
          accent={
            matching?.exceedsTolerance || inv.matchStatus === 'mismatch'
              ? 'amber'
              : inv.matchStatus === 'matched'
                ? 'green'
                : 'blue'
          }
          badge={
            matching ? (
              <Badge color={matchColor(matching.overallStatus)}>
                {matching.overallStatusLabel}
              </Badge>
            ) : undefined
          }
        >
          {!matching ? (
            <EmptyState
              icon={ShieldAlert}
              title="No matching data"
              description="Verify the invoice to compute three-way matching."
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {matching.exceedsTolerance && <Badge color="red">Exceeds tolerance</Badge>}
                {matching.missingGrn && <Badge color="red">Missing GRN</Badge>}
                {matching.isDuplicateVendorInvoice && (
                  <Badge color="red">Duplicate vendor invoice</Badge>
                )}
                {inv.matchingExceptionApproved && (
                  <Badge color="green">Exception approved</Badge>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-erp-border bg-white px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    PO qty
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-erp-text">
                    {matching.summary.poQty}
                  </p>
                </div>
                <div className="rounded-md border border-erp-border bg-white px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    GRN qty
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-erp-text">
                    {matching.summary.grnQty}
                  </p>
                </div>
                <div className="rounded-md border border-erp-border bg-white px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    Invoice qty
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-erp-text">
                    {matching.summary.invoiceQty}
                  </p>
                </div>
                <div className="rounded-md border border-erp-border bg-white px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    Invoice total
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-erp-text">
                    {formatCurrency(matching.summary.invoiceTotal)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border border-erp-border">
                <table className="erp-table min-w-[900px] text-[12px]">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">PO Qty</th>
                      <th className="num">GRN Qty</th>
                      <th className="num">Inv Qty</th>
                      <th className="num">PO Rate</th>
                      <th className="num">Inv Rate</th>
                      <th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matching.lines.map((l) => (
                      <tr
                        key={l.lineNo}
                        className={cn(!l.withinTolerance && 'bg-amber-50/70')}
                      >
                        <td>
                          <div className="font-mono text-[11px] text-erp-muted">{l.itemCode}</div>
                          <div className="font-medium text-erp-text">{l.itemName}</div>
                        </td>
                        <td className="num tabular-nums">{l.poQty ?? '—'}</td>
                        <td className="num tabular-nums">{l.grnReceivedQty ?? '—'}</td>
                        <td className="num tabular-nums">{l.invoiceQty}</td>
                        <td className="num tabular-nums">
                          {l.poRate != null ? formatCurrency(l.poRate) : '—'}
                        </td>
                        <td className="num tabular-nums">{formatCurrency(l.invoiceRate)}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {l.flags.length === 0 ? (
                              <span className="text-erp-muted">—</span>
                            ) : (
                              l.flags.map((f) => (
                                <Badge key={f} color={matchColor(f)}>
                                  {INVOICE_MATCHING_RESULT_STATUS_LABELS[f]}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-erp-muted">
                Tolerances: qty {matching.tolerancesApplied.quantityTolerancePct}% · rate{' '}
                {matching.tolerancesApplied.rateTolerancePct}% · amount ₹
                {matching.tolerancesApplied.amountToleranceInr} · tax{' '}
                {matching.tolerancesApplied.taxTolerancePct}% / ₹
                {matching.tolerancesApplied.taxToleranceInr}
              </p>
            </div>
          )}
        </ErpCardSection>

        <ErpCardSection
          title="Item Lines"
          subtitle={`${inv.lines.length} line${inv.lines.length === 1 ? '' : 's'}`}
          icon={FileText}
          columns={1}
          collapsible
          defaultOpen
        >
          {inv.lines.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No lines"
              description="This invoice has no item lines."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-erp-border">
              <table className="erp-table min-w-[1000px] text-[12px]">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Item</th>
                    <th>HSN/SAC</th>
                    <th className="num">Qty</th>
                    <th className="num">Rate</th>
                    <th className="num">Taxable</th>
                    <th className="num">GST%</th>
                    <th className="num">TDS / TCS</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="tabular-nums text-erp-muted">{l.lineNo}</td>
                      <td>
                        <div className="font-mono text-[11px] text-erp-muted">{l.itemCode}</div>
                        <div className="font-medium text-erp-text">
                          {l.description || l.itemName}
                        </div>
                      </td>
                      <td className="font-mono">{l.hsnCode || l.sacCode || '—'}</td>
                      <td className="num tabular-nums">
                        {l.quantity} {l.uom}
                      </td>
                      <td className="num tabular-nums">{formatCurrency(l.rate)}</td>
                      <td className="num tabular-nums">{formatCurrency(l.taxableAmount)}</td>
                      <td className="num tabular-nums">{l.gstRatePct}%</td>
                      <td className="num tabular-nums">
                        {formatCurrency(l.tdsAmount)} / {formatCurrency(l.tcsAmount)}
                      </td>
                      <td className="num tabular-nums font-medium">
                        {formatCurrency(l.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ErpCardSection>

        <ErpCardSection
          title="Tax & Totals"
          subtitle="Charges, tax, and document total"
          collapsedSummary={taxPeek || undefined}
          columns={1}
          collapsible
          defaultOpen={taxTotalsDefaultOpen}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ErpViewField label="Basic Amount" value={formatCurrency(inv.subtotal)} />
            <ErpViewField label="Discount" value={formatCurrency(inv.discount)} />
            <ErpViewField label="Freight" value={formatCurrency(inv.freight)} />
            <ErpViewField label="Other Charges" value={formatCurrency(inv.otherCharges)} />
            <ErpViewField label="Taxable Amount" value={formatCurrency(inv.taxableAmount)} />
            <ErpViewField label="CGST" value={formatCurrency(inv.cgst)} />
            <ErpViewField label="SGST" value={formatCurrency(inv.sgst)} />
            <ErpViewField label="IGST" value={formatCurrency(inv.igst)} />
            <ErpViewField label="Round Off" value={formatCurrency(inv.roundOff)} />
            <ErpViewField label="Grand Total" value={formatCurrency(inv.totalAmount)} />
          </div>
        </ErpCardSection>

        <ErpCardSection
          title="Notes"
          columns={1}
          collapsedSummary={notesPeek || undefined}
          collapsible
          defaultOpen={false}
        >
          <ErpViewField label="Remarks" value={inv.remarks || '—'} />
        </ErpCardSection>
      </PurchaseCardFormShell>

      <Modal open={matchOpen} onClose={() => setMatchOpen(false)} title="Matching details">
        <p className="mb-2 text-[13px] text-erp-muted">
          Overall: {matching?.overallStatusLabel ?? '—'}
        </p>
        <pre className="max-h-80 overflow-auto rounded bg-erp-surface-alt p-3 text-[11px]">
          {JSON.stringify(matching, null, 2)}
        </pre>
      </Modal>

      <Modal open={holdOpen} onClose={() => setHoldOpen(false)} title="Put invoice on hold">
        <Textarea
          value={holdReason}
          onChange={(e) => setHoldReason(e.target.value)}
          placeholder="Hold reason"
          rows={3}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="text-[13px]" onClick={() => setHoldOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-erp-primary px-3 py-1.5 text-[13px] text-white"
            onClick={() => {
              setHoldOpen(false)
              void run(() => holdPurchaseInvoice(inv.id, holdReason), 'Invoice on hold')
            }}
          >
            Confirm hold
          </button>
        </div>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject invoice">
        <Textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Rejection remarks (required)"
          rows={3}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="text-[13px]" onClick={() => setRejectOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-erp-danger px-3 py-1.5 text-[13px] text-white"
            onClick={() => {
              setRejectOpen(false)
              void run(() => rejectPurchaseInvoice(inv.id, rejectReason), 'Invoice rejected')
            }}
          >
            Reject
          </button>
        </div>
      </Modal>
    </>
  )
}
