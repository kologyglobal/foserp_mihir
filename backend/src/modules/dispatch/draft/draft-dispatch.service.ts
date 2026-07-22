import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getLineFulfilmentPosition } from '../fulfilment/sales-order-fulfilment-position.service.js'
import { mapOutboundDispatch } from '../outbound/outbound-dispatch.mappers.js'
import * as reqRepo from '../requirements/dispatch-requirement.repository.js'
import { synchroniseDispatchRequirements } from '../requirements/dispatch-requirement-sync.service.js'
import { roundQty } from '../shared/dispatch-qty.js'

export interface CreateDraftFromRequirementsInput {
  requirementIds: string[]
  lines?: Array<{ requirementId: string; quantity: number; warehouseId?: string }>
  plannedDispatchDate?: string
  preferredWarehouseId?: string
  remarks?: string
  idempotencyKey?: string
  planBeforeStockAllowed?: boolean
  sourceFingerprintByRequirement?: Record<string, string>
}

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

export async function createDraftFromRequirements(
  req: Request,
  tenantId: string,
  input: CreateDraftFromRequirementsInput,
) {
  if (input.idempotencyKey) {
    const existing = await prisma.outboundDispatch.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    })
    if (existing) return mapOutboundDispatch(existing)
  }

  if (!input.requirementIds?.length) throw new ValidationError('requirementIds is required')

  type RequirementRow = NonNullable<Awaited<ReturnType<typeof reqRepo.findById>>>
  const requirements: RequirementRow[] = []
  for (const id of input.requirementIds) {
    const row = await reqRepo.findById(tenantId, id)
    if (!row) throw new NotFoundError(`Dispatch requirement ${id} not found`)
    requirements.push(row)
  }

  const customerId = requirements[0]!.customerId
  const shipToKey = requirements[0]!.shipToKey ?? 'UNSPECIFIED'
  for (const row of requirements) {
    if (row.customerId !== customerId) {
      throw new ValidationError('Cannot combine requirements for different customers into one Draft Dispatch')
    }
    if ((row.shipToKey ?? 'UNSPECIFIED') !== shipToKey) {
      throw new ValidationError('Cannot combine requirements with different ship-to addresses')
    }
    if (row.status === 'CANCELLED' || row.status === 'FULFILLED') {
      throw new ValidationError(`Requirement ${row.requirementNumber} is ${row.status}`)
    }
  }

  const lineInputs: Array<{ requirementId: string; quantity: number; warehouseId?: string }> =
    input.lines?.length
      ? input.lines
      : input.requirementIds.map((requirementId) => ({ requirementId, quantity: 0 }))

  const createLines: Array<{
    tenantId: string
    lineNo: number
    itemId: string
    warehouseId: string
    quantity: number
    salesOrderId: string
    salesOrderLineId: string
    dispatchRequirementId: string
    readyQuantitySnapshot: number
    remarks: string | null
  }> = []

  let headerSalesOrderId: string | null = null
  let headerSalesOrderNo: string | null = null

  for (let idx = 0; idx < lineInputs.length; idx += 1) {
    const lineInput = lineInputs[idx]!
    const requirement = requirements.find((r) => r.id === lineInput.requirementId)
    if (!requirement) throw new ValidationError(`Unknown requirement ${lineInput.requirementId}`)

    const expectedFp = input.sourceFingerprintByRequirement?.[requirement.id]
    const position = await getLineFulfilmentPosition(
      tenantId,
      requirement.salesOrderId,
      requirement.salesOrderLineId,
    )
    if (expectedFp && expectedFp !== position.sourceFingerprint) {
      throw new ConflictError(
        'Sales Order fulfilment changed after this requirement was loaded. Review the latest quantity.',
      )
    }
    if (!position.itemId) {
      throw new ValidationError(`Requirement ${requirement.requirementNumber} has no resolvable finished-good item`)
    }

    const qty =
      lineInput.quantity > 0
        ? lineInput.quantity
        : position.readyQty > 0
          ? position.readyQty
          : position.remainingToDispatchQty
    if (!(qty > 0)) throw new ValidationError(`Requested quantity must be positive for ${requirement.requirementNumber}`)
    if (qty > position.remainingToDispatchQty + 1e-9) {
      throw new ValidationError(
        `Requested qty ${qty} exceeds remaining ${position.remainingToDispatchQty} for ${requirement.requirementNumber}`,
      )
    }
    const allowPlanBeforeStock = Boolean(input.planBeforeStockAllowed)
    if (!allowPlanBeforeStock && qty > position.readyQty + 1e-9) {
      throw new ValidationError(
        `Requested qty ${qty} exceeds currently ready qty ${position.readyQty}. Enable plan-before-stock only when policy allows.`,
      )
    }

    const warehouseId =
      lineInput.warehouseId ||
      input.preferredWarehouseId ||
      requirement.preferredWarehouseId ||
      (
        await prisma.inventoryStockBalance.findFirst({
          where: { tenantId, itemId: position.itemId, onHandQty: { gt: 0 } },
          select: { warehouseId: true },
        })
      )?.warehouseId
    if (!warehouseId) throw new ValidationError(`No warehouse available for item on ${requirement.requirementNumber}`)

    if (!headerSalesOrderId) {
      headerSalesOrderId = requirement.salesOrderId
      headerSalesOrderNo = requirement.salesOrder.salesOrderNo
    } else if (headerSalesOrderId !== requirement.salesOrderId) {
      headerSalesOrderId = null
      headerSalesOrderNo = null
    }

    createLines.push({
      tenantId,
      lineNo: idx + 1,
      itemId: position.itemId,
      warehouseId,
      quantity: roundQty(qty),
      salesOrderId: requirement.salesOrderId,
      salesOrderLineId: requirement.salesOrderLineId,
      dispatchRequirementId: requirement.id,
      readyQuantitySnapshot: position.readyQty,
      remarks: null,
    })
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const dispatchNo = await nextCode(tenantId, 'OUTBOUND_DISPATCH', tx)
      return tx.outboundDispatch.create({
        data: {
          tenantId,
          dispatchNo,
          status: 'DRAFT',
          salesOrderId: headerSalesOrderId,
          salesOrderNo: headerSalesOrderNo,
          customerId,
          shipToKey,
          shipToAddress: requirements[0]!.shipToAddress,
          plannedDispatchDate: input.plannedDispatchDate
            ? new Date(`${input.plannedDispatchDate}T00:00:00.000Z`)
            : null,
          preferredWarehouseId: input.preferredWarehouseId ?? createLines[0]?.warehouseId ?? null,
          planningSource: 'WORKBENCH_7C1',
          planBeforeStockAllowed: Boolean(input.planBeforeStockAllowed),
          remarks: input.remarks ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdBy: userId(req) || null,
          updatedBy: userId(req) || null,
          lines: { create: createLines },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      })
    })

    await synchroniseDispatchRequirements(tenantId, {
      salesOrderId: headerSalesOrderId ?? undefined,
      userId: userId(req) || undefined,
    })
    // If multi-SO draft, refresh each SO once
    if (!headerSalesOrderId) {
      for (const soId of [...new Set(requirements.map((r) => r.salesOrderId))]) {
        await synchroniseDispatchRequirements(tenantId, { salesOrderId: soId, userId: userId(req) || undefined })
      }
    }

    return mapOutboundDispatch(row)
  } catch (err) {
    if (input.idempotencyKey) {
      const existing = await prisma.outboundDispatch.findFirst({
        where: { tenantId, idempotencyKey: input.idempotencyKey, deletedAt: null },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      })
      if (existing) return mapOutboundDispatch(existing)
    }
    throw err
  }
}
