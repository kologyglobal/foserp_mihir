import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import { getStockPosition } from '../../inventory/balances/balance.service.js'
import { assertItem, assertUom } from '../shared/manufacturing.helpers.js'
import { createProductionOrderRecord, resolveActiveManufacturingSetup } from '../shared/production-order-factory.service.js'
import { toDecimal } from '../shared/quantity.service.js'
import * as repo from './plan.repository.js'
import type {
  CancelPlanInput,
  CreatePlanInput,
  GenerateWorkOrdersInput,
  ListPlansQuery,
  PlanLineInput,
  UpdatePlanInput,
} from './plan.schemas.js'

const OPEN_WO_STATUSES = ['DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD'] as const

async function audit(
  req: Request,
  tenantId: string,
  entityId: string,
  action: string,
  oldValues: unknown,
  newValues: unknown,
) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity: 'productionPlan',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(value)
}

async function resolveLineUom(tenantId: string, line: PlanLineInput): Promise<string> {
  if (line.uomId) {
    await assertUom(tenantId, line.uomId)
    return line.uomId
  }
  const item = await assertItem(tenantId, line.productItemId)
  if (!item.baseUomId) throw new ValidationError(`Item ${item.code} has no base UOM`)
  return item.baseUomId
}

async function openWorkOrderQty(tenantId: string, productItemId: string): Promise<Prisma.Decimal> {
  const rows = await prisma.productionOrder.findMany({
    where: {
      tenantId,
      productItemId,
      deletedAt: null,
      status: { in: [...OPEN_WO_STATUSES] },
    },
    select: { plannedQuantity: true, completedGoodQuantity: true },
  })
  return rows.reduce((sum, row) => {
    const remaining = toDecimal(row.plannedQuantity).minus(toDecimal(row.completedGoodQuantity))
    return sum.plus(Prisma.Decimal.max(remaining, new Prisma.Decimal(0)))
  }, new Prisma.Decimal(0))
}

async function fgFreeQty(tenantId: string, productItemId: string, warehouseId: string | null): Promise<Prisma.Decimal> {
  if (!warehouseId) return new Prisma.Decimal(0)
  const position = await getStockPosition(tenantId, productItemId, warehouseId)
  return toDecimal(position.freeQty)
}

async function bomComponentShortages(
  tenantId: string,
  productItemId: string,
  suggestedQty: Prisma.Decimal,
  warehouseId: string | null,
) {
  let setup: Awaited<ReturnType<typeof resolveActiveManufacturingSetup>> | null = null
  try {
    setup = await resolveActiveManufacturingSetup(tenantId, productItemId)
  } catch {
    return { bomReady: false, shortages: [] as Array<{ itemId: string; requiredQty: string; freeQty: string }> }
  }

  const bomLines = await prisma.manufacturingBomLine.findMany({
    where: { bomVersionId: setup.bomVersion.id, tenantId, deletedAt: null },
  })
  const baseQty = toDecimal(setup.bomVersion.baseQuantity)
  if (baseQty.lte(0)) {
    return { bomReady: true, shortages: [] }
  }

  const shortages: Array<{ itemId: string; requiredQty: string; freeQty: string }> = []
  for (const line of bomLines) {
    const required = toDecimal(line.quantity).mul(suggestedQty).div(baseQty)
    if (required.lte(0)) continue
    const free = warehouseId
      ? toDecimal((await getStockPosition(tenantId, line.itemId, warehouseId)).freeQty)
      : new Prisma.Decimal(0)
    if (required.greaterThan(free)) {
      shortages.push({
        itemId: line.itemId,
        requiredQty: required.toFixed(4),
        freeQty: free.toFixed(4),
      })
    }
  }
  return { bomReady: true, shortages }
}

function materialStatusFrom(suggested: Prisma.Decimal, shortages: unknown[]): string {
  if (suggested.lte(0)) return 'available'
  if (shortages.length === 0) return 'available'
  return 'shortage'
}

export async function listPlans(tenantId: string, query: ListPlansQuery) {
  return repo.listPlans(tenantId, query)
}

export async function getPlan(tenantId: string, planId: string) {
  return repo.getPlan(tenantId, planId)
}

export async function createPlan(req: Request, tenantId: string, input: CreatePlanInput) {
  const userId = req.context?.userId ?? ''

  if (input.idempotencyKey) {
    const existing = await repo.findPlanByIdempotencyKey(tenantId, input.idempotencyKey)
    if (existing) return existing
  }

  if (input.warehouseId) {
    const wh = await prisma.masterWarehouse.findFirst({
      where: { id: input.warehouseId, tenantId, deletedAt: null },
    })
    if (!wh) throw new ValidationError('Warehouse not found')
  }

  const lineCreates: Prisma.ProductionPlanLineCreateWithoutPlanInput[] = []
  let lineNo = 1
  for (const line of input.lines) {
    await assertItem(tenantId, line.productItemId)
    const uomId = await resolveLineUom(tenantId, line)
    lineCreates.push(repo.mapLineCreateInput(tenantId, lineNo, line, uomId, userId))
    lineNo += 1
  }

  const planNumber = await nextCode(tenantId, 'PRODUCTION_PLAN')
  try {
    const created = await repo.createPlan(
      {
        tenant: { connect: { id: tenantId } },
        planNumber,
        planName: input.planName,
        planDate: new Date(input.planDate),
        sourceType: input.sourceType,
        status: 'DRAFT',
        warehouse: input.warehouseId ? { connect: { id: input.warehouseId } } : undefined,
        plantCode: input.plantCode ?? null,
        periodFrom: parseDate(input.periodFrom),
        periodTo: parseDate(input.periodTo),
        notes: input.notes ?? null,
        ownerUserId: input.ownerUserId ?? userId,
        idempotencyKey: input.idempotencyKey ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
      lineCreates,
    )
    await audit(req, tenantId, created.id, 'CREATE', undefined, created)
    return created
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ValidationError('A production plan with this idempotency key already exists')
    }
    throw err
  }
}

export async function updatePlan(req: Request, tenantId: string, planId: string, input: UpdatePlanInput) {
  const userId = req.context?.userId ?? ''
  const plan = await repo.getPlan(tenantId, planId)
  if (plan.status !== 'DRAFT') {
    throw new InvalidStateError('Only draft plans can be edited')
  }

  if (input.warehouseId) {
    const wh = await prisma.masterWarehouse.findFirst({
      where: { id: input.warehouseId, tenantId, deletedAt: null },
    })
    if (!wh) throw new ValidationError('Warehouse not found')
  }

  const header: Prisma.ProductionPlanUpdateInput = {
    ...(input.planName !== undefined ? { planName: input.planName } : {}),
    ...(input.planDate !== undefined ? { planDate: new Date(input.planDate) } : {}),
    ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
    ...(input.warehouseId !== undefined
      ? input.warehouseId
        ? { warehouse: { connect: { id: input.warehouseId } } }
        : { warehouse: { disconnect: true } }
      : {}),
    ...(input.plantCode !== undefined ? { plantCode: input.plantCode } : {}),
    ...(input.periodFrom !== undefined ? { periodFrom: parseDate(input.periodFrom) } : {}),
    ...(input.periodTo !== undefined ? { periodTo: parseDate(input.periodTo) } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
    updatedBy: userId,
  }

  let updated
  if (input.lines) {
    const lineRows: Prisma.ProductionPlanLineCreateManyInput[] = []
    let lineNo = 1
    for (const line of input.lines) {
      await assertItem(tenantId, line.productItemId)
      const uomId = await resolveLineUom(tenantId, line)
      lineRows.push(repo.mapLineCreateManyInput(tenantId, planId, lineNo, line, uomId, userId))
      lineNo += 1
    }
    updated = await repo.replaceDraftLines(tenantId, planId, lineRows, header)
  } else {
    updated = await repo.updatePlanHeader(tenantId, planId, header)
  }

  await audit(req, tenantId, planId, 'UPDATE', plan, updated)
  return updated
}

export async function releasePlan(req: Request, tenantId: string, planId: string) {
  const userId = req.context?.userId ?? ''
  const plan = await repo.getPlan(tenantId, planId)
  if (plan.status !== 'DRAFT') {
    throw new InvalidStateError(`Cannot release a plan in ${plan.status} status`)
  }
  if (plan.lines.length === 0) {
    throw new ValidationError('Plan has no lines')
  }

  const updated = await repo.updatePlanHeader(tenantId, planId, {
    status: 'PLANNED',
    releasedAt: new Date(),
    releasedBy: userId,
    updatedBy: userId,
  })
  await audit(req, tenantId, planId, 'RELEASE', plan, updated)
  return updated
}

export async function previewNetting(req: Request, tenantId: string, planId: string) {
  const userId = req.context?.userId ?? ''
  const plan = await repo.getPlan(tenantId, planId)
  if (plan.status === 'CANCELLED' || plan.status === 'CLOSED') {
    throw new InvalidStateError(`Cannot net a plan in ${plan.status} status`)
  }

  const warehouseId = plan.warehouseId
  const lineResults = []

  for (const line of plan.lines) {
    if (line.ignored) {
      lineResults.push({
        lineId: line.id,
        ignored: true,
        availableFinishedStock: '0.0000',
        openWorkOrderQuantity: '0.0000',
        suggestedQuantity: '0.0000',
        bomReady: false,
        materialStatus: 'not_checked',
        componentShortages: [],
      })
      continue
    }

    const available = await fgFreeQty(tenantId, line.productItemId, warehouseId)
    const openWo = await openWorkOrderQty(tenantId, line.productItemId)
    const need = toDecimal(line.demandQuantity).plus(toDecimal(line.safetyStockQuantity))
    const suggested = Prisma.Decimal.max(need.minus(available).minus(openWo), new Prisma.Decimal(0))
    const { bomReady, shortages } = await bomComponentShortages(
      tenantId,
      line.productItemId,
      suggested,
      warehouseId,
    )
    const status = materialStatusFrom(suggested, shortages)

    await repo.updateLineNetting(line.id, {
      availableFinishedStock: available,
      openWorkOrderQuantity: openWo,
      suggestedQuantity: suggested,
      bomReady,
      materialStatus: status,
      updatedBy: userId,
    })

    lineResults.push({
      lineId: line.id,
      ignored: false,
      availableFinishedStock: available.toFixed(4),
      openWorkOrderQuantity: openWo.toFixed(4),
      suggestedQuantity: suggested.toFixed(4),
      bomReady,
      materialStatus: status,
      componentShortages: shortages,
    })
  }

  await audit(req, tenantId, planId, 'PREVIEW_NETTING', undefined, { lines: lineResults.length })
  return {
    planId,
    warehouseId,
    lines: lineResults,
    summary: {
      totalLines: lineResults.length,
      makeLines: lineResults.filter((l) => !l.ignored && toDecimal(l.suggestedQuantity).greaterThan(0)).length,
      shortageLines: lineResults.filter((l) => l.materialStatus === 'shortage').length,
    },
  }
}

export async function generateWorkOrders(
  req: Request,
  tenantId: string,
  planId: string,
  input: GenerateWorkOrdersInput,
) {
  const userId = req.context?.userId ?? ''
  const plan = await repo.getPlan(tenantId, planId)

  if (plan.status !== 'PLANNED' && plan.status !== 'WORK_ORDERS_CREATED') {
    throw new InvalidStateError('Release the plan before generating work orders')
  }

  // Refresh netting so suggested qty is current
  await previewNetting(req, tenantId, planId)
  const fresh = await repo.getPlan(tenantId, planId)

  const targetLines = fresh.lines.filter((line) => {
    if (line.ignored) return false
    if (line.productionOrderId) return false
    if (input.lineIds?.length && !input.lineIds.includes(line.id)) return false
    return toDecimal(line.suggestedQuantity).greaterThan(0)
  })

  if (targetLines.length === 0) {
    throw new ValidationError('No eligible plan lines to convert (need suggested qty > 0 and no WO yet)')
  }

  const created: Array<{ lineId: string; demandId: string; productionOrderId: string; orderNumber: string }> = []

  await prisma.$transaction(async (tx) => {
    for (const line of targetLines) {
      const qty = toDecimal(line.suggestedQuantity)
      const sourceLineKey = `${planId}:${line.id}`
      let demand = await tx.productionDemand.findFirst({
        where: { tenantId, sourceLineKey, deletedAt: null },
      })

      if (!demand) {
        const demandNumber = await nextCode(tenantId, 'PRODUCTION_DEMAND', tx)
        demand = await tx.productionDemand.create({
          data: {
            tenantId,
            demandNumber,
            sourceType: 'PRODUCTION_PLAN',
            sourceDocumentType: 'PRODUCTION_PLAN',
            sourceDocumentId: planId,
            sourceLineReference: String(line.lineNo),
            sourceLineKey,
            productItemId: line.productItemId,
            requestedQuantity: qty,
            convertedQuantity: qty,
            remainingQuantity: new Prisma.Decimal(0),
            cancelledQuantity: new Prisma.Decimal(0),
            uomId: line.uomId,
            requiredDate: line.requiredDate,
            plantCode: fresh.plantCode,
            salesOrderId: line.salesOrderId,
            status: 'FULLY_CONVERTED',
            createdBy: userId,
            updatedBy: userId,
          },
        })
      }

      const requiredDate =
        line.requiredDate ??
        fresh.periodTo ??
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

      const order = await createProductionOrderRecord(tx, {
        tenantId,
        userId,
        demandId: demand.id,
        sourceType: 'PRODUCTION_PLAN',
        sourceDocumentId: planId,
        sourceLineReference: String(line.lineNo),
        salesOrderId: line.salesOrderId,
        productItemId: line.productItemId,
        plannedQuantity: qty,
        requiredCompletionDate: requiredDate,
        plantCode: fresh.plantCode,
        notes: `From plan ${fresh.planNumber}`,
        idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:${line.id}` : `plan-wo:${planId}:${line.id}`,
      })

      await tx.productionPlanLine.update({
        where: { id: line.id },
        data: {
          demandId: demand.id,
          productionOrderId: order.id,
          updatedBy: userId,
        },
      })

      created.push({
        lineId: line.id,
        demandId: demand.id,
        productionOrderId: order.id,
        orderNumber: order.orderNumber,
      })
    }

    await tx.productionPlan.update({
      where: { id: planId },
      data: {
        status: 'WORK_ORDERS_CREATED',
        updatedBy: userId,
      },
    })
  })

  const updated = await repo.getPlan(tenantId, planId)
  await audit(req, tenantId, planId, 'GENERATE_WORK_ORDERS', plan, { created })
  return { plan: updated, created }
}

export async function closePlan(req: Request, tenantId: string, planId: string) {
  const userId = req.context?.userId ?? ''
  const plan = await repo.getPlan(tenantId, planId)
  if (plan.status !== 'PLANNED' && plan.status !== 'WORK_ORDERS_CREATED') {
    throw new InvalidStateError(`Cannot close a plan in ${plan.status} status`)
  }
  const updated = await repo.updatePlanHeader(tenantId, planId, {
    status: 'CLOSED',
    closedAt: new Date(),
    closedBy: userId,
    updatedBy: userId,
  })
  await audit(req, tenantId, planId, 'CLOSE', plan, updated)
  return updated
}

export async function cancelPlan(req: Request, tenantId: string, planId: string, input: CancelPlanInput) {
  const userId = req.context?.userId ?? ''
  const plan = await repo.getPlan(tenantId, planId)
  if (plan.status === 'CLOSED' || plan.status === 'CANCELLED') {
    throw new InvalidStateError(`Cannot cancel a plan in ${plan.status} status`)
  }
  if (plan.lines.some((l) => l.productionOrderId)) {
    throw new InvalidStateError('Cannot cancel a plan after work orders were generated; close instead')
  }
  const updated = await repo.updatePlanHeader(tenantId, planId, {
    status: 'CANCELLED',
    cancelledAt: new Date(),
    cancelledBy: userId,
    cancelReason: input.reason,
    updatedBy: userId,
  })
  await audit(req, tenantId, planId, 'CANCEL', plan, updated)
  return updated
}
