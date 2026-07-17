import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Ban,
  CheckCircle2,
  FileText,
  PackagePlus,
  Pencil,
  Printer,
  Send,
  Truck,
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
import { Modal } from '@/design-system/components/Modal'
import { Textarea } from '@/components/forms/Inputs'
import {
  approvePurchaseReturn,
  cancelPurchaseReturn,
  createDebitNoteFromReturn,
  createReplacementPoFromReturn,
  getApprovalHistory,
  getPurchaseReturnById,
  postPurchaseReturn,
  PurchaseServiceError,
  PURCHASE_RETURN_DOMAIN_STATUS_LABELS,
  PURCHASE_RETURN_ORIGIN_LABELS,
  PURCHASE_RETURN_REASON_LABELS,
  submitPurchaseReturn,
} from '@/services/purchase'
import type { ApprovalHistory, PurchaseReturn } from '@/types/purchaseDomain'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { usePurchasePermissions } from '@/utils/permissions'

export function PurchaseReturnDetailPage() {
  const { id } = useParams()
  const perms = usePurchasePermissions()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<PurchaseReturn | null>(null)
  const [history, setHistory] = useState<ApprovalHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const row = await getPurchaseReturnById(id)
      if (!row) {
        notify.error('Purchase return not found')
        navigate('/purchase/returns')
        return
      }
      setDoc(row)
      setHistory(await getApprovalHistory(row.id))
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = async (work: () => Promise<PurchaseReturn>, success: string) => {
    setBusy(true)
    try {
      const updated = await work()
      setDoc(updated)
      setHistory(await getApprovalHistory(updated.id))
      notify.success(success)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !doc) {
    return (
      <PurchaseCardFormShell
        title="Purchase Return"
        description="Loading…"
        status="…"
        favoritePath="/purchase/returns"
        breadcrumbs={[{ label: 'Returns', to: '/purchase/returns' }, { label: 'Loading' }]}
        backLink={{ to: '/purchase/returns', label: 'Back to Returns' }}
        footer={null}
        detailMode
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  const canEdit = doc.status === 'draft' || doc.status === 'pending_approval'
  const canSubmit = doc.status === 'draft'
  const canApprove = doc.status === 'pending_approval' || doc.status === 'draft'
  const canPost = doc.status === 'approved'
  const canDebit =
    (doc.status === 'approved' || doc.status === 'posted') && !doc.linkedDebitNoteId
  const canReplacement =
    (doc.status === 'approved' || doc.status === 'posted') && !doc.linkedReplacementPoId
  const canCancel = !['posted', 'closed', 'cancelled'].includes(doc.status)

  const documentFactBox = (
    <PurchaseDocumentFactBox
      vendor={{
        id: doc.vendor.id,
        code: doc.vendor.code,
        name: doc.vendor.name,
      }}
      documentStatus={{
        statusLabel: PURCHASE_RETURN_DOMAIN_STATUS_LABELS[doc.status],
        ...purchaseDocumentApprovalFact(doc.status),
        createdBy: doc.createdBy,
        modifiedBy: doc.updatedBy,
        modifiedDate: doc.updatedAt ? formatDate(doc.updatedAt.slice(0, 10)) : null,
      }}
      related={buildPurchaseRelatedLinks({
        purchaseOrderId: doc.purchaseOrderId,
        purchaseOrderNumber: doc.purchaseOrderNumber,
        goodsReceiptId: doc.goodsReceiptId,
        goodsReceiptNumber: doc.goodsReceiptNumber,
      })}
    />
  )

  return (
    <>
      <PurchaseCardFormShell
        title={doc.documentNumber}
        description="Purchase Return"
        recordNo={doc.documentNumber}
        status={PURCHASE_RETURN_DOMAIN_STATUS_LABELS[doc.status]}
        statusTone={purchaseStatusTone(doc.status)}
        company={doc.vendor.name}
        favoritePath={`/purchase/returns/${doc.id}`}
        breadcrumbs={[
          { label: 'Returns', to: '/purchase/returns' },
          { label: doc.documentNumber },
        ]}
        backLink={{ to: '/purchase/returns', label: 'Back to Returns' }}
        createdBy={doc.createdBy}
        createdDate={formatDate(doc.createdAt.slice(0, 10))}
        modifiedBy={doc.updatedBy ?? undefined}
        modifiedDate={doc.updatedAt ? formatDate(doc.updatedAt.slice(0, 10)) : undefined}
        documentIdentity={{
          moduleLabel: 'PURCHASE RETURN',
          title: doc.documentNumber,
          status: PURCHASE_RETURN_DOMAIN_STATUS_LABELS[doc.status],
          statusTone: purchaseStatusTone(doc.status),
        }}
        documentFacts={[
          { label: 'Return No', value: doc.documentNumber, emphasize: true },
          { label: 'Vendor', value: doc.vendor.name, emphasize: true },
          { label: 'Return Date', value: formatDate(doc.documentDate) },
          { label: 'Reason', value: PURCHASE_RETURN_REASON_LABELS[doc.returnReason] },
        ]}
        documentMetaChips={[
          PURCHASE_RETURN_ORIGIN_LABELS[doc.origin],
          PURCHASE_RETURN_REASON_LABELS[doc.returnReason],
          doc.warehouseName || 'Warehouse',
        ]}
        factBox={documentFactBox}
        detailMode
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            secondaryActions={[
              {
                id: 'edit',
                label: 'Edit',
                icon: Pencil,
                onClick: () => navigate(`/purchase/returns/${doc.id}/edit`),
                hidden: !perms.canCreateReturn || !canEdit,
                disabled: busy,
              },
              {
                id: 'submit',
                label: 'Submit for Approval',
                icon: Send,
                onClick: () => void runAction(() => submitPurchaseReturn(doc.id), 'Submitted'),
                hidden: !perms.canCreateReturn || !canSubmit,
                disabled: busy,
              },
              {
                id: 'approve',
                label: 'Approve',
                icon: CheckCircle2,
                onClick: () => void runAction(() => approvePurchaseReturn(doc.id), 'Approved'),
                hidden: !perms.canCreateReturn || !canApprove,
                disabled: busy,
              },
              {
                id: 'post',
                label: 'Post Return',
                icon: Truck,
                onClick: () => void runAction(() => postPurchaseReturn(doc.id), 'Return posted'),
                hidden: !perms.canPostReturn || !canPost,
                disabled: busy,
              },
              {
                id: 'debit',
                label: 'Create Debit Note',
                icon: FileText,
                onClick: () =>
                  void runAction(() => createDebitNoteFromReturn(doc.id), 'Debit note created'),
                hidden: !perms.canCreateReturn || !canDebit,
                disabled: busy,
              },
              {
                id: 'replacement',
                label: 'Create Replacement PO',
                icon: PackagePlus,
                onClick: () =>
                  void runAction(
                    () => createReplacementPoFromReturn(doc.id),
                    'Replacement PO created',
                  ),
                hidden: !perms.canCreateOrder || !canReplacement,
                disabled: busy,
              },
              {
                id: 'print',
                label: 'Print Return Challan',
                icon: Printer,
                onClick: () => navigate(`/purchase/returns/${doc.id}/print`),
              },
              {
                id: 'cancel',
                label: 'Cancel',
                icon: Ban,
                onClick: () => setCancelOpen(true),
                hidden: !canCancel,
                disabled: busy,
              },
            ]}
          />
        }
        footer={null}
      >
        <ErpCardSection title="Header" collapsible defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ErpViewField label="Return Date" value={formatDate(doc.documentDate)} />
            <ErpViewField label="Vendor" value={`${doc.vendor.name} (${doc.vendor.gstin})`} />
            <ErpViewField label="Origin" value={PURCHASE_RETURN_ORIGIN_LABELS[doc.origin]} />
            <ErpViewField
              label="Return Reason"
              value={PURCHASE_RETURN_REASON_LABELS[doc.returnReason]}
            />
            <ErpViewField
              label="PO Number"
              value={
                doc.purchaseOrderId ? (
                  <Link to={`/purchase/orders/${doc.purchaseOrderId}`} className="text-erp-primary">
                    {doc.purchaseOrderNumber}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <ErpViewField
              label="GRN Number"
              value={
                doc.goodsReceiptId ? (
                  <Link to={`/purchase/grn/${doc.goodsReceiptId}`} className="text-erp-primary">
                    {doc.goodsReceiptNumber}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <ErpViewField label="Purchase Invoice" value={doc.purchaseInvoiceNumber || '—'} />
            <ErpViewField label="Warehouse" value={doc.warehouseName} />
            <ErpViewField label="Transport" value={doc.transportDetails || '—'} />
            <ErpViewField
              label="Debit Note Required"
              value={doc.debitNoteRequired ? 'Yes' : 'No'}
            />
            <ErpViewField
              label="Replacement Required"
              value={doc.replacementRequired ? 'Yes' : 'No'}
            />
            <ErpViewField label="Remarks" value={doc.remarks || '—'} />
          </div>
        </ErpCardSection>

        <ErpCardSection title="Linked Documents" collapsible defaultOpen={false}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ErpViewField
              label="Replacement PO"
              value={
                doc.linkedReplacementPoId ? (
                  <Link
                    to={`/purchase/orders/${doc.linkedReplacementPoId}`}
                    className="text-erp-primary"
                  >
                    {doc.linkedReplacementPoNumber}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <ErpViewField
              label="Debit / Credit Note"
              value={doc.linkedDebitNoteNumber || '—'}
            />
            <ErpViewField
              label="Quality Inspection"
              value={doc.qualityInspectionNumber || '—'}
            />
            <ErpViewField
              label="Posted At"
              value={doc.postedAt ? formatDate(doc.postedAt.slice(0, 10)) : '—'}
            />
            <ErpViewField label="Total Amount" value={formatCurrency(doc.totalAmount)} />
          </div>
        </ErpCardSection>

        <ErpCardSection title="Lines" collapsible defaultOpen>
          <div className="overflow-x-auto">
            <table className="quo-editor-price__table w-full min-w-[1000px]">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Batch / Serial</th>
                  <th>Recv</th>
                  <th>Avail</th>
                  <th>Return Qty</th>
                  <th>UOM</th>
                  <th>Unit Cost</th>
                  <th>Tax</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Repl Qty</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.lineNo}</td>
                    <td>
                      <div className="font-mono text-[12px]">{l.itemCode}</div>
                      <div className="text-[13px]">{l.description || l.itemName}</div>
                    </td>
                    <td>
                      {l.batchLotNo || '—'}
                      {l.serialNumber ? ` / ${l.serialNumber}` : ''}
                    </td>
                    <td className="tabular-nums">{l.receivedQty}</td>
                    <td className="tabular-nums">{l.availableReturnQty}</td>
                    <td className="tabular-nums">{l.returnQty}</td>
                    <td>{l.uom}</td>
                    <td className="tabular-nums">{formatCurrency(l.unitCost)}</td>
                    <td className="tabular-nums">
                      {formatCurrency(l.cgst + l.sgst + l.igst)}
                    </td>
                    <td className="tabular-nums">{formatCurrency(l.returnAmount)}</td>
                    <td>{PURCHASE_RETURN_REASON_LABELS[l.reason]}</td>
                    <td className="tabular-nums">{l.replacementQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ErpCardSection>

        {history.length > 0 ? (
          <ErpCardSection title="History" collapsible defaultOpen={false}>
            <ul className="space-y-3 text-sm">
              {history.map((h) => (
                <li key={h.id} className="border-l-2 border-erp-border pl-3">
                  <strong className="text-erp-text">{h.action}</strong>
                  <span className="text-erp-muted">
                    {' '}
                    · {h.fromStatus} → {h.toStatus} · {h.actorName} ·{' '}
                    {formatDate(h.actedAt.slice(0, 10))}
                  </span>
                  {h.remarks ? <div className="text-erp-muted">{h.remarks}</div> : null}
                </li>
              ))}
            </ul>
          </ErpCardSection>
        ) : null}
      </PurchaseCardFormShell>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel purchase return"
        footer={
          <>
            <button
              type="button"
              className="rounded-md px-3 py-2 text-[13px]"
              onClick={() => setCancelOpen(false)}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-md bg-erp-danger px-3 py-2 text-[13px] font-semibold text-white"
              onClick={() => {
                setCancelOpen(false)
                void runAction(
                  () => cancelPurchaseReturn(doc.id, cancelReason || 'Cancelled'),
                  'Return cancelled',
                )
              }}
            >
              Confirm Cancel
            </button>
          </>
        }
      >
        <Textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={3}
          placeholder="Cancellation reason"
        />
      </Modal>
    </>
  )
}
