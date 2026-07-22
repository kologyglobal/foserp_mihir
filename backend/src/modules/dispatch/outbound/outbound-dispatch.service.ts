import type { InventoryStockMovement } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { assertDispatchQtyAllowed } from '../../crm/sales-orders/fulfilment/sales-order-fulfilment.service.js'
import { assertSalesOrderAllowsDispatch } from '../../crm/sales-orders/fulfilment/sales-order-dispatch-guard.service.js'
import { InventoryPostingService } from '../../inventory/shared/stock-posting.service.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../../inventory/accounting/inventory-accounting-event.service.js'
import { assertPickListsAllowConfirm } from '../picking/dispatch-pick-list.service.js'
import { assertPackingAllowsConfirm } from '../packing/dispatch-packing-reconciliation.service.js'
import { assertChallanAllowsConfirm } from '../challan/delivery-challan-reconciliation.service.js'
import { synchroniseDispatchRequirements } from '../requirements/dispatch-requirement-sync.service.js'
import { mapOutboundDispatch } from './outbound-dispatch.mappers.js'
import * as repo from './outbound-dispatch.repository.js'
import type {
  CancelOutboundDispatchInput,
  CreateOutboundDispatchInput,
  ListOutboundDispatchesQuery,
  UpdateOutboundDispatchInput,
} from './outbound-dispatch.schemas.js'

async function refreshRequirementsForDispatch(
  tenantId: string,
  dispatch: { salesOrderId: string | null; lines: Array<{ salesOrderId: string | null }> },
  actorUserId?: string,
) {
  const soIds = new Set<string>()
  if (dispatch.salesOrderId) soIds.add(dispatch.salesOrderId)
  for (const line of dispatch.lines) {
    if (line.salesOrderId) soIds.add(line.salesOrderId)
  }
  for (const salesOrderId of soIds) {
    await synchroniseDispatchRequirements(tenantId, { salesOrderId, userId: actorUserId })
  }
}

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

function canOverrideNegativeStock(req: Request): boolean {
  return (
    req.context?.permissions.includes('inventory.issues.override_negative_stock') === true ||
    req.context?.permissions.includes('tenant.manage') === true ||
    req.context?.permissions.includes('dispatch.override') === true
  )
}

async function resolveSalesOrder(
  tenantId: string,
  salesOrderId: string | undefined,
): Promise<{ id: string; salesOrderNo: string } | null> {
  if (!salesOrderId) return null
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
    select: { id: true, salesOrderNo: true },
  })
  if (!order) throw new NotFoundError('Sales order not found')
  return order
}

async function validateLinesForCreate(
  tenantId: string,
  headerSalesOrderId: string | undefined,
  lines: CreateOutboundDispatchInput['lines'],
): Promise<void> {
  const checkedSalesOrders = new Set<string>()
  for (const line of lines) {
    const soId = line.salesOrderId ?? headerSalesOrderId
    if (soId && !checkedSalesOrders.has(soId)) {
      await assertSalesOrderAllowsDispatch(tenantId, soId)
      checkedSalesOrders.add(soId)
    }
    if (line.salesOrderLineId) {
      if (!soId) {
        throw new ValidationError('salesOrderId is required when salesOrderLineId is set')
      }
      await assertDispatchQtyAllowed(tenantId, soId, line.salesOrderLineId, line.quantity)
    }
  }
}

export async function listOutboundDispatches(tenantId: string, query: ListOutboundDispatchesQuery) {
  const result = await repo.list(tenantId, query)
  return { ...result, items: result.items.map(mapOutboundDispatch) }
}

export async function getOutboundDispatch(tenantId: string, id: string) {
  const row = await repo.findById(tenantId, id)
  if (!row) throw new NotFoundError('Outbound dispatch not found')
  return mapOutboundDispatch(row)
}

export async function createOutboundDispatch(
  req: Request,
  tenantId: string,
  input: CreateOutboundDispatchInput,
) {
  if (input.idempotencyKey) {
    const existing = await repo.findByIdempotencyKey(tenantId, input.idempotencyKey)
    if (existing) return mapOutboundDispatch(existing)
  }

  const so = await resolveSalesOrder(tenantId, input.salesOrderId)
  if (so?.id) {
    await assertSalesOrderAllowsDispatch(tenantId, so.id)
  }
  await validateLinesForCreate(tenantId, so?.id, input.lines)

  try {
    const row = await prisma.$transaction(async (tx) => {
      const dispatchNo = await nextCode(tenantId, 'OUTBOUND_DISPATCH', tx)
      return tx.outboundDispatch.create({
        data: {
          tenantId,
          dispatchNo,
          status: 'DRAFT',
          salesOrderId: so?.id ?? null,
          salesOrderNo: input.salesOrderNo ?? so?.salesOrderNo ?? null,
          planningSource: 'BASIC_7C0',
          remarks: input.remarks ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdBy: userId(req) || null,
          updatedBy: userId(req) || null,
          lines: {
            create: input.lines.map((line, idx) => ({
              tenantId,
              lineNo: idx + 1,
              itemId: line.itemId,
              warehouseId: line.warehouseId,
              quantity: line.quantity,
              salesOrderId: line.salesOrderId ?? so?.id ?? null,
              salesOrderLineId: line.salesOrderLineId ?? null,
              remarks: line.remarks ?? null,
            })),
          },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      })
    })
    return mapOutboundDispatch(row)
  } catch (err) {
    if (input.idempotencyKey) {
      const existing = await repo.findByIdempotencyKey(tenantId, input.idempotencyKey)
      if (existing) return mapOutboundDispatch(existing)
    }
    throw err
  }
}

export async function updateOutboundDispatch(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateOutboundDispatchInput,
) {
  const existing = await repo.findById(tenantId, id)
  if (!existing) throw new NotFoundError('Outbound dispatch not found')
  if (existing.status !== 'DRAFT') {
    throw new InvalidStateError('Only DRAFT outbound dispatches can be edited')
  }

  if (input.lines) {
    await validateLinesForCreate(tenantId, existing.salesOrderId ?? undefined, input.lines)
  }

  const row = await prisma.$transaction(async (tx) => {
    if (input.lines) {
      await tx.outboundDispatchLine.deleteMany({ where: { outboundDispatchId: id, tenantId } })
      await tx.outboundDispatchLine.createMany({
        data: input.lines.map((line, idx) => ({
          tenantId,
          outboundDispatchId: id,
          lineNo: idx + 1,
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          quantity: line.quantity,
          salesOrderId: line.salesOrderId ?? existing.salesOrderId ?? null,
          salesOrderLineId: line.salesOrderLineId ?? null,
          remarks: line.remarks ?? null,
        })),
      })
    }
    return tx.outboundDispatch.update({
      where: { id },
      data: {
        remarks: input.remarks === undefined ? undefined : input.remarks,
        updatedBy: userId(req) || null,
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    })
  })

  return mapOutboundDispatch(row)
}

async function postConfirmedFgDispatch(
  req: Request,
  tenantId: string,
  id: string,
  options: { requireIssuedChallan: boolean },
) {
  const existing = await repo.findById(tenantId, id)
  if (!existing) throw new NotFoundError('Outbound dispatch not found')
  if (existing.status === 'CONFIRMED') return mapOutboundDispatch(existing)
  if (existing.status === 'REVERSED') {
    throw new InvalidStateError('Reversed outbound dispatches cannot be re-posted; create a new draft')
  }
  if (existing.status !== 'DRAFT') {
    throw new InvalidStateError('Only DRAFT outbound dispatches can be posted')
  }
  if (!existing.lines.length) throw new ValidationError('Outbound dispatch has no lines')

  await assertPickListsAllowConfirm(tenantId, id)
  await assertPackingAllowsConfirm(tenantId, id)
  await assertChallanAllowsConfirm(tenantId, id, {
    requireIssuedChallan: options.requireIssuedChallan,
  })

  const confirmSalesOrders = new Set<string>()
  if (existing.salesOrderId) confirmSalesOrders.add(existing.salesOrderId)
  for (const line of existing.lines) {
    if (line.salesOrderId) confirmSalesOrders.add(line.salesOrderId)
  }
  for (const salesOrderId of confirmSalesOrders) {
    await assertSalesOrderAllowsDispatch(tenantId, salesOrderId)
  }

  for (const line of existing.lines) {
    if (line.salesOrderLineId && line.salesOrderId) {
      await assertDispatchQtyAllowed(
        tenantId,
        line.salesOrderId,
        line.salesOrderLineId,
        Number(line.quantity),
      )
    }
  }

  const issueMovements: InventoryStockMovement[] = []
  const row = await prisma.$transaction(async (tx) => {
    for (const line of existing.lines) {
      const movement = await InventoryPostingService.postFgDispatchIssue(
        {
          tenantId,
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          quantity: line.quantity,
          salesOrderId: line.salesOrderId ?? undefined,
          outboundDispatchLineId: line.id,
          referenceNo: existing.dispatchNo,
          remarks: line.remarks ?? `FG dispatch ${existing.dispatchNo}`,
          idempotencyKey: `fg-dispatch:${id}:${line.id}`,
          createdBy: userId(req) || undefined,
          allowNegativeStock: canOverrideNegativeStock(req),
          consumeSoReservation: true,
        },
        tx,
      )
      await tx.outboundDispatchLine.update({
        where: { id: line.id },
        data: {
          inventoryMovementId: movement.id,
          inventoryMovementNo: movement.movementNumber,
        },
      })
      issueMovements.push(movement)
    }

    return tx.outboundDispatch.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedBy: userId(req) || null,
        updatedBy: userId(req) || null,
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    })
  })

  await tryRecordInventoryAccountingEventsForMovements(req, tenantId, issueMovements, {
    sourceDocumentType: 'OUTBOUND_DISPATCH',
    sourceDocumentId: id,
    narration: `FG dispatch ${existing.dispatchNo}`,
  })

  await refreshRequirementsForDispatch(tenantId, row, userId(req) || undefined)
  return mapOutboundDispatch(row)
}

/** Phase 7C0 compatibility confirm — soft challan gate (issued only when challans exist). */
export async function confirmOutboundDispatch(req: Request, tenantId: string, id: string) {
  return postConfirmedFgDispatch(req, tenantId, id, { requireIssuedChallan: false })
}

/**
 * Phase 7C5 hardened post — same FG_DISPATCH posting as confirm, but workbench
 * dispatches (`WORKBENCH_7C1`) require an ISSUED Delivery Challan qty match.
 * Basic 7C0 drafts keep the soft challan gate.
 */
export async function postOutboundDispatch(req: Request, tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id)
  if (!existing) throw new NotFoundError('Outbound dispatch not found')
  const requireIssuedChallan = existing.planningSource === 'WORKBENCH_7C1'
  return postConfirmedFgDispatch(req, tenantId, id, { requireIssuedChallan })
}

/**
 * Phase 7C5 reverse — compensating FG_DISPATCH inward per line, status → REVERSED.
 * Fulfilment net dispatched qty drops; remaining-to-dispatch opens again.
 */
export async function reverseOutboundDispatch(
  req: Request,
  tenantId: string,
  id: string,
  input: { reason?: string },
) {
  const existing = await repo.findById(tenantId, id)
  if (!existing) throw new NotFoundError('Outbound dispatch not found')
  if (existing.status === 'REVERSED') return mapOutboundDispatch(existing)
  if (existing.status !== 'CONFIRMED') {
    throw new InvalidStateError('Only CONFIRMED outbound dispatches can be reversed')
  }
  if (!existing.lines.length) throw new ValidationError('Outbound dispatch has no lines')

  const reversalMovements: InventoryStockMovement[] = []
  const row = await prisma.$transaction(async (tx) => {
    for (const line of existing.lines) {
      const movement = await InventoryPostingService.post(
        {
          tenantId,
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          movementType: 'INWARD',
          referenceType: 'FG_DISPATCH',
          quantity: line.quantity,
          salesOrderId: line.salesOrderId ?? undefined,
          outboundDispatchLineId: line.id,
          referenceNo: existing.dispatchNo,
          remarks: input.reason?.trim()
            ? `FG dispatch reverse ${existing.dispatchNo}: ${input.reason.trim()}`
            : `FG dispatch reverse ${existing.dispatchNo}`,
          idempotencyKey: `fg-dispatch-rev:${id}:${line.id}`,
          createdBy: userId(req) || undefined,
          allowNegativeStock: true,
        },
        tx,
      )
      await tx.outboundDispatchLine.update({
        where: { id: line.id },
        data: {
          reverseInventoryMovementId: movement.id,
          reverseInventoryMovementNo: movement.movementNumber,
        },
      })
      reversalMovements.push(movement)
    }

    return tx.outboundDispatch.update({
      where: { id },
      data: {
        status: 'REVERSED',
        reversedAt: new Date(),
        reversedBy: userId(req) || null,
        reverseReason: input.reason?.trim() || null,
        updatedBy: userId(req) || null,
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    })
  })

  await tryRecordInventoryAccountingEventsForMovements(req, tenantId, reversalMovements, {
    sourceDocumentType: 'OUTBOUND_DISPATCH',
    sourceDocumentId: id,
    narration: `FG dispatch reverse ${existing.dispatchNo}`,
  })

  await refreshRequirementsForDispatch(tenantId, row, userId(req) || undefined)
  return mapOutboundDispatch(row)
}

export async function cancelOutboundDispatch(
  req: Request,
  tenantId: string,
  id: string,
  input: CancelOutboundDispatchInput,
) {
  const existing = await repo.findById(tenantId, id)
  if (!existing) throw new NotFoundError('Outbound dispatch not found')
  if (existing.status === 'CANCELLED') return mapOutboundDispatch(existing)
  if (existing.status === 'CONFIRMED') {
    throw new ConflictError(
      'Confirmed outbound dispatches cannot be cancelled — use POST /outbound/:id/reverse (Phase 7C5)',
    )
  }
  if (existing.status === 'REVERSED') {
    throw new InvalidStateError('Reversed outbound dispatches cannot be cancelled')
  }
  if (existing.status !== 'DRAFT') {
    throw new InvalidStateError('Only DRAFT outbound dispatches can be cancelled')
  }

  const row = await prisma.outboundDispatch.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: userId(req) || null,
      cancellationReason: input.reason ?? null,
      updatedBy: userId(req) || null,
    },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
  })
  await refreshRequirementsForDispatch(tenantId, row, userId(req) || undefined)
  return mapOutboundDispatch(row)
}
