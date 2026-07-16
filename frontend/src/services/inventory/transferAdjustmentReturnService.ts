/**
 * Inventory Phase 3 mock service — transfers, adjustments & returns.
 * Promise-based; updates inventoryStore on demo posting.
 */

import { useMasterStore } from '../../store/masterStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useDispatchStore } from '../../store/dispatchStore'
import { useInvoiceStore } from '../../store/invoiceStore'
import { getGRNById, getGRNs } from '../purchase'
import type {
  AdjustmentDraftInput,
  AdjustmentLine,
  InventoryAdjustment,
  InventoryAdjustmentListRow,
  InventoryReturn,
  InventoryReturnListRow,
  InventoryReturnType,
  InventoryTransfer,
  InventoryTransferListRow,
  MovementAccountingPreview,
  MovementCostPreview,
  ReturnDraftInput,
  ReturnLine,
  ReturnSourceDetails,
  ReturnSourceDocument,
  SalesReturnCondition,
  TransferDraftInput,
  TransferLine,
  TransferStatus,
} from '../../types/inventoryDomain'
import {
  ADJUSTMENT_APPROVAL_THRESHOLD,
  ADJUSTMENT_REASONS_REQUIRING_APPROVAL,
  baseAudit,
  nextAdjustmentNo,
  nextReturnNo,
  nextTransferNo,
} from './movementSeed'
import { getItemById, InventoryServiceError } from './inventoryService'
import { canInventoryPermission } from '../../utils/permissions/inventory'

const delay = (ms = 100) => new Promise<void>((r) => setTimeout(r, ms))

let transfers: InventoryTransfer[] = []
let adjustments: InventoryAdjustment[] = []
let returns: InventoryReturn[] = []
let initialized = false

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function getMaster() {
  return useMasterStore.getState()
}

function getInv() {
  return useInventoryStore.getState()
}

function whMeta(warehouseId: string) {
  const wh = getMaster().getWarehouse(warehouseId)
  return {
    warehouseId,
    warehouseName: wh?.warehouseName ?? '—',
    plantCode: wh?.plantCode ?? '—',
  }
}

function isSameLocation(fromWhId: string, toWhId: string): boolean {
  if (fromWhId === toWhId) return true
  const from = getMaster().getWarehouse(fromWhId)
  const to = getMaster().getWarehouse(toWhId)
  return Boolean(from && to && from.plantCode === to.plantCode && from.id === to.id)
}

function isDifferentLocation(fromWhId: string, toWhId: string): boolean {
  if (fromWhId === toWhId) return false
  const from = getMaster().getWarehouse(fromWhId)
  const to = getMaster().getWarehouse(toWhId)
  if (!from || !to) return true
  return from.plantCode !== to.plantCode || from.id !== to.id
}

function buildTransferCostPreview(lines: TransferLine[]): MovementCostPreview {
  const rows = lines
    .filter((l) => l.transferQty > 0)
    .map((l) => ({
      itemCode: l.itemCode,
      qty: l.transferQty,
      rate: l.rate,
      amount: l.transferQty * l.rate,
    }))
  const subtotal = rows.reduce((s, r) => s + r.amount, 0)
  return { lines: rows, subtotal, gstAmount: 0, total: subtotal }
}

function buildAdjustmentCostPreview(lines: AdjustmentLine[]): MovementCostPreview {
  const rows = lines
    .filter((l) => l.adjustmentQty !== 0)
    .map((l) => ({
      itemCode: l.itemCode,
      qty: Math.abs(l.adjustmentQty),
      rate: l.unitCost,
      amount: Math.abs(l.adjustmentValue),
    }))
  const subtotal = rows.reduce((s, r) => s + r.amount, 0)
  return { lines: rows, subtotal, gstAmount: 0, total: subtotal }
}

function buildTransferAccountingPreview(total: number): MovementAccountingPreview {
  return {
    debitAccount: '1100 — Inventory (Destination)',
    creditAccount: '1100 — Inventory (Source)',
    amount: total,
    narration: 'Demo transfer — inventory reclassification between warehouses',
  }
}

function buildAdjustmentAccountingPreview(total: number, isPositive: boolean): MovementAccountingPreview {
  if (isPositive) {
    return {
      debitAccount: '1100 — Inventory',
      creditAccount: '5900 — Inventory Adjustment Gain',
      amount: total,
      narration: 'Demo adjustment — stock increase',
    }
  }
  return {
    debitAccount: '5900 — Inventory Adjustment Loss',
    creditAccount: '1100 — Inventory',
    amount: total,
    narration: 'Demo adjustment — stock decrease',
  }
}

function sumTransfer(doc: InventoryTransfer) {
  return {
    itemCount: doc.lines.length,
    transferQty: doc.lines.reduce((s, l) => s + l.transferQty, 0),
    dispatchedQty: doc.lines.reduce((s, l) => s + l.dispatchedQty, 0),
    receivedQty: doc.lines.reduce((s, l) => s + l.receivedQty, 0),
  }
}

function requiresAdjustmentApproval(
  adjustmentValue: number,
  createsNegativeStock: boolean,
  adjustmentType: string,
  canDirectPost: boolean,
): boolean {
  if (!canDirectPost) return true
  if (Math.abs(adjustmentValue) >= ADJUSTMENT_APPROVAL_THRESHOLD) return true
  if (createsNegativeStock) return true
  if (ADJUSTMENT_REASONS_REQUIRING_APPROVAL.includes(adjustmentType)) return true
  return false
}

function ensureInitialized() {
  if (initialized) return
  initialized = true
}

async function buildTransferLine(
  itemId: string,
  fromWhId: string,
  toWhId: string,
  transferQty: number,
  lineNo: number,
): Promise<TransferLine | null> {
  const item = await getItemById(itemId)
  if (!item) return null
  const free = getInv().getFreeQty(itemId, fromWhId)
  return {
    id: `tl-${lineNo}-${itemId}`,
    lineNo,
    itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    uomCode: item.baseUomCode,
    fromWarehouseId: fromWhId,
    toWarehouseId: toWhId,
    fromLocationId: null,
    toLocationId: null,
    transferQty,
    dispatchedQty: 0,
    receivedQty: 0,
    shortQty: 0,
    damagedQty: 0,
    shortReason: null,
    availableQty: free,
    batchNo: item.batchTracking ? `B-${item.itemCode}-001` : null,
    serialNo: item.serialTracking ? `SN-${item.itemCode}-001` : null,
    rate: item.standardCost,
    batchTracking: item.batchTracking,
    serialTracking: item.serialTracking,
    remarks: '',
  }
}

/* ── Transfers ── */

export async function getTransfers(filter?: { status?: string; search?: string }): Promise<InventoryTransferListRow[]> {
  await delay()
  ensureInitialized()
  let list = transfers.map((t) => {
    const sums = sumTransfer(t)
    return {
      id: t.id,
      documentNumber: t.documentNumber,
      transferDate: t.transferDate,
      transferType: t.transferType,
      fromWarehouseName: t.fromWarehouseName,
      toWarehouseName: t.toWarehouseName,
      itemCount: sums.itemCount,
      transferQty: sums.transferQty,
      dispatchedQty: sums.dispatchedQty,
      receivedQty: sums.receivedQty,
      expectedReceiptDate: t.expectedReceiptDate,
      status: t.status,
    }
  })
  if (filter?.status) list = list.filter((r) => r.status === filter.status)
  if (filter?.search) {
    const q = filter.search.toLowerCase()
    list = list.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.fromWarehouseName.toLowerCase().includes(q) ||
        r.toWarehouseName.toLowerCase().includes(q),
    )
  }
  return list.sort((a, b) => b.transferDate.localeCompare(a.transferDate))
}

export async function getTransferById(id: string): Promise<InventoryTransfer | null> {
  await delay()
  return transfers.find((t) => t.id === id) ?? null
}

export function validateTransferLines(
  lines: TransferLine[],
  fromWhId: string,
  toWhId: string,
): string[] {
  const errors: string[] = []
  if (fromWhId === toWhId) errors.push('Source and destination warehouse cannot be the same')
  for (const line of lines) {
    if (line.transferQty <= 0) continue
    const free = getInv().getFreeQty(line.itemId, fromWhId)
    if (line.transferQty > free) {
      errors.push(`${line.itemCode}: transfer qty ${line.transferQty} exceeds available ${free}`)
    }
    if (line.batchTracking && !line.batchNo) {
      errors.push(`${line.itemCode}: batch selection required`)
    }
    if (line.serialTracking && !line.serialNo) {
      errors.push(`${line.itemCode}: serial number required`)
    }
    if (line.receivedQty > line.dispatchedQty && line.dispatchedQty > 0) {
      errors.push(`${line.itemCode}: received qty cannot exceed dispatched qty`)
    }
    if ((line.shortQty > 0 || line.damagedQty > 0) && !line.shortReason) {
      errors.push(`${line.itemCode}: short/damaged quantity requires a reason`)
    }
  }
  if (!lines.some((l) => l.transferQty > 0)) errors.push('At least one line must have transfer quantity > 0')
  return errors
}

export async function createTransferDraft(input: TransferDraftInput): Promise<InventoryTransfer> {
  await delay()
  ensureInitialized()
  const fromWh = whMeta(input.fromWarehouseId)
  const toWh = whMeta(input.toWarehouseId)
  const ts = new Date().toISOString()
  const lines: TransferLine[] = []
  let lineNo = 1
  for (const dl of input.lines) {
    const line = await buildTransferLine(dl.itemId, input.fromWarehouseId, input.toWarehouseId, dl.transferQty ?? 0, lineNo++)
    if (line) {
      lines.push({
        ...line,
        batchNo: dl.batchNo ?? line.batchNo,
        serialNo: dl.serialNo ?? line.serialNo,
        remarks: dl.remarks ?? '',
      })
    }
  }

  const errors = validateTransferLines(lines, input.fromWarehouseId, input.toWarehouseId)
  if (errors.length) throw new InventoryServiceError(errors.join('; '), 'VALIDATION')

  const sums = {
    itemCount: lines.length,
    transferQty: lines.reduce((s, l) => s + l.transferQty, 0),
    dispatchedQty: 0,
    receivedQty: 0,
  }

  const doc: InventoryTransfer = {
    id: genId('tr'),
    documentNumber: nextTransferNo(),
    transferDate: input.transferDate,
    transferType: input.transferType,
    fromWarehouseId: fromWh.warehouseId,
    fromWarehouseName: fromWh.warehouseName,
    toWarehouseId: toWh.warehouseId,
    toWarehouseName: toWh.warehouseName,
    fromPlantCode: fromWh.plantCode,
    toPlantCode: toWh.plantCode,
    status: 'draft',
    expectedReceiptDate: input.expectedReceiptDate ?? null,
    vehicleNo: input.vehicleNo ?? null,
    transporter: input.transporter ?? null,
    reference: input.reference ?? null,
    remarks: input.remarks ?? null,
    ...sums,
    approvalRequired: isDifferentLocation(input.fromWarehouseId, input.toWarehouseId),
    lines,
    mode: input.mode ?? 'quick',
    costPreview: buildTransferCostPreview(lines),
    accountingPreview: null,
    auditHistory: [baseAudit('Draft created')],
    createdBy: 'Demo User',
    createdAt: ts,
    updatedAt: ts,
  }
  transfers = [doc, ...transfers]
  return doc
}

export async function dispatchTransferDemo(id: string): Promise<InventoryTransfer> {
  await delay()
  const idx = transfers.findIndex((t) => t.id === id)
  if (idx < 0) throw new InventoryServiceError('Transfer not found', 'NOT_FOUND')
  const doc = transfers[idx]
  if (doc.status !== 'draft') throw new InventoryServiceError('Only draft transfers can be dispatched', 'INVALID_STATUS')

  const sameLoc = isSameLocation(doc.fromWarehouseId, doc.toWarehouseId)
  const inv = getInv()
  const updatedLines = doc.lines.map((l) => ({
    ...l,
    dispatchedQty: l.transferQty,
    receivedQty: sameLoc ? l.transferQty : 0,
  }))

  for (const line of updatedLines.filter((l) => l.transferQty > 0)) {
    const result = inv.postStockTransfer({
      itemId: line.itemId,
      warehouseId: line.toWarehouseId,
      fromWarehouseId: line.fromWarehouseId,
      qty: line.transferQty,
      rate: line.rate,
      referenceNo: doc.documentNumber,
      remarks: `Transfer dispatch ${doc.documentNumber}`,
      txnDate: doc.transferDate,
    })
    if (!result.ok) throw new InventoryServiceError(result.error ?? 'Dispatch failed', 'POST_FAILED')
  }

  const newStatus: TransferStatus = sameLoc ? 'received' : 'dispatched'
  const sums = {
    itemCount: updatedLines.length,
    transferQty: updatedLines.reduce((s, l) => s + l.transferQty, 0),
    dispatchedQty: updatedLines.reduce((s, l) => s + l.dispatchedQty, 0),
    receivedQty: updatedLines.reduce((s, l) => s + l.receivedQty, 0),
  }

  const updated: InventoryTransfer = {
    ...doc,
    lines: updatedLines,
    ...sums,
    status: newStatus,
    accountingPreview: buildTransferAccountingPreview(doc.costPreview?.total ?? 0),
    updatedAt: new Date().toISOString(),
    auditHistory: [
      ...doc.auditHistory,
      baseAudit(sameLoc ? 'Received (same location — demo)' : 'Dispatched (demo)'),
    ],
  }
  transfers[idx] = updated
  return updated
}

export async function receiveTransferDemo(
  id: string,
  receiveLines?: Array<{ lineId: string; receivedQty: number; shortQty?: number; damagedQty?: number; shortReason?: string }>,
): Promise<InventoryTransfer> {
  await delay()
  const idx = transfers.findIndex((t) => t.id === id)
  if (idx < 0) throw new InventoryServiceError('Transfer not found', 'NOT_FOUND')
  const doc = transfers[idx]
  if (!['dispatched', 'in_transit', 'partially_received'].includes(doc.status)) {
    throw new InventoryServiceError('Transfer is not ready for receipt', 'INVALID_STATUS')
  }

  const updatedLines = doc.lines.map((l) => {
    const patch = receiveLines?.find((r) => r.lineId === l.id)
    if (!patch) return l
    const receivedQty = Math.min(patch.receivedQty, l.dispatchedQty)
    const shortQty = patch.shortQty ?? 0
    const damagedQty = patch.damagedQty ?? 0
    if ((shortQty > 0 || damagedQty > 0) && !patch.shortReason) {
      throw new InventoryServiceError(`${l.itemCode}: short/damaged requires reason`, 'VALIDATION')
    }
    if (receivedQty > l.dispatchedQty) {
      throw new InventoryServiceError(`${l.itemCode}: received exceeds dispatched`, 'VALIDATION')
    }
    return {
      ...l,
      receivedQty,
      shortQty,
      damagedQty,
      shortReason: patch.shortReason ?? null,
    }
  })

  const totalDispatched = updatedLines.reduce((s, l) => s + l.dispatchedQty, 0)
  const totalReceived = updatedLines.reduce((s, l) => s + l.receivedQty, 0)
  const newStatus: TransferStatus =
    totalReceived >= totalDispatched ? 'received' : totalReceived > 0 ? 'partially_received' : doc.status

  const updated: InventoryTransfer = {
    ...doc,
    lines: updatedLines,
    receivedQty: totalReceived,
    status: newStatus,
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit(`Received ${totalReceived} of ${totalDispatched} (demo)`)],
  }
  transfers[idx] = updated
  return updated
}

export async function markTransferInTransitDemo(id: string): Promise<InventoryTransfer> {
  await delay()
  const idx = transfers.findIndex((t) => t.id === id)
  if (idx < 0) throw new InventoryServiceError('Transfer not found', 'NOT_FOUND')
  const doc = transfers[idx]
  if (doc.status !== 'dispatched') throw new InventoryServiceError('Only dispatched transfers can be marked in transit', 'INVALID_STATUS')
  const updated: InventoryTransfer = {
    ...doc,
    status: 'in_transit',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Marked in transit')],
  }
  transfers[idx] = updated
  return updated
}

export async function cancelTransferDemo(id: string): Promise<InventoryTransfer> {
  await delay()
  const idx = transfers.findIndex((t) => t.id === id)
  if (idx < 0) throw new InventoryServiceError('Transfer not found', 'NOT_FOUND')
  const doc = transfers[idx]
  if (['received', 'partially_received'].includes(doc.status)) {
    throw new InventoryServiceError('Received transfers cannot be cancelled', 'INVALID_STATUS')
  }
  const updated: InventoryTransfer = {
    ...doc,
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Cancelled')],
  }
  transfers[idx] = updated
  return updated
}

/* ── Adjustments ── */

export async function getAdjustments(filter?: { status?: string; search?: string }): Promise<InventoryAdjustmentListRow[]> {
  await delay()
  ensureInitialized()
  let list = adjustments.map((a) => ({
    id: a.id,
    documentNumber: a.documentNumber,
    adjustmentDate: a.adjustmentDate,
    adjustmentType: a.adjustmentType,
    warehouseName: a.warehouseName,
    itemCount: a.itemCount,
    quantityDifference: a.quantityDifference,
    adjustmentValue: a.adjustmentValue,
    reason: a.reason,
    approvalStatus: a.approvalStatus,
    postingStatus: a.postingStatus,
    status: a.status,
  }))
  if (filter?.status) list = list.filter((r) => r.status === filter.status)
  if (filter?.search) {
    const q = filter.search.toLowerCase()
    list = list.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.warehouseName.toLowerCase().includes(q),
    )
  }
  return list.sort((a, b) => b.adjustmentDate.localeCompare(a.adjustmentDate))
}

export async function getAdjustmentById(id: string): Promise<InventoryAdjustment | null> {
  await delay()
  return adjustments.find((a) => a.id === id) ?? null
}

export async function createAdjustmentDraft(input: AdjustmentDraftInput): Promise<InventoryAdjustment> {
  await delay()
  ensureInitialized()
  const wh = whMeta(input.warehouseId)
  const ts = new Date().toISOString()
  const lines: AdjustmentLine[] = []
  let lineNo = 1
  let createsNegative = false

  for (const dl of input.lines) {
    const item = await getItemById(dl.itemId)
    if (!item) continue
    const currentQty = getInv().getOnHand(dl.itemId, input.warehouseId)
    const adjustmentQty = dl.adjustmentQty ?? 0
    const newQty = currentQty + adjustmentQty
    if (newQty < 0 && !item.allowNegativeStock) createsNegative = true
    const unitCost = item.standardCost
    lines.push({
      id: `al-${lineNo}-${dl.itemId}`,
      lineNo: lineNo++,
      itemId: dl.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      uomCode: item.baseUomCode,
      warehouseId: input.warehouseId,
      currentQty,
      adjustmentQty,
      newQty,
      unitCost,
      adjustmentValue: adjustmentQty * unitCost,
      batchNo: dl.batchNo ?? (item.batchTracking ? `B-${item.itemCode}-001` : null),
      serialNo: dl.serialNo ?? null,
      batchTracking: item.batchTracking,
      serialTracking: item.serialTracking,
      remarks: dl.remarks ?? '',
    })
  }

  const adjustmentValue = lines.reduce((s, l) => s + l.adjustmentValue, 0)
  const qtyDiff = lines.reduce((s, l) => s + l.adjustmentQty, 0)
  const canDirectPost = canInventoryPermission('inventory.adjustments.post')
  const needsApproval = requiresAdjustmentApproval(
    adjustmentValue,
    createsNegative,
    input.adjustmentType,
    canDirectPost,
  )

  const doc: InventoryAdjustment = {
    id: genId('adj'),
    documentNumber: nextAdjustmentNo(),
    adjustmentDate: input.adjustmentDate,
    adjustmentType: input.adjustmentType,
    warehouseId: wh.warehouseId,
    warehouseName: wh.warehouseName,
    plantCode: wh.plantCode,
    reason: input.reason,
    status: 'draft',
    approvalStatus: needsApproval ? 'pending' : 'not_required',
    postingStatus: 'not_posted',
    itemCount: lines.length,
    quantityDifference: qtyDiff,
    adjustmentValue,
    approvalRequired: needsApproval,
    approvalThreshold: ADJUSTMENT_APPROVAL_THRESHOLD,
    lines,
    costPreview: buildAdjustmentCostPreview(lines),
    accountingPreview: buildAdjustmentAccountingPreview(Math.abs(adjustmentValue), adjustmentValue >= 0),
    auditHistory: [baseAudit('Draft created')],
    createdBy: 'Demo User',
    approvedBy: null,
    postedBy: null,
    createdAt: ts,
    updatedAt: ts,
  }
  adjustments = [doc, ...adjustments]
  return doc
}

export async function submitAdjustment(id: string): Promise<InventoryAdjustment> {
  await delay()
  const idx = adjustments.findIndex((a) => a.id === id)
  if (idx < 0) throw new InventoryServiceError('Adjustment not found', 'NOT_FOUND')
  const doc = adjustments[idx]
  if (doc.status !== 'draft') throw new InventoryServiceError('Only draft adjustments can be submitted', 'INVALID_STATUS')

  const newStatus = doc.approvalRequired ? 'pending_approval' : 'approved'
  const updated: InventoryAdjustment = {
    ...doc,
    status: newStatus,
    approvalStatus: doc.approvalRequired ? 'pending' : 'not_required',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit(doc.approvalRequired ? 'Submitted for approval' : 'Auto-approved')],
  }
  adjustments[idx] = updated
  return updated
}

export async function approveAdjustmentDemo(id: string): Promise<InventoryAdjustment> {
  await delay()
  const idx = adjustments.findIndex((a) => a.id === id)
  if (idx < 0) throw new InventoryServiceError('Adjustment not found', 'NOT_FOUND')
  const doc = adjustments[idx]
  if (doc.status !== 'pending_approval') throw new InventoryServiceError('Adjustment is not pending approval', 'INVALID_STATUS')
  const updated: InventoryAdjustment = {
    ...doc,
    status: 'approved',
    approvalStatus: 'approved',
    approvedBy: 'Demo Approver',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Approved (demo)')],
  }
  adjustments[idx] = updated
  return updated
}

export async function rejectAdjustmentDemo(id: string, reason?: string): Promise<InventoryAdjustment> {
  await delay()
  const idx = adjustments.findIndex((a) => a.id === id)
  if (idx < 0) throw new InventoryServiceError('Adjustment not found', 'NOT_FOUND')
  const doc = adjustments[idx]
  if (doc.status !== 'pending_approval') throw new InventoryServiceError('Adjustment is not pending approval', 'INVALID_STATUS')
  const updated: InventoryAdjustment = {
    ...doc,
    status: 'rejected',
    approvalStatus: 'rejected',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit(`Rejected${reason ? `: ${reason}` : ''}`)],
  }
  adjustments[idx] = updated
  return updated
}

export async function postAdjustmentDemo(id: string): Promise<InventoryAdjustment> {
  await delay()
  const idx = adjustments.findIndex((a) => a.id === id)
  if (idx < 0) throw new InventoryServiceError('Adjustment not found', 'NOT_FOUND')
  const doc = adjustments[idx]
  if (doc.status === 'posted') throw new InventoryServiceError('Already posted', 'DUPLICATE_POST')
  if (doc.approvalRequired && doc.status !== 'approved') {
    throw new InventoryServiceError('Adjustment requires approval before posting', 'INVALID_STATUS')
  }
  if (!doc.approvalRequired && doc.status === 'draft') {
    // auto-submit path
  } else if (!['approved', 'draft'].includes(doc.status)) {
    throw new InventoryServiceError('Adjustment cannot be posted in current status', 'INVALID_STATUS')
  }

  const inv = getInv()
  for (const line of doc.lines.filter((l) => l.adjustmentQty !== 0)) {
    const result = inv.postAdjustment({
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      qty: Math.abs(line.adjustmentQty),
      isPositive: line.adjustmentQty > 0,
      rate: line.unitCost,
      referenceNo: doc.documentNumber,
      remarks: `${doc.adjustmentType}: ${doc.reason}`,
      txnDate: doc.adjustmentDate,
    })
    if (!result.ok) throw new InventoryServiceError(result.error ?? 'Posting failed', 'POST_FAILED')
  }

  const updated: InventoryAdjustment = {
    ...doc,
    status: 'posted',
    postingStatus: 'posted',
    postedBy: 'Demo User',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Posted (demo) — inventory ledger updated')],
  }
  adjustments[idx] = updated
  return updated
}

/* ── Returns ── */

export async function getReturnSourceDocuments(returnType: InventoryReturnType): Promise<ReturnSourceDocument[]> {
  await delay()
  ensureInitialized()
  const docs: ReturnSourceDocument[] = []

  if (returnType === 'purchase_return') {
    const grns = await getGRNs()
    for (const grn of grns.filter((g) => ['posted', 'accepted', 'partially_accepted'].includes(g.status))) {
      const eligible = grn.lines.filter((l) => l.acceptedQty > 0)
      if (eligible.length === 0) continue
      docs.push({
        id: grn.id,
        documentNo: grn.documentNumber,
        documentDate: grn.documentDate,
        returnType,
        partyOrDepartment: grn.vendor.name,
        warehouseId: grn.warehouseId,
        warehouseName: grn.warehouseName,
        eligibleLineCount: eligible.length,
        eligibleQty: eligible.reduce((s, l) => s + l.acceptedQty, 0),
        isEligible: true,
      })
    }
  }

  if (returnType === 'sales_return') {
    const invoices = useInvoiceStore.getState().invoices.filter((i) => i.status === 'posted')
    for (const inv of invoices) {
      const dispatch = useDispatchStore.getState().getDispatch(inv.dispatchId)
      const whId = dispatch?.lines[0]?.warehouseId ?? getMaster().warehouses[0]?.id ?? ''
      docs.push({
        id: inv.id,
        documentNo: inv.invoiceNo,
        documentDate: inv.invoiceDate,
        returnType,
        partyOrDepartment: inv.customerName,
        warehouseId: whId,
        warehouseName: getMaster().getWarehouse(whId)?.warehouseName ?? '—',
        eligibleLineCount: inv.lines.length,
        eligibleQty: inv.lines.reduce((s, l) => s + l.qty, 0),
        isEligible: true,
      })
    }
    const dispatches = useDispatchStore.getState().dispatches.filter((d) =>
      ['dispatched', 'in_transit', 'pod_received', 'closed'].includes(d.status),
    )
    for (const d of dispatches) {
      if (docs.some((doc) => doc.documentNo === d.dispatchNo)) continue
      const whId = d.lines[0]?.warehouseId ?? getMaster().warehouses[0]?.id ?? ''
      docs.push({
        id: d.id,
        documentNo: d.dispatchNo,
        documentDate: d.plannedDate,
        returnType,
        partyOrDepartment: d.customerName,
        warehouseId: whId,
        warehouseName: getMaster().getWarehouse(whId)?.warehouseName ?? '—',
        eligibleLineCount: d.lines.length,
        eligibleQty: d.lines.reduce((s, l) => s + l.qty, 0),
        isEligible: true,
      })
    }
  }

  if (returnType === 'production_material_return') {
    for (const wo of useWorkOrderStore.getState().workOrders.filter((w) =>
      ['partially_issued', 'fully_issued', 'in_production', 'completed'].includes(w.status),
    )) {
      const mats = useWorkOrderStore.getState().getWoMaterials(wo.id).filter((m) => m.issuedQty > 0)
      if (mats.length === 0) continue
      docs.push({
        id: wo.id,
        documentNo: wo.woNo,
        documentDate: wo.plannedStartDate,
        returnType,
        partyOrDepartment: wo.outputItemCode,
        warehouseId: mats[0]?.warehouseId ?? '',
        warehouseName: getMaster().getWarehouse(mats[0]?.warehouseId ?? '')?.warehouseName ?? '—',
        eligibleLineCount: mats.length,
        eligibleQty: mats.reduce((s, m) => s + m.issuedQty, 0),
        isEligible: true,
      })
    }
  }

  if (returnType === 'transfer_return') {
    for (const t of transfers.filter((tr) => tr.status === 'received')) {
      docs.push({
        id: t.id,
        documentNo: t.documentNumber,
        documentDate: t.transferDate,
        returnType,
        partyOrDepartment: `${t.fromWarehouseName} → ${t.toWarehouseName}`,
        warehouseId: t.toWarehouseId,
        warehouseName: t.toWarehouseName,
        eligibleLineCount: t.lines.length,
        eligibleQty: t.lines.reduce((s, l) => s + l.receivedQty, 0),
        isEligible: true,
      })
    }
  }

  return docs.sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getReturnSourceDetails(
  returnType: InventoryReturnType,
  sourceDocumentId: string,
): Promise<ReturnSourceDetails | null> {
  await delay()
  ensureInitialized()
  const lines: ReturnLine[] = []
  let lineNo = 1

  if (returnType === 'purchase_return') {
    const grn = await getGRNById(sourceDocumentId)
    if (!grn) return null
    for (const gl of grn.lines.filter((l) => l.acceptedQty > 0)) {
      const item = await getItemById(gl.itemId)
      if (!item) continue
      lines.push({
        id: `rl-${lineNo}`,
        lineNo: lineNo++,
        itemId: gl.itemId,
        itemCode: gl.itemCode,
        itemName: gl.itemName,
        uomCode: gl.uom,
        warehouseId: grn.warehouseId,
        eligibleQty: gl.acceptedQty,
        returnQty: 0,
        unitCost: gl.rate,
        returnValue: 0,
        batchNo: gl.batchNumber || null,
        serialNo: gl.serialNumber || null,
        batchTracking: item.batchTracking,
        serialTracking: item.serialTracking,
        reason: null,
        condition: null,
        remarks: '',
      })
    }
    return {
      sourceDocumentId: grn.id,
      sourceDocumentNo: grn.documentNumber,
      returnType,
      partyOrDepartment: grn.vendor.name,
      warehouseId: grn.warehouseId,
      warehouseName: grn.warehouseName,
      lines,
    }
  }

  if (returnType === 'sales_return') {
    const inv = useInvoiceStore.getState().invoices.find((i) => i.id === sourceDocumentId)
    if (inv) {
      const dispatch = useDispatchStore.getState().getDispatch(inv.dispatchId)
      const whId = dispatch?.lines[0]?.warehouseId ?? getMaster().warehouses[0]?.id ?? ''
      for (const il of inv.lines) {
        const item = await getItemById(il.itemId)
        if (!item) continue
        lines.push({
          id: `rl-${lineNo}`,
          lineNo: lineNo++,
          itemId: il.itemId,
          itemCode: il.itemCode,
          itemName: il.description,
          uomCode: item.baseUomCode,
          warehouseId: whId,
          eligibleQty: il.qty,
          returnQty: 0,
          unitCost: il.unitPrice,
          returnValue: 0,
          batchNo: null,
          serialNo: il.trailerNo || null,
          batchTracking: item.batchTracking,
          serialTracking: item.serialTracking,
          reason: null,
          condition: null,
          remarks: '',
        })
      }
      return {
        sourceDocumentId: inv.id,
        sourceDocumentNo: inv.invoiceNo,
        returnType,
        partyOrDepartment: inv.customerName,
        warehouseId: whId,
        warehouseName: getMaster().getWarehouse(whId)?.warehouseName ?? '—',
        lines,
      }
    }
    const dispatch = useDispatchStore.getState().getDispatch(sourceDocumentId)
    if (dispatch) {
      const whId = dispatch.lines[0]?.warehouseId ?? ''
      for (const dl of dispatch.lines) {
        const item = await getItemById(dl.itemId)
        if (!item) continue
        lines.push({
          id: `rl-${lineNo}`,
          lineNo: lineNo++,
          itemId: dl.itemId,
          itemCode: dl.itemCode,
          itemName: item.itemName,
          uomCode: item.baseUomCode,
          warehouseId: whId,
          eligibleQty: dl.qty,
          returnQty: 0,
          unitCost: item.standardCost,
          returnValue: 0,
          batchNo: null,
          serialNo: dl.serialNo || null,
          batchTracking: item.batchTracking,
          serialTracking: item.serialTracking,
          reason: null,
          condition: null,
          remarks: '',
        })
      }
      return {
        sourceDocumentId: dispatch.id,
        sourceDocumentNo: dispatch.dispatchNo,
        returnType,
        partyOrDepartment: dispatch.customerName,
        warehouseId: whId,
        warehouseName: getMaster().getWarehouse(whId)?.warehouseName ?? '—',
        lines,
      }
    }
  }

  if (returnType === 'production_material_return') {
    const wo = useWorkOrderStore.getState().getWorkOrder(sourceDocumentId)
    if (!wo) return null
    const mats = useWorkOrderStore.getState().getWoMaterials(wo.id).filter((m) => m.issuedQty > 0)
    for (const m of mats) {
      const item = await getItemById(m.itemId)
      if (!item) continue
      const uom = getMaster().getUom(m.uomId)
      lines.push({
        id: `rl-${lineNo}`,
        lineNo: lineNo++,
        itemId: m.itemId,
        itemCode: m.itemCode,
        itemName: item.itemName,
        uomCode: uom?.uomCode ?? '—',
        warehouseId: m.warehouseId,
        eligibleQty: m.issuedQty,
        returnQty: 0,
        unitCost: item.standardCost,
        returnValue: 0,
        batchNo: null,
        serialNo: null,
        batchTracking: item.batchTracking,
        serialTracking: item.serialTracking,
        reason: null,
        condition: null,
        remarks: '',
      })
    }
    const whId = mats[0]?.warehouseId ?? ''
    return {
      sourceDocumentId: wo.id,
      sourceDocumentNo: wo.woNo,
      returnType,
      partyOrDepartment: wo.outputItemCode,
      warehouseId: whId,
      warehouseName: getMaster().getWarehouse(whId)?.warehouseName ?? '—',
      lines,
    }
  }

  if (returnType === 'transfer_return') {
    const t = transfers.find((tr) => tr.id === sourceDocumentId)
    if (!t || t.status !== 'received') return null
    for (const tl of t.lines.filter((l) => l.receivedQty > 0)) {
      lines.push({
        id: `rl-${lineNo}`,
        lineNo: lineNo++,
        itemId: tl.itemId,
        itemCode: tl.itemCode,
        itemName: tl.itemName,
        uomCode: tl.uomCode,
        warehouseId: t.toWarehouseId,
        eligibleQty: tl.receivedQty,
        returnQty: 0,
        unitCost: tl.rate,
        returnValue: 0,
        batchNo: tl.batchNo,
        serialNo: tl.serialNo,
        batchTracking: tl.batchTracking,
        serialTracking: tl.serialTracking,
        reason: null,
        condition: null,
        remarks: '',
      })
    }
    return {
      sourceDocumentId: t.id,
      sourceDocumentNo: t.documentNumber,
      returnType,
      partyOrDepartment: `${t.fromWarehouseName} → ${t.toWarehouseName}`,
      warehouseId: t.toWarehouseId,
      warehouseName: t.toWarehouseName,
      lines,
    }
  }

  return null
}

export function validateReturnLines(lines: ReturnLine[], returnType: InventoryReturnType): string[] {
  const errors: string[] = []
  for (const line of lines) {
    if (line.returnQty <= 0) continue
    if (line.returnQty > line.eligibleQty) {
      errors.push(`${line.itemCode}: return qty ${line.returnQty} exceeds eligible ${line.eligibleQty}`)
    }
    if (line.serialTracking && !line.serialNo && line.returnQty > 0) {
      errors.push(`${line.itemCode}: serial must match source document`)
    }
    if (returnType === 'sales_return' && !line.condition) {
      errors.push(`${line.itemCode}: return condition required`)
    }
  }
  if (!lines.some((l) => l.returnQty > 0)) errors.push('At least one line must have return quantity > 0')
  return errors
}

export async function getReturns(filter?: { status?: string; returnType?: string; search?: string }): Promise<InventoryReturnListRow[]> {
  await delay()
  ensureInitialized()
  let list = returns.map((r) => ({
    id: r.id,
    documentNumber: r.documentNumber,
    returnDate: r.returnDate,
    returnType: r.returnType,
    sourceDocumentNo: r.sourceDocumentNo,
    partyOrDepartment: r.partyOrDepartment,
    warehouseName: r.warehouseName,
    itemCount: r.itemCount,
    returnQty: r.returnQty,
    returnValue: r.returnValue,
    status: r.status,
  }))
  if (filter?.status) list = list.filter((r) => r.status === filter.status)
  if (filter?.returnType) list = list.filter((r) => r.returnType === filter.returnType)
  if (filter?.search) {
    const q = filter.search.toLowerCase()
    list = list.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.sourceDocumentNo.toLowerCase().includes(q) ||
        (r.partyOrDepartment ?? '').toLowerCase().includes(q),
    )
  }
  return list.sort((a, b) => b.returnDate.localeCompare(a.returnDate))
}

export async function getReturnById(id: string): Promise<InventoryReturn | null> {
  await delay()
  return returns.find((r) => r.id === id) ?? null
}

export async function createReturnDraft(input: ReturnDraftInput): Promise<InventoryReturn> {
  await delay()
  ensureInitialized()
  const details = await getReturnSourceDetails(input.returnType, input.sourceDocumentId)
  if (!details) throw new InventoryServiceError('Source document not found or not eligible', 'NOT_FOUND')

  const lines: ReturnLine[] = details.lines.map((base) => {
    const patch = input.lines.find((l) => l.itemId === base.itemId)
    const returnQty = patch?.returnQty ?? 0
    return {
      ...base,
      returnQty,
      returnValue: returnQty * base.unitCost,
      reason: patch?.reason ?? base.reason,
      condition: (patch?.condition as SalesReturnCondition | null) ?? base.condition,
      remarks: patch?.remarks ?? base.remarks,
      batchNo: patch?.batchNo ?? base.batchNo,
      serialNo: patch?.serialNo ?? base.serialNo,
    }
  })

  const errors = validateReturnLines(lines, input.returnType)
  if (errors.length) throw new InventoryServiceError(errors.join('; '), 'VALIDATION')

  const ts = new Date().toISOString()
  const returnQty = lines.reduce((s, l) => s + l.returnQty, 0)
  const returnValue = lines.reduce((s, l) => s + l.returnValue, 0)

  const doc: InventoryReturn = {
    id: genId('ret'),
    documentNumber: nextReturnNo(),
    returnDate: input.returnDate,
    returnType: input.returnType,
    sourceDocumentId: details.sourceDocumentId,
    sourceDocumentNo: details.sourceDocumentNo,
    partyOrDepartment: details.partyOrDepartment,
    warehouseId: details.warehouseId,
    warehouseName: details.warehouseName,
    status: 'draft',
    itemCount: lines.filter((l) => l.returnQty > 0).length,
    returnQty,
    returnValue,
    lines,
    auditHistory: [baseAudit('Draft created from source document')],
    createdBy: 'Demo User',
    postedBy: null,
    createdAt: ts,
    updatedAt: ts,
  }
  returns = [doc, ...returns]
  return doc
}

export async function postReturnDemo(id: string): Promise<InventoryReturn> {
  await delay()
  const idx = returns.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Return not found', 'NOT_FOUND')
  const doc = returns[idx]
  if (doc.status === 'posted') throw new InventoryServiceError('Already posted', 'DUPLICATE_POST')
  if (doc.status === 'cancelled') throw new InventoryServiceError('Cannot post cancelled return', 'INVALID_STATUS')

  const errors = validateReturnLines(doc.lines, doc.returnType)
  if (errors.length) throw new InventoryServiceError(errors.join('; '), 'VALIDATION')

  const inv = getInv()
  for (const line of doc.lines.filter((l) => l.returnQty > 0)) {
    const isInbound =
      doc.returnType === 'sales_return' ||
      doc.returnType === 'production_material_return' ||
      doc.returnType === 'transfer_return'
    if (isInbound) {
      inv.postInward({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty: line.returnQty,
        rate: line.unitCost,
        referenceNo: doc.documentNumber,
        remarks: `Return ${doc.returnType} from ${doc.sourceDocumentNo}`,
        txnDate: doc.returnDate,
      })
    } else {
      inv.postIssue({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty: line.returnQty,
        rate: line.unitCost,
        referenceNo: doc.documentNumber,
        remarks: `Return ${doc.returnType} from ${doc.sourceDocumentNo}`,
        txnDate: doc.returnDate,
      })
    }
  }

  const updated: InventoryReturn = {
    ...doc,
    status: 'posted',
    postedBy: 'Demo User',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Posted (demo) — inventory ledger updated')],
  }
  returns[idx] = updated
  return updated
}

export async function cancelReturnDemo(id: string): Promise<InventoryReturn> {
  await delay()
  const idx = returns.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Return not found', 'NOT_FOUND')
  const doc = returns[idx]
  if (doc.status === 'posted') throw new InventoryServiceError('Posted returns are read-only', 'INVALID_STATUS')
  const updated: InventoryReturn = {
    ...doc,
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Cancelled')],
  }
  returns[idx] = updated
  return updated
}

/** Seed demo Phase 3 documents */
export async function seedDemoPhase3IfEmpty() {
  ensureInitialized()
  if (transfers.length > 0) return
  const master = getMaster()
  const whs = master.warehouses.filter((w) => w.isActive)
  if (whs.length < 2) return
  const today = new Date().toISOString().slice(0, 10)
  const items = master.items.filter((i) => i.isStockable).slice(0, 2)
  if (items.length === 0) return

  await createTransferDraft({
    transferType: 'warehouse_to_warehouse',
    fromWarehouseId: whs[0].id,
    toWarehouseId: whs[1].id,
    transferDate: today,
    lines: items.map((i) => ({ itemId: i.id, transferQty: 1 })),
  })
  transfers[0].status = 'draft'

  if (whs.length >= 2) {
    await createTransferDraft({
      transferType: 'plant_to_plant',
      fromWarehouseId: whs[0].id,
      toWarehouseId: whs[whs.length > 2 ? 2 : 1].id,
      transferDate: today,
      lines: [{ itemId: items[0].id, transferQty: 2 }],
    })
    const dispatched = transfers[1]
    dispatched.status = 'dispatched'
    dispatched.lines = dispatched.lines.map((l) => ({ ...l, dispatchedQty: l.transferQty }))
    dispatched.dispatchedQty = dispatched.transferQty
  }

  await createAdjustmentDraft({
    adjustmentType: 'shortage',
    warehouseId: whs[0].id,
    adjustmentDate: today,
    reason: 'Cycle count variance — demo',
    lines: [{ itemId: items[0].id, adjustmentQty: -1 }],
  })

  await createAdjustmentDraft({
    adjustmentType: 'found_stock',
    warehouseId: whs[0].id,
    adjustmentDate: today,
    reason: 'Found stock during audit',
    lines: [{ itemId: items[items.length > 1 ? 1 : 0].id, adjustmentQty: 3 }],
  })
  if (adjustments[1]) {
    adjustments[1].status = 'pending_approval'
    adjustments[1].approvalStatus = 'pending'
    adjustments[1].approvalRequired = true
    adjustments[1].adjustmentValue = ADJUSTMENT_APPROVAL_THRESHOLD + 1000
  }
}

export function resetPhase3ServiceForTests() {
  transfers = []
  adjustments = []
  returns = []
  initialized = false
}
