import type { Prisma, PurchasePlanningRow, PurchasePlanningStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import {
  PlanningNoSelectionError,
  PlanningRowNotFoundError,
} from './purchase-planning.errors.js'
import { mapPlanningRowToDto, type PlanningSummaryDto } from './purchase-planning.mapper.js'
import * as repo from './purchase-planning.repository.js'
import type {
  BulkAssignBuyerInput,
  BulkSelectVendorInput,
  BulkStatusInput,
  ListPlanningSheetQuery,
  RecalculatePlanningInput,
  UpdatePlanningRowInput,
} from './purchase-planning.validation.js'
import {
  assertBulkStatusReason,
  assertCanEditCommercialFields,
  assertPlanningEditable,
  assertStatusTransition,
  computeEstimatedAmount,
  computeNetPurchaseQuantity,
  maybeVendorSelectedStatus,
  parseDateInput,
} from './purchase-planning.workflow.js'

async function loadOrThrow(tenantId: string, id: string) {
  const row = await repo.findPlanningRowById(tenantId, id)
  if (!row) throw new PlanningRowNotFoundError()
  return row
}

function requireRows(ids: string[]): void {
  if (!ids.length) throw new PlanningNoSelectionError()
}

function planningStatusAuditAction(status: PurchasePlanningStatus): string {
  if (status === 'ON_HOLD') return PURCHASE_AUDIT_ACTION.PPS_ON_HOLD
  if (status === 'CANCELLED') return PURCHASE_AUDIT_ACTION.PPS_CANCELLED
  if (status === 'PO_CREATED') return PURCHASE_AUDIT_ACTION.PPS_CONVERTED_TO_PO
  return PURCHASE_AUDIT_ACTION.PPS_STATUS_CHANGED
}

function commercialSnapshot(row: PurchasePlanningRow) {
  return {
    status: row.status,
    buyerId: row.buyerId,
    selectedVendorId: row.selectedVendorId,
    expectedRate: Number(row.expectedRate),
    negotiatedRate: row.negotiatedRate != null ? Number(row.negotiatedRate) : null,
    purchaseType: row.purchaseType,
    priority: row.priority,
    actionMessage: row.actionMessage,
  }
}

export async function listPlanningSheet(tenantId: string, query: ListPlanningSheetQuery) {
  const result = await repo.findPlanningRows(tenantId, query)
  return {
    items: result.items.map(mapPlanningRowToDto),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getPlanningSheetSummary(tenantId: string): Promise<PlanningSummaryDto> {
  return repo.getPlanningSummaryAggregates(tenantId)
}

export async function getPlanningRow(tenantId: string, id: string) {
  const row = await loadOrThrow(tenantId, id)
  return mapPlanningRowToDto(row)
}

export async function updatePlanningRow(
  tenantId: string,
  id: string,
  actorId: string,
  input: UpdatePlanningRowInput,
) {
  const existing = await loadOrThrow(tenantId, id)
  assertPlanningEditable(existing)

  const touchesCommercial =
    input.selectedVendorId !== undefined ||
    input.expectedRate !== undefined ||
    input.negotiatedRate !== undefined ||
    input.purchaseType !== undefined
  if (touchesCommercial) {
    assertCanEditCommercialFields(existing)
  }

  const data: Prisma.PurchasePlanningRowUncheckedUpdateInput = {
    updatedById: actorId,
  }

  if (input.selectedVendorId !== undefined) data.selectedVendorId = input.selectedVendorId
  if (input.expectedRate !== undefined) data.expectedRate = input.expectedRate
  if (input.negotiatedRate !== undefined) data.negotiatedRate = input.negotiatedRate
  if (input.requiredDate !== undefined) data.requiredDate = parseDateInput(input.requiredDate) ?? null
  if (input.purchaseType !== undefined) data.purchaseType = input.purchaseType
  if (input.buyerId !== undefined) data.buyerId = input.buyerId
  if (input.priority !== undefined) data.priority = input.priority
  if (input.actionMessage !== undefined) data.actionMessage = input.actionMessage
  if (input.remarks !== undefined) data.remarks = input.remarks?.trim() || null

  let nextStatus: PurchasePlanningStatus = existing.status
  if (input.status !== undefined) {
    assertStatusTransition(existing.status, input.status)
    nextStatus = input.status
  } else {
    const auto = maybeVendorSelectedStatus(
      existing.status,
      input.selectedVendorId !== undefined ? input.selectedVendorId : existing.selectedVendorId,
    )
    if (auto) {
      assertStatusTransition(existing.status, auto)
      nextStatus = auto
    }
  }
  if (nextStatus !== existing.status) data.status = nextStatus

  const expectedRate =
    input.expectedRate !== undefined ? input.expectedRate : Number(existing.expectedRate)
  const net = Number(existing.netPurchaseQuantity)
  if (input.expectedRate !== undefined) {
    data.estimatedAmount = computeEstimatedAmount(net, expectedRate)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await repo.updatePlanningRow(tenantId, id, data, tx)
    if (!row) throw new PlanningRowNotFoundError()
    if (nextStatus !== existing.status) {
      await repo.createPlanningStatusHistory(
        {
          tenantId,
          documentId: row.id,
          documentNumber: row.planningNumber,
          action: 'STATUS_CHANGED',
          fromStatus: existing.status,
          toStatus: nextStatus,
          actorId,
          remarks: input.remarks ?? null,
        },
        tx,
      )
    }
    return row
  })

  const auditBase = {
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PLANNING,
    entityId: id,
  } as const

  if (input.buyerId !== undefined && input.buyerId !== existing.buyerId) {
    await writePurchaseAudit({
      ...auditBase,
      action: PURCHASE_AUDIT_ACTION.PPS_BUYER_ASSIGNED,
      previousValue: { buyerId: existing.buyerId },
      newValue: { buyerId: updated.buyerId },
    })
  }

  if (
    input.selectedVendorId !== undefined &&
    input.selectedVendorId !== existing.selectedVendorId
  ) {
    await writePurchaseAudit({
      ...auditBase,
      action: PURCHASE_AUDIT_ACTION.PPS_VENDOR_SELECTED,
      previousValue: { selectedVendorId: existing.selectedVendorId },
      newValue: { selectedVendorId: updated.selectedVendorId },
    })
  }

  const rateChanged =
    (input.expectedRate !== undefined &&
      Number(input.expectedRate) !== Number(existing.expectedRate)) ||
    (input.negotiatedRate !== undefined &&
      (input.negotiatedRate == null
        ? existing.negotiatedRate != null
        : existing.negotiatedRate == null ||
          Number(input.negotiatedRate) !== Number(existing.negotiatedRate)))
  if (rateChanged) {
    await writePurchaseAudit({
      ...auditBase,
      action: PURCHASE_AUDIT_ACTION.PPS_RATE_CHANGED,
      previousValue: {
        expectedRate: Number(existing.expectedRate),
        negotiatedRate:
          existing.negotiatedRate != null ? Number(existing.negotiatedRate) : null,
      },
      newValue: {
        expectedRate: Number(updated.expectedRate),
        negotiatedRate:
          updated.negotiatedRate != null ? Number(updated.negotiatedRate) : null,
      },
    })
  }

  if (nextStatus !== existing.status) {
    await writePurchaseAudit({
      ...auditBase,
      action: planningStatusAuditAction(nextStatus),
      previousValue: { status: existing.status },
      newValue: { status: nextStatus },
    })
  }

  await writePurchaseAudit({
    ...auditBase,
    action: PURCHASE_AUDIT_ACTION.PPS_UPDATED,
    previousValue: commercialSnapshot(existing),
    newValue: commercialSnapshot(updated),
  })

  return mapPlanningRowToDto(updated)
}

async function assertAllFound(requestedIds: string[], rows: PurchasePlanningRow[]) {
  if (rows.length !== requestedIds.length) {
    const found = new Set(rows.map((r) => r.id))
    const missing = requestedIds.find((id) => !found.has(id))
    throw new PlanningRowNotFoundError(
      missing ? `Planning sheet row not found: ${missing}` : 'Planning sheet row not found',
    )
  }
}

export async function bulkAssignBuyer(
  tenantId: string,
  actorId: string,
  input: BulkAssignBuyerInput,
) {
  requireRows(input.rowIds)
  const rows = await repo.findPlanningRowsByIds(tenantId, input.rowIds)
  await assertAllFound(input.rowIds, rows)
  for (const row of rows) assertPlanningEditable(row)

  await prisma.$transaction(async (tx) => {
    await repo.updatePlanningRowsMany(
      tenantId,
      input.rowIds,
      { buyerId: input.buyerId, updatedById: actorId },
      tx,
    )
    // Promote pending → under_review when buyer assigned
    const pendingIds = rows.filter((r) => r.status === 'PENDING_PLANNING').map((r) => r.id)
    if (pendingIds.length) {
      await repo.updatePlanningRowsMany(
        tenantId,
        pendingIds,
        { status: 'UNDER_REVIEW', updatedById: actorId },
        tx,
      )
      for (const row of rows.filter((r) => r.status === 'PENDING_PLANNING')) {
        await repo.createPlanningStatusHistory(
          {
            tenantId,
            documentId: row.id,
            documentNumber: row.planningNumber,
            action: 'BUYER_ASSIGNED',
            fromStatus: 'PENDING_PLANNING',
            toStatus: 'UNDER_REVIEW',
            actorId,
            remarks: `Buyer ${input.buyerId}`,
          },
          tx,
        )
      }
    }
  })

  for (const rowId of input.rowIds) {
    const previous = rows.find((r) => r.id === rowId)
    await writePurchaseAudit({
      tenantId,
      actorId,
      entity: PURCHASE_AUDIT_ENTITY.PLANNING,
      entityId: rowId,
      action: PURCHASE_AUDIT_ACTION.PPS_BUYER_ASSIGNED,
      previousValue: { buyerId: previous?.buyerId ?? null },
      newValue: { buyerId: input.buyerId },
    })
  }

  const refreshed = await repo.findPlanningRowsByIds(tenantId, input.rowIds)
  return refreshed.map(mapPlanningRowToDto)
}

export async function bulkSelectVendor(
  tenantId: string,
  actorId: string,
  input: BulkSelectVendorInput,
) {
  requireRows(input.rowIds)
  const rows = await repo.findPlanningRowsByIds(tenantId, input.rowIds)
  await assertAllFound(input.rowIds, rows)
  for (const row of rows) assertCanEditCommercialFields(row)

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const nextStatus =
        maybeVendorSelectedStatus(row.status, input.vendorId) ?? row.status
      if (nextStatus !== row.status) {
        assertStatusTransition(row.status, nextStatus)
      }
      const expectedRate =
        input.expectedRate != null ? input.expectedRate : Number(row.expectedRate)
      const negotiatedRate =
        input.negotiatedRate !== undefined ? input.negotiatedRate : row.negotiatedRate
      const estimatedAmount = computeEstimatedAmount(Number(row.netPurchaseQuantity), expectedRate)

      await repo.updatePlanningRow(
        tenantId,
        row.id,
        {
          selectedVendorId: input.vendorId,
          expectedRate,
          negotiatedRate: negotiatedRate as number | null,
          estimatedAmount,
          status: nextStatus,
          updatedById: actorId,
        },
        tx,
      )

      if (nextStatus !== row.status) {
        await repo.createPlanningStatusHistory(
          {
            tenantId,
            documentId: row.id,
            documentNumber: row.planningNumber,
            action: 'VENDOR_SELECTED',
            fromStatus: row.status,
            toStatus: nextStatus,
            actorId,
          },
          tx,
        )
      }
    }
  })

  for (const row of rows) {
    await writePurchaseAudit({
      tenantId,
      actorId,
      entity: PURCHASE_AUDIT_ENTITY.PLANNING,
      entityId: row.id,
      action: PURCHASE_AUDIT_ACTION.PPS_VENDOR_SELECTED,
      previousValue: { selectedVendorId: row.selectedVendorId },
      newValue: {
        selectedVendorId: input.vendorId,
        expectedRate: input.expectedRate,
        negotiatedRate: input.negotiatedRate,
      },
    })
  }

  const refreshed = await repo.findPlanningRowsByIds(tenantId, input.rowIds)
  return refreshed.map(mapPlanningRowToDto)
}

export async function bulkUpdateStatus(
  tenantId: string,
  actorId: string,
  input: BulkStatusInput,
) {
  requireRows(input.rowIds)
  const reason = assertBulkStatusReason(input.status as PurchasePlanningStatus, input.reason)
  const rows = await repo.findPlanningRowsByIds(tenantId, input.rowIds)
  await assertAllFound(input.rowIds, rows)

  for (const row of rows) {
    if (row.deletedAt) throw new PlanningRowNotFoundError(`Planning sheet row not found: ${row.id}`)
    assertStatusTransition(row.status, input.status as PurchasePlanningStatus)
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await repo.updatePlanningRow(
        tenantId,
        row.id,
        {
          status: input.status as PurchasePlanningStatus,
          updatedById: actorId,
          ...(input.status === 'CANCELLED'
            ? { actionMessage: false, deletedAt: null }
            : {}),
        },
        tx,
      )
      await repo.createPlanningStatusHistory(
        {
          tenantId,
          documentId: row.id,
          documentNumber: row.planningNumber,
          action: 'STATUS_CHANGED',
          fromStatus: row.status,
          toStatus: input.status,
          actorId,
          remarks: reason,
        },
        tx,
      )
    }
  })

  const nextStatus = input.status as PurchasePlanningStatus
  for (const row of rows) {
    await writePurchaseAudit({
      tenantId,
      actorId,
      entity: PURCHASE_AUDIT_ENTITY.PLANNING,
      entityId: row.id,
      action: planningStatusAuditAction(nextStatus),
      previousValue: { status: row.status },
      newValue: { status: nextStatus, reason },
    })
  }

  const refreshed = await repo.findPlanningRowsByIds(tenantId, input.rowIds)
  return refreshed.map(mapPlanningRowToDto)
}

export async function recalculatePlanningRows(
  tenantId: string,
  actorId: string,
  input: RecalculatePlanningInput,
) {
  const rows =
    input.rowIds.length > 0
      ? await repo.findPlanningRowsByIds(tenantId, input.rowIds)
      : await repo.findActivePlanningRowsForRecalc(tenantId)

  if (input.rowIds.length > 0) {
    await assertAllFound(input.rowIds, rows)
  }

  const itemIds = rows.map((r) => r.itemId).filter((id): id is string => Boolean(id))
  const [stockMap, openPoMap] = await Promise.all([
    repo.loadCurrentStockByItemId(tenantId, itemIds),
    repo.loadOpenPoQtyByItemId(tenantId, itemIds),
  ])

  const updated = await prisma.$transaction(async (tx) => {
    const results: Array<{ previous: PurchasePlanningRow; next: PurchasePlanningRow }> = []
    for (const row of rows) {
      if (row.deletedAt || row.status === 'CANCELLED' || row.status === 'COMPLETED') {
        continue
      }
      const currentStockQuantity = row.itemId ? (stockMap.get(row.itemId) ?? 0) : 0
      const openPurchaseOrderQuantity = row.itemId ? (openPoMap.get(row.itemId) ?? 0) : 0
      const netPurchaseQuantity = computeNetPurchaseQuantity(
        Number(row.requiredQuantity),
        currentStockQuantity,
        openPurchaseOrderQuantity,
      )
      const estimatedAmount = computeEstimatedAmount(netPurchaseQuantity, Number(row.expectedRate))

      const next = await repo.updatePlanningRow(
        tenantId,
        row.id,
        {
          currentStockQuantity,
          openPurchaseOrderQuantity,
          netPurchaseQuantity,
          estimatedAmount,
          updatedById: actorId,
        },
        tx,
      )
      if (next) results.push({ previous: row, next })
    }
    return results
  })

  for (const { previous, next } of updated) {
    await writePurchaseAudit({
      tenantId,
      actorId,
      entity: PURCHASE_AUDIT_ENTITY.PLANNING,
      entityId: next.id,
      action: PURCHASE_AUDIT_ACTION.PPS_QTY_RECALCULATED,
      previousValue: {
        netPurchaseQuantity: Number(previous.netPurchaseQuantity),
        currentStockQuantity: Number(previous.currentStockQuantity),
        openPurchaseOrderQuantity: Number(previous.openPurchaseOrderQuantity),
      },
      newValue: {
        netPurchaseQuantity: Number(next.netPurchaseQuantity),
        currentStockQuantity: Number(next.currentStockQuantity),
        openPurchaseOrderQuantity: Number(next.openPurchaseOrderQuantity),
      },
    })
  }

  // Preserve prior behavior: return all requested/active rows (including skipped)
  const refreshedIds = rows.map((r) => r.id)
  const refreshed = refreshedIds.length
    ? await repo.findPlanningRowsByIds(tenantId, refreshedIds)
    : []
  return refreshed.map(mapPlanningRowToDto)
}
