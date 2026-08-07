import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Ban,
  CheckCircle2,
  Download,
  FileText,
  Pencil,
  PackagePlus,
  Printer,
  RotateCw,
  Send,
  Undo2,
  Lock,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseAuditTimeline,
  buildDemoPurchaseTimeline,
} from '@/components/purchase/PurchaseAuditTimeline'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import {
  PurchaseDocumentAttachments,
  purchaseAttachmentRowsFromIds,
} from '@/components/purchase/PurchaseDocumentAttachments'
import { ErpCardSection, ErpViewField } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { purchaseActionGate, usePurchasePermissions } from '@/utils/permissions'
import { ErpButton } from '@/components/erp/ErpButton'
import { Badge } from '@/components/ui/Badge'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import { Textarea } from '@/components/forms/Inputs'
import {
  attachmentsSummary,
  hasMeaningfulTaxTotals,
  notesSummary,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  getApprovalHistory,
  getPurchaseOrderById,
  getPurchaseOrderLinkedDocuments,
  getPurchaseSetup,
  getVendors,
  rejectPurchaseOrder,
  releasePurchaseOrder,
  reopenPurchaseOrder,
  sendBackPurchaseOrder,
  sendPurchaseOrderToVendor,
  submitPurchaseOrder,
  PurchaseServiceError,
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
  PURCHASE_ORDER_LINE_STATUS_LABELS,
  PURCHASE_ORDER_TYPE_LABELS,
} from '@/services/purchase'
import type {
  ApprovalHistory,
  PurchaseOrder,
  PurchaseOrderLineStatus,
  PurchaseOrderLinkedDocuments,
  Vendor,
} from '@/types/purchaseDomain'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { PurchaseDocumentWorkflowStrip } from '@/components/purchase/PurchaseDocumentWorkflowStrip'
import { formatCurrency } from '@/utils/formatters/currency'
import { PurchaseLineQtyCell } from '@/components/purchase/PurchaseLineQtyCell'
import { PurchaseLineTrackingQtyCell } from '@/components/purchase/PurchaseLineTrackingQtyCell'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appPromptNote } from '@/store/confirmDialogStore'
import { resolvePurchaseGstColumnVisibility } from '@/utils/purchasePoGst'
import { ReservationsPanel } from '@/components/inventory/ReservationsPanel'
import { PoReceiptRollupPanel } from '@/components/purchase/PoReceiptRollupPanel'

const REVISABLE_STATUSES: PurchaseOrder['status'][] = [
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
]
const RECEIVABLE_STATUSES: PurchaseOrder['status'][] = [
  'approved',
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
]

function lineStatusBadgeColor(
  status: PurchaseOrderLineStatus,
): 'red' | 'green' | 'yellow' | 'blue' | 'gray' {
  if (status === 'cancelled') return 'red'
  if (status === 'received' || status === 'invoiced') return 'green'
  if (status === 'partial') return 'yellow'
  if (status === 'open') return 'blue'
  return 'gray'
}

function PurchaseOrderDetailSkeleton() {
  const fieldWidths = ['w-24', 'w-20', 'w-28', 'w-16', 'w-20', 'w-24', 'w-36', 'w-28']

  const skeletonFields = (count: number) =>
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className="min-w-0 space-y-2">
        <div className={`erp-skeleton h-3 rounded ${fieldWidths[index % fieldWidths.length]}`} />
        <div className="erp-skeleton h-4 w-3/4 max-w-full rounded" />
      </div>
    ))

  const collapsedSection = (title: string, subtitle?: string) => (
    <ErpCardSection
      key={title}
      title={title}
      subtitle={subtitle}
      columns={1}
      collapsible
      defaultOpen={false}
    >
      <span />
    </ErpCardSection>
  )

  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading purchase order" role="status">
      <div className="po-workflow-strip po-workflow-strip--dense">
        <div className="flex min-w-0 items-center gap-3 px-2 py-1">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="erp-skeleton h-6 w-6 shrink-0 rounded-full" />
              <div className="erp-skeleton h-3 min-w-0 flex-1 rounded" />
            </div>
          ))}
        </div>
      </div>

      <ErpCardSection
        title="General"
        subtitle="Identity, vendor, locations, and commercial terms"
        collapsible
        defaultOpen
        columns={6}
      >
        {skeletonFields(24)}
      </ErpCardSection>

      <ErpCardSection
        title="Item Lines"
        subtitle="Loading order lines"
        columns={1}
        collapsible
        defaultOpen
      >
        <div className="overflow-x-auto rounded-md border border-erp-border">
          <div className="grid min-w-[1100px] grid-cols-[3rem_2fr_repeat(13,minmax(5rem,1fr))] gap-3 border-b border-erp-border bg-erp-surface-alt px-3 py-2">
            {Array.from({ length: 15 }).map((_, index) => (
              <div key={index} className="erp-skeleton h-3 rounded" />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, row) => (
            <div
              key={row}
              className="grid min-w-[1100px] grid-cols-[3rem_2fr_repeat(13,minmax(5rem,1fr))] gap-3 border-b border-erp-border px-3 py-3 last:border-b-0"
            >
              {Array.from({ length: 15 }).map((_, cell) => (
                <div
                  key={cell}
                  className={`erp-skeleton rounded ${cell === 1 ? 'h-8' : 'h-4'}`}
                  style={{ animationDelay: `${row * 45 + cell * 10}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      </ErpCardSection>

      <ErpCardSection
        title="Tax & Totals"
        subtitle="Charges, tax, and document total"
        columns={1}
        collapsible
        defaultOpen
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {skeletonFields(14)}
        </div>
      </ErpCardSection>

      {collapsedSection(
        'Receipts by item',
        'Ordered / received / pending per line — expand for individual GRNs',
      )}
      {collapsedSection('Inventory Reservations', 'Stock reserved for this purchase order')}
      {collapsedSection('Terms & Notes')}
      {collapsedSection('Attachments')}

      {collapsedSection('History', 'Lifecycle history')}
      {collapsedSection('Linked Documents', 'Upstream and downstream references')}
    </div>
  )
}

export function PurchaseOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [history, setHistory] = useState<ApprovalHistory[]>([])
  const [linked, setLinked] = useState<PurchaseOrderLinkedDocuments | null>(null)
  const [vendorMaster, setVendorMaster] = useState<Vendor | null>(null)
  const [requireApprovalOnPo, setRequireApprovalOnPo] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [approveRemarks, setApproveRemarks] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [receiptRefreshToken, setReceiptRefreshToken] = useState(0)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const row = await getPurchaseOrderById(id)
      if (!row) {
        notify.error('Purchase order not found')
        navigate('/purchase/orders')
        return
      }
      setPo(row)
      const [hist, linkedDocs, vendors, setup] = await Promise.all([
        getApprovalHistory(row.id),
        getPurchaseOrderLinkedDocuments(row.id),
        getVendors(),
        // Setup only drives action visibility — never fail the document on it.
        getPurchaseSetup().catch(() => null),
      ])
      setHistory(hist)
      setLinked(linkedDocs)
      setVendorMaster(vendors.find((v) => v.id === row.vendor.id) ?? null)
      setRequireApprovalOnPo(setup?.general.requireApprovalOnPo ?? true)
      setReceiptRefreshToken((n) => n + 1)
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!po) return
    if (searchParams.get('print') === '1') {
      window.print()
      searchParams.delete('print')
      setSearchParams(searchParams, { replace: true })
    }
  }, [po, searchParams, setSearchParams])

  const runAction = async (work: () => Promise<PurchaseOrder>, success: string) => {
    setBusy(true)
    try {
      await work()
      // Backend is the source of truth — refetch instead of trusting the local result.
      await load()
      notify.success(success)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const documentFactBox = useMemo(() => {
    if (!po) return null
    const statusLabel = PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status]
    const approval = purchaseDocumentApprovalFact(po.status, po.approver?.name)
    const related = buildPurchaseRelatedLinks({
      purchaseRequisitionId: linked?.purchaseRequisition?.id ?? po.purchaseRequisitionId,
      purchaseRequisitionNumber:
        linked?.purchaseRequisition?.documentNumber ?? po.purchaseRequisitionNumber,
      rfqId: linked?.rfq?.id ?? po.rfqId,
      rfqNumber: linked?.rfq?.documentNumber ?? po.rfqNumber,
      vendorQuotationId: linked?.vendorQuotation?.id ?? po.vendorQuotationId,
      vendorQuotationNumber:
        linked?.vendorQuotation?.documentNumber ?? po.vendorQuotationNumber,
      comparisonId: linked?.comparison?.id ?? po.comparisonId,
      comparisonNumber: linked?.comparison?.documentNumber ?? po.comparisonNumber,
      blanketOrderId: linked?.blanketOrder?.id ?? po.blanketOrderId,
      blanketOrderNumber: linked?.blanketOrder?.documentNumber ?? po.blanketOrderNumber,
      grns: linked?.grns,
      invoices: linked?.invoices,
      returns: linked?.returns,
    })
    const firstLine = po.lines[0]
    return (
      <PurchaseDocumentFactBox
        vendor={{
          id: vendorMaster?.id ?? po.vendor.id,
          code: vendorMaster?.vendorCode ?? po.vendor.code,
          name: vendorMaster?.vendorName ?? po.vendor.name,
          rating: vendorMaster?.rating,
          paymentTerms: po.paymentTerms || vendorMaster?.paymentTerms,
          leadTimeDays: vendorMaster?.leadTimeDays,
        }}
        purchaseHistory={{
          lastPurchasePrice: firstLine?.rate ?? null,
          lastVendorName: po.vendor.name,
          averageLeadTimeDays: vendorMaster?.leadTimeDays ?? null,
        }}
        documentStatus={{
          statusLabel,
          ...approval,
          createdBy: po.createdBy,
          modifiedBy: po.updatedBy,
          modifiedDate: po.updatedAt ? formatDate(po.updatedAt.slice(0, 10)) : null,
        }}
        related={related}
      />
    )
  }, [po, linked, vendorMaster])

  const headerFacts = useMemo(() => {
    if (!po) return []
    return [
      { label: 'Vendor', value: po.vendor.name },
      { label: 'Buyer', value: po.buyer.name },
      { label: 'PO Date', value: formatDate(po.documentDate) },
      { label: 'Expected', value: formatDate(po.expectedDeliveryDate) },
    ]
  }, [po])

  const lineTaxCols = useMemo(
    () => resolvePurchaseGstColumnVisibility(po?.lines ?? []),
    [po?.lines],
  )

  if (loading || !po) {
    return (
      <PurchaseCardFormShell
        title="Purchase Order"
        description="Loading…"
        status="…"
        favoritePath="/purchase/orders"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Purchase Orders', to: '/purchase/orders' },
          { label: 'Loading' },
        ]}
        factBox={
          <div
            className="space-y-4 rounded-md border border-erp-border bg-erp-surface p-4"
            aria-hidden="true"
          >
            <div className="erp-skeleton h-5 w-36 rounded" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="erp-skeleton h-3 w-20 rounded" />
                  <div className="erp-skeleton h-4 w-full rounded" />
                </div>
              ))}
            </div>
          </div>
        }
        collapsibleFactBox
        footer={null}
        stickyFooter={false}
        detailMode
      >
        <PurchaseOrderDetailSkeleton />
      </PurchaseCardFormShell>
    )
  }

  const statusLabel = PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status]
  const orderTypeLabel = PURCHASE_ORDER_TYPE_LABELS[po.orderType]

  // Prefer backend-provided eligibility (API mode); fall back to local status rules (demo).
  const aa = po.allowedActions
  const isEditable = aa ? aa.canEdit : po.status === 'draft' || po.status === 'sent_back'
  const canSubmit = aa ? aa.canSubmit : isEditable && requireApprovalOnPo
  const canApprove = aa ? aa.canApprove : po.status === 'pending_approval'
  // With approval required, Open/Sent Back must be submitted first — only Approved can release.
  const canRelease = aa
    ? aa.canSendToVendor
    : requireApprovalOnPo
      ? po.status === 'approved'
      : po.status === 'approved' || po.status === 'draft' || po.status === 'sent_back'
  const canReopen = aa ? aa.canReopen : po.status === 'closed' || po.status === 'rejected' || po.status === 'cancelled'
  const canSendToVendor = aa
    ? aa.canSendToVendor
    : (po.status === 'approved' || po.status === 'released') && !po.sentToVendorAt
  const canCreateGrn = aa ? aa.canReceive : RECEIVABLE_STATUSES.includes(po.status)
  const canRevise = aa
    ? Boolean(aa.canRevise)
    : REVISABLE_STATUSES.includes(po.status) && !po.lines.some((l) => l.receivedQty > 0)
  const canClose = aa ? aa.canClose : !['draft', 'closed', 'cancelled', 'pending_approval'].includes(po.status)
  const canCancel = aa ? aa.canCancel : po.status === 'pending_approval'

  const approveGate = purchaseActionGate({
    permission: 'purchase.po.approve',
    statusAllowed: canApprove,
  })
  const releaseGate = purchaseActionGate({
    permission: 'purchase.po.send',
    statusAllowed: canRelease,
  })
  const submitGate = purchaseActionGate({
    permission: 'purchase.po.edit',
    statusAllowed: canSubmit,
    statusBlockedReason: 'Only Open or Sent Back orders can be sent for approval',
  })
  const editGate = purchaseActionGate({
    permission: 'purchase.po.edit',
    statusAllowed: isEditable,
  })
  const cancelGate = purchaseActionGate({
    permission: 'purchase.po.cancel',
    statusAllowed: canCancel,
  })
  const grnGate = purchaseActionGate({
    permission: 'purchase.grn.create',
    statusAllowed: canCreateGrn,
  })

  const gstTotal = po.cgst + po.sgst + po.igst
  const taxTotalsDefaultOpen = hasMeaningfulTaxTotals(po.subtotal, gstTotal, po.totalAmount)
  const taxPeek = taxTotalsSummary({
    subtotal: po.subtotal,
    tax: gstTotal,
    total: po.totalAmount,
  })
  const notesPeek = notesSummary(po.termsAndConditions, po.internalNotes, po.remarks)
  const attachmentsPeek = attachmentsSummary(po.attachmentIds.length)

  return (
    <>
      <PurchaseCardFormShell
        title={po.documentNumber}
        description={`${orderTypeLabel} · ${po.vendor.name}`}
        recordNo={po.documentNumber}
        status={statusLabel}
        statusTone={purchaseStatusTone(po.status)}
        company={po.vendor.name}
        favoritePath={`/purchase/orders/${po.id}`}
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Purchase Orders', to: '/purchase/orders' },
          { label: po.documentNumber },
        ]}
        createdBy={po.createdBy}
        createdDate={formatDate(po.createdAt.slice(0, 10))}
        modifiedBy={po.updatedBy ?? undefined}
        modifiedDate={po.updatedAt ? formatDate(po.updatedAt.slice(0, 10)) : undefined}
        recordHeaderFacts={headerFacts}
        recordHeaderId={`Rev ${po.revisionNo}`}
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            moreActionsLabel="More"
            maxHeaderActions={3}
            primaryAction={
              canApprove && !approveGate.hidden
                ? {
                    id: 'approve',
                    label: 'Approve',
                    icon: CheckCircle2,
                    onClick: () => setApproveOpen(true),
                    disabled: busy || approveGate.disabled,
                    disabledReason: approveGate.disabledReason,
                  }
                : canRelease && !releaseGate.hidden
                  ? {
                      id: 'release',
                      label: 'Release',
                      icon: PackagePlus,
                      onClick: () =>
                        void runAction(() => releasePurchaseOrder(po.id), `${po.documentNumber} released`),
                      disabled: busy || releaseGate.disabled,
                      disabledReason: releaseGate.disabledReason,
                    }
                  : canSubmit && !submitGate.hidden
                    ? {
                        id: 'submit',
                        label: 'Send for Approval',
                        icon: Send,
                        onClick: () =>
                          void runAction(
                            () => submitPurchaseOrder(po.id),
                            `${po.documentNumber} sent for approval`,
                          ),
                        disabled: busy || submitGate.disabled,
                        disabledReason: submitGate.disabledReason,
                      }
                    : undefined
            }
            secondaryActions={[
              {
                id: 'edit',
                label: 'Edit / Save Draft',
                icon: Pencil,
                pin: true,
                onClick: () => navigate(`/purchase/orders/${po.id}/edit`),
                hidden: editGate.hidden || !isEditable,
              },
              {
                id: 'reject',
                label: 'Reject',
                icon: Ban,
                onClick: () =>
                  void (async () => {
                    const reason = await appPromptNote({
                      title: `Reject ${po.documentNumber}?`,
                      description: 'Rejection reason is required for the audit trail.',
                      tone: 'danger',
                      confirmLabel: 'Reject',
                      note: { required: true, label: 'Rejection reason' },
                    })
                    if (reason == null) return
                    await runAction(
                      () => rejectPurchaseOrder(po.id, reason),
                      `${po.documentNumber} rejected`,
                    )
                  })(),
                hidden: approveGate.hidden || !(aa ? aa.canReject : canApprove),
                disabled: busy || approveGate.disabled,
              },
              {
                id: 'send-back',
                label: 'Send Back',
                icon: Undo2,
                onClick: () =>
                  void (async () => {
                    const reason = await appPromptNote({
                      title: `Send back ${po.documentNumber}?`,
                      description: 'The buyer can edit and resubmit. Reason is required.',
                      tone: 'warning',
                      confirmLabel: 'Send back',
                      note: { required: true, label: 'Send-back reason' },
                    })
                    if (reason == null) return
                    await runAction(
                      () => sendBackPurchaseOrder(po.id, reason),
                      `${po.documentNumber} sent back`,
                    )
                  })(),
                hidden: approveGate.hidden || !(aa ? aa.canSendBack : canApprove),
                disabled: busy || approveGate.disabled,
              },
              {
                id: 'reopen',
                label: 'Reopen',
                icon: Undo2,
                onClick: () => void runAction(() => reopenPurchaseOrder(po.id), `${po.documentNumber} reopened`),
                hidden: !perms.canEditOrder || !canReopen,
                disabled: busy,
              },
              {
                id: 'send-vendor',
                label: 'Send to Vendor',
                icon: Send,
                onClick: () =>
                  void runAction(() => sendPurchaseOrderToVendor(po.id), `${po.documentNumber} sent to vendor`),
                hidden: !perms.canEditOrder || !canSendToVendor,
                disabled: busy,
              },
              {
                id: 'grn',
                label: 'Create GRN',
                icon: PackagePlus,
                onClick: () => navigate(`/purchase/grn/new?poId=${po.id}`),
                hidden: grnGate.hidden || !canCreateGrn,
              },
              {
                id: 'revise',
                label: 'Revise Order',
                icon: RotateCw,
                onClick: () => navigate(`/purchase/orders/${po.id}/revise`),
                hidden: !perms.canEditOrder || !canRevise,
              },
              {
                id: 'print',
                label: 'Print',
                icon: Printer,
                onClick: () => navigate(`/purchase/orders/${po.id}/print`),
              },
              {
                id: 'download',
                label: 'Download PDF',
                icon: Download,
                onClick: () => navigate(`/purchase/orders/${po.id}/print?download=1`),
              },
            ]}
            destructiveActions={[
              {
                id: 'close',
                label: 'Close',
                icon: Lock,
                onClick: () => void runAction(() => closePurchaseOrder(po.id), `${po.documentNumber} closed`),
                hidden: !perms.canEditOrder || !canClose,
                disabled: busy,
              },
              {
                id: 'cancel',
                label: 'Cancel',
                icon: Ban,
                onClick: () => setCancelOpen(true),
                hidden: cancelGate.hidden || !canCancel,
                disabled: busy || cancelGate.disabled,
                disabledReason: cancelGate.disabledReason,
              },
            ]}
          />
        }
        factBox={documentFactBox}
        collapsibleFactBox
        footer={null}
        stickyFooter={false}
        detailMode
      >
        <PurchaseDocumentWorkflowStrip
          status={po.status}
          purpose="Purchase orders — create, approve and release, then track delivery."
          nextActionContext={{
            canSubmit: !submitGate.hidden && !submitGate.disabled,
            canApprove: !approveGate.hidden && !approveGate.disabled,
            canRelease: !releaseGate.hidden && !releaseGate.disabled,
            canCreateGrn: !grnGate.hidden && !grnGate.disabled,
            canClose: canClose,
            canCreateInvoice: perms.canCreateInvoice,
          }}
        />

        <ErpCardSection
          title="General"
          subtitle="Identity, vendor, locations, and commercial terms"
          collapsible
          defaultOpen
          columns={6}
        >
          <ErpViewField label="PO Number" value={po.documentNumber} />
          <ErpViewField label="PO Date" value={formatDate(po.documentDate)} />
          <ErpViewField label="Order Type" value={orderTypeLabel} />
          <ErpViewField
            label="Status"
            value={<StatusDot label={statusLabel} tone={statusToneFromLabel(po.status)} />}
          />
          <ErpViewField label="Revised version" value={String(po.revisionNo)} />
          <ErpViewField label="Currency" value={po.currency} />
          <ErpViewField label="Vendor" value={`${po.vendor.code} — ${po.vendor.name}`} />
          <ErpViewField label="Vendor GST Number" value={po.vendor.gstin} />
          <ErpViewField label="Place of Supply" value={po.placeOfSupply || '—'} />
          <ErpViewField label="Buyer" value={po.buyer.name} />
          <ErpViewField label="Purchase Location" value={po.purchaseLocation.name} />
          <ErpViewField label="Delivery Location" value={po.deliveryLocation.name} />
          <ErpViewField label="Expected Delivery Date" value={formatDate(po.expectedDeliveryDate)} />
          <ErpViewField label="Validity Date" value={po.validityDate ? formatDate(po.validityDate) : '—'} />
          <ErpViewField label="Price Basis" value={po.priceBasis || '—'} />
          <ErpViewField label="Payment Terms" value={po.paymentTerms} />
          <ErpViewField label="Delivery Terms" value={po.deliveryTerms} />
          <ErpViewField label="Freight Terms" value={po.freightTerms || '—'} />
          <ErpViewField label="Packing Terms" value={po.packingTerms || '—'} />
          <ErpViewField label="Insurance Terms" value={po.insuranceTerms || '—'} />
          <ErpViewField label="Warranty" value={po.warranty || '—'} />
          <ErpViewField label="Inspection Requirement" value={po.inspectionRequirement || '—'} />
          <ErpViewField
            label="Sent to Vendor"
            value={po.sentToVendorAt ? formatDate(po.sentToVendorAt.slice(0, 10)) : '—'}
          />
          <ErpViewField label="Released At" value={po.releasedAt ? formatDate(po.releasedAt.slice(0, 10)) : '—'} />
          <ErpViewField label="Vendor Address" value={po.vendor.address || '—'} colSpan={3} />
          <ErpViewField label="Source PR" hideIfEmpty>
            {po.purchaseRequisitionId ? (
              <Link className="text-erp-primary font-mono" to={`/purchase/requisitions/${po.purchaseRequisitionId}`}>
                {po.purchaseRequisitionNumber}
              </Link>
            ) : null}
          </ErpViewField>
          <ErpViewField label="Source RFQ" hideIfEmpty>
            {po.rfqId ? (
              <Link className="text-erp-primary font-mono" to={`/purchase/rfqs/${po.rfqId}`}>
                {po.rfqNumber}
              </Link>
            ) : null}
          </ErpViewField>
          <ErpViewField label="Source Vendor Quotation" hideIfEmpty>
            {po.vendorQuotationId ? (
              <Link
                className="text-erp-primary font-mono"
                to={`/purchase/vendor-quotations/${po.vendorQuotationId}`}
              >
                {po.vendorQuotationNumber}
              </Link>
            ) : null}
          </ErpViewField>
          <ErpViewField label="Source Comparison" hideIfEmpty>
            {po.comparisonId ? (
              <Link className="text-erp-primary font-mono" to={`/purchase/comparison/${po.rfqId ?? ''}`}>
                {po.comparisonNumber}
              </Link>
            ) : null}
          </ErpViewField>
          <ErpViewField label="Source Blanket Order" value={po.blanketOrderNumber ?? undefined} hideIfEmpty />
        </ErpCardSection>

        <ErpCardSection
          title="Item Lines"
          subtitle={`${po.lines.length} line${po.lines.length === 1 ? '' : 's'}`}
          columns={1}
          collapsible
          defaultOpen
        >
          {po.lines.length === 0 ? (
            <EmptyState icon={FileText} title="No lines" description="This order has no item lines." />
          ) : (
            <div className="overflow-x-auto rounded-md border border-erp-border">
              <table className="erp-table purchase-order-detail-lines w-max min-w-full text-[12px]">
                <colgroup>
                  <col className="purchase-order-detail-lines__col-line" />
                  <col className="purchase-order-detail-lines__col-item" />
                  <col className="purchase-order-detail-lines__col-qty" />
                  <col className="purchase-order-detail-lines__col-money" />
                  <col className="purchase-order-detail-lines__col-money" />
                  {lineTaxCols.showCgst ? (
                    <col className="purchase-order-detail-lines__col-money" />
                  ) : null}
                  {lineTaxCols.showSgst ? (
                    <col className="purchase-order-detail-lines__col-money" />
                  ) : null}
                  {lineTaxCols.showIgst ? (
                    <col className="purchase-order-detail-lines__col-money" />
                  ) : null}
                  <col className="purchase-order-detail-lines__col-money-wide" />
                  <col className="purchase-order-detail-lines__col-tracking" />
                  <col className="purchase-order-detail-lines__col-tracking" />
                  <col className="purchase-order-detail-lines__col-tracking" />
                  <col className="purchase-order-detail-lines__col-flag" />
                  <col className="purchase-order-detail-lines__col-code-wide" />
                  <col className="purchase-order-detail-lines__col-code" />
                  <col className="purchase-order-detail-lines__col-status" />
                  <col className="purchase-order-detail-lines__col-date" />
                  <col className="purchase-order-detail-lines__col-requisition" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="purchase-order-detail-lines__col-line">#</th>
                    <th className="purchase-order-detail-lines__col-item">Item</th>
                    <th className="num purchase-order-detail-lines__col-qty">Qty</th>
                    <th className="num purchase-order-detail-lines__col-money">Rate</th>
                    <th className="num purchase-order-detail-lines__col-money">Taxable</th>
                    {lineTaxCols.showCgst ? (
                      <th className="num purchase-order-detail-lines__col-money">CGST</th>
                    ) : null}
                    {lineTaxCols.showSgst ? (
                      <th className="num purchase-order-detail-lines__col-money">SGST</th>
                    ) : null}
                    {lineTaxCols.showIgst ? (
                      <th className="num purchase-order-detail-lines__col-money">IGST</th>
                    ) : null}
                    <th className="num purchase-order-detail-lines__col-money-wide">Line Total</th>
                    <th className="num purchase-order-detail-lines__col-tracking">Outstanding</th>
                    <th className="num purchase-order-detail-lines__col-tracking">Received</th>
                    <th className="num purchase-order-detail-lines__col-tracking">Invoiced</th>
                    <th className="purchase-order-detail-lines__col-flag">QC Required</th>
                    <th className="purchase-order-detail-lines__col-code-wide">Quality Test Group</th>
                    <th className="purchase-order-detail-lines__col-code">Bin Code</th>
                    <th className="purchase-order-detail-lines__col-status">Status</th>
                    <th className="purchase-order-detail-lines__col-date">Expected Delivery</th>
                    <th className="purchase-order-detail-lines__col-requisition">Requisition no.</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="purchase-order-detail-lines__col-line tabular-nums text-erp-muted">
                        {l.lineNo}
                      </td>
                      <td className="purchase-order-detail-lines__col-item">
                        <div className="font-mono text-[12px] text-erp-text">{l.itemCode}</div>
                        <div className="truncate text-[12px] text-erp-muted" title={l.itemName}>
                          {l.itemName}
                        </div>
                        {l.prSources && l.prSources.length > 0 ? (
                          <details className="mt-1 rounded border border-erp-border bg-erp-surface-alt/40 px-2 py-1 text-[11px]">
                            <summary className="cursor-pointer font-medium text-erp-primary">
                              PR breakdown ({l.prSources.length})
                            </summary>
                            <ul className="mt-1 space-y-0.5 text-erp-text">
                              {l.prSources.map((s) => (
                                <li key={s.id} className="flex justify-between gap-3 font-mono">
                                  <Link
                                    className="text-erp-primary hover:underline"
                                    to={`/purchase/requisitions/${s.purchaseRequisitionId}`}
                                  >
                                    {s.requisitionNumber}
                                  </Link>
                                  <span className="tabular-nums">{s.quantity}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </td>
                      <td className="num purchase-order-detail-lines__col-qty">
                        <PurchaseLineQtyCell line={l} />
                      </td>
                      <td className="num tabular-nums purchase-order-detail-lines__col-money">
                        {formatCurrency(l.rate)}
                      </td>
                      <td className="num tabular-nums purchase-order-detail-lines__col-money">
                        {formatCurrency(l.taxableAmount)}
                      </td>
                      {lineTaxCols.showCgst ? (
                        <td className="num tabular-nums purchase-order-detail-lines__col-money">
                          {formatCurrency(l.cgst)}
                        </td>
                      ) : null}
                      {lineTaxCols.showSgst ? (
                        <td className="num tabular-nums purchase-order-detail-lines__col-money">
                          {formatCurrency(l.sgst)}
                        </td>
                      ) : null}
                      {lineTaxCols.showIgst ? (
                        <td className="num tabular-nums purchase-order-detail-lines__col-money">
                          {formatCurrency(l.igst)}
                        </td>
                      ) : null}
                      <td className="num tabular-nums font-medium purchase-order-detail-lines__col-money-wide">
                        {formatCurrency(l.lineTotal)}
                      </td>
                      <td className="num purchase-order-detail-lines__col-tracking">
                        <PurchaseLineTrackingQtyCell
                          line={l}
                          purchaseQty={Number(l.outstandingQty ?? l.pendingQty ?? 0)}
                          baseQty={Number(l.outstandingQtyBase ?? l.pendingQty ?? 0)}
                        />
                      </td>
                      <td className="num purchase-order-detail-lines__col-tracking">
                        <PurchaseLineTrackingQtyCell
                          line={l}
                          purchaseQty={Number(l.receivedQty ?? 0)}
                          baseQty={Number(l.receivedQtyBase ?? 0)}
                        />
                      </td>
                      <td className="num purchase-order-detail-lines__col-tracking">
                        <PurchaseLineTrackingQtyCell
                          line={l}
                          purchaseQty={Number(l.invoicedQty ?? 0)}
                          baseQty={Number(l.invoicedQtyBase ?? 0)}
                        />
                      </td>
                      <td className="purchase-order-detail-lines__col-flag">{l.qcRequired ? 'Yes' : 'No'}</td>
                      <td className="font-mono text-[12px] purchase-order-detail-lines__col-code-wide">
                        {l.qualityTestGroupCode || '—'}
                      </td>
                      <td className="font-mono text-[12px] purchase-order-detail-lines__col-code">
                        {l.binCode || '—'}
                      </td>
                      <td className="purchase-order-detail-lines__col-status">
                        <Badge color={lineStatusBadgeColor(l.lineStatus)}>
                          {PURCHASE_ORDER_LINE_STATUS_LABELS[l.lineStatus]}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap purchase-order-detail-lines__col-date">
                        {formatDate(l.expectedDeliveryDate || l.requiredDate)}
                      </td>
                      <td className="font-mono text-[12px] purchase-order-detail-lines__col-code">
                        {l.requisitionNo || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <style>{`
                .purchase-order-detail-lines {
                  border-collapse: separate;
                  border-spacing: 0;
                }
                .purchase-order-detail-lines thead th {
                  vertical-align: bottom;
                  line-height: 1.25;
                  white-space: normal;
                  word-break: break-word;
                  hyphens: auto;
                }
                .purchase-order-detail-lines tbody td {
                  vertical-align: middle;
                }
                .purchase-order-detail-lines__col-line {
                  width: 2.5rem;
                  min-width: 2.5rem;
                  max-width: 2.5rem;
                  padding-left: 8px !important;
                  padding-right: 8px !important;
                }
                .purchase-order-detail-lines__col-item {
                  width: 18rem;
                  min-width: 18rem;
                  max-width: 22rem;
                  padding-left: 8px !important;
                  padding-right: 8px !important;
                  white-space: normal;
                }
                .purchase-order-detail-lines__col-qty {
                  min-width: 9.5rem;
                  width: 9.5rem;
                  white-space: nowrap;
                }
                .purchase-order-detail-lines__col-money {
                  min-width: 6.25rem;
                  width: 6.25rem;
                  white-space: nowrap;
                  padding-left: 8px !important;
                  padding-right: 10px !important;
                }
                .purchase-order-detail-lines__col-money-wide {
                  min-width: 6.75rem;
                  width: 6.75rem;
                  white-space: nowrap;
                  padding-left: 8px !important;
                  padding-right: 10px !important;
                }
                .purchase-order-detail-lines__col-tracking {
                  min-width: 8.5rem;
                  width: 8.5rem;
                  padding-left: 8px !important;
                  padding-right: 10px !important;
                  vertical-align: middle;
                }
                .purchase-order-detail-lines__col-requisition {
                  min-width: 7rem;
                  width: 7rem;
                  white-space: nowrap;
                }
                .purchase-order-detail-lines__col-flag {
                  min-width: 4.5rem;
                  width: 4.5rem;
                  white-space: nowrap;
                  text-align: center;
                }
                .purchase-order-detail-lines__col-code {
                  min-width: 6rem;
                  width: 6rem;
                  white-space: nowrap;
                }
                .purchase-order-detail-lines__col-code-wide {
                  min-width: 7rem;
                  width: 7rem;
                  white-space: nowrap;
                }
                .purchase-order-detail-lines__col-status {
                  min-width: 7.25rem;
                  width: 7.25rem;
                  white-space: nowrap;
                }
                .purchase-order-detail-lines__col-date {
                  min-width: 7.25rem;
                  width: 7.25rem;
                  white-space: nowrap;
                }
              `}</style>
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
            <ErpViewField label="Basic Amount" value={formatCurrency(po.subtotal)} />
            <ErpViewField label="Line Discount" value={formatCurrency(po.lineDiscount)} />
            <ErpViewField label="Trade Discount" value={formatCurrency(po.tradeDiscount)} />
            <ErpViewField label="Freight" value={formatCurrency(po.freight)} />
            <ErpViewField label="Packing Charges" value={formatCurrency(po.packingCharges)} />
            <ErpViewField label="Insurance Charges" value={formatCurrency(po.insuranceCharges)} />
            <ErpViewField label="Other Charges" value={formatCurrency(po.otherCharges)} />
            <ErpViewField label="Taxable Amount" value={formatCurrency(po.taxableAmount)} />
            {lineTaxCols.showCgst ? (
              <ErpViewField label="CGST" value={formatCurrency(po.cgst)} />
            ) : null}
            {lineTaxCols.showSgst ? (
              <ErpViewField label="SGST" value={formatCurrency(po.sgst)} />
            ) : null}
            {lineTaxCols.showIgst ? (
              <ErpViewField label="IGST" value={formatCurrency(po.igst)} />
            ) : null}
            <ErpViewField label="TCS" value={formatCurrency(po.tcsAmount)} />
            <ErpViewField label="Round Off" value={formatCurrency(po.roundOff)} />
            <ErpViewField label="Grand Total" value={formatCurrency(po.totalAmount)} />
          </div>
        </ErpCardSection>

        <ErpCardSection
          title="Receipts by item"
          subtitle="Ordered / received / pending per line — expand for individual GRNs"
          columns={1}
          collapsible
          defaultOpen
        >
          <PoReceiptRollupPanel purchaseOrderId={po.id} refreshToken={receiptRefreshToken} />
        </ErpCardSection>

        <ErpCardSection
          title="Inventory Reservations"
          subtitle="Stock reserved for this purchase order"
          columns={1}
          collapsible
          defaultOpen={false}
        >
          <ReservationsPanel referenceNo={po.documentNumber} />
        </ErpCardSection>

        <ErpCardSection
          title="Terms & Notes"
          columns={1}
          collapsedSummary={notesPeek || undefined}
          collapsible
          defaultOpen={false}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ErpViewField label="Terms and Conditions">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-erp-text">
                {po.termsAndConditions || '—'}
              </p>
            </ErpViewField>
            <ErpViewField label="Internal Notes">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-erp-text">
                {po.internalNotes || '—'}
              </p>
            </ErpViewField>
            <ErpViewField label="Remarks" value={po.remarks || '—'} className="sm:col-span-2" />
          </div>
        </ErpCardSection>

        <ErpCardSection
          title="Attachments"
          columns={1}
          collapsedSummary={attachmentsPeek || undefined}
          collapsible
          defaultOpen={false}
        >
          <PurchaseDocumentAttachments
            files={purchaseAttachmentRowsFromIds(po.attachmentIds)}
            disabled
            onChange={() => {}}
            hint="PO specifications, drawings, quotations, and supporting documents"
          />
        </ErpCardSection>

        <ErpCardSection title="History" subtitle="Lifecycle history" columns={1} collapsible defaultOpen={false}>
          <PurchaseAuditTimeline
            entityType="purchase-order"
            entityId={po.id}
            showTitle={false}
            className="border-0 p-0 shadow-none"
            demoEvents={buildDemoPurchaseTimeline({
              entityId: po.id,
              entityType: 'PurchaseOrder',
              createdAt: po.createdAt,
              createdBy: po.createdBy,
              updatedAt: po.updatedAt,
              updatedBy: po.updatedBy,
              statusLabel: po.status,
              extra: [
                ...history.map((h) => ({
                  action: h.action,
                  actionLabel: `${h.action.replace(/_/g, ' ')} (${h.fromStatus} → ${h.toStatus})`,
                  timestamp: h.actedAt,
                  actor: h.actorName,
                })),
                ...po.changeHistory.map((c) => ({
                  action: `CHANGE_${c.id}`,
                  actionLabel: `Changed ${c.fieldLabel}${
                    c.previousValue || c.newValue
                      ? `: ${c.previousValue || '—'} → ${c.newValue || '—'}`
                      : ''
                  }`,
                  timestamp: c.changedAt,
                  actor: c.changedBy,
                })),
              ],
            })}
          />
        </ErpCardSection>

        <ErpCardSection
          title="Linked Documents"
          subtitle="Upstream and downstream references"
          columns={1}
          collapsible
          defaultOpen={false}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ErpViewField label="Purchase Requisition">
              {linked?.purchaseRequisition ? (
                <Link
                  className="text-erp-primary font-mono"
                  to={`/purchase/requisitions/${linked.purchaseRequisition.id}`}
                >
                  {linked.purchaseRequisition.documentNumber}
                </Link>
              ) : (
                '—'
              )}
            </ErpViewField>
            <ErpViewField label="RFQ">
              {linked?.rfq ? (
                <Link className="text-erp-primary font-mono" to={`/purchase/rfqs/${linked.rfq.id}`}>
                  {linked.rfq.documentNumber}
                </Link>
              ) : (
                '—'
              )}
            </ErpViewField>
            <ErpViewField label="Vendor Quotation">
              {linked?.vendorQuotation ? (
                <Link
                  className="text-erp-primary font-mono"
                  to={`/purchase/vendor-quotations/${linked.vendorQuotation.id}`}
                >
                  {linked.vendorQuotation.documentNumber}
                </Link>
              ) : (
                '—'
              )}
            </ErpViewField>
            <ErpViewField label="Comparison" value={linked?.comparison?.documentNumber ?? '—'} />
            <ErpViewField label="Blanket Order" value={linked?.blanketOrder?.documentNumber ?? '—'} />
          </div>

          <div className="mt-1 space-y-4">
            <div>
              <p className="mb-2 text-[12px] font-semibold text-erp-text">GRNs</p>
              {!linked?.grns.length ? (
                <p className="text-[13px] text-erp-muted">No goods receipts posted yet.</p>
              ) : (
                <ul className="divide-y divide-erp-border rounded-md border border-erp-border">
                  {linked.grns.map((g) => (
                    <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]">
                      <Link className="text-erp-primary font-mono" to={`/purchase/grn/${g.id}`}>
                        {g.documentNumber}
                      </Link>
                      <span className="flex items-center gap-3 text-erp-muted">
                        <StatusDot label={g.status} tone={statusToneFromLabel(g.status)} className="text-[12px]" />
                        <span className="tabular-nums">{formatDate(g.documentDate)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-[12px] font-semibold text-erp-text">Purchase Invoices</p>
              {!linked?.invoices.length ? (
                <p className="text-[13px] text-erp-muted">No purchase invoices yet.</p>
              ) : (
                <ul className="divide-y divide-erp-border rounded-md border border-erp-border">
                  {linked.invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]"
                    >
                      <Link className="text-erp-primary font-mono" to={`/purchase/invoices/${inv.id}`}>
                        {inv.documentNumber}
                      </Link>
                      <span className="flex items-center gap-3 text-erp-muted">
                        <StatusDot
                          label={inv.status}
                          tone={statusToneFromLabel(inv.status)}
                          className="text-[12px]"
                        />
                        <span className="tabular-nums">{formatDate(inv.documentDate)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-[12px] font-semibold text-erp-text">Purchase Returns</p>
              {!linked?.returns.length ? (
                <p className="text-[13px] text-erp-muted">No purchase returns yet.</p>
              ) : (
                <ul className="divide-y divide-erp-border rounded-md border border-erp-border">
                  {linked.returns.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]"
                    >
                      <Link className="text-erp-primary font-mono" to={`/purchase/returns/${r.id}`}>
                        {r.documentNumber}
                      </Link>
                      <span className="flex items-center gap-3 text-erp-muted">
                        <StatusDot
                          label={r.status}
                          tone={statusToneFromLabel(r.status)}
                          className="text-[12px]"
                        />
                        <span className="tabular-nums">{formatDate(r.documentDate)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ErpCardSection>
      </PurchaseCardFormShell>

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title={`Approve ${po.documentNumber}`}>
        <div className="space-y-4 text-[13px]">
          <Textarea
            rows={3}
            placeholder="Approval remarks (optional)"
            value={approveRemarks}
            onChange={(e) => setApproveRemarks(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <ErpButton type="button" variant="ghost" onClick={() => setApproveOpen(false)} disabled={busy}>
              Cancel
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              icon={CheckCircle2}
              disabled={busy}
              onClick={async () => {
                await runAction(
                  () => approvePurchaseOrder(po.id, approveRemarks || undefined),
                  `${po.documentNumber} approved`,
                )
                setApproveOpen(false)
                setApproveRemarks('')
              }}
            >
              {busy ? 'Approving…' : 'Confirm Approve'}
            </ErpButton>
          </div>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${po.documentNumber}`}>
        <div className="space-y-4 text-[13px]">
          <Textarea
            rows={3}
            placeholder="Cancellation reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <ErpButton type="button" variant="ghost" onClick={() => setCancelOpen(false)} disabled={busy}>
              Back
            </ErpButton>
            <ErpButton
              type="button"
              variant="danger"
              icon={Ban}
              disabled={busy}
              onClick={async () => {
                await runAction(
                  () => cancelPurchaseOrder(po.id, cancelReason || undefined),
                  `${po.documentNumber} cancelled`,
                )
                setCancelOpen(false)
                setCancelReason('')
              }}
            >
              {busy ? 'Cancelling…' : 'Confirm Cancel'}
            </ErpButton>
          </div>
        </div>
      </Modal>
    </>
  )
}
