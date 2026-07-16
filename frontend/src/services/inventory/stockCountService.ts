/**
 * Stock count mock service (Phase 5).
 * Demo-only — no real stock adjustment or ledger posting.
 */

import { useMasterStore } from '../../store/masterStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { getSessionUser } from '../../utils/permissions'
import type {
  StockAdjustmentPreview,
  StockCount,
  StockCountFilter,
  StockCountLine,
  StockCountLineInput,
  StockCountListRow,
  StockCountRecountInput,
  StockCountScopeInput,
} from '../../types/inventoryDomain'
import {
  buildCountLine,
  buildScope,
  buildSeedStockCounts,
  nextCountNumber,
  resetStockCountSequencesForTests,
  STOCK_COUNT_HIGH_VALUE_THRESHOLD,
  STOCK_COUNT_VARIANCE_TOLERANCE_QTY,
} from './stockCountSeed'
const delay = (ms = 100) => new Promise<void>((r) => setTimeout(r, ms))

export class StockCountServiceError extends Error {
  code: string

  constructor(message: string, code = 'STOCK_COUNT_ERROR') {
    super(message)
    this.name = 'StockCountServiceError'
    this.code = code
  }
}

let counts: StockCount[] = []
let initialized = false

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function clone<T>(v: T): T {
  return structuredClone(v)
}

function getMaster() {
  return useMasterStore.getState()
}

function getInv() {
  return useInventoryStore.getState()
}

function currentUser() {
  return getSessionUser().name
}

function pushAudit(count: StockCount, action: string, remarks: string | null = null, snapshotData?: Record<string, unknown>) {
  count.auditHistory.unshift({
    id: genId('sca'),
    action,
    userName: currentUser(),
    timestamp: new Date().toISOString(),
    remarks,
    snapshotData,
  })
}

function isReadOnly(count: StockCount): boolean {
  return count.status === 'posted' || count.status === 'cancelled'
}

function recalcSummary(count: StockCount) {
  count.itemCount = count.lines.length
  count.countedItems = count.lines.filter((l) => l.countedQty !== null).length
  const diffLines = count.lines.filter((l) => l.variance !== 0)
  count.differenceItems = diffLines.length
  count.differenceValue = diffLines.reduce((s, l) => s + l.differenceValue, 0)
  count.varianceApprovalRequired =
    Math.abs(count.differenceValue) >= STOCK_COUNT_HIGH_VALUE_THRESHOLD ||
    diffLines.some((l) => Math.abs(l.variance) > STOCK_COUNT_VARIANCE_TOLERANCE_QTY)
}

function lineVariance(line: StockCountLine): number {
  const qty = line.recountQty ?? line.countedQty
  if (qty === null) return 0
  return qty - line.snapshotSystemQty
}

function updateLineFromQty(line: StockCountLine, qty: number, reason?: string) {
  line.countedQty = qty
  line.variance = lineVariance(line)
  line.differenceValue = line.variance * line.unitCost
  if (reason !== undefined) line.reason = reason
  if (line.variance === 0) {
    line.lineStatus = 'counted'
  } else if (Math.abs(line.variance) > STOCK_COUNT_VARIANCE_TOLERANCE_QTY) {
    line.lineStatus = 'recount_required'
  } else {
    line.lineStatus = 'variance'
  }
}

function matchesFilter(count: StockCount, filter: StockCountFilter): boolean {
  if (filter.tab && filter.tab !== 'all') {
    if (count.status !== filter.tab) return false
  }
  if (filter.status && filter.status !== 'all' && count.status !== filter.status) return false
  if (filter.countType && filter.countType !== 'all' && count.scope.countType !== filter.countType) return false
  if (filter.warehouseId && count.scope.warehouseId !== filter.warehouseId) return false
  if (filter.search) {
    const q = filter.search.toLowerCase()
    const hay = `${count.countNumber} ${count.scope.warehouseName} ${count.assignedTo} ${count.scope.countType}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

function toListRow(count: StockCount): StockCountListRow {
  return {
    id: count.id,
    countNumber: count.countNumber,
    countType: count.scope.countType,
    warehouseName: count.scope.warehouseName,
    countDate: count.scope.countDate,
    itemCount: count.itemCount,
    countedItems: count.countedItems,
    differenceItems: count.differenceItems,
    differenceValue: count.differenceValue,
    assignedTo: count.assignedTo,
    status: count.status,
    blindCount: count.scope.blindCount,
  }
}

function resolveScopeItems(scope: StockCountScopeInput): Array<{
  itemId: string
  itemCode: string
  itemName: string
  batchNo: string | null
  binCode: string | null
  batchTracking: boolean
}> {
  const master = getMaster()
  const inv = getInv()
  const whId = scope.warehouseId
  let items = master.items.filter((i) => i.isStockable && i.isActive)

  if (scope.categoryId) {
    items = items.filter((i) => i.categoryId === scope.categoryId)
  }
  if (scope.itemId) {
    items = items.filter((i) => i.id === scope.itemId)
  }

  const rows: Array<{
    itemId: string
    itemCode: string
    itemName: string
    batchNo: string | null
    binCode: string | null
    batchTracking: boolean
  }> = []

  for (const item of items) {
    const onHand = inv.getOnHand(item.id, whId)
    if (onHand <= 0 && scope.countType !== 'full_physical' && scope.countType !== 'warehouse') continue

    const ext = { batchTracking: item.itemCode.includes('PAINT') || item.itemCode.includes('BOLT') }
    const batchNo = scope.batchNo ?? (ext.batchTracking ? `B-${item.itemCode}-001` : null)
    const binCode = scope.binCode ?? (scope.binLocationId ? scope.binCode ?? 'A1-01' : null)

    if (scope.batchNo && batchNo !== scope.batchNo) continue
    if (scope.binCode && binCode !== scope.binCode) continue

    rows.push({
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      batchNo,
      binCode,
      batchTracking: ext.batchTracking,
    })
  }

  if (rows.length === 0 && scope.itemId) {
    const item = master.getItem(scope.itemId)
    if (item) {
      rows.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        batchNo: scope.batchNo ?? null,
        binCode: scope.binCode ?? null,
        batchTracking: false,
      })
    }
  }

  return rows.slice(0, 50)
}

function buildLinesFromScope(scope: StockCountScopeInput): StockCountLine[] {
  const inv = getInv()
  const items = resolveScopeItems(scope)
  return items.map((item, idx) => {
    const systemQty = inv.getOnHand(item.itemId, scope.warehouseId)
    const masterItem = getMaster().getItem(item.itemId)
    const unitCost = masterItem?.standardRate ?? 0
    return buildCountLine({
      lineNo: idx + 1,
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      batchNo: item.batchNo,
      binCode: item.binCode,
      snapshotSystemQty: systemQty,
      systemQty,
      unitCost,
    })
  })
}

function ensureInitialized() {
  if (initialized) return
  counts = buildSeedStockCounts()
  initialized = true
}

export async function getStockCounts(filter: StockCountFilter = {}): Promise<StockCountListRow[]> {
  await delay()
  ensureInitialized()
  return counts.filter((c) => matchesFilter(c, filter)).map(toListRow)
}

export async function getStockCountById(id: string): Promise<StockCount | null> {
  await delay()
  ensureInitialized()
  const row = counts.find((c) => c.id === id)
  return row ? clone(row) : null
}

export async function createStockCountSnapshot(scopeInput: StockCountScopeInput): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const master = getMaster()
  const wh = master.getWarehouse(scopeInput.warehouseId)
  if (!wh) throw new StockCountServiceError('Warehouse not found', 'INVALID_WAREHOUSE')

  const category = scopeInput.categoryId ? master.getCategory(scopeInput.categoryId) : null
  const item = scopeInput.itemId ? master.getItem(scopeInput.itemId) : null
  const location = scopeInput.binLocationId ? master.getLocation(scopeInput.binLocationId) : null

  const scope = buildScope({
    countType: scopeInput.countType,
    warehouseId: scopeInput.warehouseId,
    warehouseName: wh.warehouseName,
    categoryId: scopeInput.categoryId ?? null,
    categoryName: category?.categoryName ?? null,
    itemId: scopeInput.itemId ?? null,
    itemCode: item?.itemCode ?? null,
    binLocationId: scopeInput.binLocationId ?? null,
    binCode: scopeInput.binCode ?? location?.locationCode ?? null,
    batchNo: scopeInput.batchNo ?? null,
    countDate: scopeInput.countDate,
    assignedTeam: scopeInput.assignedTeam,
    blindCount: scopeInput.blindCount,
  })

  const lines = buildLinesFromScope(scopeInput)
  if (lines.length === 0) {
    throw new StockCountServiceError('No stock lines match the count scope', 'EMPTY_SCOPE')
  }

  const now = new Date().toISOString()
  const count: StockCount = {
    id: genId('sc'),
    countNumber: nextCountNumber(),
    scope,
    status: 'counting',
    currentStep: 3,
    lines,
    itemCount: lines.length,
    countedItems: 0,
    differenceItems: 0,
    differenceValue: 0,
    assignedTo: scopeInput.assignedTeam[0] ?? currentUser(),
    snapshotAt: now,
    submittedAt: null,
    approvedAt: null,
    approvedBy: null,
    postedAt: null,
    postedBy: null,
    varianceApprovalRequired: false,
    varianceApproved: false,
    varianceRejected: false,
    adjustmentPreview: null,
    auditHistory: [],
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser(),
  }

  pushAudit(count, 'Created', `${scope.countType} count for ${wh.warehouseName}`)
  pushAudit(count, 'Snapshot Created', 'Stock snapshot created in frontend demo mode.', {
    lineCount: lines.length,
    snapshotAt: now,
    lines: lines.map((l) => ({
      itemCode: l.itemCode,
      snapshotSystemQty: l.snapshotSystemQty,
      batchNo: l.batchNo,
      binCode: l.binCode,
    })),
  })

  counts.unshift(count)
  return clone(count)
}

export async function saveStockCount(
  id: string,
  lineInputs: StockCountLineInput[],
): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  if (isReadOnly(count)) throw new StockCountServiceError('Posted counts are read-only', 'READ_ONLY')
  if (count.status !== 'counting' && count.status !== 'recount_required') {
    throw new StockCountServiceError('Count is not in an editable state', 'INVALID_STATUS')
  }

  for (const input of lineInputs) {
    const line = count.lines.find((l) => l.id === input.lineId)
    if (!line) continue
    if (line.variance !== 0 && !input.reason?.trim() && input.countedQty !== line.snapshotSystemQty) {
      // reason validated on submit; allow save without reason during entry
    }
    updateLineFromQty(line, input.countedQty, input.reason)
    line.systemQty = getInv().getOnHand(line.itemId, count.scope.warehouseId)
    line.movementAfterSnapshot = line.systemQty - line.snapshotSystemQty
  }

  recalcSummary(count)
  count.updatedAt = new Date().toISOString()
  pushAudit(count, 'Quantities Saved', `Saved ${lineInputs.length} line(s)`)
  counts[idx] = count
  return clone(count)
}

function validateLinesForSubmit(count: StockCount) {
  const pending = count.lines.filter((l) => l.countedQty === null)
  if (pending.length > 0) {
    throw new StockCountServiceError('Enter counted quantity for all lines', 'INCOMPLETE_LINES')
  }
  for (const line of count.lines) {
    if (line.variance !== 0 && !line.reason.trim()) {
      throw new StockCountServiceError(
        `Difference reason required for ${line.itemCode}`,
        'REASON_REQUIRED',
      )
    }
  }
}

export async function submitStockCount(id: string): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  if (isReadOnly(count)) throw new StockCountServiceError('Posted counts are read-only', 'READ_ONLY')

  validateLinesForSubmit(count)
  recalcSummary(count)

  const needsRecount = count.lines.some((l) => l.lineStatus === 'recount_required')
  if (needsRecount) {
    count.status = 'recount_required'
    count.currentStep = 5
    pushAudit(count, 'Recount Required', 'Variance exceeds configured tolerance')
  } else if (count.varianceApprovalRequired) {
    count.status = 'under_review'
    count.currentStep = 6
    pushAudit(count, 'Submitted for Review', 'High-value variance requires approval')
  } else {
    count.status = 'approved'
    count.currentStep = 7
    count.varianceApproved = true
    pushAudit(count, 'Auto-Approved', 'Variance within tolerance and value threshold')
  }

  count.submittedAt = new Date().toISOString()
  count.updatedAt = count.submittedAt
  counts[idx] = count
  return clone(count)
}

export async function requestRecountDemo(id: string, lineIds?: string[]): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  if (isReadOnly(count)) throw new StockCountServiceError('Posted counts are read-only', 'READ_ONLY')

  const targets = lineIds?.length
    ? count.lines.filter((l) => lineIds.includes(l.id))
    : count.lines.filter((l) => l.variance !== 0)

  for (const line of targets) {
    line.lineStatus = 'recount_required'
    line.recountQty = null
  }

  count.status = 'recount_required'
  count.currentStep = 5
  count.updatedAt = new Date().toISOString()
  pushAudit(count, 'Recount Requested', `${targets.length} line(s) marked for recount`)
  counts[idx] = count
  return clone(count)
}

export async function saveRecountDemo(
  id: string,
  recountInputs: StockCountRecountInput[],
): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  if (isReadOnly(count)) throw new StockCountServiceError('Posted counts are read-only', 'READ_ONLY')

  for (const input of recountInputs) {
    const line = count.lines.find((l) => l.id === input.lineId)
    if (!line) continue
    line.recountQty = input.recountQty
    line.countedQty = input.recountQty
    line.variance = input.recountQty - line.snapshotSystemQty
    line.differenceValue = line.variance * line.unitCost
    if (input.reason) line.reason = input.reason
    line.lineStatus = line.variance === 0 ? 'accepted' : 'variance'
  }

  recalcSummary(count)
  count.status = 'under_review'
  count.currentStep = 6
  count.updatedAt = new Date().toISOString()
  pushAudit(count, 'Recount Saved', `Recount completed for ${recountInputs.length} line(s)`)
  counts[idx] = count
  return clone(count)
}

export async function acceptCountLineDemo(id: string, lineId: string): Promise<StockCount> {
  await delay()
  const count = await internalAcceptLines(id, [lineId])
  return count
}

async function internalAcceptLines(id: string, lineIds: string[]): Promise<StockCount> {
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  if (isReadOnly(count)) throw new StockCountServiceError('Posted counts are read-only', 'READ_ONLY')

  for (const lineId of lineIds) {
    const line = count.lines.find((l) => l.id === lineId)
    if (line) line.lineStatus = 'accepted'
  }

  count.updatedAt = new Date().toISOString()
  pushAudit(count, 'Count Accepted', `${lineIds.length} line(s) accepted`)
  counts[idx] = count
  return clone(count)
}

export async function approveStockVarianceDemo(id: string): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  if (isReadOnly(count)) throw new StockCountServiceError('Posted counts are read-only', 'READ_ONLY')
  if (count.varianceRejected) {
    throw new StockCountServiceError('Variance was rejected — cannot approve', 'REJECTED')
  }

  count.status = 'approved'
  count.currentStep = 7
  count.varianceApproved = true
  count.approvedAt = new Date().toISOString()
  count.approvedBy = currentUser()
  count.updatedAt = count.approvedAt

  for (const line of count.lines) {
    if (line.variance !== 0) line.lineStatus = 'accepted'
  }

  pushAudit(count, 'Variance Approved', 'Supervisor approved stock count variance')
  counts[idx] = count
  return clone(count)
}

export async function rejectStockVarianceDemo(id: string, reason: string): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  if (isReadOnly(count)) throw new StockCountServiceError('Posted counts are read-only', 'READ_ONLY')

  count.varianceRejected = true
  count.varianceApproved = false
  count.status = 'cancelled'
  count.currentStep = 6
  count.updatedAt = new Date().toISOString()

  for (const line of count.lines) {
    if (line.variance !== 0) line.lineStatus = 'rejected'
  }

  pushAudit(count, 'Variance Rejected', reason || 'Variance rejected by supervisor')
  counts[idx] = count
  return clone(count)
}

export async function getStockAdjustmentPreview(id: string): Promise<StockAdjustmentPreview> {
  await delay()
  ensureInitialized()
  const count = counts.find((c) => c.id === id)
  if (!count) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  if (!count.varianceApproved && count.status !== 'approved' && count.status !== 'posted') {
    throw new StockCountServiceError('Variance must be approved before adjustment preview', 'NOT_APPROVED')
  }

  const diffLines = count.lines.filter((l) => l.variance !== 0)
  const previewLines = diffLines.map((l) => {
    const isPositive = l.variance > 0
    return {
      itemCode: l.itemCode,
      itemName: l.itemName,
      batchNo: l.batchNo,
      binCode: l.binCode,
      adjustmentQty: l.variance,
      unitCost: l.unitCost,
      adjustmentValue: l.differenceValue,
      debitAccount: isPositive ? '1100 — Inventory' : '5200 — Stock Variance',
      creditAccount: isPositive ? '5200 — Stock Variance' : '1100 — Inventory',
    }
  })

  const preview: StockAdjustmentPreview = {
    countId: count.id,
    countNumber: count.countNumber,
    lines: previewLines,
    totalQtyImpact: diffLines.reduce((s, l) => s + l.variance, 0),
    totalValueImpact: diffLines.reduce((s, l) => s + l.differenceValue, 0),
    narration: `Demo adjustment for ${count.countNumber} — ${diffLines.length} line(s) with variance`,
    demoOnly: true,
  }

  count.adjustmentPreview = preview
  count.currentStep = 7
  count.updatedAt = new Date().toISOString()
  pushAudit(count, 'Adjustment Preview Created', preview.narration)
  return clone(preview)
}

export async function postStockCountAdjustmentDemo(id: string): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  if (count.status === 'posted') throw new StockCountServiceError('Already posted', 'ALREADY_POSTED')
  if (!count.varianceApproved && count.differenceItems > 0) {
    throw new StockCountServiceError('Variance approval required before posting', 'NOT_APPROVED')
  }
  if (!count.adjustmentPreview && count.differenceItems > 0) {
    await getStockAdjustmentPreview(id)
  }

  // Demo-only: optionally update inventory store for visible feedback but mark as demo
  const inv = getInv()
  for (const line of count.lines) {
    if (line.variance === 0) continue
    const isPositive = line.variance > 0
    inv.postAdjustment({
      itemId: line.itemId,
      warehouseId: count.scope.warehouseId,
      qty: Math.abs(line.variance),
      isPositive,
      referenceNo: count.countNumber,
      remarks: `[Demo SC] ${line.reason || 'Stock count adjustment'}`,
    })
  }

  count.status = 'posted'
  count.currentStep = 8
  count.postedAt = new Date().toISOString()
  count.postedBy = currentUser()
  count.updatedAt = count.postedAt
  pushAudit(count, 'Posted Demo', 'Demo posting complete — no real ledger adjustment')
  counts[idx] = count
  return clone(count)
}

export async function revealSystemQuantityDemo(
  id: string,
  lineId: string,
  reason: string,
): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  const line = count.lines.find((l) => l.id === lineId)
  if (!line) throw new StockCountServiceError('Line not found', 'LINE_NOT_FOUND')
  if (!reason.trim()) throw new StockCountServiceError('Reveal reason is required', 'REASON_REQUIRED')

  line.systemQtyRevealed = true
  line.revealReason = reason
  count.updatedAt = new Date().toISOString()
  pushAudit(count, 'System Qty Revealed', `${line.itemCode}: ${reason}`)
  counts[idx] = count
  return clone(count)
}

export async function createDraftStockCount(scopeInput: StockCountScopeInput): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const master = getMaster()
  const wh = master.getWarehouse(scopeInput.warehouseId)
  if (!wh) throw new StockCountServiceError('Warehouse not found', 'INVALID_WAREHOUSE')

  const category = scopeInput.categoryId ? master.getCategory(scopeInput.categoryId) : null
  const item = scopeInput.itemId ? master.getItem(scopeInput.itemId) : null

  const scope = buildScope({
    countType: scopeInput.countType,
    warehouseId: scopeInput.warehouseId,
    warehouseName: wh.warehouseName,
    categoryId: scopeInput.categoryId ?? null,
    categoryName: category?.categoryName ?? null,
    itemId: scopeInput.itemId ?? null,
    itemCode: item?.itemCode ?? null,
    binLocationId: scopeInput.binLocationId ?? null,
    binCode: scopeInput.binCode ?? null,
    batchNo: scopeInput.batchNo ?? null,
    countDate: scopeInput.countDate,
    assignedTeam: scopeInput.assignedTeam,
    blindCount: scopeInput.blindCount,
  })

  const now = new Date().toISOString()
  const count: StockCount = {
    id: genId('sc'),
    countNumber: nextCountNumber(),
    scope,
    status: 'draft',
    currentStep: 1,
    lines: [],
    itemCount: 0,
    countedItems: 0,
    differenceItems: 0,
    differenceValue: 0,
    assignedTo: scopeInput.assignedTeam[0] ?? currentUser(),
    snapshotAt: null,
    submittedAt: null,
    approvedAt: null,
    approvedBy: null,
    postedAt: null,
    postedBy: null,
    varianceApprovalRequired: false,
    varianceApproved: false,
    varianceRejected: false,
    adjustmentPreview: null,
    auditHistory: [],
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser(),
  }
  pushAudit(count, 'Draft Created', `${scope.countType} count draft`)
  counts.unshift(count)
  return clone(count)
}

/** Refresh system qty from live inventory (supervisor view) */
export async function refreshSystemQuantities(id: string): Promise<StockCount> {
  await delay()
  ensureInitialized()
  const idx = counts.findIndex((c) => c.id === id)
  if (idx < 0) throw new StockCountServiceError('Stock count not found', 'NOT_FOUND')
  const count = counts[idx]
  const inv = getInv()
  for (const line of count.lines) {
    line.systemQty = inv.getOnHand(line.itemId, count.scope.warehouseId)
    line.movementAfterSnapshot = line.snapshotSystemQty !== null
      ? line.systemQty - line.snapshotSystemQty
      : 0
  }
  counts[idx] = count
  return clone(count)
}

export function resetStockCountServiceForTests() {
  counts = []
  initialized = false
  resetStockCountSequencesForTests()
}

export { STOCK_COUNT_VARIANCE_TOLERANCE_QTY, STOCK_COUNT_HIGH_VALUE_THRESHOLD }
