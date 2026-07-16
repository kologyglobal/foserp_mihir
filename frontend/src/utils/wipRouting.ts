import type { WorkOrder, WorkOrderMaterialLine, WorkOrderProductionOperation } from '../types/workorder'
import type { StockReferenceType } from '../types/inventory'
import type { WorkCenter, WorkCenterWarehouseMapping } from '../types/workcenter'

/** Minimal operation shape for WIP routing (production or routing template). */
export interface WipRoutingOperation {
  id: string
  sequenceNo: number
  operationName: string
  workCenterId: string
  workCenterCode: string
  outsourced: boolean
  status?: WorkOrderProductionOperation['status']
}

export interface WipFlowStepDynamic {
  id: string
  label: string
  warehouseCode: string | null
  operationName?: string
}

export function getWorkCenterById(workCenterId: string, workCenters: WorkCenter[]): WorkCenter | undefined {
  return workCenters.find((w) => w.id === workCenterId)
}

export function getWorkCenterWarehouseMapping(
  workCenterId: string,
  workCenters: WorkCenter[],
): WorkCenterWarehouseMapping | null {
  const wc = getWorkCenterById(workCenterId, workCenters)
  if (!wc?.inputWarehouseCode || !wc.wipWarehouseCode || !wc.outputWarehouseCode) return null
  return {
    inputWarehouseCode: wc.inputWarehouseCode,
    wipWarehouseCode: wc.wipWarehouseCode,
    outputWarehouseCode: wc.outputWarehouseCode,
  }
}

export function validateOperationWarehouseMapping(
  op: Pick<WipRoutingOperation, 'operationName' | 'workCenterId' | 'workCenterCode' | 'outsourced'>,
  workCenters: WorkCenter[],
): { ok: boolean; error?: string } {
  if (op.outsourced) return { ok: true }
  const mapping = getWorkCenterWarehouseMapping(op.workCenterId, workCenters)
  if (!mapping) {
    return {
      ok: false,
      error: `Work center ${op.workCenterCode} is missing input / WIP / output warehouse mapping — configure in Work Center Master`,
    }
  }
  return { ok: true }
}

export function sortRoutingOps<T extends { sequenceNo: number }>(operations: T[]): T[] {
  return [...operations].sort((a, b) => a.sequenceNo - b.sequenceNo)
}

export function getInHouseOps(operations: WipRoutingOperation[]): WipRoutingOperation[] {
  return sortRoutingOps(operations).filter((o) => !o.outsourced)
}

export function getFirstInHouseOp(operations: WipRoutingOperation[]): WipRoutingOperation | undefined {
  return getInHouseOps(operations)[0]
}

export function getNextInHouseOp(
  current: WipRoutingOperation,
  operations: WipRoutingOperation[],
): WipRoutingOperation | undefined {
  const sorted = sortRoutingOps(operations)
  const idx = sorted.findIndex((o) => o.id === current.id)
  for (let i = idx + 1; i < sorted.length; i += 1) {
    if (!sorted[i].outsourced) return sorted[i]
  }
  return undefined
}

export function getFgReceiptSourceWarehouseCode(
  operations: WipRoutingOperation[],
  workCenters: WorkCenter[],
): string | null {
  const inHouse = getInHouseOps(operations)
  const last = inHouse[inHouse.length - 1]
  if (!last) return null
  const mapping = getWorkCenterWarehouseMapping(last.workCenterId, workCenters)
  if (!mapping) return null
  if (mapping.outputWarehouseCode === 'FG_YARD') {
    return mapping.wipWarehouseCode
  }
  return mapping.outputWarehouseCode
}

export function buildDynamicWipFlowSteps(
  operations: WipRoutingOperation[],
  workCenters: WorkCenter[],
): WipFlowStepDynamic[] {
  const steps: WipFlowStepDynamic[] = [
    { id: 'rm_store', label: 'RM Store', warehouseCode: 'RM_STORE' },
    { id: 'issue', label: 'Issue to WO', warehouseCode: null },
  ]

  const seen = new Set<string>()
  for (const op of getInHouseOps(operations)) {
    const mapping = getWorkCenterWarehouseMapping(op.workCenterId, workCenters)
    if (!mapping) continue
    for (const code of [mapping.wipWarehouseCode, mapping.outputWarehouseCode]) {
      if (!code || seen.has(code) || code === 'FG_YARD') continue
      seen.add(code)
      steps.push({
        id: `wip_${code.toLowerCase()}`,
        label: code.replace(/_/g, ' '),
        warehouseCode: code,
        operationName: op.operationName,
      })
    }
  }

  steps.push({ id: 'fg_yard', label: 'FG Yard', warehouseCode: 'FG_YARD' })
  return steps
}

function opShopFloorDone(op: WipRoutingOperation): boolean {
  return op.status === 'completed' || op.status === 'qc_hold'
}

export function resolveDynamicWipStepId(
  wo: WorkOrder,
  materials: WorkOrderMaterialLine[],
  operations: WipRoutingOperation[],
  workCenters: WorkCenter[],
): string {
  const steps = buildDynamicWipFlowSteps(operations, workCenters)

  if (wo.status === 'fg_received' || wo.status === 'closed') return 'fg_yard'
  if (wo.status === 'completed') {
    const wipSteps = steps.filter((s) => s.warehouseCode?.startsWith('WIP_'))
    return wipSteps[wipSteps.length - 1]?.id ?? 'fg_yard'
  }

  const inHouse = getInHouseOps(operations)

  for (let i = inHouse.length - 1; i >= 0; i -= 1) {
    if (inHouse[i].status && opShopFloorDone(inHouse[i])) {
      const mapping = getWorkCenterWarehouseMapping(inHouse[i].workCenterId, workCenters)
      const targetCode = mapping?.outputWarehouseCode ?? mapping?.wipWarehouseCode
      const step = steps.find((s) => s.warehouseCode === targetCode)
      return step?.id ?? steps[2]?.id ?? 'issue'
    }
  }

  const anyIssued = materials.some((m) => m.issuedQty > 0)
  if (anyIssued || wo.status === 'fully_issued' || wo.status === 'partially_issued' || wo.status === 'in_production') {
    const first = getFirstInHouseOp(operations)
    if (first) {
      const mapping = getWorkCenterWarehouseMapping(first.workCenterId, workCenters)
      const code = mapping?.wipWarehouseCode
      const step = steps.find((s) => s.warehouseCode === code)
      return step?.id ?? 'issue'
    }
    return 'issue'
  }

  return 'rm_store'
}

export function getWipFlowStepIndex(steps: WipFlowStepDynamic[], stepId: string): number {
  return steps.findIndex((s) => s.id === stepId)
}

export interface WipMovementInventory {
  getOnHand: (itemId: string, warehouseId: string) => number
  postWipReceive: (input: {
    itemId: string
    warehouseId: string
    qty: number
    rate: number
    referenceNo: string
    remarks: string
    workOrderId: string
    referenceType?: StockReferenceType
  }) => { ok: boolean; error?: string; movementNo?: string }
  postWipTransfer: (input: {
    itemId: string
    fromWarehouseId: string
    warehouseId: string
    qty: number
    rate: number
    referenceNo: string
    remarks: string
    workOrderId: string
    referenceType?: StockReferenceType
  }) => { ok: boolean; error?: string; movementNo?: string }
}

export interface WipMovementResult {
  ok: boolean
  error?: string
  skipped?: boolean
  referenceType?: StockReferenceType
  fromWarehouseCode?: string
  toWarehouseCode?: string
  movementNo?: string
}

export interface WipTransferInput {
  wo: WorkOrder
  itemId: string
  qty: number
  fromWarehouseCode: string
  toWarehouseCode: string
  referenceNo: string
  remarks: string
  referenceType: StockReferenceType
  findWarehouseByCode: (code: string) => { id: string } | undefined
  inventory: WipMovementInventory
  itemRate: number
}

export function executeWipMovement(input: WipTransferInput): WipMovementResult {
  const { fromWarehouseCode, toWarehouseCode, referenceType } = input
  if (fromWarehouseCode === toWarehouseCode) {
    return { ok: true, skipped: true, referenceType, fromWarehouseCode, toWarehouseCode }
  }

  const fromWh = input.findWarehouseByCode(fromWarehouseCode)
  const toWh = input.findWarehouseByCode(toWarehouseCode)
  if (!fromWh || !toWh) {
    return { ok: false, error: `Warehouse not configured (${fromWarehouseCode} → ${toWarehouseCode})` }
  }

  const onHand = input.inventory.getOnHand(input.itemId, fromWh.id)
  if (onHand < input.qty) {
    const receive = input.inventory.postWipReceive({
      itemId: input.itemId,
      warehouseId: fromWh.id,
      qty: input.qty - onHand,
      rate: input.itemRate,
      referenceNo: input.referenceNo,
      remarks: `${input.remarks} — backfill source`,
      workOrderId: input.wo.id,
      referenceType: 'WIP_RECEIVE',
    })
    if (!receive.ok) return receive
  }

  const transfer = input.inventory.postWipTransfer({
    itemId: input.itemId,
    fromWarehouseId: fromWh.id,
    warehouseId: toWh.id,
    qty: input.qty,
    rate: input.itemRate,
    referenceNo: input.referenceNo,
    remarks: input.remarks,
    workOrderId: input.wo.id,
    referenceType,
  })
  if (!transfer.ok) return transfer

  return {
    ok: true,
    referenceType,
    fromWarehouseCode,
    toWarehouseCode,
    movementNo: transfer.movementNo,
  }
}

/** Op start: pull stock from WC input warehouse into WC WIP warehouse. */
export function moveToWipForOperation(
  wo: WorkOrder,
  op: WipRoutingOperation,
  workCenters: WorkCenter[],
  inventory: WipMovementInventory,
  findWarehouseByCode: (code: string) => { id: string } | undefined,
  itemRate: number,
): WipMovementResult {
  const mapping = getWorkCenterWarehouseMapping(op.workCenterId, workCenters)
  if (!mapping) return { ok: false, error: 'Work center warehouse mapping missing' }

  return executeWipMovement({
    wo,
    itemId: wo.outputItemId,
    qty: wo.qty,
    fromWarehouseCode: mapping.inputWarehouseCode,
    toWarehouseCode: mapping.wipWarehouseCode,
    referenceNo: wo.woNo,
    remarks: `MOVE_TO_WIP · ${op.operationName} (${op.workCenterCode})`,
    referenceType: 'MOVE_TO_WIP',
    findWarehouseByCode,
    inventory,
    itemRate,
  })
}

/** Op complete / QC pass: move from WC WIP warehouse to WC output warehouse. */
export function moveFromWipForOperation(
  wo: WorkOrder,
  op: WipRoutingOperation,
  workCenters: WorkCenter[],
  inventory: WipMovementInventory,
  findWarehouseByCode: (code: string) => { id: string } | undefined,
  itemRate: number,
): WipMovementResult {
  const mapping = getWorkCenterWarehouseMapping(op.workCenterId, workCenters)
  if (!mapping) return { ok: false, error: 'Work center warehouse mapping missing' }

  return executeWipMovement({
    wo,
    itemId: wo.outputItemId,
    qty: wo.qty,
    fromWarehouseCode: mapping.wipWarehouseCode,
    toWarehouseCode: mapping.outputWarehouseCode,
    referenceNo: wo.woNo,
    remarks: `MOVE_FROM_WIP · ${op.operationName} (${op.workCenterCode})`,
    referenceType: 'MOVE_FROM_WIP',
    findWarehouseByCode,
    inventory,
    itemRate,
  })
}

/** Material issue on first in-house op: receive into WC WIP warehouse. */
export function receiveIssuedMaterialToFirstOpWip(
  wo: WorkOrder,
  line: { itemId: string; itemCode: string },
  qty: number,
  operations: WipRoutingOperation[],
  workCenters: WorkCenter[],
  inventory: WipMovementInventory,
  findWarehouseByCode: (code: string) => { id: string } | undefined,
  itemRate: number,
): WipMovementResult {
  const first = getFirstInHouseOp(operations)
  if (!first) return { ok: true, skipped: true }

  const mapping = getWorkCenterWarehouseMapping(first.workCenterId, workCenters)
  if (!mapping) return { ok: false, error: 'First operation work center missing warehouse mapping' }

  const wh = findWarehouseByCode(mapping.wipWarehouseCode)
  if (!wh) return { ok: false, error: `WIP warehouse ${mapping.wipWarehouseCode} not found` }

  const receive = inventory.postWipReceive({
    itemId: line.itemId,
    warehouseId: wh.id,
    qty,
    rate: itemRate,
    referenceNo: wo.woNo,
    remarks: `MOVE_TO_WIP · issue → ${mapping.wipWarehouseCode} (${first.workCenterCode}) — ${line.itemCode}`,
    workOrderId: wo.id,
    referenceType: 'MOVE_TO_WIP',
  })
  if (!receive.ok) return receive

  return {
    ok: true,
    referenceType: 'MOVE_TO_WIP',
    fromWarehouseCode: 'RM_STORE',
    toWarehouseCode: mapping.wipWarehouseCode,
    movementNo: receive.movementNo,
  }
}

export function toWipRoutingOpsFromProduction(
  operations: WorkOrderProductionOperation[],
): WipRoutingOperation[] {
  return operations.map((o) => ({
    id: o.id,
    sequenceNo: o.sequenceNo,
    operationName: o.operationName,
    workCenterId: o.workCenterId,
    workCenterCode: o.workCenterCode,
    outsourced: o.outsourced,
    status: o.status,
  }))
}

export function toWipRoutingOpsFromRouting(
  operations: Array<{
    id: string
    sequenceNo: number
    operationName: string
    workCenterId: string
    outsourced: boolean
  }>,
  workCenters: WorkCenter[],
): WipRoutingOperation[] {
  return operations.map((o) => ({
    id: o.id,
    sequenceNo: o.sequenceNo,
    operationName: o.operationName,
    workCenterId: o.workCenterId,
    workCenterCode: workCenters.find((w) => w.id === o.workCenterId)?.workCenterCode ?? '—',
    outsourced: o.outsourced,
  }))
}

/** @deprecated Use getWorkCenterWarehouseMapping — kept for gradual migration */
export function getWipCodeForWorkCenter(workCenterId: string, workCenters: WorkCenter[]): string | null {
  return getWorkCenterById(workCenterId, workCenters)?.wipWarehouseCode ?? null
}

/** @deprecated Use getFgReceiptSourceWarehouseCode */
export function getFgReceiptSourceWipCode(
  operations: WipRoutingOperation[],
  workCenters: WorkCenter[],
): string | null {
  return getFgReceiptSourceWarehouseCode(operations, workCenters)
}

/** @deprecated Use moveFromWipForOperation */
export function transferOutputToNextWip(
  wo: WorkOrder,
  completedOp: WipRoutingOperation,
  _operations: WipRoutingOperation[],
  workCenters: WorkCenter[],
  inventory: WipMovementInventory,
  findWarehouseByCode: (code: string) => { id: string } | undefined,
  itemRate: number,
): WipMovementResult {
  return moveFromWipForOperation(wo, completedOp, workCenters, inventory, findWarehouseByCode, itemRate)
}

/** @deprecated Use executeWipMovement */
export function executeWipTransfer(
  input: Omit<WipTransferInput, 'referenceType'> & { inventory: WipMovementInventory },
): WipMovementResult {
  return executeWipMovement({ ...input, referenceType: 'WIP_TRANSFER' })
}
