import type { WorkOrder } from '../types/workorder'
import { useInventoryStore } from '../store/inventoryStore'
import { useMasterStore } from '../store/masterStore'
import { useRoutingStore } from '../store/routingStore'
import { useWorkCenterStore } from '../store/workCenterStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import {
  getFgReceiptSourceWarehouseCode,
  getWorkCenterWarehouseMapping,
  moveFromWipForOperation,
  moveToWipForOperation,
  receiveIssuedMaterialToFirstOpWip,
  toWipRoutingOpsFromProduction,
  toWipRoutingOpsFromRouting,
  validateOperationWarehouseMapping,
  type WipMovementResult,
  type WipRoutingOperation,
} from './wipRouting'

function findWarehouseByCode(code: string) {
  return useMasterStore.getState().warehouses.find((w) => w.warehouseCode === code)
}

function inventoryApi() {
  const inv = useInventoryStore.getState()
  return {
    getOnHand: inv.getOnHand.bind(inv),
    postWipReceive: inv.postWipReceive.bind(inv),
    postWipTransfer: inv.postWipTransfer.bind(inv),
  }
}

function logWipMovementActivity(woId: string, result: WipMovementResult, operationName: string) {
  if (!result.ok || result.skipped) return
  const from = result.fromWarehouseCode ?? '—'
  const to = result.toWarehouseCode ?? '—'
  const type = result.referenceType ?? 'WIP_TRANSFER'
  useWorkOrderStore.getState().appendActivity(
    woId,
    'WIP Movement',
    `${type}: ${from} → ${to} · ${operationName}${result.movementNo ? ` · ${result.movementNo}` : ''}`,
  )
}

export function getWoWipRoutingOps(wo: WorkOrder): WipRoutingOperation[] {
  const productionOps = useWorkOrderStore.getState().getProductionOperations(wo.id)
  if (productionOps.length > 0) return toWipRoutingOpsFromProduction(productionOps)

  if (wo.routingHeaderId) {
    const routingOps = useRoutingStore.getState().getEnrichedOperations(wo.routingHeaderId)
    return toWipRoutingOpsFromRouting(routingOps, useWorkCenterStore.getState().workCenters)
  }
  return []
}

export function validateJobCardWarehouseMapping(
  workCenterId: string,
  workCenterCode: string,
  operationName: string,
  outsourced: boolean,
): { ok: boolean; error?: string } {
  return validateOperationWarehouseMapping(
    { workCenterId, workCenterCode, operationName, outsourced },
    useWorkCenterStore.getState().workCenters,
  )
}

export function receiveMaterialIssueToWip(
  wo: WorkOrder,
  line: { itemId: string; itemCode: string },
  qty: number,
): WipMovementResult {
  const workCenters = useWorkCenterStore.getState().workCenters
  const ops = getWoWipRoutingOps(wo)
  const item = useMasterStore.getState().getItem(line.itemId)
  const result = receiveIssuedMaterialToFirstOpWip(
    wo,
    line,
    qty,
    ops,
    workCenters,
    inventoryApi(),
    findWarehouseByCode,
    item?.standardRate ?? 0,
  )
  if (result.ok && !result.skipped) {
    const first = ops.find((o) => !o.outsourced)
    logWipMovementActivity(wo.id, result, first?.operationName ?? 'Material Issue')
  }
  return result
}

export function moveToWipOnOperationStart(woId: string, productionOperationId: string): WipMovementResult {
  const wo = useWorkOrderStore.getState().getWorkOrder(woId)
  if (!wo) return { ok: false, error: 'WO not found' }

  const ops = toWipRoutingOpsFromProduction(useWorkOrderStore.getState().getProductionOperations(woId))
  const op = ops.find((o) => o.id === productionOperationId)
  if (!op) return { ok: false, error: 'Operation not found' }

  const item = useMasterStore.getState().getItem(wo.outputItemId)
  const result = moveToWipForOperation(
    wo,
    op,
    useWorkCenterStore.getState().workCenters,
    inventoryApi(),
    findWarehouseByCode,
    item?.standardRate ?? 0,
  )
  logWipMovementActivity(woId, result, op.operationName)
  return result
}

export function moveFromWipOnOperationComplete(woId: string, productionOperationId: string): WipMovementResult {
  const wo = useWorkOrderStore.getState().getWorkOrder(woId)
  if (!wo) return { ok: false, error: 'WO not found' }

  const ops = toWipRoutingOpsFromProduction(useWorkOrderStore.getState().getProductionOperations(woId))
  const op = ops.find((o) => o.id === productionOperationId)
  if (!op) return { ok: false, error: 'Operation not found' }

  const item = useMasterStore.getState().getItem(wo.outputItemId)
  const result = moveFromWipForOperation(
    wo,
    op,
    useWorkCenterStore.getState().workCenters,
    inventoryApi(),
    findWarehouseByCode,
    item?.standardRate ?? 0,
  )
  logWipMovementActivity(woId, result, op.operationName)
  return result
}

/** @deprecated Use moveFromWipOnOperationComplete */
export function transferWipAfterOperationComplete(woId: string, productionOperationId: string): void {
  moveFromWipOnOperationComplete(woId, productionOperationId)
}

export function resolveFgReceiptWipWarehouseId(wo: WorkOrder): string | undefined {
  const ops = getWoWipRoutingOps(wo)
  const code = getFgReceiptSourceWarehouseCode(ops, useWorkCenterStore.getState().workCenters)
  if (!code) return undefined
  return findWarehouseByCode(code)?.id
}

export function resolveSubcontractReceiveWipWarehouseId(wo: WorkOrder): string | undefined {
  const ops = getWoWipRoutingOps(wo)
  const outsourcedOp = ops.find((o) => o.outsourced)
  if (outsourcedOp) {
    const mapping = getWorkCenterWarehouseMapping(outsourcedOp.workCenterId, useWorkCenterStore.getState().workCenters)
    if (mapping) return findWarehouseByCode(mapping.outputWarehouseCode)?.id
  }
  return resolveFgReceiptWipWarehouseId(wo)
}

export { getWorkCenterWarehouseMapping, validateOperationWarehouseMapping }
