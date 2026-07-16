/**
 * Inventory movement mock service (Phase 2 — receipts & issues).
 * Promise-based; updates inventoryStore ledger on demo posting.
 */

import { useMasterStore } from '../../store/masterStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { getPurchaseOrders } from '../purchase'
import type {
  BatchSelectionMethod,
  BatchSelectionPreviewLine,
  InventoryIssue,
  InventoryIssueListRow,
  InventoryReceipt,
  InventoryReceiptListRow,
  IssueDraftInput,
  MovementLine,
  MovementSourceDetails,
  MovementSourceDocument,
  QualityDisposition,
  ReceiptDraftInput,
  ReceiptSourceType,
  IssueSourceType,
} from '../../types/inventoryDomain'
import {
  baseAudit,
  buildMovementLine,
  nextIssueNo,
  nextReceiptNo,
  resetMovementSequencesForTests,
} from './movementSeed'
import { getItemById } from './inventoryService'
import { InventoryServiceError } from './inventoryService'

const delay = (ms = 100) => new Promise<void>((r) => setTimeout(r, ms))

let receipts: InventoryReceipt[] = []
let issues: InventoryIssue[] = []
let initialized = false
const postedReceiptIds = new Set<string>()
const postedIssueIds = new Set<string>()

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function getMaster() {
  return useMasterStore.getState()
}

function getInv() {
  return useInventoryStore.getState()
}

function getWo() {
  return useWorkOrderStore.getState()
}

function resolveWoWarehouseId(woId: string): string {
  const master = getMaster()
  const wo = getWo().getWorkOrder(woId)
  if (!wo) return master.warehouses.find((w) => w.isActive)?.id ?? ''
  const matWh = getWo().getWoMaterials(woId)[0]?.warehouseId
  if (matWh) return matWh
  const fgWh = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD' && w.isActive)
  return fgWh?.id ?? master.warehouses.find((w) => w.isActive)?.id ?? ''
}

function whMeta(warehouseId: string) {
  const wh = getMaster().getWarehouse(warehouseId)
  return {
    warehouseId,
    warehouseName: wh?.warehouseName ?? '—',
    plantCode: wh?.plantCode ?? '—',
  }
}

function buildCostPreview(lines: MovementLine[]): InventoryReceipt['costPreview'] {
  const rows = lines
    .filter((l) => (l.receivedQty || l.issuedQty) > 0)
    .map((l) => ({
      itemCode: l.itemCode,
      qty: l.receivedQty || l.issuedQty,
      rate: l.rate,
      amount: (l.receivedQty || l.issuedQty) * l.rate,
    }))
  const subtotal = rows.reduce((s, r) => s + r.amount, 0)
  const gstAmount = subtotal * 0.18
  return { lines: rows, subtotal, gstAmount, total: subtotal + gstAmount }
}

function buildAccountingPreview(total: number, type: 'receipt' | 'issue'): InventoryReceipt['accountingPreview'] {
  if (type === 'receipt') {
    return {
      debitAccount: '1100 — Inventory',
      creditAccount: '2100 — GR/IR Clearing',
      amount: total,
      narration: 'Demo receipt posting — inventory debit / GRIR credit',
    }
  }
  return {
    debitAccount: '5100 — Material Consumption',
    creditAccount: '1100 — Inventory',
    amount: total,
    narration: 'Demo issue posting — consumption debit / inventory credit',
  }
}

function ensureInitialized() {
  if (initialized) return
  initialized = true
}

function toReceiptListRow(r: InventoryReceipt): InventoryReceiptListRow {
  return {
    id: r.id,
    documentNumber: r.documentNumber,
    documentDate: r.documentDate,
    sourceType: r.sourceType,
    sourceDocumentNo: r.sourceDocumentNo,
    warehouseName: r.warehouseName,
    status: r.status,
    lineCount: r.lines.length,
    totalReceivedQty: r.lines.reduce((s, l) => s + l.receivedQty, 0),
    vendorName: r.vendorName,
    createdBy: r.createdBy,
  }
}

function toIssueListRow(r: InventoryIssue): InventoryIssueListRow {
  return {
    id: r.id,
    documentNumber: r.documentNumber,
    documentDate: r.documentDate,
    sourceType: r.sourceType,
    sourceDocumentNo: r.sourceDocumentNo,
    warehouseName: r.warehouseName,
    status: r.status,
    lineCount: r.lines.length,
    totalIssuedQty: r.lines.reduce((s, l) => s + l.issuedQty, 0),
    department: r.department,
    createdBy: r.createdBy,
  }
}

async function buildLineFromItem(
  itemId: string,
  warehouseId: string,
  pendingQty: number,
  lineNo: number,
): Promise<MovementLine | null> {
  const item = await getItemById(itemId)
  if (!item) return null
  const free = getInv().getFreeQty(itemId, warehouseId)
  return buildMovementLine({
    lineNo,
    itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    uomCode: item.baseUomCode,
    warehouseId,
    pendingQty,
    receivedQty: 0,
    issuedQty: 0,
    availableQty: free,
    rate: item.standardCost,
    batchTracking: item.batchTracking,
    serialTracking: item.serialTracking,
    expiryTracking: item.expiryTracking,
    batchNo: item.batchTracking ? `B-${item.itemCode}-001` : null,
    expiryDate: item.expiryTracking ? '2027-06-30' : null,
  })
}

/* ── Source documents ── */

export async function getReceiptSourceDocuments(sourceType: ReceiptSourceType): Promise<MovementSourceDocument[]> {
  await delay()
  ensureInitialized()
  const master = getMaster()
  const docs: MovementSourceDocument[] = []

  if (sourceType === 'purchase_order') {
    const pos = await getPurchaseOrders()
    for (const po of pos.filter((p) => ['released', 'partially_received', 'approved'].includes(p.status))) {
      const pendingLines = po.lines.filter((l) => l.pendingQty > 0)
      if (pendingLines.length === 0) continue
      const whId = pendingLines[0]?.warehouseId ?? master.warehouses[0]?.id ?? ''
      const wh = whMeta(whId)
      docs.push({
        id: po.id,
        documentNo: po.documentNumber,
        documentDate: po.documentDate,
        sourceType,
        partyName: po.vendor.name,
        warehouseId: wh.warehouseId,
        warehouseName: wh.warehouseName,
        pendingLineCount: pendingLines.length,
        pendingQty: pendingLines.reduce((s, l) => s + l.pendingQty, 0),
        isOpen: true,
      })
    }
  }

  if (sourceType === 'production_output') {
    for (const wo of getWo().workOrders.filter((w) => ['in_production', 'released', 'fully_issued'].includes(w.status))) {
      const whId = resolveWoWarehouseId(wo.id)
      const wh = whMeta(whId)
      docs.push({
        id: wo.id,
        documentNo: wo.woNo,
        documentDate: wo.plannedStartDate,
        sourceType,
        partyName: wo.outputItemCode,
        warehouseId: wh.warehouseId,
        warehouseName: wh.warehouseName,
        pendingLineCount: 1,
        pendingQty: wo.qty,
        isOpen: !['completed', 'closed', 'cancelled'].includes(wo.status),
      })
    }
  }

  if (sourceType === 'direct_receipt') {
    docs.push({
      id: 'direct',
      documentNo: 'Direct Receipt',
      documentDate: new Date().toISOString().slice(0, 10),
      sourceType,
      partyName: null,
      warehouseId: master.warehouses[0]?.id ?? '',
      warehouseName: master.warehouses[0]?.warehouseName ?? '—',
      pendingLineCount: 0,
      pendingQty: 0,
      isOpen: true,
    })
  }

  return docs.sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getIssueSourceDocuments(sourceType: IssueSourceType): Promise<MovementSourceDocument[]> {
  await delay()
  ensureInitialized()
  const master = getMaster()
  const docs: MovementSourceDocument[] = []

  if (sourceType === 'production_order') {
    for (const wo of getWo().workOrders.filter((w) => ['released', 'material_reserved', 'partially_issued', 'in_production'].includes(w.status))) {
      const mats = getWo().getWoMaterials(wo.id).filter((m) => m.balanceQty > 0)
      if (mats.length === 0) continue
      const whId = mats[0]?.warehouseId ?? master.warehouses[0]?.id ?? ''
      const wh = whMeta(whId)
      docs.push({
        id: wo.id,
        documentNo: wo.woNo,
        documentDate: wo.plannedStartDate,
        sourceType,
        partyName: wo.outputItemCode,
        warehouseId: wh.warehouseId,
        warehouseName: wh.warehouseName,
        pendingLineCount: mats.length,
        pendingQty: mats.reduce((s, m) => s + m.balanceQty, 0),
        isOpen: true,
      })
    }
  }

  if (sourceType === 'direct_issue') {
    docs.push({
      id: 'direct',
      documentNo: 'Direct Issue',
      documentDate: new Date().toISOString().slice(0, 10),
      sourceType,
      partyName: null,
      warehouseId: master.warehouses[0]?.id ?? '',
      warehouseName: master.warehouses[0]?.warehouseName ?? '—',
      pendingLineCount: 0,
      pendingQty: 0,
      isOpen: true,
    })
  }

  return docs.sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getReceiptSourceDetails(
  sourceType: ReceiptSourceType,
  sourceDocumentId: string,
): Promise<MovementSourceDetails | null> {
  await delay()
  ensureInitialized()

  if (sourceType === 'purchase_order') {
    const pos = await getPurchaseOrders()
    const po = pos.find((p) => p.id === sourceDocumentId)
    if (!po) return null
    const lines: MovementLine[] = []
    let lineNo = 1
    for (const pl of po.lines.filter((l) => l.pendingQty > 0)) {
      const line = await buildLineFromItem(pl.itemId, pl.warehouseId, pl.pendingQty, lineNo++)
      if (line) {
        line.rate = pl.rate
        lines.push(line)
      }
    }
    const whId = lines[0]?.warehouseId ?? po.lines[0]?.warehouseId ?? ''
    const wh = whMeta(whId)
    return {
      sourceDocumentId: po.id,
      sourceDocumentNo: po.documentNumber,
      sourceType,
      warehouseId: wh.warehouseId,
      warehouseName: wh.warehouseName,
      plantCode: wh.plantCode,
      partyName: po.vendor.name,
      lines,
    }
  }

  if (sourceType === 'production_output') {
    const wo = getWo().getWorkOrder(sourceDocumentId)
    if (!wo) return null
    const whId = resolveWoWarehouseId(wo.id)
    const wh = whMeta(whId)
    const pending = wo.qty
    const line = await buildLineFromItem(wo.outputItemId, whId, pending, 1)
    if (!line) return null
    return {
      sourceDocumentId: wo.id,
      sourceDocumentNo: wo.woNo,
      sourceType,
      warehouseId: wh.warehouseId,
      warehouseName: wh.warehouseName,
      plantCode: wh.plantCode,
      partyName: wo.outputItemCode,
      lines: [line],
    }
  }

  if (sourceType === 'direct_receipt') {
    const master = getMaster()
    const wh = master.warehouses.find((w) => w.isActive)
    if (!wh) return null
    const stockable = master.items.filter((i) => i.isStockable).slice(0, 5)
    const lines: MovementLine[] = []
    let lineNo = 1
    for (const item of stockable) {
      const line = await buildLineFromItem(item.id, wh.id, 0, lineNo++)
      if (line) lines.push(line)
    }
    return {
      sourceDocumentId: 'direct',
      sourceDocumentNo: 'Direct Receipt',
      sourceType,
      warehouseId: wh.id,
      warehouseName: wh.warehouseName,
      plantCode: wh.plantCode,
      partyName: null,
      lines,
    }
  }

  return null
}

export async function getIssueSourceDetails(
  sourceType: IssueSourceType,
  sourceDocumentId: string,
): Promise<MovementSourceDetails | null> {
  await delay()
  ensureInitialized()

  if (sourceType === 'production_order') {
    const wo = getWo().getWorkOrder(sourceDocumentId)
    if (!wo) return null
    const mats = getWo().getWoMaterials(wo.id).filter((m) => m.balanceQty > 0)
    const lines: MovementLine[] = []
    let lineNo = 1
    for (const m of mats) {
      const line = await buildLineFromItem(m.itemId, m.warehouseId, m.balanceQty, lineNo++)
      if (line) {
        line.pendingQty = m.balanceQty
        line.issuedQty = 0
        lines.push(line)
      }
    }
    const whId = lines[0]?.warehouseId ?? resolveWoWarehouseId(wo.id)
    const wh = whMeta(whId)
    return {
      sourceDocumentId: wo.id,
      sourceDocumentNo: wo.woNo,
      sourceType,
      warehouseId: wh.warehouseId,
      warehouseName: wh.warehouseName,
      plantCode: wh.plantCode,
      partyName: wo.outputItemCode,
      lines,
    }
  }

  if (sourceType === 'direct_issue') {
    const master = getMaster()
    const wh = master.warehouses.find((w) => w.isActive)
    if (!wh) return null
    const stockable = master.items.filter((i) => i.isStockable && getInv().getOnHand(i.id, wh.id) > 0).slice(0, 5)
    const lines: MovementLine[] = []
    let lineNo = 1
    for (const item of stockable) {
      const line = await buildLineFromItem(item.id, wh.id, 0, lineNo++)
      if (line) lines.push(line)
    }
    return {
      sourceDocumentId: 'direct',
      sourceDocumentNo: 'Direct Issue',
      sourceType,
      warehouseId: wh.id,
      warehouseName: wh.warehouseName,
      plantCode: wh.plantCode,
      partyName: null,
      lines,
    }
  }

  return null
}

/* ── Validation ── */

export function validateReceiptLines(
  lines: MovementLine[],
  opts?: { tolerancePct?: number; allowOverReceipt?: boolean },
): string[] {
  const errors: string[] = []
  for (const line of lines) {
    if (line.receivedQty <= 0) continue
    const maxAllowed = opts?.allowOverReceipt
      ? line.pendingQty * (1 + (opts.tolerancePct ?? 0) / 100)
      : line.pendingQty
    if (line.pendingQty > 0 && line.receivedQty > maxAllowed) {
      errors.push(`${line.itemCode}: received qty ${line.receivedQty} exceeds pending ${line.pendingQty}`)
    }
    if (line.acceptedQty + line.rejectedQty + line.quarantineQty > line.receivedQty) {
      errors.push(`${line.itemCode}: accepted+rejected+quarantine exceeds received`)
    }
    if (line.batchTracking && !line.batchNo && line.receivedQty > 0) {
      errors.push(`${line.itemCode}: batch number required`)
    }
    if (line.serialTracking && !line.serialNo && line.receivedQty > 0) {
      errors.push(`${line.itemCode}: serial number required`)
    }
    if (line.expiryTracking && !line.expiryDate && line.receivedQty > 0) {
      errors.push(`${line.itemCode}: expiry date required`)
    }
  }
  const hasQty = lines.some((l) => l.receivedQty > 0)
  if (!hasQty) errors.push('At least one line must have received quantity > 0')
  return errors
}

export function validateIssueLines(
  lines: MovementLine[],
  opts?: { allowNegativeStock?: boolean },
): string[] {
  const errors: string[] = []
  const blocked: QualityDisposition[] = ['quality_hold', 'quarantine', 'blocked', 'rejected']
  for (const line of lines) {
    if (line.issuedQty <= 0) continue
    if (blocked.includes(line.qualityStatus)) {
      errors.push(`${line.itemCode}: cannot issue — stock status is ${line.qualityStatus}`)
    }
    const free = getInv().getFreeQty(line.itemId, line.warehouseId)
    if (!opts?.allowNegativeStock && line.issuedQty > free) {
      errors.push(`${line.itemCode}: insufficient available stock (free: ${free})`)
    }
    if (line.batchTracking && !line.batchNo && line.issuedQty > 0) {
      errors.push(`${line.itemCode}: batch selection required`)
    }
  }
  const hasQty = lines.some((l) => l.issuedQty > 0)
  if (!hasQty) errors.push('At least one line must have issue quantity > 0')
  return errors
}

/* ── CRUD receipts ── */

export async function getReceipts(filter?: { status?: string; search?: string }): Promise<InventoryReceiptListRow[]> {
  await delay()
  ensureInitialized()
  let list = receipts.map(toReceiptListRow)
  if (filter?.status) list = list.filter((r) => r.status === filter.status)
  if (filter?.search) {
    const q = filter.search.toLowerCase()
    list = list.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        (r.sourceDocumentNo ?? '').toLowerCase().includes(q) ||
        (r.vendorName ?? '').toLowerCase().includes(q),
    )
  }
  return list.sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getReceiptById(id: string): Promise<InventoryReceipt | null> {
  await delay()
  return receipts.find((r) => r.id === id) ?? null
}

export async function createReceiptDraft(input: ReceiptDraftInput): Promise<InventoryReceipt> {
  await delay()
  ensureInitialized()
  const wh = whMeta(input.warehouseId)
  const ts = new Date().toISOString()
  const lines: MovementLine[] = []
  let lineNo = 1
  for (const dl of input.lines) {
    const item = await getItemById(dl.itemId)
    if (!item) continue
    lines.push(
      buildMovementLine({
        lineNo: lineNo++,
        itemId: dl.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uomCode: item.baseUomCode,
        warehouseId: input.warehouseId,
        pendingQty: dl.pendingQty ?? 0,
        receivedQty: dl.receivedQty ?? 0,
        acceptedQty: dl.acceptedQty ?? dl.receivedQty ?? 0,
        rejectedQty: dl.rejectedQty ?? 0,
        quarantineQty: dl.quarantineQty ?? 0,
        rate: dl.rate ?? item.standardCost,
        batchNo: dl.batchNo ?? null,
        serialNo: dl.serialNo ?? null,
        expiryDate: dl.expiryDate ?? null,
        batchTracking: item.batchTracking,
        serialTracking: item.serialTracking,
        expiryTracking: item.expiryTracking,
        qualityStatus: dl.qualityStatus ?? 'available',
        remarks: dl.remarks ?? '',
      }),
    )
  }

  let sourceDocumentNo: string | null = null
  let vendorName: string | null = null
  if (input.sourceDocumentId && input.sourceType === 'purchase_order') {
    const pos = await getPurchaseOrders()
    const po = pos.find((p) => p.id === input.sourceDocumentId)
    sourceDocumentNo = po?.documentNumber ?? null
    vendorName = po?.vendor.name ?? null
  } else if (input.sourceDocumentId && input.sourceType === 'production_output') {
    const wo = getWo().getWorkOrder(input.sourceDocumentId)
    sourceDocumentNo = wo?.woNo ?? null
  }

  const receipt: InventoryReceipt = {
    id: genId('ir'),
    documentNumber: nextReceiptNo(),
    movementType: 'receipt',
    documentDate: input.documentDate,
    postingDate: input.postingDate,
    sourceType: input.sourceType,
    sourceDocumentId: input.sourceDocumentId,
    sourceDocumentNo,
    warehouseId: wh.warehouseId,
    warehouseName: wh.warehouseName,
    plantCode: wh.plantCode,
    status: 'draft',
    createdBy: 'Demo User',
    approvedBy: null,
    postedBy: null,
    createdAt: ts,
    updatedAt: ts,
    vendorName,
    gateEntryNo: null,
    vehicleNo: null,
    lrNo: null,
    lines,
    mode: input.mode ?? 'quick',
    costPreview: buildCostPreview(lines),
    accountingPreview: null,
    attachments: [],
    auditHistory: [baseAudit('Draft created')],
  }
  receipts = [receipt, ...receipts]
  return receipt
}

export async function updateReceiptDraft(id: string, patch: Partial<ReceiptDraftInput>): Promise<InventoryReceipt> {
  await delay()
  const idx = receipts.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Receipt not found', 'NOT_FOUND')
  const existing = receipts[idx]
  if (!['draft', 'pending_receipt', 'partially_received', 'quality_hold'].includes(existing.status)) {
    throw new InventoryServiceError('Receipt cannot be edited in current status', 'INVALID_STATUS')
  }

  const whId = patch.warehouseId ?? existing.warehouseId
  const wh = whMeta(whId)
  let lines = existing.lines
  if (patch.lines) {
    lines = []
    let lineNo = 1
    for (const dl of patch.lines) {
      const item = await getItemById(dl.itemId)
      if (!item) continue
      lines.push(
        buildMovementLine({
          ...existing.lines.find((l) => l.itemId === dl.itemId),
          lineNo: lineNo++,
          itemId: dl.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          uomCode: item.baseUomCode,
          warehouseId: whId,
          pendingQty: dl.pendingQty ?? existing.lines.find((l) => l.itemId === dl.itemId)?.pendingQty ?? 0,
          receivedQty: dl.receivedQty ?? 0,
          acceptedQty: dl.acceptedQty ?? dl.receivedQty ?? 0,
          rejectedQty: dl.rejectedQty ?? 0,
          quarantineQty: dl.quarantineQty ?? 0,
          rate: dl.rate ?? item.standardCost,
          batchNo: dl.batchNo ?? null,
          serialNo: dl.serialNo ?? null,
          expiryDate: dl.expiryDate ?? null,
          batchTracking: item.batchTracking,
          serialTracking: item.serialTracking,
          expiryTracking: item.expiryTracking,
        }),
      )
    }
  }

  const updated: InventoryReceipt = {
    ...existing,
    documentDate: patch.documentDate ?? existing.documentDate,
    postingDate: patch.postingDate ?? existing.postingDate,
    warehouseId: wh.warehouseId,
    warehouseName: wh.warehouseName,
    plantCode: wh.plantCode,
    lines,
    mode: patch.mode ?? existing.mode,
    costPreview: buildCostPreview(lines),
    updatedAt: new Date().toISOString(),
    auditHistory: [...existing.auditHistory, baseAudit('Draft updated')],
  }
  receipts[idx] = updated
  return updated
}

export async function postReceiptDemo(id: string): Promise<InventoryReceipt> {
  await delay()
  const idx = receipts.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Receipt not found', 'NOT_FOUND')
  const doc = receipts[idx]
  if (doc.status === 'posted') throw new InventoryServiceError('Already posted', 'DUPLICATE_POST')
  if (doc.status === 'cancelled') throw new InventoryServiceError('Cannot post cancelled receipt', 'INVALID_STATUS')

  const errors = validateReceiptLines(doc.lines)
  if (errors.length) throw new InventoryServiceError(errors.join('; '), 'VALIDATION')

  const inv = getInv()
  for (const line of doc.lines.filter((l) => l.receivedQty > 0)) {
    const qty = line.acceptedQty || line.receivedQty
    const result = inv.postGrnReceipt({
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      qty,
      rate: line.rate,
      referenceNo: doc.documentNumber,
      remarks: `Receipt ${doc.documentNumber} from ${doc.sourceDocumentNo ?? doc.sourceType}`,
      txnDate: doc.postingDate,
    })
    if (!result.ok) throw new InventoryServiceError(result.error ?? 'Posting failed', 'POST_FAILED')
  }

  postedReceiptIds.add(id)
  const total = doc.costPreview?.total ?? 0
  const updated: InventoryReceipt = {
    ...doc,
    status: 'posted',
    postedBy: 'Demo User',
    accountingPreview: buildAccountingPreview(total, 'receipt'),
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Posted (demo) — inventory ledger updated')],
  }
  receipts[idx] = updated
  return updated
}

export async function cancelReceiptDemo(id: string): Promise<InventoryReceipt> {
  await delay()
  const idx = receipts.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Receipt not found', 'NOT_FOUND')
  const doc = receipts[idx]
  if (doc.status === 'posted') throw new InventoryServiceError('Posted receipts cannot be cancelled in demo', 'INVALID_STATUS')
  const updated: InventoryReceipt = {
    ...doc,
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Cancelled')],
  }
  receipts[idx] = updated
  return updated
}

/* ── CRUD issues ── */

export async function getIssues(filter?: { status?: string; search?: string }): Promise<InventoryIssueListRow[]> {
  await delay()
  ensureInitialized()
  let list = issues.map(toIssueListRow)
  if (filter?.status) list = list.filter((r) => r.status === filter.status)
  if (filter?.search) {
    const q = filter.search.toLowerCase()
    list = list.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        (r.sourceDocumentNo ?? '').toLowerCase().includes(q),
    )
  }
  return list.sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getIssueById(id: string): Promise<InventoryIssue | null> {
  await delay()
  return issues.find((r) => r.id === id) ?? null
}

export async function createIssueDraft(input: IssueDraftInput): Promise<InventoryIssue> {
  await delay()
  ensureInitialized()
  const wh = whMeta(input.warehouseId)
  const ts = new Date().toISOString()
  const lines: MovementLine[] = []
  let lineNo = 1
  for (const dl of input.lines) {
    const item = await getItemById(dl.itemId)
    if (!item) continue
    const free = getInv().getFreeQty(dl.itemId, input.warehouseId)
    lines.push(
      buildMovementLine({
        lineNo: lineNo++,
        itemId: dl.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uomCode: item.baseUomCode,
        warehouseId: input.warehouseId,
        pendingQty: dl.pendingQty ?? 0,
        issuedQty: dl.issuedQty ?? 0,
        availableQty: free,
        rate: dl.rate ?? item.standardCost,
        batchNo: dl.batchNo ?? null,
        batchTracking: item.batchTracking,
        serialTracking: item.serialTracking,
        expiryTracking: item.expiryTracking,
        qualityStatus: 'available',
        remarks: dl.remarks ?? '',
      }),
    )
  }

  let sourceDocumentNo: string | null = null
  if (input.sourceDocumentId && input.sourceType === 'production_order') {
    const wo = getWo().getWorkOrder(input.sourceDocumentId)
    sourceDocumentNo = wo?.woNo ?? null
  }

  const issue: InventoryIssue = {
    id: genId('is'),
    documentNumber: nextIssueNo(),
    movementType: 'issue',
    documentDate: input.documentDate,
    postingDate: input.postingDate,
    sourceType: input.sourceType,
    sourceDocumentId: input.sourceDocumentId,
    sourceDocumentNo,
    warehouseId: wh.warehouseId,
    warehouseName: wh.warehouseName,
    plantCode: wh.plantCode,
    status: 'draft',
    createdBy: 'Demo User',
    approvedBy: null,
    postedBy: null,
    createdAt: ts,
    updatedAt: ts,
    department: null,
    costCentre: null,
    batchMethod: input.batchMethod ?? 'fefo',
    lines,
    mode: input.mode ?? 'quick',
    costPreview: buildCostPreview(lines),
    accountingPreview: null,
    attachments: [],
    auditHistory: [baseAudit('Draft created')],
  }
  issues = [issue, ...issues]
  return issue
}

export async function updateIssueDraft(id: string, patch: Partial<IssueDraftInput>): Promise<InventoryIssue> {
  await delay()
  const idx = issues.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Issue not found', 'NOT_FOUND')
  const existing = issues[idx]
  if (!['draft', 'pending_issue', 'partially_issued'].includes(existing.status)) {
    throw new InventoryServiceError('Issue cannot be edited in current status', 'INVALID_STATUS')
  }

  const whId = patch.warehouseId ?? existing.warehouseId
  const wh = whMeta(whId)
  let lines = existing.lines
  if (patch.lines) {
    lines = []
    let lineNo = 1
    for (const dl of patch.lines) {
      const item = await getItemById(dl.itemId)
      if (!item) continue
      lines.push(
        buildMovementLine({
          ...existing.lines.find((l) => l.itemId === dl.itemId),
          lineNo: lineNo++,
          itemId: dl.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          uomCode: item.baseUomCode,
          warehouseId: whId,
          pendingQty: dl.pendingQty ?? 0,
          issuedQty: dl.issuedQty ?? 0,
          availableQty: getInv().getFreeQty(dl.itemId, whId),
          rate: dl.rate ?? item.standardCost,
          batchNo: dl.batchNo ?? null,
          batchTracking: item.batchTracking,
          serialTracking: item.serialTracking,
          expiryTracking: item.expiryTracking,
        }),
      )
    }
  }

  const updated: InventoryIssue = {
    ...existing,
    documentDate: patch.documentDate ?? existing.documentDate,
    postingDate: patch.postingDate ?? existing.postingDate,
    batchMethod: patch.batchMethod ?? existing.batchMethod,
    warehouseId: wh.warehouseId,
    warehouseName: wh.warehouseName,
    plantCode: wh.plantCode,
    lines,
    costPreview: buildCostPreview(lines),
    updatedAt: new Date().toISOString(),
    auditHistory: [...existing.auditHistory, baseAudit('Draft updated')],
  }
  issues[idx] = updated
  return updated
}

export async function getBatchSelectionPreview(
  itemId: string,
  warehouseId: string,
  qty: number,
  method: BatchSelectionMethod = 'fefo',
): Promise<BatchSelectionPreviewLine[]> {
  const { getAvailableBatches } = await import('./traceabilityService')
  return getAvailableBatches(itemId, warehouseId, qty, method)
}

export async function postIssueDemo(id: string, opts?: { allowNegativeStock?: boolean }): Promise<InventoryIssue> {
  await delay()
  const idx = issues.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Issue not found', 'NOT_FOUND')
  const doc = issues[idx]
  if (doc.status === 'posted') throw new InventoryServiceError('Already posted', 'DUPLICATE_POST')

  const errors = validateIssueLines(doc.lines, opts)
  if (errors.length) throw new InventoryServiceError(errors.join('; '), 'VALIDATION')

  const inv = getInv()
  for (const line of doc.lines.filter((l) => l.issuedQty > 0)) {
    const result = inv.postIssue({
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      qty: line.issuedQty,
      rate: line.rate,
      referenceNo: doc.documentNumber,
      remarks: `Issue ${doc.documentNumber} for ${doc.sourceDocumentNo ?? doc.sourceType}`,
      txnDate: doc.postingDate,
    })
    if (!result.ok && opts?.allowNegativeStock) {
      // Demo override — force issue via adjustment path not available; skip strict check
      continue
    }
    if (!result.ok) throw new InventoryServiceError(result.error ?? 'Posting failed', 'POST_FAILED')
  }

  postedIssueIds.add(id)
  const total = doc.costPreview?.total ?? 0
  const updated: InventoryIssue = {
    ...doc,
    status: 'posted',
    postedBy: 'Demo User',
    accountingPreview: buildAccountingPreview(total, 'issue'),
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Posted (demo) — inventory ledger updated')],
  }
  issues[idx] = updated
  return updated
}

export async function reverseIssueDemo(id: string): Promise<InventoryIssue> {
  await delay()
  const idx = issues.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Issue not found', 'NOT_FOUND')
  const doc = issues[idx]
  if (doc.status !== 'posted') throw new InventoryServiceError('Only posted issues can be reversed', 'INVALID_STATUS')

  const inv = getInv()
  for (const line of doc.lines.filter((l) => l.issuedQty > 0)) {
    inv.postInward({
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      qty: line.issuedQty,
      rate: line.rate,
      referenceNo: `${doc.documentNumber}-REV`,
      remarks: `Reverse issue ${doc.documentNumber}`,
      txnDate: new Date().toISOString().slice(0, 10),
    })
  }

  const updated: InventoryIssue = {
    ...doc,
    status: 'reversed',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Reversed (demo) — stock restored')],
  }
  issues[idx] = updated
  return updated
}

export async function cancelIssueDemo(id: string): Promise<InventoryIssue> {
  await delay()
  const idx = issues.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Issue not found', 'NOT_FOUND')
  const doc = issues[idx]
  if (doc.status === 'posted') throw new InventoryServiceError('Posted issues cannot be cancelled', 'INVALID_STATUS')
  const updated: InventoryIssue = {
    ...doc,
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
    auditHistory: [...doc.auditHistory, baseAudit('Cancelled')],
  }
  issues[idx] = updated
  return updated
}

/** Seed demo receipts/issues on first load for register tabs */
export async function seedDemoMovementsIfEmpty() {
  ensureInitialized()
  if (receipts.length > 0) return
  const today = new Date().toISOString().slice(0, 10)
  const poDocs = await getReceiptSourceDocuments('purchase_order')
  if (poDocs[0]) {
    const details = await getReceiptSourceDetails('purchase_order', poDocs[0].id)
    if (details) {
      await createReceiptDraft({
        sourceType: 'purchase_order',
        sourceDocumentId: details.sourceDocumentId,
        warehouseId: details.warehouseId,
        documentDate: today,
        postingDate: today,
        lines: details.lines.map((l) => ({ itemId: l.itemId, receivedQty: 0, pendingQty: l.pendingQty })),
      })
      receipts[0].status = 'pending_receipt'
    }
  }
  const woDocs = await getIssueSourceDocuments('production_order')
  if (woDocs[0]) {
    const details = await getIssueSourceDetails('production_order', woDocs[0].id)
    if (details) {
      await createIssueDraft({
        sourceType: 'production_order',
        sourceDocumentId: details.sourceDocumentId,
        warehouseId: details.warehouseId,
        documentDate: today,
        postingDate: today,
        lines: details.lines.map((l) => ({ itemId: l.itemId, issuedQty: 0, pendingQty: l.pendingQty })),
      })
      issues[0].status = 'pending_issue'
    }
  }
}

export function resetMovementServiceForTests() {
  receipts = []
  issues = []
  initialized = false
  postedReceiptIds.clear()
  postedIssueIds.clear()
  resetMovementSequencesForTests()
}
