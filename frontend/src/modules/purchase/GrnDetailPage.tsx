import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Package,
  PackageCheck,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  Download,
  XCircle,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { ErpCardSection, ErpViewField } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import { DecimalInput } from '@/components/forms/Inputs'
import {
  approveToleranceGRN,
  cancelGRN,
  createPurchaseReturnFromGrn,
  getGRNById,
  GRN_LINE_INSPECTION_STATUS_LABELS,
  postGRN,
  PurchaseServiceError,
  rejectToleranceGRN,
  reverseGRN,
  submitGRN,
} from '@/services/purchase'
import { GRN_TOLERANCE_STATUS_LABELS } from '@/services/purchase/grnTolerance'
import {
  formatGrnStatusLabel,
  remainingPoOpenAfterGrn,
  summarizeGrnReceipt,
} from '@/services/purchase/grnReceiptSummary'
import type { GoodsReceiptNote } from '@/types/purchaseDomain'
import { isIncludedGrnLine } from '@/modules/purchase/grnLineDraft'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { purchaseActionGate, usePurchasePermissions } from '@/utils/permissions'
import { formatDate } from '@/utils/dates/format'
import {
  formatPurchaseQty,
  getPurchaseLineBaseUomCode,
  purchaseLineHasDualUom,
} from '@/utils/purchaseLineUom'
import { notify } from '@/store/toastStore'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'

export function GrnDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams] = useSearchParams()
  const [grn, setGrn] = useState<GoodsReceiptNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [postConfirmOpen, setPostConfirmOpen] = useState(false)
  const [inventoryMsgOpen, setInventoryMsgOpen] = useState(false)
  const [reverseOpen, setReverseOpen] = useState(false)
  const [reverseSelectedIds, setReverseSelectedIds] = useState<string[]>([])
  const [reverseQtyByLineId, setReverseQtyByLineId] = useState<Record<string, number>>({})
  const [reverseReason, setReverseReason] = useState('')
  const [reverseBusy, setReverseBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const row = await getGRNById(id)
      if (!row) {
        notify.error('GRN not found')
        navigate('/purchase/grn')
        return
      }
      setGrn(row)
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!grn) return
    if (searchParams.get('print') === '1') {
      navigate(`/purchase/grn/${grn.id}/print`, { replace: true })
    }
  }, [grn, navigate, searchParams])

  const run = async (work: () => Promise<GoodsReceiptNote>, success: string) => {
    setBusy(true)
    try {
      const updated = await work()
      setGrn(updated)
      notify.success(success)
      return updated
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Action failed')
      return null
    } finally {
      setBusy(false)
    }
  }

  const receiptSummary = useMemo(
    () => (grn ? summarizeGrnReceipt(grn.lines.filter(isIncludedGrnLine)) : null),
    [grn],
  )

  /** Saved GRN lines only (legacy idle zero-qty / not-received clutter excluded). */
  const documentLines = useMemo(
    () => (grn ? grn.lines.filter(isIncludedGrnLine) : []),
    [grn],
  )

  const reversibleLines = useMemo(() => {
    return documentLines.filter((l) => {
      const remaining =
        l.remainingReversibleQty ??
        Math.max(0, (Number(l.receivedQty) || 0) - (Number(l.reversedQty) || 0))
      return remaining > 0 && (Number(l.receivedQty) || 0) > 0
    })
  }, [documentLines])

  const remainingReversibleQty = (l: (typeof reversibleLines)[number]) =>
    l.remainingReversibleQty ??
    Math.max(0, (Number(l.receivedQty) || 0) - (Number(l.reversedQty) || 0))

  const openReverseModal = () => {
    const qtyMap: Record<string, number> = {}
    for (const l of reversibleLines) {
      qtyMap[l.id] = remainingReversibleQty(l)
    }
    setReverseQtyByLineId(qtyMap)
    setReverseSelectedIds(reversibleLines.map((l) => l.id))
    setReverseReason('')
    setReverseOpen(true)
  }

  const reverseQtyValid = useMemo(() => {
    if (reverseSelectedIds.length === 0) return false
    return reverseSelectedIds.every((id) => {
      const line = reversibleLines.find((l) => l.id === id)
      if (!line) return false
      const remaining = remainingReversibleQty(line)
      const q = reverseQtyByLineId[id] ?? remaining
      return q > 0 && q <= remaining + 1e-9
    })
  }, [reverseSelectedIds, reverseQtyByLineId, reversibleLines])

  const headerFacts = useMemo(() => {
    if (!grn) return []
    return [
      { label: 'Vendor', value: grn.vendor.name },
      { label: 'PO', value: grn.purchaseOrderNumber },
      { label: 'GRN Date', value: formatDate(grn.documentDate) },
      { label: 'Warehouse', value: grn.warehouseName || '-' },
    ]
  }, [grn])

  if (loading || !grn) {
    return (
      <PurchaseCardFormShell
        title="Goods Receipt Note"
        description="Loading…"
        status="-"
        favoritePath="/purchase/grn"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'GRN / Receipts', to: '/purchase/grn' },
          { label: 'Loading' },
        ]}
        footer={null}
        stickyFooter={false}
        detailMode
      >
        {loading ? (
          <LoadingState variant="form" rows={6} />
        ) : (
          <EmptyState icon={Package} title="GRN not found" />
        )}
      </PurchaseCardFormShell>
    )
  }

  const statusLabel = formatGrnStatusLabel(grn.status, documentLines)
  const actions = grn.allowedActions
  const canEdit = actions?.canEdit ?? (grn.status === 'draft' || grn.status === 'pending_inspection')
  const canSubmit = actions?.canSubmit ?? grn.status === 'draft'
  const canCancel = actions?.canCancel ?? false
  const canReverse = actions?.canReverse ?? false
  const canPost =
    actions?.canPostInventory ??
    (grn.status === 'accepted' ||
      grn.status === 'partially_accepted' ||
      (grn.status === 'pending_inspection' && !grn.inspectionRequired))
  const postGate = purchaseActionGate({
    permission: 'purchase.grn.post',
    statusAllowed: canPost,
  })
  const createGate = purchaseActionGate({
    permission: 'purchase.grn.create',
    statusAllowed: canSubmit || canEdit,
  })
  const reverseGate = purchaseActionGate({
    permission: 'purchase.grn.post',
    statusAllowed: canReverse && !grn.reverseBlockedReason,
    statusBlockedReason: grn.reverseBlockedReason ?? undefined,
  })
  const cancelGate = purchaseActionGate({
    permission: 'purchase.grn.create',
    statusAllowed: canCancel,
  })
  const hasReturnableQty =
    (grn.totalReturnableQty ?? 0) > 0 ||
    documentLines.some((l) => (l.returnableQty ?? 0) > 0)
  const totalReturned = grn.totalReturnedQty ?? documentLines.reduce((s, l) => s + (l.returnedQty ?? 0), 0)
  const totalReturnable = grn.totalReturnableQty ?? documentLines.reduce((s, l) => s + (l.returnableQty ?? 0), 0)
  const returnGate = purchaseActionGate({
    permission: 'purchase.return.create',
    statusAllowed:
      grn.status !== 'draft' &&
      grn.status !== 'cancelled' &&
      grn.status !== 'reversed' &&
      hasReturnableQty,
    statusBlockedReason: 'No returnable quantity on this GRN (complete QC / posting first)',
  })

  const documentFactBox = (
    <PurchaseDocumentFactBox
      vendor={{
        id: grn.vendor.id,
        code: grn.vendor.code,
        name: grn.vendor.name,
      }}
      documentStatus={{
        statusLabel,
        ...purchaseDocumentApprovalFact(grn.status),
        createdBy: grn.createdBy,
        modifiedBy: grn.updatedBy,
        modifiedDate: grn.updatedAt ? formatDate(grn.updatedAt.slice(0, 10)) : null,
      }}
      related={buildPurchaseRelatedLinks({
        purchaseOrderId: grn.purchaseOrderId,
        purchaseOrderNumber: grn.purchaseOrderNumber,
      })}
    />
  )

  return (
    <PurchaseCardFormShell
      title={grn.documentNumber}
      description={`${grn.vendor.name} · ${grn.purchaseOrderNumber}`}
      recordNo={grn.documentNumber}
      status={statusLabel}
      statusTone={purchaseStatusTone(grn.status)}
      statusKey={grn.status}
      company={grn.vendor.name}
      favoritePath={`/purchase/grn/${grn.id}`}
      breadcrumbs={[
        { label: 'Purchase', to: '/purchase' },
        { label: 'GRN / Receipts', to: '/purchase/grn' },
        { label: grn.documentNumber },
      ]}
      createdBy={grn.createdBy}
      createdDate={formatDate(grn.createdAt.slice(0, 10))}
      modifiedBy={grn.updatedBy ?? undefined}
      modifiedDate={grn.updatedAt ? formatDate(grn.updatedAt.slice(0, 10)) : undefined}
      recordHeaderFacts={headerFacts}
      detailMode
      factBox={documentFactBox}
      collapsibleFactBox
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          collapseSecondaryOnNarrow={false}
          primaryAction={
            canPost && !postGate.hidden
              ? {
                  id: 'post',
                  label: 'Post GRN',
                  icon: PackageCheck,
                  onClick: () => setPostConfirmOpen(true),
                  disabled: busy || postGate.disabled,
                  disabledReason: postGate.disabledReason,
                }
              : grn.status === 'pending_tolerance_approval' && perms.canPostGrn
                ? {
                    id: 'approve-tol',
                    label: 'Approve Tolerance',
                    icon: CheckCircle2,
                    onClick: () =>
                      void run(
                        () => approveToleranceGRN(grn.id),
                        'Tolerance approved — GRN submitted',
                      ),
                    disabled: busy,
                  }
              : canSubmit && !createGate.hidden
                ? {
                    id: 'submit',
                    label: 'Submit',
                    icon: Send,
                    onClick: async () => {
                      const updated = await run(() => submitGRN(grn.id), 'GRN submitted')
                      if (updated?.status === 'pending_tolerance_approval') {
                        notify.info(
                          'Outside tolerance — awaiting Purchase Manager approval.',
                        )
                      } else if (
                        updated &&
                        updated.inspectionRequired &&
                        !updated.qualityInspectionId
                      ) {
                        notify.info(
                          'GRN submitted. Open Quality Inspection from the command bar to continue QC.',
                        )
                      }
                    },
                    disabled: busy || createGate.disabled,
                    disabledReason: createGate.disabledReason,
                  }
                : undefined
          }
          secondaryActions={[
            {
              id: 'reject-tol',
              label: 'Reject Tolerance',
              icon: XCircle,
              onClick: () =>
                void run(() => rejectToleranceGRN(grn.id, 'Rejected'), 'Returned to draft'),
              hidden: grn.status !== 'pending_tolerance_approval',
              disabled: busy || !perms.canPostGrn,
            },
            {
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              pin: true,
              onClick: () => navigate(`/purchase/grn/${grn.id}/edit`),
              hidden: createGate.hidden,
              disabled: !canEdit || createGate.disabled,
              disabledReason: createGate.disabledReason,
            },
            {
              id: 'qi',
              label: 'Quality Inspection',
              icon: ClipboardCheck,
              onClick: () =>
                navigate(
                  grn.qualityInspectionId
                    ? `/purchase/quality-inspections/${grn.qualityInspectionId}`
                    : `/purchase/quality-inspections/new?grnId=${grn.id}`,
                ),
              hidden: !perms.canViewQuality,
              disabled: !grn.inspectionRequired,
            },
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              pin: true,
              onClick: () => navigate(`/purchase/grn/${grn.id}/print`),
            },
            {
              id: 'download',
              label: 'Download PDF',
              icon: Download,
              onClick: () => navigate(`/purchase/grn/${grn.id}/print?download=1`),
            },
            {
              id: 'valuation',
              label: 'View Cost Entries',
              icon: Package,
              onClick: () =>
                navigate(
                  `/inventory/costing/entries?search=${encodeURIComponent(grn.documentNumber)}`,
                ),
              hidden: grn.status === 'draft' || grn.status === 'cancelled',
            },
            {
              id: 'invoice',
              label: 'Create Invoice',
              icon: FileText,
              onClick: () =>
                navigate(`/purchase/invoices/new?fromGrn=${grn.id}`),
              hidden: !perms.canCreateInvoice,
              disabled:
                busy ||
                !(
                  grn.status === 'posted' ||
                  grn.status === 'accepted' ||
                  grn.status === 'partially_accepted'
                ),
              disabledReason: 'Accept / post GRN before invoicing',
            },
            {
              id: 'return',
              label: 'Create Material Return',
              icon: RotateCcw,
              onClick: async () => {
                setBusy(true)
                try {
                  const ret = await createPurchaseReturnFromGrn(grn.id)
                  notify.success(`Material return ${ret.documentNumber} created`)
                  navigate(`/purchase/returns/${ret.id}`)
                } catch (err) {
                  notify.error(err instanceof PurchaseServiceError ? err.message : 'Return failed')
                } finally {
                  setBusy(false)
                }
              },
              hidden: returnGate.hidden,
              disabled: busy || returnGate.disabled,
              disabledReason: returnGate.disabledReason ?? 'No returnable quantity on this GRN (complete QC / posting first)',
            },
            {
              id: 'reverse-grn',
              label: 'Reverse GRN',
              icon: RotateCcw,
              onClick: () => openReverseModal(),
              hidden: reverseGate.hidden,
              disabled: busy || reverseGate.disabled || reversibleLines.length === 0,
              disabledReason:
                reverseGate.disabledReason ??
                (reversibleLines.length === 0 ? 'No received lines remain to reverse' : undefined),
            },
            {
              id: 'cancel-grn',
              label: 'Cancel GRN',
              icon: XCircle,
              onClick: async () => {
                const ok = await appConfirm({
                  title: 'Cancel GRN?',
                  description:
                    'Cancel this draft or in-progress receipt. Posted stock on QC-pending receipts will be unwound.',
                  confirmLabel: 'Cancel GRN',
                  tone: 'danger',
                })
                if (!ok) return
                const reason = await appPromptNote({
                  title: 'Cancellation reason',
                  description: 'Optional note for audit trail.',
                  confirmLabel: 'Confirm cancel',
                  note: { required: false, label: 'Note' },
                })
                await run(() => cancelGRN(grn.id, reason?.trim() ?? ''), 'GRN cancelled')
              },
              hidden: cancelGate.hidden,
              disabled: busy || cancelGate.disabled,
              disabledReason: cancelGate.disabledReason,
            },
          ]}
        />
      }
      footer={null}
      stickyFooter={false}
    >
      <div className="space-y-3">
        {grn.status === 'reversed' ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-950">
            This GRN was fully reversed
            {grn.reversedAt ? ` on ${formatDate(grn.reversedAt.slice(0, 10))}` : ''}. Stock and PO
            receipt quantities for all lines have been restored.
          </div>
        ) : grn.partiallyReversed || (receiptSummary?.reversedLineCount ?? 0) > 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
            <strong>Partial reverse</strong>
            {receiptSummary ? (
              <>
                {' '}
                — {receiptSummary.reversedLineCount} line
                {receiptSummary.reversedLineCount === 1 ? '' : 's'} reversed;{' '}
                {receiptSummary.receivedLineCount} line
                {receiptSummary.receivedLineCount === 1 ? '' : 's'} still received. Use Reverse GRN
                again to reverse remaining lines, or Material Return for vendor returns.
              </>
            ) : (
              <> — some received lines have been reversed. Remaining lines can still be reversed.</>
            )}
          </div>
        ) : null}
        {grn.status === 'pending_tolerance_approval' ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
            Outside receiving tolerance — awaiting Purchase Manager approval. Use Approve / Reject
            Tolerance above, or resolve from the Purchase Approvals queue.
          </div>
        ) : null}
        <ErpCardSection
          title="General"
          subtitle="Identity, vendor, and receipt details"
          collapsible
          defaultOpen
          columns={6}
        >
          <ErpViewField label="GRN Number" value={grn.documentNumber} />
          <ErpViewField label="GRN Date" value={formatDate(grn.documentDate)} />
          <ErpViewField
            label="Status"
            value={<StatusDot label={statusLabel} tone={statusToneFromLabel(grn.status)} />}
          />
          <ErpViewField label="Amount" value={formatCurrency(grn.totalAmount)} />
          <ErpViewField
            label="PO Number"
            value={
              <Link to={`/purchase/orders/${grn.purchaseOrderId}`} className="text-erp-primary font-mono">
                {grn.purchaseOrderNumber}
              </Link>
            }
          />
          <ErpViewField label="Vendor" value={`${grn.vendor.code} — ${grn.vendor.name}`} />
          <ErpViewField label="Vendor Challan" value={grn.vendorChallanNumber || '-'} />
          <ErpViewField
            label="Challan Date"
            value={grn.vendorChallanDate ? formatDate(grn.vendorChallanDate) : '-'}
          />
          <ErpViewField label="Vehicle" value={grn.vehicleNo || '-'} />
          <ErpViewField label="Transporter" value={grn.transporterName || '-'} />
          <ErpViewField label="LR Number" value={grn.lrNumber || '-'} />
          <ErpViewField label="Gate Entry" value={grn.gateEntryNo || '-'} />
          <ErpViewField label="Warehouse" value={grn.warehouseName || '-'} />
          <ErpViewField label="Receiving Location" value={grn.receivingLocation || '-'} />
          <ErpViewField label="Received By" value={grn.receivedBy.name} />
          <ErpViewField label="Inspection Required" value={grn.inspectionRequired ? 'Yes' : 'No'} />
          <ErpViewField label="Remarks" value={grn.remarks || '-'} colSpan={3} />
        </ErpCardSection>

        <ErpCardSection
          title="Receiving chain"
          subtitle="Quality · Inventory costing · Invoice · Return"
          collapsible
          defaultOpen
          columns={1}
        >
          <div className="grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-erp-border p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Quality</div>
              <p className="mt-1">
                {grn.inspectionRequired
                  ? grn.qualityInspectionId
                    ? 'QI linked'
                    : 'QI required'
                  : 'QI not required'}
              </p>
              {grn.inspectionRequired ? (
                <button
                  type="button"
                  className="mt-2 font-semibold text-erp-primary hover:underline"
                  onClick={() =>
                    navigate(
                      grn.qualityInspectionId
                        ? `/purchase/quality-inspections/${grn.qualityInspectionId}`
                        : `/purchase/quality-inspections/new?grnId=${grn.id}`,
                    )
                  }
                >
                  {grn.qualityInspectionId ? 'Open QI →' : 'Create QI →'}
                </button>
              ) : null}
            </div>
            <div className="rounded-md border border-erp-border p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                Inventory costing
              </div>
              <p className="mt-1">Valuation is owned by Inventory Costing (not Purchase).</p>
              <button
                type="button"
                className="mt-2 font-semibold text-erp-primary hover:underline"
                onClick={() =>
                  navigate(
                    `/inventory/costing/entries?search=${encodeURIComponent(grn.documentNumber)}`,
                  )
                }
              >
                View cost entries →
              </button>
            </div>
            <div className="rounded-md border border-erp-border p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Invoice</div>
              <p className="mt-1">Create Purchase Invoice from accepted / posted quantity.</p>
              <button
                type="button"
                className="mt-2 font-semibold text-erp-primary hover:underline disabled:opacity-50"
                disabled={!perms.canCreateInvoice}
                onClick={() =>
                  navigate(`/purchase/invoices/new?fromGrn=${grn.id}`)
                }
              >
                Create invoice →
              </button>
            </div>
            <div className="rounded-md border border-erp-border p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Return</div>
              <p className="mt-1">
                {totalReturned > 0 ? (
                  <>
                    <strong className="tabular-nums">{formatNumber(totalReturned)}</strong> returned
                    {totalReturnable > 0 ? (
                      <>
                        {' '}
                        ·{' '}
                        <strong className="tabular-nums">{formatNumber(totalReturnable)}</strong>{' '}
                        still returnable
                      </>
                    ) : (
                      <> · fully returned</>
                    )}
                  </>
                ) : (
                  <>Material returns reduce stock; received qty on the GRN is unchanged.</>
                )}
              </p>
              <button
                type="button"
                className="mt-2 font-semibold text-erp-primary hover:underline disabled:opacity-50"
                disabled={returnGate.hidden || returnGate.disabled || busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const ret = await createPurchaseReturnFromGrn(grn.id)
                    notify.success(`Return ${ret.documentNumber} created`)
                    navigate(`/purchase/returns/${ret.id}`)
                  } catch (err) {
                    notify.error(err instanceof PurchaseServiceError ? err.message : 'Return failed')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Create return →
              </button>
            </div>
          </div>
        </ErpCardSection>

        <ErpCardSection
          title="Item Lines"
          subtitle={
            receiptSummary
              ? `${documentLines.length} line${documentLines.length === 1 ? '' : 's'} · received on this GRN: ${receiptSummary.receivedLineCount}`
              : `${documentLines.length} line${documentLines.length === 1 ? '' : 's'}`
          }
          collapsible
          defaultOpen
          columns={1}
        >
          {grn.status === 'posted' && receiptSummary && (receiptSummary.partialReceipt || receiptSummary.stillOpenOnPoTotal > 0) ? (
            <p className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-950">
              <strong>Posted</strong> means inventory was updated for quantities received on{' '}
              <em>this</em> GRN only ({formatNumber(documentLines.reduce((s, l) => s + l.receivedQty, 0))} total).
              {receiptSummary.stillOpenOnPoTotal > 0
                ? ' Remaining open quantity stays on the purchase order — create another GRN to receive the balance.'
                : null}
            </p>
          ) : null}
          <p className="mb-2 text-[11px] text-erp-muted">
            <strong>PO open (before GRN)</strong> is the open PO quantity when this GRN was created (snapshot).
            <strong> Still on PO</strong> is what remains open on the purchase order after this GRN&apos;s received qty.
            Material returns appear as <strong>negative rows</strong> under each receipt line; the net row shows qty still on hand.
          </p>
          <div className="min-w-0 w-full overflow-x-auto rounded-md border border-erp-border">
            <table className="erp-table w-full min-w-[1120px] text-left text-[12px]">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Item</th>
                  <th className="w-16">UOM</th>
                  <th className="num">Ordered</th>
                  <th className="num">Prev</th>
                  <th className="num" title="Open PO quantity when this GRN was created">PO open (before)</th>
                  <th className="num">Received</th>
                  <th className="num" title="Qty returned to vendor on this GRN line">Returned</th>
                  <th className="num" title="PO quantity still open after this GRN">Still on PO</th>
                  <th className="num">Tol %</th>
                  <th className="num">Var %</th>
                  <th>Tol status</th>
                  <th className="num">Accepted</th>
                  <th className="num">Rejected</th>
                  <th>Batch</th>
                  <th>Inspection</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {documentLines.flatMap((l) => {
                  const returnRows = (grn.materialReturnLines ?? []).filter(
                    (r) => r.goodsReceiptLineId === l.id,
                  )
                  const returnedTotal = l.returnedQty ?? returnRows.reduce((s, r) => s + r.returnQuantity, 0)
                  const hasReturns = returnedTotal > 0
                  const reversedQty = Number(l.reversedQty) || 0
                  const netReceived = l.receivedQty - returnedTotal - reversedQty
                  const netAccepted = l.acceptedQty - returnedTotal - (Number(l.reversedAcceptedQty) || 0)
                  const lineUom = l.uom?.trim() || '-'
                  const baseUom = getPurchaseLineBaseUomCode(l.itemId) || lineUom
                  const dualReceived = purchaseLineHasDualUom({
                    itemId: l.itemId,
                    uomConversionFactor: l.uomConversionFactor,
                  })
                  const dash = <td className="num text-erp-muted">-</td>
                  const fullyReversed = Boolean(l.lineFullyReversed) || (reversedQty > 0 && netReceived <= 0)

                  const receiptRow = (
                    <tr key={l.id} className={fullyReversed ? 'bg-red-50/40' : undefined}>
                      <td className="tabular-nums text-erp-muted">{l.lineNo}</td>
                      <td className="min-w-[10rem]">
                        <div className="font-mono text-[11px] text-erp-muted whitespace-nowrap">
                          {l.itemCode}
                        </div>
                        <div className="font-medium text-erp-text">{l.itemName}</div>
                        {fullyReversed ? (
                          <div className="mt-0.5 text-[11px] font-semibold text-red-800">Reversed</div>
                        ) : reversedQty > 0 ? (
                          <div className="mt-0.5 text-[11px] font-semibold text-amber-800">
                            Partially reversed
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap font-mono text-[11px] text-erp-muted">{lineUom}</td>
                      <td className="num tabular-nums">{formatNumber(l.orderedQty)}</td>
                      <td className="num tabular-nums">{formatNumber(l.previouslyReceivedQty)}</td>
                      <td className="num tabular-nums">{formatNumber(l.pendingQty)}</td>
                      <td className="num tabular-nums">
                        <div>
                          {formatNumber(l.receivedUomQty ?? l.receivedQty)} {lineUom}
                        </div>
                        {dualReceived && baseUom !== lineUom ? (
                          <div className="text-[10px] text-erp-muted">
                            {formatPurchaseQty(l.receivedQty)} {baseUom}
                          </div>
                        ) : null}
                      </td>
                      <td className="num tabular-nums">
                        {hasReturns ? (
                          <span className="font-medium text-red-700">−{formatNumber(returnedTotal)}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="num tabular-nums">{formatNumber(remainingPoOpenAfterGrn(l))}</td>
                      <td className="num tabular-nums">{formatNumber(l.tolerancePercentage ?? 0)}</td>
                      <td className="num tabular-nums">
                        {l.variancePercentage == null ? '-' : `${formatNumber(l.variancePercentage)}%`}
                      </td>
                      <td className="whitespace-nowrap">
                        {GRN_TOLERANCE_STATUS_LABELS[
                          (l.toleranceStatus ?? 'EXACT') as keyof typeof GRN_TOLERANCE_STATUS_LABELS
                        ] ?? l.toleranceStatus}
                      </td>
                      <td className="num tabular-nums">{formatNumber(l.acceptedQty)}</td>
                      <td
                        className={
                          l.rejectedQty > 0
                            ? 'num tabular-nums font-semibold text-red-700'
                            : 'num tabular-nums'
                        }
                      >
                        {formatNumber(l.rejectedQty)}
                      </td>
                      <td className="font-mono text-[11px] whitespace-nowrap">{l.batchNumber || '-'}</td>
                      <td className="whitespace-nowrap">
                        {GRN_LINE_INSPECTION_STATUS_LABELS[l.inspectionStatus]}
                      </td>
                      <td className="text-erp-muted">{l.remarks || '-'}</td>
                    </tr>
                  )

                  const reverseRow =
                    reversedQty > 0 ? (
                      <tr key={`${l.id}-reverse`} className="bg-red-50/70">
                        <td />
                        <td className="min-w-[10rem] pl-6">
                          <div className="font-semibold text-red-900">↳ Reverse</div>
                          <div className="text-[11px] text-red-800">
                            Inventory / PO receipt restored
                            {l.reversedAt
                              ? ` · ${formatDate(l.reversedAt.slice(0, 10))}`
                              : ''}
                          </div>
                        </td>
                        <td className="whitespace-nowrap font-mono text-[11px] text-red-800">{lineUom}</td>
                        {dash}
                        {dash}
                        {dash}
                        <td className="num tabular-nums font-medium text-red-700">
                          −{formatNumber(reversedQty)}
                        </td>
                        {dash}
                        {dash}
                        {dash}
                        {dash}
                        {dash}
                        <td className="num tabular-nums font-medium text-red-700">
                          −{formatNumber(Number(l.reversedAcceptedQty) || reversedQty)}
                        </td>
                        <td className="num tabular-nums font-medium text-red-700">
                          {(Number(l.reversedRejectedQty) || 0) > 0
                            ? `−${formatNumber(Number(l.reversedRejectedQty) || 0)}`
                            : '-'}
                        </td>
                        {dash}
                        {dash}
                        <td className="text-erp-muted">GRN reverse</td>
                      </tr>
                    ) : null

                  const fallbackReturnRow =
                    hasReturns && returnRows.length === 0 ? (
                      <tr key={`${l.id}-return-summary`} className="bg-violet-50/60">
                        <td />
                        <td className="min-w-[10rem] pl-6">
                          <div className="font-semibold text-violet-900">↳ Material return</div>
                          <div className="text-[11px] text-violet-800">Returned to vendor</div>
                        </td>
                        <td className="whitespace-nowrap font-mono text-[11px] text-violet-800">{lineUom}</td>
                        {dash}
                        {dash}
                        {dash}
                        {dash}
                        <td className="num tabular-nums font-medium text-red-700">
                          −{formatNumber(returnedTotal)}
                        </td>
                        {dash}
                        {dash}
                        {dash}
                        {dash}
                        <td className="num tabular-nums font-medium text-red-700">
                          −{formatNumber(returnedTotal)}
                        </td>
                        {dash}
                        {dash}
                        {dash}
                        {dash}
                        <td className="text-erp-muted">Material return</td>
                      </tr>
                    ) : null

                  const materialReturnRows = returnRows.map((r) => (
                    <tr key={`${l.id}-return-${r.purchaseReturnId}`} className="bg-violet-50/60">
                      <td />
                      <td className="min-w-[10rem] pl-6">
                        <Link
                          to={`/purchase/returns/${r.purchaseReturnId}`}
                          className="font-mono text-[11px] font-semibold text-erp-primary hover:underline"
                        >
                          ↳ {r.returnNumber}
                        </Link>
                        <div className="text-[11px] text-violet-800">Material return to vendor</div>
                      </td>
                      <td className="whitespace-nowrap font-mono text-[11px] text-violet-800">{lineUom}</td>
                      {dash}
                      {dash}
                      {dash}
                      {dash}
                      <td className="num tabular-nums font-medium text-red-700">
                        −{formatNumber(r.returnQuantity)}
                      </td>
                      {dash}
                      {dash}
                      {dash}
                      {dash}
                      <td className="num tabular-nums font-medium text-red-700">
                        −{formatNumber(r.returnQuantity)}
                      </td>
                      {dash}
                      {dash}
                      {dash}
                      <td className="text-erp-muted">Material return</td>
                    </tr>
                  ))

                  const netRow =
                    hasReturns || reversedQty > 0 ? (
                      <tr key={`${l.id}-net`} className="border-t border-erp-border bg-slate-50/90 font-semibold">
                        <td />
                        <td className="pl-6 text-[12px] text-erp-text">
                          Net after reverse{hasReturns ? ' / returns' : ''}
                        </td>
                        <td className="whitespace-nowrap font-mono text-[11px] text-erp-text">{lineUom}</td>
                        {dash}
                        {dash}
                        {dash}
                        <td className="num tabular-nums text-erp-text">{formatNumber(netReceived)}</td>
                        <td className="num tabular-nums text-erp-text">
                          {hasReturns ? `−${formatNumber(returnedTotal)}` : '-'}
                        </td>
                        {dash}
                        {dash}
                        {dash}
                        {dash}
                        <td className="num tabular-nums text-erp-text">{formatNumber(netAccepted)}</td>
                        {dash}
                        {dash}
                        {dash}
                        <td className="text-[11px] text-erp-muted">
                          {fullyReversed
                            ? 'Fully reversed'
                            : (l.returnableQty ?? 0) > 0
                              ? `${formatNumber(l.returnableQty ?? 0)} still returnable`
                              : hasReturns
                                ? 'Fully returned'
                                : '-'}
                        </td>
                      </tr>
                    ) : null

                  return [
                    receiptRow,
                    reverseRow,
                    fallbackReturnRow,
                    ...materialReturnRows,
                    netRow,
                  ].filter(Boolean)
                })}
              </tbody>
            </table>
          </div>
        </ErpCardSection>
      </div>

      <Modal
        open={postConfirmOpen}
        onClose={() => setPostConfirmOpen(false)}
        title="Post GRN"
        footer={
          <>
            <ErpButton variant="secondary" onClick={() => setPostConfirmOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setPostConfirmOpen(false)
                const updated = await run(() => postGRN(grn.id), `${grn.documentNumber} posted`)
                if (updated) setInventoryMsgOpen(true)
              }}
            >
              Post
            </ErpButton>
          </>
        }
      >
        <p className="text-sm text-erp-muted">
          Post {grn.documentNumber}? This updates PO received quantities and posts stock into Inventory
          (or holds it for Quality Inspection when QC is required). Stock posts to the live inventory
          ledger when no open quality hold remains.
        </p>
      </Modal>

      <Modal
        open={inventoryMsgOpen}
        onClose={() => setInventoryMsgOpen(false)}
        title="GRN posted"
        footer={
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={() => setInventoryMsgOpen(false)}>
              Close
            </ErpButton>
            <ErpButton
              variant="primary"
              onClick={() => {
                setInventoryMsgOpen(false)
                navigate('/inventory/stock')
              }}
            >
              View Stock
            </ErpButton>
            <ErpButton
              variant="secondary"
              onClick={() => {
                setInventoryMsgOpen(false)
                navigate('/inventory/costing')
              }}
            >
              Valuation
            </ErpButton>
          </div>
        }
      >
        <p className="text-sm">
          {grn.inventoryPostDeferred || grn.inspectionRequired
            ? 'GRN posted. Inventory posting is waiting on quality inspection or warehouse setup — check Stock after QI accept / Post inventory completes.'
            : 'GRN posted and stock is now available in Inventory.'}
        </p>
      </Modal>

      <Modal
        open={reverseOpen}
        onClose={() => !reverseBusy && setReverseOpen(false)}
        title="Reverse goods receipt"
        size="lg"
        closeDisabled={reverseBusy}
        footer={
          <>
            <ErpButton
              variant="secondary"
              disabled={reverseBusy}
              onClick={() => setReverseOpen(false)}
            >
              Cancel
            </ErpButton>
            <ErpButton
              variant="danger"
              disabled={
                reverseBusy ||
                reverseSelectedIds.length === 0 ||
                !reverseReason.trim() ||
                !reverseQtyValid
              }
              onClick={async () => {
                if (!reverseReason.trim() || reverseSelectedIds.length === 0 || !reverseQtyValid) {
                  return
                }
                const lineQuantities = reverseSelectedIds
                  .map((lineId) => {
                    const line = reversibleLines.find((l) => l.id === lineId)
                    const remaining = line ? remainingReversibleQty(line) : 0
                    return {
                      lineId,
                      quantity: reverseQtyByLineId[lineId] ?? remaining,
                    }
                  })
                  .filter((row) => row.quantity > 0)
                const allSelected =
                  reversibleLines.length > 0 &&
                  reverseSelectedIds.length === reversibleLines.length
                const allFullQty = reverseSelectedIds.every((id) => {
                  const line = reversibleLines.find((l) => l.id === id)
                  if (!line) return false
                  const remaining = remainingReversibleQty(line)
                  const q = reverseQtyByLineId[id] ?? remaining
                  return Math.abs(q - remaining) < 1e-9
                })
                const fullReverse = allSelected && allFullQty
                const partialQty = lineQuantities.some((row) => {
                  const line = reversibleLines.find((l) => l.id === row.lineId)
                  if (!line) return false
                  return Math.abs(row.quantity - remainingReversibleQty(line)) > 1e-9
                })
                const ok = await appConfirm({
                  title: fullReverse ? 'Reverse entire GRN?' : 'Reverse selected quantities?',
                  description: fullReverse
                    ? 'Stock will be compensated for all remaining received lines, PO open quantities restored, and this GRN will become Reversed.'
                    : partialQty
                      ? `Selected lines will reverse the entered quantities only (partial reverse). Unselected lines stay received.`
                      : `Only ${reverseSelectedIds.length} selected line${
                          reverseSelectedIds.length === 1 ? '' : 's'
                        } will reverse. Unselected lines stay received.`,
                  confirmLabel: fullReverse ? 'Reverse all' : 'Reverse selected',
                  tone: 'danger',
                })
                if (!ok) return
                setReverseBusy(true)
                try {
                  const updated = await reverseGRN(grn.id, reverseReason.trim(), {
                    lineIds: reverseSelectedIds,
                    lineQuantities,
                  })
                  setGrn(updated)
                  setReverseOpen(false)
                  notify.success(
                    fullReverse || updated.status === 'reversed'
                      ? 'GRN fully reversed'
                      : partialQty
                        ? 'Partial quantity reversed on selected line(s)'
                        : 'Selected GRN line(s) reversed',
                  )
                } catch (err) {
                  notify.error(
                    err instanceof PurchaseServiceError ? err.message : 'Reverse failed',
                  )
                } finally {
                  setReverseBusy(false)
                }
              }}
            >
              {reverseBusy ? 'Reversing…' : 'Reverse'}
            </ErpButton>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-erp-muted">
            Select received lines and enter how much to reverse on each line (full remaining or a
            partial quantity). Inventory and PO open quantities are restored only for the reversed
            qty. Use Material Return when returning goods to the vendor without undoing the GRN
            receipt.
          </p>
          {reversibleLines.length === 0 ? (
            <p className="rounded border border-erp-border bg-erp-surface-muted px-3 py-2 text-[13px]">
              No remaining received lines to reverse.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-erp-border">
              <table className="erp-table w-full text-left text-[12px]">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all reverseable lines"
                        checked={
                          reversibleLines.length > 0 &&
                          reverseSelectedIds.length === reversibleLines.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setReverseSelectedIds(reversibleLines.map((l) => l.id))
                            setReverseQtyByLineId((prev) => {
                              const next = { ...prev }
                              for (const l of reversibleLines) {
                                if (next[l.id] == null || next[l.id] <= 0) {
                                  next[l.id] = remainingReversibleQty(l)
                                }
                              }
                              return next
                            })
                          } else {
                            setReverseSelectedIds([])
                          }
                        }}
                      />
                    </th>
                    <th>#</th>
                    <th>Item</th>
                    <th className="num">Received</th>
                    <th className="num">Already reversed</th>
                    <th className="num">Will reverse</th>
                  </tr>
                </thead>
                <tbody>
                  {reversibleLines.map((l) => {
                    const remaining = remainingReversibleQty(l)
                    const checked = reverseSelectedIds.includes(l.id)
                    const reverseQty = reverseQtyByLineId[l.id] ?? remaining
                    const qtyInvalid =
                      checked && (reverseQty <= 0 || reverseQty > remaining + 1e-9)
                    return (
                      <tr key={l.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Reverse line ${l.lineNo} ${l.itemCode}`}
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setReverseSelectedIds((prev) =>
                                  prev.includes(l.id) ? prev : [...prev, l.id],
                                )
                                setReverseQtyByLineId((prev) => ({
                                  ...prev,
                                  [l.id]: prev[l.id] > 0 ? prev[l.id] : remaining,
                                }))
                              } else {
                                setReverseSelectedIds((prev) => prev.filter((id) => id !== l.id))
                              }
                            }}
                          />
                        </td>
                        <td className="tabular-nums text-erp-muted">{l.lineNo}</td>
                        <td>
                          <div className="font-mono text-[11px] text-erp-muted">{l.itemCode}</div>
                          <div className="font-medium">{l.itemName}</div>
                        </td>
                        <td className="num tabular-nums">{formatNumber(l.receivedQty)}</td>
                        <td className="num tabular-nums">
                          {formatNumber(Number(l.reversedQty) || 0)}
                        </td>
                        <td className="num">
                          <DecimalInput
                            className="w-24"
                            min={0}
                            max={remaining}
                            blankZero
                            disabled={!checked || reverseBusy}
                            value={checked ? reverseQty : 0}
                            onChange={(v) => {
                              setReverseQtyByLineId((prev) => ({ ...prev, [l.id]: v }))
                            }}
                          />
                          <div className="mt-0.5 text-[10px] text-erp-muted">
                            max {formatNumber(remaining)}
                          </div>
                          {qtyInvalid ? (
                            <div className="mt-0.5 text-[10px] text-red-600">
                              Enter 1–{formatNumber(remaining)}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-erp-text">
              Reason <span className="text-red-600">*</span>
            </span>
            <textarea
              className="w-full min-h-[72px] rounded border border-erp-border px-2 py-1.5 text-[13px]"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="e.g. Wrong item received, duplicate challan…"
              disabled={reverseBusy}
            />
          </label>
        </div>
      </Modal>
    </PurchaseCardFormShell>
  )
}
