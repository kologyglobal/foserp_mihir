import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { resolveManufacturedProductItem } from '../shared/manufacturing.helpers.js'
import { toDecimal } from '../shared/quantity.service.js'
import { resolveActiveManufacturingSetup, createProductionOrderRecord } from '../shared/production-order-factory.service.js'
import * as repo from './demand.repository.js'
import type { ConvertSalesOrderLineInput } from './demand.schemas.js'

export interface SalesOrderLineDto {
  id: string
  lineNo?: number
  productOrItem?: string
  description?: string
  productId?: string | null
  qty: number
  uom?: string
}

const CONVERTIBLE_SO_STATUSES = new Set(['confirmed', 'in_production'])

function parseLines(value: unknown): SalesOrderLineDto[] {
  return Array.isArray(value) ? (value as SalesOrderLineDto[]) : []
}

async function loadConvertibleSalesOrder(tenantId: string, salesOrderId: string) {
  const salesOrder = await prisma.crmSalesOrder.findFirst({ where: { id: salesOrderId, ...tenantActiveFilter(tenantId) } })
  if (!salesOrder) throw new NotFoundError('Sales order not found')
  return salesOrder
}

export async function listEligibleSalesOrders(tenantId: string) {
  const orders = await prisma.crmSalesOrder.findMany({
    where: { ...tenantActiveFilter(tenantId), status: { in: Array.from(CONVERTIBLE_SO_STATUSES) } },
    orderBy: { orderDate: 'desc' },
    take: 100,
  })
  return orders.map((order) => ({
    id: order.id,
    salesOrderNo: order.salesOrderNo,
    customerId: order.companyId,
    status: order.status,
    orderDate: order.orderDate,
    requiredDate: order.requiredDate,
    lineCount: parseLines(order.lines).length,
  }))
}

export async function getSalesOrderLineEligibility(tenantId: string, salesOrderId: string) {
  const salesOrder = await loadConvertibleSalesOrder(tenantId, salesOrderId)
  const lines = parseLines(salesOrder.lines)

  const results = await Promise.all(
    lines.map(async (line) => {
      const reasons: string[] = []
      if (!CONVERTIBLE_SO_STATUSES.has(salesOrder.status)) {
        reasons.push(`Sales order status "${salesOrder.status}" is not eligible for production conversion`)
      }

      let resolvedItem: { id: string; code: string; name: string } | null = null
      if (!line.productId) {
        reasons.push('Line has no productId to resolve a manufactured item')
      } else {
        try {
          resolvedItem = await resolveManufacturedProductItem(tenantId, line.productId)
        } catch (err) {
          reasons.push(err instanceof Error ? err.message : 'Could not resolve line product to a manufactured item')
        }
      }

      let hasActiveBom = false
      let hasActiveRouting = false
      let hasProfile = false
      if (resolvedItem) {
        try {
          await resolveActiveManufacturingSetup(tenantId, resolvedItem.id)
          hasProfile = true
          hasActiveBom = true
          hasActiveRouting = true
        } catch (err) {
          reasons.push(err instanceof Error ? err.message : 'Manufacturing setup not ready')
        }
      }

      const sourceLineKey = `${salesOrderId}:${line.id}`
      const demand = await repo.findDemandBySourceLineKey(tenantId, sourceLineKey)
      const requestedQuantity = demand ? toDecimal(demand.requestedQuantity) : toDecimal(line.qty)
      const convertedQuantity = demand ? toDecimal(demand.convertedQuantity) : new Prisma.Decimal(0)
      const remainingQuantity = demand ? toDecimal(demand.remainingQuantity) : toDecimal(line.qty)

      if (demand && demand.status === 'FULLY_CONVERTED') {
        reasons.push('Line demand is already fully converted')
      }
      if (demand && demand.status === 'CANCELLED') {
        reasons.push('Line demand has been cancelled')
      }

      return {
        lineId: line.id,
        productId: line.productId ?? null,
        productOrItem: line.productOrItem ?? null,
        description: line.description ?? null,
        qty: line.qty,
        uom: line.uom ?? null,
        resolvedItemId: resolvedItem?.id ?? null,
        resolvedItemCode: resolvedItem?.code ?? null,
        eligible: reasons.length === 0,
        reasons,
        readiness: { hasProfile, hasActiveBom, hasActiveRouting },
        demandId: demand?.id ?? null,
        demandStatus: demand?.status ?? null,
        requestedQuantity: requestedQuantity.toString(),
        convertedQuantity: convertedQuantity.toString(),
        remainingQuantity: remainingQuantity.toString(),
      }
    }),
  )

  return {
    salesOrder: {
      id: salesOrder.id,
      salesOrderNo: salesOrder.salesOrderNo,
      customerId: salesOrder.companyId,
      status: salesOrder.status,
    },
    lines: results,
  }
}

export async function convertSalesOrderLine(
  req: Request,
  tenantId: string,
  salesOrderId: string,
  lineRef: string,
  input: ConvertSalesOrderLineInput,
) {
  const userId = req.context?.userId ?? ''

  if (input.idempotencyKey) {
    const existingOrder = await prisma.productionOrder.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey, deletedAt: null },
    })
    if (existingOrder) {
      const existingDemand = existingOrder.demandId ? await repo.getDemand(tenantId, existingOrder.demandId) : null
      return { demand: existingDemand, order: existingOrder }
    }
  }

  const salesOrder = await loadConvertibleSalesOrder(tenantId, salesOrderId)
  if (!CONVERTIBLE_SO_STATUSES.has(salesOrder.status)) {
    throw new ValidationError(
      `Sales order must be confirmed before production conversion (current status: "${salesOrder.status}")`,
    )
  }

  const lines = parseLines(salesOrder.lines)
  const line = lines.find((candidate) => candidate.id === lineRef)
  if (!line) throw new NotFoundError(`Sales order line not found: ${lineRef}`)
  if (!line.productId) throw new ValidationError('Sales order line has no productId to resolve a manufactured item')

  const resolvedItem = await resolveManufacturedProductItem(tenantId, line.productId)
  const sourceLineKey = `${salesOrderId}:${lineRef}`
  const quantity = toDecimal(input.quantity)

  const result = await prisma.$transaction(async (tx) => {
    let demand = await tx.productionDemand.findFirst({ where: { tenantId, sourceLineKey, deletedAt: null } })

    if (!demand) {
      const demandNumber = await nextCode(tenantId, 'PRODUCTION_DEMAND', tx)
      const requestedQuantity = toDecimal(line.qty)
      demand = await tx.productionDemand.create({
        data: {
          tenantId,
          demandNumber,
          sourceType: 'SALES_ORDER',
          sourceDocumentType: 'SALES_ORDER',
          sourceDocumentId: salesOrderId,
          sourceLineReference: lineRef,
          sourceLineKey,
          salesOrderId,
          customerId: salesOrder.companyId,
          productItemId: resolvedItem.id,
          requestedQuantity,
          convertedQuantity: new Prisma.Decimal(0),
          remainingQuantity: requestedQuantity,
          cancelledQuantity: new Prisma.Decimal(0),
          uomId: resolvedItem.baseUomId,
          requiredDate: salesOrder.requiredDate ?? null,
          priority: input.priority ?? 'MEDIUM',
          plantCode: input.plantCode ?? null,
          status: 'OPEN',
          createdBy: userId,
          updatedBy: userId,
        },
      })
    }

    const remaining = toDecimal(demand.remainingQuantity)
    if (demand.status === 'CANCELLED') {
      throw new ValidationError('Cannot convert a cancelled demand')
    }
    if (quantity.greaterThan(remaining)) {
      throw new ValidationError(
        `Requested quantity (${quantity.toString()}) exceeds remaining demand quantity (${remaining.toString()})`,
      )
    }

    const requiredCompletionDate =
      (input.requiredDate ? new Date(input.requiredDate) : null) ??
      demand.requiredDate ??
      salesOrder.requiredDate ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const order = await createProductionOrderRecord(tx, {
      tenantId,
      userId,
      demandId: demand.id,
      sourceType: 'SALES_ORDER',
      sourceDocumentId: salesOrderId,
      sourceLineReference: lineRef,
      salesOrderId,
      customerId: salesOrder.companyId,
      productItemId: resolvedItem.id,
      plannedQuantity: quantity,
      requiredCompletionDate,
      priority: input.priority ?? demand.priority,
      plantCode: input.plantCode ?? demand.plantCode,
      managerId: input.managerId ?? null,
      supervisorId: input.supervisorId ?? null,
      notes: input.notes ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    })

    const newRemaining = remaining.minus(quantity)
    const updatedDemand = await tx.productionDemand.update({
      where: { id: demand.id },
      data: {
        convertedQuantity: toDecimal(demand.convertedQuantity).plus(quantity),
        remainingQuantity: newRemaining,
        status: newRemaining.lessThanOrEqualTo(0) ? 'FULLY_CONVERTED' : 'PARTIALLY_CONVERTED',
        updatedBy: userId,
      },
    })

    if (salesOrder.status === 'confirmed') {
      await tx.crmSalesOrder.update({
        where: { id: salesOrderId },
        data: { status: 'in_production', updatedBy: userId },
      })
    }

    return { demand: updatedDemand, order }
  })

  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity: 'productionOrder',
    entityId: result.order.id,
    action: 'CONVERT_SO_LINE',
    newValues: result,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })

  return result
}

/**
 * Phase 6A1 — Synchronise ProductionDemand pegs from confirmed Sales Orders
 * without creating Work Orders. Idempotent via sourceLineKey uniqueness.
 */
export async function syncConfirmedSalesOrderDemands(
  tenantId: string,
  userId: string,
  options?: {
    plantCode?: string | null
    periodStart?: Date | null
    periodEnd?: Date | null
    demandCutoffDate?: Date | null
    customerId?: string | null
    productItemId?: string | null
  },
) {
  const orders = await prisma.crmSalesOrder.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      status: { in: Array.from(CONVERTIBLE_SO_STATUSES) },
      ...(options?.customerId ? { companyId: options.customerId } : {}),
    },
    take: 500,
  })

  let created = 0
  let updated = 0
  let skipped = 0
  const demandIds: string[] = []

  for (const salesOrder of orders) {
    const lines = parseLines(salesOrder.lines)
    for (const line of lines) {
      if (!line.productId || !(line.qty > 0)) {
        skipped += 1
        continue
      }

      let resolvedItem: Awaited<ReturnType<typeof resolveManufacturedProductItem>>
      try {
        resolvedItem = await resolveManufacturedProductItem(tenantId, line.productId)
      } catch {
        skipped += 1
        continue
      }

      if (options?.productItemId && resolvedItem.id !== options.productItemId) {
        skipped += 1
        continue
      }

      const requiredDate = salesOrder.requiredDate ?? null
      if (options?.periodStart && requiredDate && requiredDate < options.periodStart) {
        skipped += 1
        continue
      }
      if (options?.periodEnd && requiredDate && requiredDate > options.periodEnd) {
        skipped += 1
        continue
      }
      if (options?.demandCutoffDate && requiredDate && requiredDate > options.demandCutoffDate) {
        skipped += 1
        continue
      }

      const sourceLineKey = `${salesOrder.id}:${line.id}`
      const requestedQuantity = toDecimal(line.qty)

      const existing = await prisma.productionDemand.findFirst({
        where: { tenantId, sourceLineKey, deletedAt: null },
      })

      if (existing) {
        // Safe metadata refresh only when demand still open / partial and qty not reduced below converted
        if (existing.status === 'CANCELLED' || existing.status === 'FULLY_CONVERTED') {
          demandIds.push(existing.id)
          skipped += 1
          continue
        }
        const converted = toDecimal(existing.convertedQuantity)
        if (requestedQuantity.lessThan(converted)) {
          demandIds.push(existing.id)
          skipped += 1
          continue
        }
        const newRemaining = requestedQuantity.minus(converted)
        const refreshed = await prisma.productionDemand.update({
          where: { id: existing.id },
          data: {
            requestedQuantity,
            remainingQuantity: newRemaining,
            requiredDate,
            customerId: salesOrder.companyId,
            sourceSnapshotJson: {
              salesOrderNo: salesOrder.salesOrderNo,
              lineId: line.id,
              lineNo: line.lineNo ?? null,
              description: line.description ?? null,
              productOrItem: line.productOrItem ?? null,
              qty: line.qty,
            },
            plantCode: options?.plantCode ?? existing.plantCode,
            updatedBy: userId,
            status: newRemaining.lessThanOrEqualTo(0)
              ? 'FULLY_CONVERTED'
              : converted.greaterThan(0)
                ? 'PARTIALLY_CONVERTED'
                : 'OPEN',
          },
        })
        demandIds.push(refreshed.id)
        updated += 1
        continue
      }

      const demandNumber = await nextCode(tenantId, 'PRODUCTION_DEMAND')
      try {
        const createdDemand = await prisma.productionDemand.create({
          data: {
            tenantId,
            demandNumber,
            sourceType: 'SALES_ORDER',
            sourceDocumentType: 'SALES_ORDER',
            sourceDocumentId: salesOrder.id,
            sourceLineReference: line.id,
            sourceLineKey,
            sourceSnapshotJson: {
              salesOrderNo: salesOrder.salesOrderNo,
              lineId: line.id,
              lineNo: line.lineNo ?? null,
              description: line.description ?? null,
              productOrItem: line.productOrItem ?? null,
              qty: line.qty,
            },
            salesOrderId: salesOrder.id,
            customerId: salesOrder.companyId,
            productItemId: resolvedItem.id,
            requestedQuantity,
            convertedQuantity: new Prisma.Decimal(0),
            remainingQuantity: requestedQuantity,
            cancelledQuantity: new Prisma.Decimal(0),
            uomId: resolvedItem.baseUomId,
            requiredDate,
            priority: 'MEDIUM',
            plantCode: options?.plantCode ?? null,
            status: 'OPEN',
            createdBy: userId,
            updatedBy: userId,
          },
        })
        demandIds.push(createdDemand.id)
        created += 1
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const raced = await prisma.productionDemand.findFirst({
            where: { tenantId, sourceLineKey, deletedAt: null },
          })
          if (raced) demandIds.push(raced.id)
          skipped += 1
          continue
        }
        throw err
      }
    }
  }

  return { created, updated, skipped, demandIds }
}
