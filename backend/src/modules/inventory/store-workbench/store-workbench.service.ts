import { prisma } from '../../../config/database.js'
import {
  getStoreWorkbenchSummary as getManufacturingWorkbenchSummary,
  listStoreWorkbenchFinishedGoods,
  listStoreWorkbenchIssues,
  listStoreWorkbenchReservations,
  listStoreWorkbenchReturns,
} from '../../manufacturing/store-workbench/store-workbench.service.js'
import { reconcileInventoryBalances } from '../balances/reconciliation.service.js'
import { dec } from '../shared/quantity.helpers.js'
import {
  adjustmentNeedsActionCategory,
  dispatchReadinessSeverity,
  needsActionKey,
  stockCountNeedsActionCategory,
  transferNeedsActionCategory,
  NEEDS_ACTION_DOMAINS,
  type NeedsActionDomain,
  type NeedsActionRow,
  type NeedsActionSeverity,
} from './store-workbench.mappers.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function clampLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
}

// ── Manufacturing — thin projection over the existing store-workbench queues ──

async function deriveManufacturingRows(tenantId: string, limit: number): Promise<NeedsActionRow[]> {
  const [reservations, issues, returns, finishedGoods] = await Promise.all([
    listStoreWorkbenchReservations(tenantId, { limit }),
    listStoreWorkbenchIssues(tenantId, { limit }),
    listStoreWorkbenchReturns(tenantId, { limit }),
    listStoreWorkbenchFinishedGoods(tenantId, { limit }),
  ])
  const rows: NeedsActionRow[] = []
  for (const r of reservations.rows) {
    rows.push({
      key: needsActionKey('manufacturing', 'WO_RESERVATION_SHORT', r.materialId),
      domain: 'manufacturing',
      category: 'WO_RESERVATION_SHORT',
      severity: 'CRITICAL',
      title: `Reserve material for ${r.orderNumber}`,
      detail: `${r.item?.code ?? r.itemId} short by ${r.shortageQty} (required ${r.requiredQty}, reserved ${r.reservedQty}).`,
      source: { type: 'ProductionOrderMaterial', id: r.materialId, number: r.orderNumber },
      deepLink: '/manufacturing/store-workbench',
      quantity: r.shortageQty,
      asOf: reservations.asOf,
    })
  }
  for (const r of issues.rows) {
    rows.push({
      key: needsActionKey('manufacturing', 'WO_ISSUE_PENDING', r.materialId),
      domain: 'manufacturing',
      category: 'WO_ISSUE_PENDING',
      severity: 'WARNING',
      title: `Issue material to ${r.orderNumber}`,
      detail: `${r.item?.code ?? r.itemId} balance to issue ${r.balanceToIssue} (required ${r.requiredQty}, issued ${r.issuedQty}).`,
      source: { type: 'ProductionOrderMaterial', id: r.materialId, number: r.orderNumber },
      deepLink: '/manufacturing/store-workbench',
      quantity: r.balanceToIssue,
      asOf: issues.asOf,
    })
  }
  for (const r of returns.rows) {
    rows.push({
      key: needsActionKey('manufacturing', 'WO_MATERIAL_HELD', r.materialId),
      domain: 'manufacturing',
      category: 'WO_MATERIAL_HELD',
      severity: 'INFO',
      title: `Material held at ${r.orderNumber}`,
      detail: `${r.item?.code ?? r.itemId} eligible to return ${r.eligibleReturnQty} (issued ${r.issuedQty}, returned ${r.returnedQty}).`,
      source: { type: 'ProductionOrderMaterial', id: r.materialId, number: r.orderNumber },
      deepLink: '/manufacturing/store-workbench',
      quantity: r.eligibleReturnQty,
      asOf: returns.asOf,
    })
  }
  for (const r of finishedGoods.rows) {
    rows.push({
      key: needsActionKey('manufacturing', 'FG_RECEIPT_PENDING', r.workOrderId),
      domain: 'manufacturing',
      category: 'FG_RECEIPT_PENDING',
      severity: 'WARNING',
      title: `Receive finished goods for ${r.orderNumber}`,
      detail: `${r.product?.code ?? 'FG'} eligible ${r.eligibleQty} of completed ${r.completedGoodQty}.`,
      source: { type: 'ProductionOrder', id: r.workOrderId, number: r.orderNumber },
      deepLink: '/manufacturing/store-workbench',
      quantity: r.eligibleQty,
      asOf: finishedGoods.asOf,
    })
  }
  return rows.slice(0, limit)
}

// ── Purchase — GRN QC / inventory-posting pending + open quality inspections ──

const GRN_POSTING_PENDING_STATUSES = [
  'SUBMITTED',
  'RECEIVING_COMPLETED',
  'PARTIALLY_ACCEPTED',
  'FULLY_ACCEPTED',
] as const
const QI_OPEN_STATUSES = ['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'] as const

async function derivePurchaseRows(tenantId: string, limit: number): Promise<NeedsActionRow[]> {
  const [grns, inspections] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['QC_PENDING', ...GRN_POSTING_PENDING_STATUSES] },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        grnNumber: true,
        status: true,
        vendorNameSnapshot: true,
        updatedAt: true,
      },
    }),
    prisma.qualityInspection.findMany({
      where: { tenantId, deletedAt: null, status: { in: [...QI_OPEN_STATUSES] } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, inspectionNumber: true, status: true, updatedAt: true },
    }),
  ])

  const rows: NeedsActionRow[] = []
  for (const grn of grns) {
    const qcPending = grn.status === 'QC_PENDING'
    const category = qcPending ? 'GRN_QC_PENDING' : 'GRN_POSTING_PENDING'
    rows.push({
      key: needsActionKey('purchase', category, grn.id),
      domain: 'purchase',
      category,
      severity: qcPending ? 'WARNING' : 'CRITICAL',
      title: qcPending
        ? `GRN ${grn.grnNumber} awaiting quality inspection`
        : `GRN ${grn.grnNumber} awaiting inventory posting`,
      detail: `Vendor ${grn.vendorNameSnapshot || 'n/a'} — status ${grn.status}.`,
      source: { type: 'GoodsReceipt', id: grn.id, number: grn.grnNumber },
      deepLink: `/purchase/grn/${grn.id}`,
      quantity: null,
      asOf: grn.updatedAt.toISOString(),
    })
  }
  for (const qi of inspections) {
    rows.push({
      key: needsActionKey('purchase', 'PURCHASE_QI_OPEN', qi.id),
      domain: 'purchase',
      category: 'PURCHASE_QI_OPEN',
      severity: qi.status === 'DEVIATION_PENDING' ? 'CRITICAL' : 'WARNING',
      title: `Inspection ${qi.inspectionNumber} awaiting decision`,
      detail: `Purchase quality inspection is ${qi.status}.`,
      source: { type: 'PurchaseQualityInspection', id: qi.id, number: qi.inspectionNumber },
      deepLink: `/purchase/quality-inspections/${qi.id}`,
      quantity: null,
      asOf: qi.updatedAt.toISOString(),
    })
  }
  return rows.slice(0, limit)
}

// ── Dispatch — shortages / blockers surfaced from persisted requirements ──

async function deriveDispatchRows(tenantId: string, limit: number): Promise<NeedsActionRow[]> {
  const requirements = await prisma.dispatchRequirement.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['ACTIVE', 'ON_HOLD', 'RECONCILIATION_REQUIRED'] },
      readinessStatus: {
        in: [
          'NOT_READY',
          'WAITING_FOR_PRODUCTION',
          'WAITING_FOR_QUALITY',
          'WAITING_FOR_STOCK',
          'ON_HOLD',
          'BLOCKED',
          'RECONCILIATION_REQUIRED',
          'PARTIALLY_READY',
        ],
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      requirementNumber: true,
      readinessStatus: true,
      primaryBlockerCode: true,
      remainingQuantitySnapshot: true,
      updatedAt: true,
    },
  })
  const rows: NeedsActionRow[] = []
  for (const r of requirements) {
    const severity = dispatchReadinessSeverity(r.readinessStatus)
    if (!severity) continue
    rows.push({
      key: needsActionKey('dispatch', 'DISPATCH_NOT_READY', r.id),
      domain: 'dispatch',
      category: 'DISPATCH_NOT_READY',
      severity,
      title: `Requirement ${r.requirementNumber} is ${r.readinessStatus.replaceAll('_', ' ').toLowerCase()}`,
      detail: r.primaryBlockerCode
        ? `Remaining ${dec(r.remainingQuantitySnapshot)} — primary blocker ${r.primaryBlockerCode}.`
        : `Remaining ${dec(r.remainingQuantitySnapshot)}.`,
      source: { type: 'DispatchRequirement', id: r.id, number: r.requirementNumber },
      deepLink: '/dispatch/workbench',
      quantity: dec(r.remainingQuantitySnapshot),
      asOf: r.updatedAt.toISOString(),
    })
  }
  return rows
}

// ── Inventory transfers — pending approval / dispatch / receipt ──

async function deriveTransferRows(tenantId: string, limit: number): Promise<NeedsActionRow[]> {
  const transfers = await prisma.inventoryTransfer.findMany({
    where: { tenantId, status: { in: ['SUBMITTED', 'APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'] } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      transferNumber: true,
      status: true,
      updatedAt: true,
      fromWarehouse: { select: { code: true } },
      toWarehouse: { select: { code: true } },
      lines: { select: { quantity: true, receivedQty: true } },
    },
  })
  const rows: NeedsActionRow[] = []
  for (const t of transfers) {
    const action = transferNeedsActionCategory(t.status)
    if (!action) continue
    const totalQty = t.lines.reduce((sum, line) => sum + Number(line.quantity), 0)
    const receivedQty = t.lines.reduce((sum, line) => sum + Number(line.receivedQty), 0)
    rows.push({
      key: needsActionKey('transfers', action.category, t.id),
      domain: 'transfers',
      category: action.category,
      severity: action.severity,
      title: `${action.action} — ${t.transferNumber}`,
      detail: `${t.fromWarehouse.code} → ${t.toWarehouse.code}: ${totalQty} planned, ${receivedQty} received (${t.status}).`,
      source: { type: 'InventoryTransfer', id: t.id, number: t.transferNumber },
      deepLink: '/inventory/transfers',
      quantity: String(totalQty - receivedQty),
      asOf: t.updatedAt.toISOString(),
    })
  }
  return rows
}

// ── Stock counts / adjustments — pending entry, approvals and posting ──

async function deriveStockCountRows(tenantId: string, limit: number): Promise<NeedsActionRow[]> {
  const counts = await prisma.inventoryStockCount.findMany({
    where: { tenantId, status: { in: ['SNAPSHOTTED', 'COUNTING', 'SUBMITTED', 'APPROVED'] } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      countNumber: true,
      status: true,
      updatedAt: true,
      warehouse: { select: { code: true } },
    },
  })
  const rows: NeedsActionRow[] = []
  for (const c of counts) {
    const action = stockCountNeedsActionCategory(c.status)
    if (!action) continue
    rows.push({
      key: needsActionKey('stock-counts', action.category, c.id),
      domain: 'stock-counts',
      category: action.category,
      severity: action.severity,
      title: `${action.action} — ${c.countNumber}`,
      detail: `Warehouse ${c.warehouse.code} — status ${c.status}.`,
      source: { type: 'InventoryStockCount', id: c.id, number: c.countNumber },
      deepLink: '/inventory/counts',
      quantity: null,
      asOf: c.updatedAt.toISOString(),
    })
  }
  return rows
}

async function deriveAdjustmentRows(tenantId: string, limit: number): Promise<NeedsActionRow[]> {
  const adjustments = await prisma.inventoryAdjustment.findMany({
    where: { tenantId, status: { in: ['SUBMITTED', 'APPROVED'] } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      adjustmentNumber: true,
      status: true,
      reason: true,
      updatedAt: true,
      warehouse: { select: { code: true } },
    },
  })
  const rows: NeedsActionRow[] = []
  for (const a of adjustments) {
    const action = adjustmentNeedsActionCategory(a.status)
    if (!action) continue
    rows.push({
      key: needsActionKey('adjustments', action.category, a.id),
      domain: 'adjustments',
      category: action.category,
      severity: action.severity,
      title: `${action.action} — ${a.adjustmentNumber}`,
      detail: `Warehouse ${a.warehouse.code} — ${a.reason} (${a.status}).`,
      source: { type: 'InventoryAdjustment', id: a.id, number: a.adjustmentNumber },
      deepLink: '/inventory/counts',
      quantity: null,
      asOf: a.updatedAt.toISOString(),
    })
  }
  return rows
}

// ── Balance reconciliation mismatches (read-only ledger diagnostic) ──

async function deriveReconciliationRows(tenantId: string, limit: number): Promise<NeedsActionRow[]> {
  const result = await reconcileInventoryBalances(tenantId, { mismatchesOnly: true })
  return result.rows.slice(0, limit).map((row) => ({
    key: needsActionKey('reconciliation', 'BALANCE_MISMATCH', row.itemId, row.warehouseId),
    domain: 'reconciliation' as const,
    category: 'BALANCE_MISMATCH',
    severity: 'CRITICAL' as const,
    title: `Balance mismatch for ${row.item?.code ?? row.itemId}`,
    detail: `Warehouse ${row.warehouse?.code ?? row.warehouseId}: stored ${row.storedOnHandQty} vs ledger ${row.ledgerOnHandQty} (Δ ${row.onHandDifference}); reserved Δ ${row.reservedDifference}.`,
    source: { type: 'InventoryStockBalance', id: `${row.itemId}:${row.warehouseId}`, number: null },
    deepLink: `/inventory/ledger?itemId=${row.itemId}`,
    quantity: row.onHandDifference,
    asOf: row.updatedAt ?? result.asOf,
  }))
}

// ── Exceptions — failed inventory accounting events. Traceability has no
//    persisted exception model yet; extend this deriver when one lands. ──

async function deriveExceptionRows(tenantId: string, limit: number): Promise<NeedsActionRow[]> {
  const events = await prisma.inventoryAccountingEvent.findMany({
    where: { tenantId, status: 'FAILED' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      eventType: true,
      sourceDocumentType: true,
      sourceDocumentId: true,
      quantity: true,
      failureReason: true,
      createdAt: true,
    },
  })
  return events.map((e) => ({
    key: needsActionKey('exceptions', 'ACCOUNTING_EVENT_FAILED', e.id),
    domain: 'exceptions' as const,
    category: 'ACCOUNTING_EVENT_FAILED',
    severity: 'CRITICAL' as const,
    title: `Inventory accounting event ${e.eventType} failed`,
    detail: `${e.sourceDocumentType} ${e.sourceDocumentId}: ${e.failureReason ?? 'GL posting failed'}.`,
    source: { type: 'InventoryAccountingEvent', id: e.id, number: null },
    deepLink: null,
    quantity: dec(e.quantity),
    asOf: e.createdAt.toISOString(),
  }))
}

const DOMAIN_DERIVERS: Record<
  NeedsActionDomain,
  (tenantId: string, limit: number) => Promise<NeedsActionRow[]>
> = {
  manufacturing: deriveManufacturingRows,
  purchase: derivePurchaseRows,
  dispatch: deriveDispatchRows,
  transfers: deriveTransferRows,
  'stock-counts': deriveStockCountRows,
  adjustments: deriveAdjustmentRows,
  reconciliation: deriveReconciliationRows,
  exceptions: deriveExceptionRows,
}

const SEVERITY_ORDER: Record<NeedsActionSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
}

function sortRows(rows: NeedsActionRow[]): NeedsActionRow[] {
  return rows.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.key.localeCompare(b.key),
  )
}

export async function listNeedsActionForDomain(
  tenantId: string,
  domain: NeedsActionDomain,
  opts?: { limit?: number },
) {
  const limit = clampLimit(opts?.limit)
  const rows = sortRows(await DOMAIN_DERIVERS[domain](tenantId, limit))
  return { asOf: new Date().toISOString(), domain, rows }
}

export async function listNeedsAction(tenantId: string, opts?: { limit?: number }) {
  const limit = clampLimit(opts?.limit)
  const results = await Promise.all(
    NEEDS_ACTION_DOMAINS.map((domain) => DOMAIN_DERIVERS[domain](tenantId, limit)),
  )
  const rows = sortRows(results.flat())
  return { asOf: new Date().toISOString(), rows }
}

/**
 * Aggregated KPI summary. Counts are capped operational queue sizes (per-domain
 * cap 200) — approximate, not transactional totals. The manufacturing block
 * reuses the existing manufacturing store-workbench summary untouched.
 */
export async function getInventoryStoreWorkbenchSummary(tenantId: string) {
  const [manufacturing, ...domainRows] = await Promise.all([
    getManufacturingWorkbenchSummary(tenantId),
    ...NEEDS_ACTION_DOMAINS.map((domain) => DOMAIN_DERIVERS[domain](tenantId, MAX_LIMIT)),
  ])

  const byDomain: Record<string, number> = {}
  const bySeverity: Record<NeedsActionSeverity, number> = { CRITICAL: 0, WARNING: 0, INFO: 0 }
  let total = 0
  for (const [index, rows] of domainRows.entries()) {
    byDomain[NEEDS_ACTION_DOMAINS[index]] = rows.length
    total += rows.length
    for (const row of rows) bySeverity[row.severity] += 1
  }

  return {
    asOf: new Date().toISOString(),
    needsAction: { total, byDomain, bySeverity },
    manufacturing,
  }
}
