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
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import { Textarea } from '@/components/forms/Inputs'
import {
  approvalActivitySummary,
  attachmentsSummary,
  commercialTermsSummary,
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
  getVendors,
  releasePurchaseOrder,
  reopenPurchaseOrder,
  sendPurchaseOrderToVendor,
  submitPurchaseOrder,
  PurchaseServiceError,
  PURCHASE_ORDER_APPROVAL_STATUS_LABELS,
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
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { ReservationsPanel } from '@/components/inventory/ReservationsPanel'

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

export function PurchaseOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [history, setHistory] = useState<ApprovalHistory[]>([])
  const [linked, setLinked] = useState<PurchaseOrderLinkedDocuments | null>(null)
  const [vendorMaster, setVendorMaster] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [approveRemarks, setApproveRemarks] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

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
      const [hist, linkedDocs, vendors] = await Promise.all([
        getApprovalHistory(row.id),
        getPurchaseOrderLinkedDocuments(row.id),
        getVendors(),
      ])
      setHistory(hist)
      setLinked(linkedDocs)
      setVendorMaster(vendors.find((v) => v.id === row.vendor.id) ?? null)
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
      const updated = await work()
      setPo(updated)
      notify.success(success)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const downloadStub = () => {
    if (!po) return
    const blob = new Blob(
      [
        [
          `PURCHASE ORDER ${po.documentNumber}`,
          `Vendor: ${po.vendor.name} (${po.vendor.gstin})`,
          `Date: ${po.documentDate} · Expected: ${po.expectedDeliveryDate}`,
          '',
          ...po.lines.map(
            (l) => `${l.lineNo}. ${l.itemCode} ${l.itemName} qty ${l.quantity} ${l.uom} @ ${l.rate} = ${l.lineTotal}`,
          ),
          '',
          `Grand Total: ${formatCurrency(po.totalAmount)}`,
        ].join('\n'),
      ],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${po.documentNumber}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const changeHistoryPeek = useMemo(() => {
    if (!po) return ''
    return po.changeHistory.length > 0
      ? `${po.changeHistory.length} revision${po.changeHistory.length === 1 ? '' : 's'}`
      : ''
  }, [po])

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

  if (loading || !po) {
    return (
      <PurchaseCardFormShell
        title="Purchase Order"
        description="Loading…"
        status="…"
        favoritePath="/purchase/orders"
        backLink={{ to: '/purchase/orders', label: 'Back to Purchase Orders' }}
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Purchase Orders', to: '/purchase/orders' },
          { label: 'Loading' },
        ]}
        footer={null}
        stickyFooter={false}
        detailMode
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  const statusLabel = PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status]
  const orderTypeLabel = PURCHASE_ORDER_TYPE_LABELS[po.orderType]
  const approvalLabel = PURCHASE_ORDER_APPROVAL_STATUS_LABELS[po.approvalStatus]

  const isEditable = po.status === 'draft' || po.status === 'pending_approval'
  const canSubmit = po.status === 'draft'
  const canApprove = po.status === 'pending_approval'
  const canRelease = po.status === 'approved'
  const canReopen = po.status === 'closed'
  const canSendToVendor = (po.status === 'approved' || po.status === 'released') && !po.sentToVendorAt
  const canCreateGrn = RECEIVABLE_STATUSES.includes(po.status)
  const canRevise = REVISABLE_STATUSES.includes(po.status)
  const canClose = !['draft', 'closed', 'cancelled'].includes(po.status)
  const canCancel = !['closed', 'cancelled'].includes(po.status)

  const approveGate = purchaseActionGate({
    permission: 'purchase.order.approve',
    statusAllowed: canApprove,
  })
  const releaseGate = purchaseActionGate({
    permission: 'purchase.order.release',
    statusAllowed: canRelease,
  })
  const submitGate = purchaseActionGate({
    permission: 'purchase.order.edit',
    statusAllowed: canSubmit,
    statusBlockedReason: 'Only Draft orders can be submitted',
  })
  const editGate = purchaseActionGate({
    permission: 'purchase.order.edit',
    statusAllowed: isEditable,
  })
  const cancelGate = purchaseActionGate({
    permission: 'purchase.order.cancel',
    statusAllowed: canCancel,
  })
  const grnGate = purchaseActionGate({
    permission: 'purchase.grn.create',
    statusAllowed: canCreateGrn,
  })

  const gstTotal = po.cgst + po.sgst + po.igst
  const taxTotalsDefaultOpen = hasMeaningfulTaxTotals(po.subtotal, gstTotal, po.totalAmount)
  const commercialPeek = commercialTermsSummary({
    expectedDelivery: po.expectedDeliveryDate,
    paymentTerms: po.paymentTerms,
    freightTerms: po.freightTerms,
    deliveryTerms: po.deliveryTerms,
    priceBasis: po.priceBasis,
    validityDate: po.validityDate,
  })
  const taxPeek = taxTotalsSummary({
    subtotal: po.subtotal,
    tax: gstTotal,
    total: po.totalAmount,
  })
  const notesPeek = notesSummary(po.termsAndConditions, po.internalNotes, po.remarks)
  const attachmentsPeek = attachmentsSummary(po.attachmentIds.length)
  const approvalPeek = approvalActivitySummary({
    statusLabel: approvalLabel,
    historyCount: history.length,
  })

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
        backLink={{ to: '/purchase/orders', label: 'Back to Purchase Orders' }}
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
            collapseSecondaryOnNarrow={false}
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
                        label: 'Submit',
                        icon: Send,
                        onClick: () =>
                          void runAction(() => submitPurchaseOrder(po.id), `${po.documentNumber} submitted`),
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
                pin: true,
                onClick: () => navigate(`/purchase/orders/${po.id}/print`),
              },
              { id: 'download', label: 'Download PDF', icon: Download, onClick: downloadStub },
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

        <ErpCardSection title="General" subtitle="Identity, vendor, and locations" collapsible defaultOpen>
          <ErpViewField label="PO Number" value={po.documentNumber} />
          <ErpViewField label="PO Date" value={formatDate(po.documentDate)} />
          <ErpViewField label="Order Type" value={orderTypeLabel} />
          <ErpViewField
            label="Status"
            value={<StatusDot label={statusLabel} tone={statusToneFromLabel(po.status)} />}
          />
          <ErpViewField label="Revision" value={`Rev ${po.revisionNo}`} />
          <ErpViewField label="Currency" value={po.currency} />
          <ErpViewField label="Vendor" value={`${po.vendor.code} — ${po.vendor.name}`} />
          <ErpViewField label="Vendor GST Number" value={po.vendor.gstin} />
          <ErpViewField label="Place of Supply" value={po.placeOfSupply || '—'} />
          <ErpViewField label="Vendor Address" value={po.vendor.address || '—'} colSpan={3} />
          <ErpViewField label="Buyer" value={po.buyer.name} />
          <ErpViewField label="Purchase Location" value={po.purchaseLocation.name} />
          <ErpViewField label="Delivery Location" value={po.deliveryLocation.name} />
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
          title="Commercial Terms"
          subtitle="Delivery, payment, and logistics"
          collapsedSummary={commercialPeek || undefined}
          collapsible
          defaultOpen={false}
        >
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
              <table className="erp-table min-w-[1100px] text-[12px]">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Item</th>
                    <th>UOM</th>
                    <th className="num">Qty</th>
                    <th className="num">Rate</th>
                    <th className="num">Taxable</th>
                    <th className="num">CGST</th>
                    <th className="num">SGST</th>
                    <th className="num">IGST</th>
                    <th className="num">Line Total</th>
                    <th className="num">Received</th>
                    <th className="num">Pending</th>
                    <th>Status</th>
                    <th>Required Date</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="tabular-nums text-erp-muted">{l.lineNo}</td>
                      <td>
                        <div className="font-mono text-[12px] text-erp-text">{l.itemCode}</div>
                        <div className="text-[12px] text-erp-muted">{l.itemName}</div>
                      </td>
                      <td>{l.uom}</td>
                      <td className="num tabular-nums">{l.quantity}</td>
                      <td className="num tabular-nums">{formatCurrency(l.rate)}</td>
                      <td className="num tabular-nums">{formatCurrency(l.taxableAmount)}</td>
                      <td className="num tabular-nums">{formatCurrency(l.cgst)}</td>
                      <td className="num tabular-nums">{formatCurrency(l.sgst)}</td>
                      <td className="num tabular-nums">{formatCurrency(l.igst)}</td>
                      <td className="num tabular-nums font-medium">{formatCurrency(l.lineTotal)}</td>
                      <td className="num tabular-nums">{l.receivedQty}</td>
                      <td className="num tabular-nums">{l.pendingQty}</td>
                      <td>
                        <Badge color={lineStatusBadgeColor(l.lineStatus)}>
                          {PURCHASE_ORDER_LINE_STATUS_LABELS[l.lineStatus]}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(l.requiredDate)}</td>
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
            <ErpViewField label="Basic Amount" value={formatCurrency(po.subtotal)} />
            <ErpViewField label="Line Discount" value={formatCurrency(po.lineDiscount)} />
            <ErpViewField label="Trade Discount" value={formatCurrency(po.tradeDiscount)} />
            <ErpViewField label="Freight" value={formatCurrency(po.freight)} />
            <ErpViewField label="Packing Charges" value={formatCurrency(po.packingCharges)} />
            <ErpViewField label="Insurance Charges" value={formatCurrency(po.insuranceCharges)} />
            <ErpViewField label="Other Charges" value={formatCurrency(po.otherCharges)} />
            <ErpViewField label="Taxable Amount" value={formatCurrency(po.taxableAmount)} />
            <ErpViewField label="CGST" value={formatCurrency(po.cgst)} />
            <ErpViewField label="SGST" value={formatCurrency(po.sgst)} />
            <ErpViewField label="IGST" value={formatCurrency(po.igst)} />
            <ErpViewField label="TCS" value={formatCurrency(po.tcsAmount)} />
            <ErpViewField label="Round Off" value={formatCurrency(po.roundOff)} />
            <ErpViewField label="Grand Total" value={formatCurrency(po.totalAmount)} />
          </div>
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

        <ErpCardSection
          title="Approval History"
          columns={1}
          collapsedSummary={approvalPeek || undefined}
          collapsible
          defaultOpen={false}
        >
          {history.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No approval activity yet.</p>
          ) : (
            <ul className="divide-y divide-erp-border rounded-md border border-erp-border">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-3 px-3 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="font-medium capitalize text-erp-text">
                      {h.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-erp-muted"> · {h.actorName}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-erp-muted">
                      <StatusDot label={h.fromStatus} tone={statusToneFromLabel(h.fromStatus)} className="text-[12px]" />
                      <span aria-hidden>→</span>
                      <StatusDot label={h.toStatus} tone={statusToneFromLabel(h.toStatus)} className="text-[12px]" />
                    </span>
                    {h.remarks ? <span className="mt-1 block text-erp-muted">{h.remarks}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-erp-muted">
                    {formatDate(h.actedAt.slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ErpCardSection>

        <ErpCardSection
          title="Change History"
          columns={1}
          collapsedSummary={changeHistoryPeek || undefined}
          collapsible
          defaultOpen={false}
        >
          {po.changeHistory.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No revisions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-erp-border">
              <table className="erp-table min-w-[720px] text-[12px]">
                <thead>
                  <tr>
                    <th>Revision</th>
                    <th>Field</th>
                    <th>Previous</th>
                    <th>New</th>
                    <th>Reason</th>
                    <th>Changed By</th>
                    <th>Changed At</th>
                  </tr>
                </thead>
                <tbody>
                  {po.changeHistory.map((c) => (
                    <tr key={c.id}>
                      <td className="num tabular-nums">{c.revisionNo}</td>
                      <td>{c.fieldLabel}</td>
                      <td>{c.previousValue || '—'}</td>
                      <td>{c.newValue || '—'}</td>
                      <td>{c.reason || '—'}</td>
                      <td>{c.changedBy}</td>
                      <td className="whitespace-nowrap">{formatDate(c.changedAt.slice(0, 10))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
