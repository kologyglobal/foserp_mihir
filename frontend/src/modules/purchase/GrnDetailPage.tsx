import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ClipboardCheck,
  Package,
  PackageCheck,
  Pencil,
  Printer,
  RotateCcw,
  Send,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { ErpCardSection, ErpViewField } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import {
  createPurchaseReturnFromGrn,
  getGRNById,
  GRN_DOMAIN_STATUS_LABELS,
  GRN_LINE_INSPECTION_STATUS_LABELS,
  postGRN,
  PurchaseServiceError,
  submitGRN,
} from '@/services/purchase'
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
  const [searchParams, setSearchParams] = useSearchParams()
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
    if (searchParams.get('print') === '1' || window.location.pathname.endsWith('/print')) {
      window.print()
      searchParams.delete('print')
      setSearchParams(searchParams, { replace: true })
    }
  }, [grn, searchParams, setSearchParams])

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

  if (loading || !grn) {
    return (
      <PurchaseCardFormShell
        title="Goods Receipt Note"
        description="Loading…"
        status="—"
        favoritePath="/purchase/grn"
        breadcrumbs={[
          { label: 'GRN / Receipts', to: '/purchase/grn' },
          { label: 'Loading' },
        ]}
        backLink={{ to: '/purchase/grn', label: 'Back to Goods Receipts' }}
        footer={null}
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
      favoritePath={`/purchase/grn/${grn.id}`}
      breadcrumbs={[
        { label: 'GRN / Receipts', to: '/purchase/grn' },
        { label: grn.documentNumber },
      ]}
      backLink={{ to: '/purchase/grn', label: 'Back to Goods Receipts' }}
      documentIdentity={{
        moduleLabel: 'GOODS RECEIPT NOTE',
        title: grn.documentNumber,
        status: statusLabel,
        statusTone: purchaseStatusTone(grn.status),
      }}
      documentFacts={[
        { label: 'GRN No', value: grn.documentNumber, emphasize: true },
        { label: 'Vendor', value: grn.vendor.name, emphasize: true },
        { label: 'PO Source', value: grn.purchaseOrderNumber, emphasize: true },
        { label: 'GRN Date', value: formatDate(grn.documentDate) },
        { label: 'Warehouse', value: grn.warehouseName || '—' },
      ]}
      documentMetaChips={[
        'From PO',
        grn.inspectionRequired ? 'QC Required' : 'QC Not required',
        grn.warehouseName || 'Warehouse',
      ]}
      detailMode
      factBox={documentFactBox}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
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
              : canSubmit && !createGate.hidden
                ? {
                    id: 'submit',
                    label: 'Submit',
                    icon: Send,
                    onClick: () => void run(() => submitGRN(grn.id), 'GRN submitted'),
                    disabled: busy || createGate.disabled,
                    disabledReason: createGate.disabledReason,
                  }
                : undefined
          }
          secondaryActions={[
            {
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
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
                    : `/purchase/quality-inspections?grnId=${grn.id}`,
                ),
              hidden: !perms.canViewQuality,
              disabled: !grn.inspectionRequired,
            },
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              onClick: () => navigate(`/purchase/grn/${grn.id}/print`),
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
    >
      <ErpCardSection title="Header" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ErpViewField label="GRN Number" value={grn.documentNumber} />
          <ErpViewField label="GRN Date" value={formatDate(grn.documentDate)} />
          <ErpViewField
            label="PO Number"
            value={
              <Link to={`/purchase/orders/${grn.purchaseOrderId}`} className="text-erp-primary">
                {grn.purchaseOrderNumber}
              </Link>
            }
          />
          <ErpViewField label="Vendor" value={grn.vendor.name} />
          <ErpViewField label="Vendor Challan" value={grn.vendorChallanNumber || '—'} />
          <ErpViewField
            label="Challan Date"
            value={grn.vendorChallanDate ? formatDate(grn.vendorChallanDate) : '—'}
          />
          <ErpViewField label="Vehicle" value={grn.vehicleNo || '—'} />
          <ErpViewField label="Transporter" value={grn.transporterName || '—'} />
          <ErpViewField label="LR Number" value={grn.lrNumber || '—'} />
          <ErpViewField label="Gate Entry" value={grn.gateEntryNo || '—'} />
          <ErpViewField label="Warehouse" value={grn.warehouseName} />
          <ErpViewField label="Receiving Location" value={grn.receivingLocation || '—'} />
          <ErpViewField label="Received By" value={grn.receivedBy.name} />
          <ErpViewField label="Inspection Required" value={grn.inspectionRequired ? 'Yes' : 'No'} />
          <ErpViewField label="Status" value={statusLabel} />
          <ErpViewField label="Amount" value={formatCurrency(grn.totalAmount)} />
          <ErpViewField label="Remarks" value={grn.remarks || '—'} />
        </div>
      </ErpCardSection>

      <ErpCardSection title="Lines" defaultOpen>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs text-erp-muted">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Ordered</th>
                <th className="px-2 py-2">Prev</th>
                <th className="px-2 py-2">Pending</th>
                <th className="px-2 py-2">Received</th>
                <th className="px-2 py-2">Accepted</th>
                <th className="px-2 py-2">Rejected</th>
                <th className="px-2 py-2">Batch</th>
                <th className="px-2 py-2">Inspection</th>
                <th className="px-2 py-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-2 py-2">{l.lineNo}</td>
                  <td className="px-2 py-2">
                    <div className="font-mono text-xs">{l.itemCode}</div>
                    <div>{l.itemName}</div>
                  </td>
                  <td className="px-2 py-2">{formatNumber(l.orderedQty)}</td>
                  <td className="px-2 py-2">{formatNumber(l.previouslyReceivedQty)}</td>
                  <td className="px-2 py-2">{formatNumber(l.pendingQty)}</td>
                  <td className="px-2 py-2">{formatNumber(l.receivedQty)}</td>
                  <td className="px-2 py-2">{formatNumber(l.acceptedQty)}</td>
                  <td className="px-2 py-2">{formatNumber(l.rejectedQty)}</td>
                  <td className="px-2 py-2 font-mono text-xs">{l.batchNumber || '—'}</td>
                  <td className="px-2 py-2">{GRN_LINE_INSPECTION_STATUS_LABELS[l.inspectionStatus]}</td>
                  <td className="px-2 py-2">{l.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ErpCardSection>

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
                if (updated?.inventoryPostDeferred) setInventoryMsgOpen(true)
              }}
            >
              Post
            </ErpButton>
          </>
        }
      >
        <p className="text-sm text-erp-muted">
          Post {grn.documentNumber}? PO receipt quantities will be updated. Inventory stock posting
          remains deferred until the backend is connected.
        </p>
      </Modal>

      <Modal
        open={inventoryMsgOpen}
        onClose={() => setInventoryMsgOpen(false)}
        title="GRN posted"
        footer={
          <ErpButton variant="primary" onClick={() => setInventoryMsgOpen(false)}>
            OK
          </ErpButton>
        }
      >
        <p className="text-sm">
          GRN posted successfully. <strong>Inventory will be updated when the backend is connected</strong>{' '}
          (demo mock — stock quantities are not written live).
        </p>
      </Modal>
    </PurchaseCardFormShell>
  )
}
