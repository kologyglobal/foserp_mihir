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
                    onClick: async () => {
                      const updated = await run(() => submitGRN(grn.id), 'GRN submitted')
                      if (
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
                    : `/purchase/quality-inspections/new?grnId=${grn.id}`,
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
      <ErpCardSection title="Header" defaultOpen columns={1}>
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

      <ErpCardSection title="Lines" defaultOpen columns={1}>
        <div className="min-w-0 w-full overflow-x-auto">
          <table className="erp-table w-full min-w-[960px] text-left text-sm">
            <thead className="border-b text-xs text-erp-muted">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2 num">Ordered</th>
                <th className="px-2 py-2 num">Prev</th>
                <th className="px-2 py-2 num">Pending</th>
                <th className="px-2 py-2 num">Received</th>
                <th className="px-2 py-2 num">Accepted</th>
                <th className="px-2 py-2 num">Rejected</th>
                <th className="px-2 py-2">Batch</th>
                <th className="px-2 py-2">Inspection</th>
                <th className="px-2 py-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-2 py-2">{l.lineNo}</td>
                  <td className="min-w-[10rem] px-2 py-2">
                    <div className="font-mono text-xs whitespace-nowrap">{l.itemCode}</div>
                    <div className="text-erp-text">{l.itemName}</div>
                  </td>
                  <td className="px-2 py-2 num">{formatNumber(l.orderedQty)}</td>
                  <td className="px-2 py-2 num">{formatNumber(l.previouslyReceivedQty)}</td>
                  <td className="px-2 py-2 num">{formatNumber(l.pendingQty)}</td>
                  <td className="px-2 py-2 num">{formatNumber(l.receivedQty)}</td>
                  <td className="px-2 py-2 num">{formatNumber(l.acceptedQty)}</td>
                  <td className="px-2 py-2 num">{formatNumber(l.rejectedQty)}</td>
                  <td className="px-2 py-2 font-mono text-xs whitespace-nowrap">{l.batchNumber || '—'}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{GRN_LINE_INSPECTION_STATUS_LABELS[l.inspectionStatus]}</td>
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
