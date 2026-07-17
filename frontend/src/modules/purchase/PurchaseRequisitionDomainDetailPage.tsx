import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Printer, ShoppingCart, Truck } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpViewField } from '../../components/erp/card-form/ErpViewField'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../design-system/components/LoadingState'
import { TableLink } from '../../components/ui/AppLink'
import {
  convertPurchaseRequisitionToPo,
  convertPurchaseRequisitionToRfq,
  getPurchaseRequisitionById,
  getRFQById,
  getPurchaseOrderById,
  updatePurchaseRequisition,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
  PURCHASE_REQUISITION_SOURCE_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
  PurchaseServiceError,
} from '../../services/purchase'
import type { PurchaseRequisition } from '../../types/purchaseDomain'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { notify } from '../../store/toastStore'
import { usePurchasePermissions } from '../../utils/permissions'
import {
  canConvertPrToPo,
  canConvertPrToRfq,
  isPrPendingPo,
  prProcurementPathLabel,
} from '../../utils/purchaseRequisitionNextStep'
import { PurchaseRequisitionDocumentPage } from './PurchaseFormPages'

export function PurchaseRequisitionDomainDetailPage({
  mode = 'view',
}: {
  mode?: 'view' | 'edit'
}) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams] = useSearchParams()
  const [pr, setPr] = useState<PurchaseRequisition | null>(null)
  const [linkedRfqNo, setLinkedRfqNo] = useState<string | null>(null)
  const [linkedPoNo, setLinkedPoNo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notDomain, setNotDomain] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [department, setDepartment] = useState('')
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)

  const readOnly = mode === 'view' || pr?.status === 'cancelled' || pr?.status === 'pending_approval'
  const canEdit = pr && (pr.status === 'draft' || pr.status === 'rejected')
  const showCreatePo = pr ? canConvertPrToPo(pr) && perms.canCreateOrder : false
  const showCreateRfq = pr ? canConvertPrToRfq(pr) && perms.canCreateRfq : false

  const createPurchaseOrder = async () => {
    if (!pr) return
    setConverting(true)
    try {
      const po = await convertPurchaseRequisitionToPo(pr.id)
      notify.success(`Purchase Order ${po.documentNumber} created`)
      navigate(`/purchase/orders/${po.id}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Could not create PO')
    } finally {
      setConverting(false)
    }
  }

  const createRfq = async () => {
    if (!pr) return
    setConverting(true)
    try {
      const rfq = await convertPurchaseRequisitionToRfq(pr.id)
      notify.success(`RFQ ${rfq.documentNumber} created`)
      navigate(`/purchase/rfqs/${rfq.id}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Could not create RFQ')
    } finally {
      setConverting(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const row = await getPurchaseRequisitionById(id)
      if (cancelled) return
      if (!row) {
        setNotDomain(true)
        setPr(null)
        setLoading(false)
        return
      }
      setPr(row)
      setRemarks(row.remarks)
      setDepartment(row.department)
      if (row.convertedRfqId) {
        const rfq = await getRFQById(row.convertedRfqId)
        if (!cancelled) setLinkedRfqNo(rfq?.documentNumber ?? null)
      }
      if (row.convertedPoId) {
        const po = await getPurchaseOrderById(row.convertedPoId)
        if (!cancelled) setLinkedPoNo(po?.documentNumber ?? null)
      }
      setLoading(false)
      if (searchParams.get('print') === '1') {
        window.setTimeout(() => window.print(), 400)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, searchParams])

  const requiredBy = useMemo(() => {
    if (!pr) return null
    return (
      pr.expectedDeliveryDate ??
      (pr.lines.length ? [...pr.lines].map((l) => l.requiredDate).sort()[0] : null)
    )
  }, [pr])

  const save = async () => {
    if (!pr || !canEdit) return
    setSaving(true)
    try {
      const updated = await updatePurchaseRequisition(pr.id, {
        department,
        remarks,
      })
      setPr(updated)
      notify.success('Requisition updated')
      navigate(`/purchase/requisitions/${pr.id}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <OperationalPageShell title="Purchase Requisition" badge="Purchase" variant="dynamics">
        <LoadingState variant="form" rows={6} />
      </OperationalPageShell>
    )
  }

  if (notDomain) {
    return <PurchaseRequisitionDocumentPage readOnly={mode === 'view'} />
  }

  if (!pr) {
    return (
      <OperationalPageShell title="Purchase Requisition" badge="Purchase" variant="dynamics">
        <EmptyState
          icon={ArrowLeft}
          title="Requisition not found"
          description="This purchase requisition is not in the demo service data."
          action={
            <Link to="/purchase/requisitions" className="erp-btn erp-btn--primary text-[13px]">
              Back to list
            </Link>
          }
        />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={pr.documentNumber}
      description={`${PURCHASE_REQUISITION_STATUS_LABELS[pr.status]} · ${PURCHASE_REQUISITION_SOURCE_LABELS[pr.source]}`}
      badge="Purchase"
      variant="dynamics"
      favoritePath={`/purchase/requisitions/${pr.id}`}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'back',
              label: 'Back',
              icon: ArrowLeft,
              onClick: () => navigate('/purchase/requisitions'),
            },
            ...(canEdit && mode === 'view' && perms.canEditRequisition
              ? [
                  {
                    id: 'edit',
                    label: 'Edit',
                    icon: Pencil,
                    onClick: () => navigate(`/purchase/requisitions/${pr.id}/edit`),
                  },
                ]
              : []),
            ...(showCreateRfq
              ? [
                  {
                    id: 'rfq',
                    label: converting ? 'Creating…' : 'Create RFQ',
                    icon: ShoppingCart,
                    onClick: () => void createRfq(),
                    disabled: converting,
                  },
                ]
              : []),
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              onClick: () => window.print(),
            },
          ]}
          primaryAction={
            mode === 'edit' && canEdit && perms.canEditRequisition
              ? {
                  id: 'save',
                  label: saving ? 'Saving…' : 'Save',
                  onClick: () => void save(),
                }
              : showCreatePo
                ? {
                    id: 'create-po',
                    label: converting ? 'Creating…' : 'Create Purchase Order',
                    icon: Truck,
                    onClick: () => void createPurchaseOrder(),
                    disabled: converting,
                  }
                : undefined
          }
        />
      }
    >
      <div className="space-y-4">
        <div className="erp-page-panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <ErpViewField label="PR Number" value={pr.documentNumber} />
          <ErpViewField label="PR Date" value={formatDate(pr.documentDate)} />
          <ErpViewField label="Status" value={PURCHASE_REQUISITION_STATUS_LABELS[pr.status]} />
          <ErpViewField label="Department" value={
            mode === 'edit' && canEdit ? (
              <input
                className="erp-input h-9 w-full text-[13px]"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={readOnly && mode !== 'edit'}
              />
            ) : (
              pr.department
            )
          } />
          <ErpViewField label="Location" value={pr.location.name} />
          <ErpViewField label="Requested By" value={pr.requester.name} />
          <ErpViewField label="Required By" value={requiredBy ? formatDate(requiredBy) : '—'} />
          <ErpViewField label="Priority" value={PURCHASE_REQUISITION_PRIORITY_LABELS[pr.priority]} />
          <ErpViewField label="Source" value={PURCHASE_REQUISITION_SOURCE_LABELS[pr.source]} />
          <ErpViewField label="Procurement path" value={prProcurementPathLabel(pr)} />
          <ErpViewField label="Estimated Value" value={formatCurrency(pr.totalAmount)} />
          {isPrPendingPo(pr) ? (
            <ErpViewField
              label="Next step"
              value={
                <span className="font-semibold text-emerald-700">
                  Ready for Purchase Order — use Create Purchase Order above
                </span>
              }
            />
          ) : null}
          <ErpViewField
            label="Linked RFQ"
            value={
              linkedRfqNo && pr.convertedRfqId ? (
                <TableLink to={`/purchase/rfqs/${pr.convertedRfqId}`}>{linkedRfqNo}</TableLink>
              ) : (
                '—'
              )
            }
          />
          <ErpViewField
            label="Linked PO"
            value={
              linkedPoNo && pr.convertedPoId ? (
                <TableLink to={`/purchase/orders/${pr.convertedPoId}`}>{linkedPoNo}</TableLink>
              ) : (
                '—'
              )
            }
          />
        </div>

        <div className="erp-page-panel p-4">
          <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Lines</h3>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th>UOM</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {pr.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.lineNo}</td>
                    <td>
                      <div className="font-mono text-[12px]">{line.itemCode}</div>
                      <div className="text-[12px] text-erp-muted">{line.itemName}</div>
                    </td>
                    <td className="num">{line.quantity}</td>
                    <td>{line.uom}</td>
                    <td className="num">{formatCurrency(line.estimatedRate)}</td>
                    <td className="num">{formatCurrency(line.amount)}</td>
                    <td>{formatDate(line.requiredDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-page-panel space-y-2 p-4">
          <label className="text-[12px] font-medium text-erp-muted">Remarks</label>
          {mode === 'edit' && canEdit ? (
            <textarea
              className="erp-input min-h-[80px] w-full text-[13px]"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          ) : (
            <p className="text-[13px] text-erp-text">{pr.remarks || '—'}</p>
          )}
          {pr.status === 'cancelled' ? (
            <Badge color="red">Cancelled — read-only</Badge>
          ) : null}
          {pr.status === 'pending_approval' ? (
            <Badge color="orange">Pending approval — requester cannot edit</Badge>
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
