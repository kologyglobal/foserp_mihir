import type { QrEntityType, QrGenealogyEdge, QrGenealogyNode, QrRecord, QrTraceResult } from '../types/qrTraceability'
import { QR_ENTITY_LABELS } from '../types/qrTraceability'
import { parseQrPayload } from '../utils/qrPayload'
import { useQrStore } from '../store/qrStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useQualityStore } from '../store/qualityStore'
import { useMasterStore } from '../store/masterStore'
import { onJobWorkReceived, onQcFailed, onQcPassed, ensureWorkOrderQr } from './qrIntegration'

type ActionResult = { ok: boolean; error?: string; message?: string; qrId?: string }

export function resolveQrScan(scan: string): { ok: true; record: QrRecord } | { ok: false; error: string } {
  const trimmed = scan.trim()
  if (!trimmed) return { ok: false, error: 'QR value required' }

  let record = useQrStore.getState().getByCode(trimmed)
  if (!record) {
    const payload = parseQrPayload(trimmed)
    if (payload) {
      record =
        useQrStore.getState().records.find(
          (r) =>
            r.entityType === payload.type &&
            (r.displayCode === payload.id || r.entityId === payload.id || r.metadata.trailerNo === payload.id),
        ) ?? useQrStore.getState().getByCode(payload.id)
    }
  }
  if (!record) return { ok: false, error: 'Unknown QR code' }
  useQrStore.getState().markScanned(record.qrId)
  return { ok: true, record }
}

function log(
  qrId: string,
  eventType: Parameters<ReturnType<typeof useQrStore.getState>['recordEvent']>[0]['eventType'],
  referenceNo: string,
  details: string,
  movementKind?: Parameters<ReturnType<typeof useQrStore.getState>['recordEvent']>[0]['movementKind'],
) {
  useQrStore.getState().recordEvent({ qrId, eventType, referenceNo, details, movementKind })
}

export function getAllowedActions(record: QrRecord, mode?: string): string[] {
  const actions: string[] = []
  switch (record.entityType) {
    case 'MATERIAL_LOT':
      if (mode === 'Receive' || !mode) actions.push('Receive Confirm')
      if (mode === 'Issue' || !mode) actions.push('Issue to WO')
      if (mode === 'Transfer' || !mode) actions.push('Transfer')
      if (mode === 'QC Inspect' || !mode) actions.push('Open QC')
      break
    case 'SUB_ASSEMBLY':
      if (mode === 'WIP Move' || !mode) actions.push('WIP Move')
      if (mode === 'Issue' || !mode) actions.push('Consume to Parent WO')
      if (mode === 'QC Inspect' || !mode) actions.push('Open QC')
      break
    case 'WORK_ORDER':
      actions.push('Open WO 360')
      break
    case 'JOB_CARD':
      if (mode === 'Job Card Start' || !mode) actions.push('Start Job Card')
      if (mode === 'Job Card Complete' || !mode) actions.push('Complete Job Card')
      break
    case 'JOB_WORK_ORDER':
      if (mode === 'Job Work Send' || !mode) actions.push('Validate Vendor Send')
      if (mode === 'Job Work Receive' || !mode) actions.push('Receive from Vendor')
      if (mode === 'QC Inspect' || !mode) actions.push('Open QC')
      break
    case 'FINISHED_TRAILER':
      if (mode === 'Dispatch' || !mode) actions.push('Confirm Loading')
      if (mode === 'QC Inspect' || !mode) actions.push('Open Final QC')
      break
    case 'DISPATCH':
      if (mode === 'Dispatch' || !mode) actions.push('Confirm Dispatch')
      break
    default:
      actions.push('View Traceability')
  }
  actions.push('View Traceability')
  return [...new Set(actions)]
}

export function resolveWorkOrderRef(ref: string) {
  const trimmed = ref.trim()
  if (!trimmed) return undefined
  const store = useWorkOrderStore.getState()
  return store.getWorkOrder(trimmed) ?? store.workOrders.find((w) => w.woNo === trimmed)
}

export function qrIssueToWo(input: { scan: string; woId: string; qty: number }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved
  if (record.entityType !== 'MATERIAL_LOT') return { ok: false, error: 'Scan a material lot QR' }
  const itemId = record.metadata.itemId
  const warehouseId = record.metadata.warehouseId
  if (!itemId || !warehouseId) return { ok: false, error: 'QR missing item/warehouse metadata' }
  const wo = resolveWorkOrderRef(input.woId)
  if (!wo) return { ok: false, error: 'Work order not found — enter WO No or ID' }

  const inv = useInventoryStore.getState()
  const free = inv.getFreeQty(itemId, warehouseId)
  if (input.qty > free) return { ok: false, error: `Insufficient stock. Free: ${free}` }

  const r = inv.postIssueToWorkOrder({
    itemId,
    warehouseId,
    qty: input.qty,
    referenceNo: wo.woNo,
    remarks: `QR issue ${record.displayCode} → ${wo.woNo}`,
    workOrderId: wo.id,
    maxFromReserved: input.qty,
  })
  if (!r.ok) {
    const fallback = inv.postIssue({
      itemId,
      warehouseId,
      qty: input.qty,
      referenceNo: record.displayCode,
      remarks: `QR_ISSUE_TO_WO ${wo.woNo}`,
    })
    if (!fallback.ok) return fallback
    log(record.qrId, 'issued', fallback.movementNo ?? wo.woNo, `Issued ${input.qty} to ${wo.woNo}`, 'QR_ISSUE_TO_WO')
  } else {
    log(record.qrId, 'issued', r.movementNo ?? wo.woNo, `Issued ${input.qty} to ${wo.woNo}`, 'QR_ISSUE_TO_WO')
  }

  useQrStore.getState().updateStatus(record.qrId, 'ISSUED')
  const woQr = ensureWorkOrderQr(wo.id)
  if (woQr) useQrStore.getState().linkGenealogy(record.qrId, woQr.qrId, 'issued-to-wo')
  return { ok: true, message: `Issued ${input.qty} to ${wo.woNo}`, qrId: record.qrId }
}

export function qrTransfer(input: { scan: string; toWarehouseId: string; qty: number }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved
  if (record.entityType !== 'MATERIAL_LOT') return { ok: false, error: 'Scan a material lot QR' }
  const itemId = record.metadata.itemId
  const fromWarehouseId = record.metadata.warehouseId
  if (!itemId || !fromWarehouseId) return { ok: false, error: 'QR missing warehouse metadata' }

  const r = useInventoryStore.getState().postStockTransfer({
    itemId,
    warehouseId: input.toWarehouseId,
    fromWarehouseId,
    qty: input.qty,
    referenceNo: record.displayCode,
    remarks: `QR_TRANSFER ${record.displayCode}`,
  })
  if (!r.ok) return r

  useQrStore.getState().updateMetadata(record.qrId, {
    warehouseId: input.toWarehouseId,
    warehouseCode: useMasterStore.getState().getWarehouse(input.toWarehouseId)?.warehouseCode,
  })
  log(record.qrId, 'moved', r.movementNo ?? record.displayCode, 'Inter-warehouse transfer', 'QR_TRANSFER')
  return { ok: true, message: 'Transfer posted', qrId: record.qrId }
}

export function qrReceiveConfirm(input: { scan: string }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved
  if (record.entityType !== 'MATERIAL_LOT' && record.entityType !== 'GRN_LINE') {
    return { ok: false, error: 'Scan a material lot or GRN line QR' }
  }
  if (record.status === 'REJECTED') return { ok: false, error: 'QR is rejected — cannot receive' }
  if (record.status === 'QC_HOLD') return { ok: false, error: 'QR on QC hold — resolve inspection first' }
  useQrStore.getState().updateStatus(record.qrId, 'IN_STOCK')
  log(record.qrId, 'received', record.metadata.grnNo ?? record.displayCode, 'Receive confirmed via QR scan')
  return { ok: true, message: `Receive confirmed for ${record.displayCode}`, qrId: record.qrId }
}

export function qrConfirmLoading(input: { scan: string }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved
  if (record.entityType !== 'FINISHED_TRAILER') return { ok: false, error: 'Scan finished trailer QR' }
  if (record.status === 'REJECTED') return { ok: false, error: 'Trailer QR rejected — cannot load' }
  const woId = record.metadata.woId
  if (woId && !useQualityStore.getState().hasFinalQcPassed(woId)) {
    return { ok: false, error: 'Final QC must pass before loading' }
  }
  log(record.qrId, 'moved', record.displayCode, 'Loading confirmed via QR scan')
  useQrStore.getState().markScanned(record.qrId)
  return { ok: true, message: `Trailer ${record.displayCode} scanned for loading`, qrId: record.qrId }
}

export function qrJobWorkSendValidate(input: { scan: string }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved
  if (record.entityType !== 'JOB_WORK_ORDER') return { ok: false, error: 'Scan job work order QR' }
  if (record.status !== 'AT_VENDOR') return { ok: false, error: `Expected AT_VENDOR status, got ${record.status}` }
  useQrStore.getState().markScanned(record.qrId)
  return {
    ok: true,
    message: `Job work ${record.displayCode} validated at vendor ${record.metadata.vendorName ?? ''}`.trim(),
    qrId: record.qrId,
  }
}

export function qrWipMove(input: { scan: string }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved
  if (record.entityType !== 'SUB_ASSEMBLY') return { ok: false, error: 'Scan a sub-assembly QR' }

  log(record.qrId, 'moved', record.metadata.woNo ?? record.displayCode, 'WIP move via QR scan', 'QR_WIP_MOVE')
  useQrStore.getState().updateStatus(record.qrId, 'IN_WIP')
  return { ok: true, message: `WIP move recorded for ${record.displayCode}`, qrId: record.qrId }
}

export function qrSaConsume(input: { scan: string; parentWoId: string; qty: number }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  const { record } = resolved
  if (record.entityType !== 'SUB_ASSEMBLY') return { ok: false, error: 'Scan a sub-assembly QR' }
  const parent = useWorkOrderStore.getState().getWorkOrder(input.parentWoId)
  if (!parent) return { ok: false, error: 'Parent WO not found' }

  log(record.qrId, 'consumed', parent.woNo, `Consumed into ${parent.woNo}`, 'QR_SA_CONSUME')
  useQrStore.getState().updateStatus(record.qrId, 'CONSUMED')
  const parentQr = ensureWorkOrderQr(parent.id)
  if (parentQr) useQrStore.getState().linkGenealogy(record.qrId, parentQr.qrId, 'sa-consumed')
  return { ok: true, message: `SA consumed into ${parent.woNo}`, qrId: record.qrId }
}

export function qrJobCardStart(input: { scan: string; assignedTeam?: string }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  let jobCardId = resolved.record.entityId
  if (resolved.record.entityType === 'WORK_ORDER') {
    jobCardId =
      useWorkOrderStore.getState().jobCards.find(
        (j) => j.workOrderId === resolved.record.entityId && j.status !== 'completed',
      )?.id ?? jobCardId
  }
  if (resolved.record.entityType !== 'JOB_CARD' && resolved.record.entityType !== 'WORK_ORDER') {
    return { ok: false, error: 'Scan job card or work order QR' }
  }
  const r = useWorkOrderStore.getState().startJobCard(jobCardId, {
    assignedTeam: input.assignedTeam ?? 'QR Scan Team',
    startTime: new Date().toISOString(),
  })
  if (!r.ok) return r
  log(resolved.record.qrId, 'moved', jobCardId, 'Job card started')
  useQrStore.getState().updateStatus(resolved.record.qrId, 'IN_WIP')
  return { ok: true, message: 'Job card started', qrId: resolved.record.qrId }
}

export function qrJobCardComplete(input: { scan: string; actualHours?: number; remarks?: string }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  let jobCardId = resolved.record.entityId
  if (resolved.record.entityType === 'WORK_ORDER') {
    jobCardId =
      useWorkOrderStore.getState().jobCards.find(
        (j) => j.workOrderId === resolved.record.entityId && j.status === 'in_progress',
      )?.id ?? jobCardId
  }
  const jc = useWorkOrderStore.getState().jobCards.find((j) => j.id === jobCardId)
  if (!jc) return { ok: false, error: 'Job card not found' }
  const r = useWorkOrderStore.getState().completeJobCard(jobCardId, {
    endTime: new Date().toISOString(),
    actualHours: input.actualHours ?? 1,
    remarks: input.remarks ?? 'Completed via QR',
    qcChecks: jc.qcChecks,
  })
  if (!r.ok) return r
  log(resolved.record.qrId, 'consumed', jobCardId, 'Job card completed')
  return { ok: true, message: 'Job card completed', qrId: resolved.record.qrId }
}

export function qrJobWorkReceive(input: {
  scan: string
  receivedQty: number
  rejectedQty?: number
}): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  if (resolved.record.entityType !== 'JOB_WORK_ORDER') return { ok: false, error: 'Scan job work QR' }
  const shipmentId = resolved.record.entityId
  const r = useWorkOrderStore.getState().receiveSubcontractMaterial(
    shipmentId,
    input.receivedQty,
    input.rejectedQty ?? 0,
  )
  if (!r.ok) return r
  onJobWorkReceived(shipmentId, input.receivedQty, input.rejectedQty ?? 0)
  return { ok: true, message: `Received ${input.receivedQty}`, qrId: resolved.record.qrId }
}

export function qrOpenInspection(record: QrRecord): { ok: boolean; inspectionId?: string; path?: string; error?: string } {
  const q = useQualityStore.getState()
  if (record.entityType === 'FINISHED_TRAILER' && record.metadata.woId) {
    const fqc = q.createFinalInspection(record.metadata.woId)
    if (!fqc.ok) return fqc
    return { ok: true, inspectionId: fqc.inspectionId, path: `/quality/inspections/${fqc.inspectionId}` }
  }
  const pending = q.getPendingInspections().find(
    (i) =>
      i.workOrderId === record.metadata.woId ||
      i.jobCardId === record.metadata.jobCardId ||
      i.itemId === record.metadata.itemId,
  )
  if (pending) return { ok: true, inspectionId: pending.id, path: `/quality/inspections/${pending.id}` }
  return { ok: false, error: 'No pending inspection for this QR' }
}

export function qrApplyQcResult(qrId: string, passed: boolean, referenceNo: string): void {
  if (passed) onQcPassed(qrId, referenceNo)
  else onQcFailed(qrId, referenceNo)
}

export function qrConfirmDispatch(input: { scan: string; dispatchId: string }): ActionResult {
  const resolved = resolveQrScan(input.scan)
  if (!resolved.ok) return resolved
  if (resolved.record.entityType !== 'FINISHED_TRAILER' && resolved.record.entityType !== 'DISPATCH') {
    return { ok: false, error: 'Scan finished trailer or dispatch QR' }
  }

  const plan = useDispatchStore.getState().getDispatch(input.dispatchId)
  if (!plan) return { ok: false, error: 'Dispatch plan not found' }

  const trailerQr = useQrStore
    .getState()
    .records.find((r) => r.entityType === 'FINISHED_TRAILER' && r.metadata.woId === plan.lines[0]?.workOrderId)
  if (!trailerQr) return { ok: false, error: 'Finished trailer QR required before dispatch' }

  const woId = plan.lines[0]?.workOrderId
  if (woId && !useQualityStore.getState().hasFinalQcPassed(woId)) {
    return { ok: false, error: 'Final QC must pass before dispatch' }
  }

  const r = useDispatchStore.getState().confirmDispatch(input.dispatchId)
  if (!r.ok) return r

  log(trailerQr.qrId, 'dispatched', plan.dispatchNo, `FG dispatch ${plan.dispatchNo}`, 'QR_FG_DISPATCH')
  useQrStore.getState().updateStatus(trailerQr.qrId, 'DISPATCHED')
  const dispatchQr = useQrStore.getState().getForEntity('DISPATCH', input.dispatchId)[0]
  if (dispatchQr) useQrStore.getState().updateStatus(dispatchQr.qrId, 'DISPATCHED')
  return { ok: true, message: 'Dispatch confirmed', qrId: trailerQr.qrId }
}

export function qrValidateDispatchReady(dispatchId: string): { ok: boolean; error?: string } {
  const plan = useDispatchStore.getState().getDispatch(dispatchId)
  if (!plan) return { ok: false, error: 'Dispatch not found' }
  const woId = plan.lines[0]?.workOrderId
  if (!woId) return { ok: false, error: 'No WO on dispatch line' }
  const trailerQr = useQrStore.getState().getForEntity('FINISHED_TRAILER', woId)[0]
  if (!trailerQr) return { ok: false, error: 'Finished trailer QR required' }
  if (!useQualityStore.getState().hasFinalQcPassed(woId)) return { ok: false, error: 'Final QC not passed' }
  return { ok: true }
}

export function buildGenealogy(rootQrId: string): { nodes: QrGenealogyNode[]; edges: QrGenealogyEdge[] } {
  const store = useQrStore.getState()
  const nodes = new Map<string, QrGenealogyNode>()
  const edges: QrGenealogyEdge[] = []
  const visited = new Set<string>()

  function walk(qrId: string) {
    if (visited.has(qrId)) return
    visited.add(qrId)
    const rec = store.getQr(qrId)
    if (!rec) return
    nodes.set(qrId, {
      qrId: rec.qrId,
      entityType: rec.entityType,
      displayCode: rec.displayCode,
      status: rec.status,
      label: QR_ENTITY_LABELS[rec.entityType],
      metadata: rec.metadata,
    })
    for (const edge of store.edges.filter((e) => e.fromQrId === qrId || e.toQrId === qrId)) {
      edges.push(edge)
      walk(edge.fromQrId)
      walk(edge.toQrId)
    }
    if (rec.metadata.parentQrId) walk(rec.metadata.parentQrId)
  }

  walk(rootQrId)
  return { nodes: [...nodes.values()], edges }
}

const TRACE_CHAIN_ORDER: QrEntityType[] = [
  'MATERIAL_LOT',
  'GRN_LINE',
  'SUB_ASSEMBLY',
  'WORK_ORDER',
  'FINISHED_TRAILER',
  'DISPATCH',
]

/** Ordered RM → SA → FG → Dispatch chain from genealogy graph */
export function buildTraceChain(rootQrId: string): QrGenealogyNode[] {
  const { nodes } = buildGenealogy(rootQrId)
  return [...nodes].sort((a, b) => {
    const ia = TRACE_CHAIN_ORDER.indexOf(a.entityType)
    const ib = TRACE_CHAIN_ORDER.indexOf(b.entityType)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

export function traceChainHasTypes(rootQrId: string, types: QrEntityType[]): boolean {
  const present = new Set(buildTraceChain(rootQrId).map((n) => n.entityType))
  return types.every((t) => present.has(t))
}

export function lookupQrTrace(query: {
  qrCode?: string
  trailerNo?: string
  chassisNo?: string
  woNo?: string
  itemCode?: string
  batchNo?: string
}): QrTraceResult {
  const store = useQrStore.getState()
  let qr: QrRecord | null = null

  if (query.qrCode?.trim()) {
    const resolved = resolveQrScan(query.qrCode.trim())
    if (resolved.ok) qr = resolved.record
  }
  if (!qr && query.trailerNo?.trim()) {
    qr = store.records.find((r) => r.metadata.trailerNo === query.trailerNo!.trim()) ?? null
  }
  if (!qr && query.chassisNo?.trim()) {
    qr = store.records.find((r) => r.metadata.chassisNo === query.chassisNo!.trim()) ?? null
  }
  if (!qr && query.woNo?.trim()) {
    qr =
      store.records.find(
        (r) => r.metadata.woNo === query.woNo!.trim() || r.displayCode === query.woNo!.trim(),
      ) ?? null
  }
  if (!qr && query.batchNo?.trim()) {
    qr = store.records.find((r) => r.metadata.lotNo === query.batchNo!.trim() || r.displayCode === query.batchNo!.trim()) ?? null
  }
  if (!qr && query.itemCode?.trim()) {
    qr = store.records.find((r) => r.metadata.itemCode === query.itemCode!.trim()) ?? null
  }

  if (!qr) return { qr: null, history: [], genealogy: { nodes: [], edges: [] }, related: [] }

  const genealogy = buildGenealogy(qr.qrId)
  const related = store.records.filter(
    (r) =>
      r.qrId !== qr!.qrId &&
      (r.metadata.woId === qr!.metadata.woId ||
        r.metadata.trailerNo === qr!.metadata.trailerNo ||
        r.metadata.lotNo === qr!.metadata.lotNo),
  )
  return { qr, history: store.getHistory(qr.qrId), genealogy, related }
}

export function validateEntityType(record: QrRecord, expected: QrEntityType | QrEntityType[]): boolean {
  const list = Array.isArray(expected) ? expected : [expected]
  return list.includes(record.entityType)
}
