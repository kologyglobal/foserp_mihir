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
import {
  approveToleranceGRN,
  createPurchaseReturnFromGrn,
  getGRNById,
  GRN_DOMAIN_STATUS_LABELS,
  GRN_LINE_INSPECTION_STATUS_LABELS,
  postGRN,
  PurchaseServiceError,
  rejectToleranceGRN,
  submitGRN,
} from '@/services/purchase'
import { GRN_TOLERANCE_STATUS_LABELS } from '@/services/purchase/grnTolerance'
import type { GoodsReceiptNote } from '@/types/purchaseDomain'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { purchaseActionGate, usePurchasePermissions } from '@/utils/permissions'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'

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

  const headerFacts = useMemo(() => {
    if (!grn) return []
    return [
      { label: 'Vendor', value: grn.vendor.name },
      { label: 'PO', value: grn.purchaseOrderNumber },
      { label: 'GRN Date', value: formatDate(grn.documentDate) },
      { label: 'Warehouse', value: grn.warehouseName || '—' },
    ]
  }, [grn])

  if (loading || !grn) {
    return (
      <PurchaseCardFormShell
        title="Goods Receipt Note"
        description="Loading…"
        status="—"
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

  const statusLabel = GRN_DOMAIN_STATUS_LABELS[grn.status]
  const canEdit = grn.status === 'draft' || grn.status === 'pending_inspection'
  const canSubmit = grn.status === 'draft'
  const canPost =
    grn.status === 'accepted' ||
    grn.status === 'partially_accepted' ||
    (grn.status === 'pending_inspection' && !grn.inspectionRequired)
  const postGate = purchaseActionGate({
    permission: 'purchase.grn.post',
    statusAllowed: canPost,
  })
  const createGate = purchaseActionGate({
    permission: 'purchase.grn.create',
    statusAllowed: canSubmit || canEdit,
  })
  const returnGate = purchaseActionGate({
    permission: 'purchase.return.create',
    statusAllowed: grn.lines.some((l) => l.rejectedQty > 0),
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
              label: 'Create Purchase Return',
              icon: RotateCcw,
              onClick: async () => {
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
              },
              hidden: returnGate.hidden,
              disabled: busy || returnGate.disabled,
              disabledReason: returnGate.disabledReason,
            },
          ]}
        />
      }
      footer={null}
      stickyFooter={false}
    >
      <div className="space-y-3">
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
          columns={4}
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
          <ErpViewField label="Vendor Challan" value={grn.vendorChallanNumber || '—'} />
          <ErpViewField
            label="Challan Date"
            value={grn.vendorChallanDate ? formatDate(grn.vendorChallanDate) : '—'}
          />
          <ErpViewField label="Vehicle" value={grn.vehicleNo || '—'} />
          <ErpViewField label="Transporter" value={grn.transporterName || '—'} />
          <ErpViewField label="LR Number" value={grn.lrNumber || '—'} />
          <ErpViewField label="Gate Entry" value={grn.gateEntryNo || '—'} />
          <ErpViewField label="Warehouse" value={grn.warehouseName || '—'} />
          <ErpViewField label="Receiving Location" value={grn.receivingLocation || '—'} />
          <ErpViewField label="Received By" value={grn.receivedBy.name} />
          <ErpViewField label="Inspection Required" value={grn.inspectionRequired ? 'Yes' : 'No'} />
          <ErpViewField label="Remarks" value={grn.remarks || '—'} colSpan={3} />
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
              <p className="mt-1">Returnable qty comes from the Purchase Return API.</p>
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
          subtitle={`${grn.lines.length} line${grn.lines.length === 1 ? '' : 's'}`}
          collapsible
          defaultOpen
          columns={1}
        >
          <div className="min-w-0 w-full overflow-x-auto rounded-md border border-erp-border">
            <table className="erp-table w-full min-w-[960px] text-left text-[12px]">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Item</th>
                  <th className="num">Ordered</th>
                  <th className="num">Prev</th>
                  <th className="num">Pending</th>
                  <th className="num">Received</th>
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
                {grn.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="tabular-nums text-erp-muted">{l.lineNo}</td>
                    <td className="min-w-[10rem]">
                      <div className="font-mono text-[11px] text-erp-muted whitespace-nowrap">
                        {l.itemCode}
                      </div>
                      <div className="font-medium text-erp-text">{l.itemName}</div>
                    </td>
                    <td className="num tabular-nums">{formatNumber(l.orderedQty)}</td>
                    <td className="num tabular-nums">{formatNumber(l.previouslyReceivedQty)}</td>
                    <td className="num tabular-nums">{formatNumber(l.pendingQty)}</td>
                    <td className="num tabular-nums">{formatNumber(l.receivedQty)}</td>
                    <td className="num tabular-nums">{formatNumber(l.tolerancePercentage ?? 0)}</td>
                    <td className="num tabular-nums">
                      {l.variancePercentage == null ? '—' : `${formatNumber(l.variancePercentage)}%`}
                    </td>
                    <td className="whitespace-nowrap">
                      {GRN_TOLERANCE_STATUS_LABELS[
                        (l.toleranceStatus ?? 'OK') as keyof typeof GRN_TOLERANCE_STATUS_LABELS
                      ] ?? l.toleranceStatus}
                    </td>
                    <td className="num tabular-nums">{formatNumber(l.acceptedQty)}</td>
                    <td className="num tabular-nums">{formatNumber(l.rejectedQty)}</td>
                    <td className="font-mono text-[11px] whitespace-nowrap">{l.batchNumber || '—'}</td>
                    <td className="whitespace-nowrap">
                      {GRN_LINE_INSPECTION_STATUS_LABELS[l.inspectionStatus]}
                    </td>
                    <td className="text-erp-muted">{l.remarks || '—'}</td>
                  </tr>
                ))}
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
    </PurchaseCardFormShell>
  )
}
