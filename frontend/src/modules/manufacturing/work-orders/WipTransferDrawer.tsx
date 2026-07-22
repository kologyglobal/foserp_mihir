import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import {
  createWipMovement,
  listWorkOrderMaterials,
  listWorkOrders,
  transferToWorkOrder,
} from '@/services/api/manufacturingApi'
import type { ProductionOrderMaterial, WorkOrderDetail } from '@/types/manufacturingProduction'
import type { WipMovementType } from '@/types/manufacturingWipMovement'
import { WIP_MOVEMENT_TYPE_LABELS } from '@/types/manufacturingWipMovement'
import { canMoveWip, canTransferMaterials } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { useSetupLookup } from '../setup/useSetupLookups'

type Props = { open: boolean; onClose: () => void; workOrder: WorkOrderDetail; onChanged: () => void }

type Option = { id: string; label: string }

const OPEN_STATUSES = new Set(['RELEASED', 'IN_PROGRESS', 'ON_HOLD', 'READY'])

function availableTypes(): WipMovementType[] {
  const types: WipMovementType[] = []
  if (canMoveWip()) {
    types.push('LOCATION_WIP', 'MATERIAL_RELOCATE', 'WO_TO_WO')
  } else if (canTransferMaterials()) {
    types.push('WO_TO_WO')
  }
  return types
}

/** Simple WIP / material transfer posting drawer for API work orders. */
export function WipTransferDrawer({ open, onClose, workOrder, onChanged }: Props) {
  const [movementType, setMovementType] = useState<WipMovementType>('LOCATION_WIP')
  const [fromWarehouseId, setFromWarehouseId] = useState('')
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [materialLineId, setMaterialLineId] = useState('')
  const [targetProductionOrderId, setTargetProductionOrderId] = useState('')
  const [materials, setMaterials] = useState<ProductionOrderMaterial[]>([])
  const [targetOrders, setTargetOrders] = useState<Option[]>([])
  const [busy, setBusy] = useState(false)
  const { options: warehouses } = useSetupLookup('warehouses')
  const types = useMemo(() => availableTypes(), [])

  useEffect(() => {
    if (!open) return
    const nextTypes = availableTypes()
    setMovementType(nextTypes[0] ?? 'LOCATION_WIP')
    setFromWarehouseId('')
    setToWarehouseId('')
    setQuantity('')
    setReason('')
    setRemarks('')
    setMaterialLineId('')
    setTargetProductionOrderId('')
    void Promise.all([
      listWorkOrderMaterials(workOrder.id)
        .then((res) => setMaterials(res.data))
        .catch(() => setMaterials([])),
      listWorkOrders({ limit: 100 })
        .then((res) => {
          setTargetOrders(
            res.data
              .filter((order) => order.id !== workOrder.id && OPEN_STATUSES.has(order.status))
              .map((order) => ({
                id: order.id,
                label: `${order.workOrderNo || order.orderNumber} — ${order.status.replace(/_/g, ' ')}`,
              })),
          )
        })
        .catch(() => setTargetOrders([])),
    ]).catch(() => notify.warning('Some transfer lookups could not be loaded'))
  }, [open, workOrder.id])

  const materialOptions = useMemo(
    () =>
      materials.map((line) => ({
        id: line.id,
        label: `${line.item.code} — ${line.item.name} (issued ${line.issuedQty})`,
      })),
    [materials],
  )

  useEffect(() => {
    if (movementType !== 'MATERIAL_RELOCATE' || !materialLineId) return
    const line = materials.find((m) => m.id === materialLineId)
    if (line?.warehouseId) setFromWarehouseId(line.warehouseId)
  }, [materialLineId, materials, movementType])

  const submit = async () => {
    const qty = Number(quantity)
    if (!fromWarehouseId || !toWarehouseId) return notify.error('Select source and destination warehouses')
    if (!Number.isFinite(qty) || qty <= 0) return notify.error('Enter a positive quantity')
    if (!reason.trim()) return notify.error('A reason is required')
    if (movementType === 'MATERIAL_RELOCATE' && !materialLineId) return notify.error('Select a material line')
    if (movementType === 'WO_TO_WO' && !targetProductionOrderId) return notify.error('Select a target work order')
    if (movementType !== 'WO_TO_WO' && fromWarehouseId === toWarehouseId) {
      return notify.error('Source and destination warehouses must differ')
    }

    setBusy(true)
    try {
      const idempotencyKey = `wip-transfer:${crypto.randomUUID()}`
      if (movementType === 'WO_TO_WO' && !canMoveWip() && canTransferMaterials()) {
        await transferToWorkOrder(workOrder.id, targetProductionOrderId, {
          quantity: qty,
          fromWarehouseId,
          toWarehouseId,
          reason: reason.trim(),
          remarks: remarks.trim() || undefined,
          materialLineId: materialLineId || undefined,
          idempotencyKey,
        })
      } else {
        await createWipMovement(workOrder.id, {
          movementType,
          quantity: qty,
          fromWarehouseId,
          toWarehouseId,
          reason: reason.trim(),
          remarks: remarks.trim() || undefined,
          materialLineId: movementType === 'MATERIAL_RELOCATE' ? materialLineId : undefined,
          targetProductionOrderId: movementType === 'WO_TO_WO' ? targetProductionOrderId : undefined,
          itemId:
            movementType === 'MATERIAL_RELOCATE'
              ? materials.find((m) => m.id === materialLineId)?.itemId
              : undefined,
          idempotencyKey,
        })
      }
      notify.success('Transfer posted')
      onChanged()
      onClose()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Unable to post transfer')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer"
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || types.length === 0} onClick={() => void submit()}>
            Post
          </Button>
        </div>
      }
    >
      {types.length === 0 ? (
        <p className="text-sm text-erp-muted">You do not have permission to post transfers on this work order.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Transfer type" required>
            <Select value={movementType} onChange={(e) => setMovementType(e.target.value as WipMovementType)}>
              {types.map((type) => (
                <option key={type} value={type}>
                  {WIP_MOVEMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>

          {movementType === 'MATERIAL_RELOCATE' ? (
            <FormField label="Material line" required>
              <Select value={materialLineId} onChange={(e) => setMaterialLineId(e.target.value)}>
                <option value="">Select…</option>
                {materialOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          {movementType === 'WO_TO_WO' ? (
            <FormField label="Target work order" required>
              <Select value={targetProductionOrderId} onChange={(e) => setTargetProductionOrderId(e.target.value)}>
                <option value="">Select…</option>
                {targetOrders.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          <FormField label="From warehouse" required>
            <Select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
              <option value="">Select…</option>
              {warehouses.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="To warehouse" required>
            <Select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
              <option value="">Select…</option>
              {warehouses.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Quantity" required>
            <Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </FormField>

          <div className="sm:col-span-2">
            <FormField label="Reason" required>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why is this transfer needed?" />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <FormField label="Remarks">
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </FormField>
          </div>
        </div>
      )}
    </Modal>
  )
}
