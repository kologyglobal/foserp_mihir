import type { BarcodeEntityType, BarcodeTraceResult } from '../types/barcode'
import { useBarcodeStore } from '../store/barcodeStore'
import { useMasterStore } from '../store/masterStore'
import { useInventoryStore } from '../store/inventoryStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useDispatchStore } from '../store/dispatchStore'
import { workflowPostGrn } from './qrWorkflow'

type ActionResult = { ok: boolean; error?: string; message?: string; barcodeId?: string }

function resolveScan(scan: string) {
  const trimmed = scan.trim()
  if (!trimmed) return { ok: false as const, error: 'Scan value required' }

  let record = useBarcodeStore.getState().getByValue(trimmed)
  if (!record && trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { bc?: string; id?: string; t?: string }
      if (parsed.bc) record = useBarcodeStore.getState().getByValue(parsed.bc)
      else if (parsed.id && parsed.t) {
        const matches = useBarcodeStore.getState().getForEntity(parsed.t as BarcodeEntityType, parsed.id)
        record = matches.find((b) => b.status === 'active') ?? matches[0]
      }
    } catch {
      /* not JSON */
    }
  }

  if (!record) {
    const byTrailer = useBarcodeStore.getState().barcodes.find(
      (b) =>
        b.status === 'active' &&
        ((b.trailerNo && b.trailerNo.toUpperCase() === trimmed.toUpperCase()) ||
          (b.chassisNo && b.chassisNo.toUpperCase() === trimmed.toUpperCase())),
    )
    if (byTrailer) record = byTrailer
  }

  if (!record) return { ok: false as const, error: `Unknown barcode: ${trimmed}` }
  if (record.status === 'void') return { ok: false as const, error: 'Barcode is void' }
  return { ok: true as const, record }
}

function logEvent(
  barcodeId: string,
  eventType: 'received' | 'issued' | 'consumed' | 'moved' | 'subcontracted' | 'dispatched',
  referenceNo: string,
  details: string,
) {
  useBarcodeStore.getState().recordEvent({ barcodeId, eventType, referenceNo, details })
}

export function lookupBarcodeTrace(query: {
  barcode?: string
  trailerNo?: string
  chassisNo?: string
}): BarcodeTraceResult {
  const store = useBarcodeStore.getState()
  let barcode = query.barcode?.trim() ? store.getByValue(query.barcode.trim()) : undefined

  if (!barcode && query.trailerNo?.trim()) {
    barcode = store.barcodes.find(
      (b) => b.trailerNo?.toUpperCase() === query.trailerNo!.trim().toUpperCase(),
    )
  }
  if (!barcode && query.chassisNo?.trim()) {
    barcode = store.barcodes.find(
      (b) => b.chassisNo?.toUpperCase() === query.chassisNo!.trim().toUpperCase(),
    )
  }

  if (!barcode) return { barcode: null, history: [], related: [] }

  return {
    barcode,
    history: store.getHistory(barcode.barcodeId),
    related: store.barcodes.filter(
      (b) =>
        b.barcodeId !== barcode!.barcodeId &&
        (b.entityId === barcode!.entityId ||
          (b.trailerNo && b.trailerNo === barcode!.trailerNo) ||
          (b.chassisNo && b.chassisNo === barcode!.chassisNo)),
    ),
  }
}

export function ensureEntityBarcode(
  entityType: BarcodeEntityType,
  entityId: string,
  entityLabel: string,
  extra?: { batchNo?: string; trailerNo?: string; chassisNo?: string },
) {
  const existing = useBarcodeStore.getState().getForEntity(entityType, entityId).find((b) => b.status === 'active')
  if (existing) return existing
  return useBarcodeStore.getState().generateBarcode({
    entityType,
    entityId,
    entityLabel,
    ...extra,
  })
}

export function scanToReceive(input: {
  scan: string
  poId: string
  poLineId: string
  receivedQty: number
}): ActionResult {
  const resolved = resolveScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved

  const r = workflowPostGrn(input.poId, [
    { poLineId: input.poLineId, receivedQty: input.receivedQty, rejectedQty: 0 },
  ])
  if (!r.ok) return r

  const grn = usePurchaseStore.getState().grns.find((g) => g.id === r.grnId)
  if (grn) ensureEntityBarcode('grn', grn.id, grn.grnNo)

  logEvent(
    record.barcodeId,
    'received',
    grn?.grnNo ?? input.poId,
    `GRN receipt qty ${input.receivedQty} via scan ${record.barcodeValue}`,
  )
  return { ok: true, message: `Received ${input.receivedQty}`, barcodeId: record.barcodeId }
}

export function scanToIssue(input: {
  scan: string
  warehouseId: string
  qty: number
  referenceNo?: string
  remarks?: string
}): ActionResult {
  const resolved = resolveScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved

  if (record.entityType !== 'item' && record.entityType !== 'batch') {
    return { ok: false, error: 'Scan an item or batch barcode to issue stock' }
  }

  const item = useMasterStore.getState().getItem(record.entityId)
  if (!item) return { ok: false, error: 'Item not found for barcode' }

  const r = useInventoryStore.getState().postIssue({
    itemId: record.entityId,
    warehouseId: input.warehouseId,
    qty: input.qty,
    referenceNo: input.referenceNo ?? record.barcodeValue,
    remarks: input.remarks ?? `Scan issue ${record.barcodeValue}`,
  })
  if (!r.ok) return r

  logEvent(record.barcodeId, 'issued', r.movementNo ?? record.barcodeValue, `Issued ${input.qty}`)
  return { ok: true, message: `Issued ${input.qty} ${item.itemCode}`, barcodeId: record.barcodeId }
}

export function scanToTransfer(input: {
  scan: string
  fromWarehouseId: string
  toWarehouseId: string
  qty: number
}): ActionResult {
  const resolved = resolveScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved

  if (record.entityType !== 'item' && record.entityType !== 'batch') {
    return { ok: false, error: 'Scan an item or batch barcode to transfer' }
  }

  const item = useMasterStore.getState().getItem(record.entityId)
  if (!item) return { ok: false, error: 'Item not found' }

  const r = useInventoryStore.getState().postStockTransfer({
    itemId: record.entityId,
    warehouseId: input.toWarehouseId,
    fromWarehouseId: input.fromWarehouseId,
    qty: input.qty,
    referenceNo: record.barcodeValue,
    remarks: `Scan transfer ${record.barcodeValue}`,
  })
  if (!r.ok) return r

  logEvent(record.barcodeId, 'moved', r.movementNo ?? record.barcodeValue, `Transferred ${input.qty}`)
  return { ok: true, message: `Transferred ${input.qty} ${item.itemCode}`, barcodeId: record.barcodeId }
}

export function scanOperationStart(input: { scan: string; assignedTeam?: string }): ActionResult {
  const resolved = resolveScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved

  let jobCardId: string | undefined
  if (record.entityType === 'work_order') {
    jobCardId = useWorkOrderStore.getState().jobCards.find(
      (j) => j.workOrderId === record.entityId && j.status !== 'completed',
    )?.id
  } else {
    jobCardId = record.entityId
  }

  if (!jobCardId) return { ok: false, error: 'No open job card for scan' }

  const r = useWorkOrderStore.getState().startJobCard(jobCardId, {
    assignedTeam: input.assignedTeam ?? 'Scan Team',
    startTime: new Date().toISOString(),
  })
  if (!r.ok) return r

  logEvent(record.barcodeId, 'moved', jobCardId, 'Operation started via scan')
  return { ok: true, message: 'Operation started', barcodeId: record.barcodeId }
}

export function scanOperationComplete(input: {
  scan: string
  actualHours?: number
  remarks?: string
}): ActionResult {
  const resolved = resolveScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved

  let jobCardId: string | undefined
  if (record.entityType === 'work_order') {
    jobCardId = useWorkOrderStore.getState().jobCards.find(
      (j) => j.workOrderId === record.entityId && j.status === 'in_progress',
    )?.id
  } else {
    jobCardId = record.entityId
  }

  if (!jobCardId) return { ok: false, error: 'No in-progress job card for scan' }

  const jc = useWorkOrderStore.getState().jobCards.find((j) => j.id === jobCardId)!
  const r = useWorkOrderStore.getState().completeJobCard(jobCardId, {
    endTime: new Date().toISOString(),
    actualHours: input.actualHours ?? 1,
    remarks: input.remarks ?? 'Completed via scan',
    qcChecks: jc.qcChecks,
  })
  if (!r.ok) return r

  logEvent(record.barcodeId, 'consumed', jobCardId, 'Operation completed via scan')
  return { ok: true, message: 'Operation completed', barcodeId: record.barcodeId }
}

export function scanWipMove(input: { scan: string }): ActionResult {
  return scanOperationStart({ scan: input.scan, assignedTeam: 'WIP Scan' })
}

export function scanSubcontractSend(input: {
  scan: string
  woId: string
  lineId: string
  vendorId: string
  challanNo: string
  qty: number
  expectedReturnDate: string
}): ActionResult {
  const resolved = resolveScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved

  const r = useWorkOrderStore.getState().sendSubcontractMaterial(
    input.woId,
    input.lineId,
    input.vendorId,
    input.challanNo,
    input.qty,
    input.expectedReturnDate,
  )
  if (!r.ok) return r

  logEvent(record.barcodeId, 'subcontracted', input.challanNo, `Subcontract send qty ${input.qty}`)
  return { ok: true, message: `Sent ${input.qty}`, barcodeId: record.barcodeId }
}

export function scanSubcontractReceive(input: {
  scan: string
  shipmentId: string
  receivedQty: number
  rejectedQty?: number
}): ActionResult {
  const resolved = resolveScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved

  const r = useWorkOrderStore.getState().receiveSubcontractMaterial(
    input.shipmentId,
    input.receivedQty,
    input.rejectedQty ?? 0,
  )
  if (!r.ok) return r

  logEvent(record.barcodeId, 'received', input.shipmentId, `Subcontract receive ${input.receivedQty}`)
  return { ok: true, message: `Received ${input.receivedQty}`, barcodeId: record.barcodeId }
}

export function scanTrailer(input: {
  scan: string
  dispatchId: string
  lineId: string
  trailerNo?: string
  chassisNo?: string
}): ActionResult {
  const resolved = resolveScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved

  const trailerNo = input.trailerNo ?? record.trailerNo ?? record.barcodeValue
  const chassisNo = input.chassisNo ?? record.chassisNo ?? `${trailerNo}-CH`

  const r = useDispatchStore.getState().updateLineIdentity(input.dispatchId, input.lineId, {
    trailerNo,
    chassisNo,
  })
  if (!r.ok) return r

  ensureEntityBarcode('trailer', `${input.dispatchId}-${input.lineId}`, trailerNo, { trailerNo, chassisNo })
  logEvent(record.barcodeId, 'moved', input.dispatchId, `Trailer ${trailerNo} linked`)
  return { ok: true, message: `Trailer ${trailerNo} scanned`, barcodeId: record.barcodeId }
}

export function scanDispatch(input: { scan: string; dispatchId: string }): ActionResult {
  const resolved = resolveScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved

  const r = useDispatchStore.getState().confirmDispatch(input.dispatchId)
  if (!r.ok) return r

  logEvent(record.barcodeId, 'dispatched', input.dispatchId, 'Dispatch confirmed via scan')
  useBarcodeStore.getState().updateStatus(record.barcodeId, 'consumed')
  return { ok: true, message: 'Dispatch confirmed', barcodeId: record.barcodeId }
}
