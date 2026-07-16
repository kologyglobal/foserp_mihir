import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Send, Truck, XCircle } from 'lucide-react'
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
  cancelTransferDemo,
  createTransferDraft,
  dispatchTransferDemo,
  getItemById,
  getTransferById,
  markTransferInTransitDemo,
  receiveTransferDemo,
  InventoryServiceError,
} from '@/services/inventory'
import type { InventoryTransfer, TransferLine, TransferType } from '@/types/inventoryDomain'
import { TRANSFER_STATUS_LABELS, TRANSFER_TYPE_LABELS } from '@/utils/inventoryMovementLabels'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { useMasterStore } from '@/store/masterStore'
import { notify } from '@/store/toastStore'
import { BatchSelector } from '@/components/inventory/BatchSelector'
import { SerialSelector } from '@/components/inventory/SerialSelector'

function today() {
  return new Date().toISOString().slice(0, 10)
}

type EditorLine = TransferLine & { _key: string }

export function TransferEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const warehouses = useMasterStore((s) => s.warehouses.filter((w) => w.isActive))
  const items = useMasterStore((s) => s.items.filter((i) => i.isStockable && i.isActive))

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [doc, setDoc] = useState<InventoryTransfer | null>(null)
  const [transferType, setTransferType] = useState<TransferType>('warehouse_to_warehouse')
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id ?? warehouses[0]?.id ?? '')
  const [transferDate, setTransferDate] = useState(today())
  const [expectedReceiptDate, setExpectedReceiptDate] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [transporter, setTransporter] = useState('')
  const [reference, setReference] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<EditorLine[]>([])
  const [selectedItemId, setSelectedItemId] = useState('')
  const [transferQty, setTransferQty] = useState(1)
  const [availableQty, setAvailableQty] = useState(0)
  const [unitCost, setUnitCost] = useState(0)
  const [lineBatchNo, setLineBatchNo] = useState<string | null>(null)
  const [lineSerialNo, setLineSerialNo] = useState<string | null>(null)
  const [lineBatchTracking, setLineBatchTracking] = useState(false)
  const [lineSerialTracking, setLineSerialTracking] = useState(false)

  const loadDoc = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const t = await getTransferById(id)
      if (!t) { navigate('/inventory/movements/transfers'); return }
      setDoc(t)
      setTransferType(t.transferType)
      setFromWarehouseId(t.fromWarehouseId)
      setToWarehouseId(t.toWarehouseId)
      setTransferDate(t.transferDate)
      setExpectedReceiptDate(t.expectedReceiptDate ?? '')
      setVehicleNo(t.vehicleNo ?? '')
      setTransporter(t.transporter ?? '')
      setReference(t.reference ?? '')
      setRemarks(t.remarks ?? '')
      setLines(t.lines.map((l) => ({ ...l, _key: l.id })))
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { void loadDoc() }, [loadDoc])

  useEffect(() => {
    if (!selectedItemId || !fromWarehouseId) {
      setAvailableQty(0)
      setUnitCost(0)
      setLineBatchTracking(false)
      setLineSerialTracking(false)
      setLineBatchNo(null)
      setLineSerialNo(null)
      return
    }
    void getItemById(selectedItemId).then((item) => {
      if (!item) return
      setUnitCost(item.standardCost)
      setAvailableQty(item.availableQuantity)
      setLineBatchTracking(item.batchTracking)
      setLineSerialTracking(item.serialTracking)
      setLineBatchNo(null)
      setLineSerialNo(null)
    })
  }, [selectedItemId, fromWarehouseId])

  const readOnly = Boolean(doc && ['received', 'cancelled', 'partially_received'].includes(doc.status))

  async function handleSave() {
    if (!fromWarehouseId || !toWarehouseId || lines.length === 0) {
      notify.error('Select warehouses and at least one line')
      return
    }
    setSaving(true)
    try {
      const created = await createTransferDraft({
        transferType,
        fromWarehouseId,
        toWarehouseId,
        transferDate,
        expectedReceiptDate: expectedReceiptDate || null,
        vehicleNo: vehicleNo || null,
        transporter: transporter || null,
        reference: reference || null,
        remarks: remarks || null,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          transferQty: l.transferQty,
          batchNo: l.batchNo,
          serialNo: l.serialNo,
          remarks: l.remarks,
        })),
      })
      notify.success(`Transfer ${created.documentNumber} saved as draft`)
      navigate(`/inventory/movements/transfers/${created.id}`)
    } catch (e) {
      notify.error(e instanceof InventoryServiceError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function addLine() {
    if (!selectedItemId || transferQty <= 0) return
    const item = items.find((i) => i.id === selectedItemId)
    if (!item) return
    setLines((prev) => [
      ...prev,
      {
        _key: crypto.randomUUID(),
        id: `new-${Date.now()}`,
        lineNo: prev.length + 1,
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uomCode: '—',
        fromWarehouseId,
        toWarehouseId,
        fromLocationId: null,
        toLocationId: null,
        transferQty,
        dispatchedQty: 0,
        receivedQty: 0,
        shortQty: 0,
        damagedQty: 0,
        shortReason: null,
        availableQty,
        batchNo: lineBatchNo,
        serialNo: lineSerialNo,
        rate: unitCost,
        batchTracking: lineBatchTracking,
        serialTracking: lineSerialTracking,
        remarks: '',
      },
    ])
    setSelectedItemId('')
    setTransferQty(1)
    setLineBatchNo(null)
    setLineSerialNo(null)
  }

  async function runAction(
    label: string,
    fn: () => Promise<InventoryTransfer>,
  ) {
    if (!doc) return
    try {
      const updated = await fn()
      setDoc(updated)
      setLines(updated.lines.map((l) => ({ ...l, _key: l.id })))
      notify.success(label)
    } catch (e) {
      notify.error(e instanceof InventoryServiceError ? e.message : 'Action failed')
    }
  }

  if (loading) {
    return (
      <OperationalPageShell title="Transfer" badge="Inventory">
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  const statusLabel = doc ? TRANSFER_STATUS_LABELS[doc.status] : 'New'

  return (
    <ErpCardFormPage
      variant="dynamics"
      badge="Inventory & Warehouse"
      title={isNew ? 'Quick Transfer' : `Transfer ${doc?.documentNumber ?? ''}`}
      description="Select source warehouse, item and quantity — system loads availability, UOM and cost."
      recordNo={doc?.documentNumber}
      statusChip={<StatusDot label={statusLabel} tone={statusToneFromLabel(statusLabel)} />}
      breadcrumbs={[
        { label: 'Inventory & Warehouse', to: '/inventory' },
        { label: 'Transfers', to: '/inventory/movements/transfers' },
        { label: isNew ? 'New' : doc?.documentNumber ?? 'Detail' },
      ]}
      favoritePath={isNew ? '/inventory/movements/transfers/new' : `/inventory/movements/transfers/${id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={isNew && perms.canCreateTransfer ? { id: 'save', label: saving ? 'Saving…' : 'Save Draft', icon: Save, onClick: () => void handleSave(), disabled: saving } : undefined}
          secondaryActions={[
            ...(doc?.status === 'draft' && perms.canDispatchTransfer ? [{ id: 'dispatch', label: 'Dispatch', icon: Send, onClick: () => void runAction('Dispatched', () => dispatchTransferDemo(doc.id)) }] : []),
            ...(doc?.status === 'dispatched' && perms.canReceiveTransfer ? [{ id: 'transit', label: 'In Transit', icon: Truck, onClick: () => void runAction('In transit', () => markTransferInTransitDemo(doc.id)) }] : []),
            ...(['dispatched', 'in_transit', 'partially_received'].includes(doc?.status ?? '') && perms.canReceiveTransfer ? [{ id: 'receive', label: 'Receive', icon: Truck, onClick: () => void runAction('Received', () => receiveTransferDemo(doc!.id)) }] : []),
            ...(doc && ['draft', 'dispatched', 'in_transit'].includes(doc.status) && perms.canCancelTransfer ? [{ id: 'cancel', label: 'Cancel', icon: XCircle, onClick: () => void runAction('Cancelled', () => cancelTransferDemo(doc.id)) }] : []),
          ]}
        />
      )}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Transfer Type</label>
            <Select value={transferType} onChange={(e) => setTransferType(e.target.value as TransferType)} disabled={readOnly || !isNew} className="w-full">
              {Object.entries(TRANSFER_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">From Warehouse</label>
            <Select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} disabled={readOnly || !isNew} className="w-full">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouseName}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">To Warehouse</label>
            <Select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} disabled={readOnly || !isNew} className="w-full">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouseName}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Transfer Date</label>
            <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} disabled={readOnly || !isNew} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Expected Receipt Date</label>
            <Input type="date" value={expectedReceiptDate} onChange={(e) => setExpectedReceiptDate(e.target.value)} disabled={readOnly || !isNew} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Vehicle Number</label>
            <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} disabled={readOnly || !isNew} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Transporter</label>
            <Input value={transporter} onChange={(e) => setTransporter(e.target.value)} disabled={readOnly || !isNew} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Reference</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} disabled={readOnly || !isNew} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-erp-muted">Remarks</label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={readOnly || !isNew} className="w-full" />
          </div>
        </div>
        <div className="space-y-4">
          {isNew ? (
            <div className="rounded-lg border border-erp-border p-4">
              <h3 className="text-[13px] font-semibold">Add line</h3>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-erp-muted">Item</label>
                  <Select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="w-full">
                    <option value="">Select item</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.itemName}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-erp-muted">Quantity</label>
                  <Input type="number" min={0} value={transferQty} onChange={(e) => setTransferQty(Number(e.target.value))} className="w-full" />
                </div>
                {lineBatchTracking && transferQty > 0 ? (
                  <div>
                    <span className="mb-1 block text-[12px] font-medium text-erp-muted">Batch</span>
                    <BatchSelector
                      itemId={selectedItemId}
                      warehouseId={fromWarehouseId}
                      qty={transferQty}
                      value={lineBatchNo}
                      method="fefo"
                      onChange={setLineBatchNo}
                    />
                  </div>
                ) : null}
                {lineSerialTracking && transferQty > 0 ? (
                  <div>
                    <span className="mb-1 block text-[12px] font-medium text-erp-muted">Serial</span>
                    <SerialSelector
                      itemId={selectedItemId}
                      warehouseId={fromWarehouseId}
                      requiredQty={Math.floor(transferQty)}
                      value={lineSerialNo ? [lineSerialNo] : []}
                      onChange={(serials) => setLineSerialNo(serials[0] ?? null)}
                    />
                  </div>
                ) : null}
                <dl className="grid grid-cols-2 gap-2 text-[12px]">
                  <div><dt className="text-erp-muted">Available</dt><dd className="font-medium">{formatNumber(availableQty)}</dd></div>
                  <div><dt className="text-erp-muted">Unit Cost</dt><dd className="font-medium">{formatCurrency(unitCost)}</dd></div>
                </dl>
                <button type="button" className="erp-btn erp-btn-secondary h-9" onClick={addLine}>Add Line</button>
              </div>
            </div>
          ) : null}
          <table className="erp-table w-full text-[12px]">
            <thead>
              <tr>
                <th>Item</th>
                <th>Batch</th>
                <th>Serial</th>
                <th className="text-right">Transfer</th>
                <th className="text-right">Dispatched</th>
                <th className="text-right">Received</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l._key}>
                  <td><span className="font-mono">{l.itemCode}</span> {l.itemName}</td>
                  <td className="font-mono text-xs">{l.batchNo ?? '—'}</td>
                  <td className="font-mono text-xs">{l.serialNo ?? '—'}</td>
                  <td className="num">{formatNumber(l.transferQty)}</td>
                  <td className="num">{formatNumber(l.dispatchedQty)}</td>
                  <td className="num">{formatNumber(l.receivedQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {doc ? (
            <>
              <MovementCostPreviewPanel preview={doc.costPreview} />
              <MovementAccountingPreviewPanel preview={doc.accountingPreview} />
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
