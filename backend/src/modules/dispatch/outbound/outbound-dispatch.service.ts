import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import {
  assertSalesOrderAllowsDispatch,
} from '../../crm/sales-orders/fulfilment/sales-order-dispatch-guard.service.js'
import { assertDispatchQtyAllowed } from '../../crm/sales-orders/fulfilment/sales-order-fulfilment.service.js'
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

/** Phase 7C0 compatibility confirm — soft policy unless hardened workbench applies. */
export async function confirmOutboundDispatch(
  req: Request,
  tenantId: string,
  id: string,
  input?: { idempotencyKey?: string },
) {
  const { postFgDispatch } = await import('../posting/dispatch-posting.service.js')
  return postFgDispatch(req, tenantId, id, {
    mode: 'confirm',
    idempotencyKey: input?.idempotencyKey,
  })
}

/**
 * Phase 7C5 hardened post — same FG_DISPATCH posting via DispatchPostingService.
 * WORKBENCH_7C1 uses hardened policy when DISPATCH_HARDENED_POSTING_ENABLED.
 */
export async function postOutboundDispatch(
  req: Request,
  tenantId: string,
  id: string,
  input?: {
    idempotencyKey?: string
    emergency?: boolean
    overrideReason?: string
    emergencyOverride?: {
      businessReason: string
      urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      riskAcknowledged: boolean
      approvedByName?: string
      approvalReference?: string
      expiresAt?: string
      scope?: string
      remarks?: string
      overrideId?: string
    }
  },
) {
  const { postFgDispatch, resolvePostingPolicyForOutbound } = await import(
    '../posting/dispatch-posting.service.js'
  )
  const existing = await repo.findById(tenantId, id)
  if (!existing) throw new NotFoundError('Outbound dispatch not found')
  const policy = resolvePostingPolicyForOutbound(existing, 'post')
  return postFgDispatch(req, tenantId, id, {
    mode: 'post',
    policy,
    idempotencyKey: input?.idempotencyKey,
    emergency: input?.emergency === true,
    overrideReason: input?.overrideReason,
    emergencyOverride: input?.emergencyOverride,
  })
}

/**
 * Phase 7C5 reverse — delegates to DispatchReversalService (partial + approval + apply).
 */
export async function reverseOutboundDispatch(
  req: Request,
  tenantId: string,
  id: string,
  input: {
    reason?: string
    reasonCode?: string
    force?: boolean
    skipApproval?: boolean
    applyImmediately?: boolean
    requestOnly?: boolean
    lines?: Array<{ outboundDispatchLineId?: string; postingLineId?: string; quantity: number }>
    idempotencyKey?: string
  },
) {
  const { reverseOutboundDispatchCanonical } = await import('../posting/dispatch-reversal.service.js')
  const result = await reverseOutboundDispatchCanonical(req, tenantId, id, input)
  if (!result.awaitingApproval) {
    const row = await repo.findById(tenantId, id)
    if (row) await refreshRequirementsForDispatch(tenantId, row, userId(req) || undefined)
  }
  return result
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
