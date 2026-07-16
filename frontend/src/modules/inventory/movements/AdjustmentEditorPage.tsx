import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Save, Send } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCardFormPage } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  MovementAccountingPreviewPanel,
  MovementAuditTimeline,
  MovementCostPreviewPanel,
} from '@/components/inventory/movements/MovementPreviewPanels'
import {
  approveAdjustmentDemo,
  createAdjustmentDraft,
  getAdjustmentById,
  getItemById,
  postAdjustmentDemo,
  submitAdjustment,
  InventoryServiceError,
} from '@/services/inventory'
import type { AdjustmentType, InventoryAdjustment } from '@/types/inventoryDomain'
import { ADJUSTMENT_STATUS_LABELS, ADJUSTMENT_TYPE_LABELS } from '@/utils/inventoryMovementLabels'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { useMasterStore } from '@/store/masterStore'
import { notify } from '@/store/toastStore'
import { BatchSelector } from '@/components/inventory/BatchSelector'
import { SerialSelector } from '@/components/inventory/SerialSelector'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function AdjustmentEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const warehouses = useMasterStore((s) => s.warehouses.filter((w) => w.isActive))
  const items = useMasterStore((s) => s.items.filter((i) => i.isStockable && i.isActive))

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [doc, setDoc] = useState<InventoryAdjustment | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('shortage')
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [adjustmentDate, setAdjustmentDate] = useState(today())
  const [reason, setReason] = useState('')
  const [itemId, setItemId] = useState('')
  const [adjustmentQty, setAdjustmentQty] = useState(-1)
  const [currentQty, setCurrentQty] = useState(0)
  const [unitCost, setUnitCost] = useState(0)
  const [batchNo, setBatchNo] = useState<string | null>(null)
  const [serialNo, setSerialNo] = useState<string | null>(null)
  const [batchTracking, setBatchTracking] = useState(false)
  const [serialTracking, setSerialTracking] = useState(false)

  const loadDoc = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const a = await getAdjustmentById(id)
      if (!a) { navigate('/inventory/movements/adjustments'); return }
      setDoc(a)
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { void loadDoc() }, [loadDoc])

  useEffect(() => {
    if (!itemId) {
      setCurrentQty(0)
      setUnitCost(0)
      setBatchTracking(false)
      setSerialTracking(false)
      setBatchNo(null)
      setSerialNo(null)
      return
    }
    void getItemById(itemId).then((item) => {
      if (!item) return
      setUnitCost(item.standardCost)
      setCurrentQty(item.availableQuantity)
      setBatchTracking(item.batchTracking)
      setSerialTracking(item.serialTracking)
      setBatchNo(null)
      setSerialNo(null)
    })
  }, [itemId, warehouseId])

  const newQty = currentQty + adjustmentQty
  const adjustmentValue = adjustmentQty * unitCost
  const readOnly = Boolean(doc && ['posted', 'rejected', 'cancelled'].includes(doc.status))

  async function handleSave() {
    if (!itemId || !reason.trim()) {
      notify.error('Select item and enter reason')
      return
    }
    setSaving(true)
    try {
      const created = await createAdjustmentDraft({
        adjustmentType,
        warehouseId,
        adjustmentDate,
        reason,
        lines: [{ itemId, adjustmentQty, batchNo, serialNo }],
      })
      notify.success(`Adjustment ${created.documentNumber} saved`)
      navigate(`/inventory/movements/adjustments/${created.id}`)
    } catch (e) {
      notify.error(e instanceof InventoryServiceError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function runAction(label: string, fn: () => Promise<InventoryAdjustment>) {
    if (!doc) return
    try {
      const updated = await fn()
      setDoc(updated)
      notify.success(label)
    } catch (e) {
      notify.error(e instanceof InventoryServiceError ? e.message : 'Action failed')
    }
  }

  if (loading) {
    return (
      <OperationalPageShell title="Adjustment" badge="Inventory">
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  const statusLabel = doc ? ADJUSTMENT_STATUS_LABELS[doc.status] : 'New'

  return (
    <ErpCardFormPage
      variant="dynamics"
      badge="Inventory & Warehouse"
      title={isNew ? 'Quick Adjustment' : `Adjustment ${doc?.documentNumber ?? ''}`}
      description="Enter item, warehouse, adjustment qty and reason — system calculates value and approval requirement."
      recordNo={doc?.documentNumber}
      statusChip={<StatusDot label={statusLabel} tone={statusToneFromLabel(statusLabel)} />}
      breadcrumbs={[
        { label: 'Inventory & Warehouse', to: '/inventory' },
        { label: 'Adjustments', to: '/inventory/movements/adjustments' },
        { label: isNew ? 'New' : doc?.documentNumber ?? 'Detail' },
      ]}
      favoritePath={isNew ? '/inventory/movements/adjustments/new' : `/inventory/movements/adjustments/${id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={isNew && perms.canCreateAdjustment ? { id: 'save', label: saving ? 'Saving…' : 'Save Draft', icon: Save, onClick: () => void handleSave(), disabled: saving } : undefined}
          secondaryActions={[
            ...(doc?.status === 'draft' && perms.canSubmitAdjustment ? [{ id: 'submit', label: 'Submit', icon: Send, onClick: () => void runAction('Submitted', () => submitAdjustment(doc.id)) }] : []),
            ...(doc?.status === 'pending_approval' && perms.canApproveAdjustment ? [{ id: 'approve', label: 'Approve', icon: Check, onClick: () => void runAction('Approved', () => approveAdjustmentDemo(doc.id)) }] : []),
            ...(doc && ['approved', 'draft'].includes(doc.status) && perms.canPostAdjustment && doc.postingStatus !== 'posted' ? [{ id: 'post', label: 'Post', icon: Check, onClick: () => void runAction('Posted', () => postAdjustmentDemo(doc.id)) }] : []),
          ]}
        />
      )}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Adjustment Type</label>
            <Select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType)} disabled={readOnly || !isNew} className="w-full">
              {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Warehouse</label>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={readOnly || !isNew} className="w-full">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouseName}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Date</label>
            <Input type="date" value={adjustmentDate} onChange={(e) => setAdjustmentDate(e.target.value)} disabled={readOnly || !isNew} className="w-full" />
          </div>
          {isNew ? (
            <>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-erp-muted">Item</label>
                <Select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full">
                  <option value="">Select item</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.itemName}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-erp-muted">Adjustment Quantity (+/-)</label>
                <Input type="number" value={adjustmentQty} onChange={(e) => setAdjustmentQty(Number(e.target.value))} className="w-full" />
              </div>
              {batchTracking && Math.abs(adjustmentQty) > 0 ? (
                <div>
                  <span className="mb-1 block text-[12px] font-medium text-erp-muted">Batch</span>
                  <BatchSelector
                    itemId={itemId}
                    warehouseId={warehouseId}
                    qty={Math.abs(adjustmentQty)}
                    value={batchNo}
                    method="fefo"
                    onChange={setBatchNo}
                  />
                </div>
              ) : null}
              {serialTracking && Math.abs(adjustmentQty) > 0 ? (
                <div>
                  <span className="mb-1 block text-[12px] font-medium text-erp-muted">Serial</span>
                  <SerialSelector
                    itemId={itemId}
                    warehouseId={warehouseId}
                    requiredQty={Math.floor(Math.abs(adjustmentQty))}
                    value={serialNo ? [serialNo] : []}
                    onChange={(serials) => setSerialNo(serials[0] ?? null)}
                  />
                </div>
              ) : null}
            </>
          ) : null}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Reason</label>
            <Textarea value={isNew ? reason : doc?.reason ?? ''} onChange={(e) => setReason(e.target.value)} disabled={readOnly || !isNew} className="w-full" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-erp-border bg-erp-surface p-4">
            <h3 className="text-[13px] font-semibold">System Preview</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
              <div><dt className="text-erp-muted">Current Qty</dt><dd className="font-medium">{formatNumber(isNew ? currentQty : doc?.lines[0]?.currentQty ?? 0)}</dd></div>
              <div><dt className="text-erp-muted">New Qty</dt><dd className="font-medium">{formatNumber(isNew ? newQty : doc?.lines[0]?.newQty ?? 0)}</dd></div>
              <div><dt className="text-erp-muted">Unit Cost</dt><dd className="font-medium">{formatCurrency(isNew ? unitCost : doc?.lines[0]?.unitCost ?? 0)}</dd></div>
              <div><dt className="text-erp-muted">Adjustment Value</dt><dd className="font-semibold">{formatCurrency(isNew ? adjustmentValue : doc?.adjustmentValue ?? 0)}</dd></div>
              {doc ? (
                <>
                  <div><dt className="text-erp-muted">Approval Required</dt><dd className="font-medium">{doc.approvalRequired ? 'Yes' : 'No'}</dd></div>
                  <div><dt className="text-erp-muted">Threshold</dt><dd className="font-medium">{formatCurrency(doc.approvalThreshold)}</dd></div>
                </>
              ) : (
                <div className="col-span-2 text-[11px] text-erp-muted">
                  Approval required when value exceeds threshold, negative stock, sensitive reason, or user lacks direct-post permission.
                </div>
              )}
            </dl>
          </div>
          {doc ? (
            <>
              <MovementCostPreviewPanel preview={doc.costPreview} />
              <MovementAccountingPreviewPanel preview={doc.accountingPreview} />
              <table className="erp-table w-full text-[12px]">
                <thead><tr><th>Item</th><th className="text-right">Adj Qty</th><th className="text-right">Value</th></tr></thead>
                <tbody>
                  {doc.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="font-mono">{l.itemCode}</td>
                      <td className="num">{formatNumber(l.adjustmentQty)}</td>
                      <td className="num">{formatCurrency(l.adjustmentValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <h3 className="mb-2 text-[13px] font-semibold">Audit</h3>
                <MovementAuditTimeline entries={doc.auditHistory} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </ErpCardFormPage>
  )
}
