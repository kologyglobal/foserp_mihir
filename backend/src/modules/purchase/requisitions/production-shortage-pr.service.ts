import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { mapPurchaseRequisitionToDto } from './purchase-requisition.mapper.js'
import { findPurchaseRequisitionById } from './purchase-requisition.repository.js'
import { submitPurchaseRequisition } from './purchase-requisition.service.js'
import type { FromProductionShortageInput } from './requisition.schemas.js'

const PRIORITY_MAP = {
  LOW: 'LOW',
  MEDIUM: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const

const prInclude = { lines: { orderBy: { lineNumber: 'asc' as const } } } as const

/**
 * Manufacturing materials shortage → Purchase Requisition adapter.
 * Uses the current PurchaseRequisition schema (not the legacy requisition.* stack).
 */
export async function createFromProductionShortage(
  req: Request,
  tenantId: string,
  input: FromProductionShortageInput,
) {
  const actorId = req.context?.userId ?? ''
  const priority = PRIORITY_MAP[input.priority] ?? 'NORMAL'

  if (input.idempotencyKey) {
    const existing = await prisma.purchaseRequisition.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        remarks: { contains: `idem:${input.idempotencyKey}` },
      },
      include: prInclude,
    })
    if (existing) return withProductionShortageShape(mapPurchaseRequisitionToDto(existing))
  }

  const itemIds = [...new Set(input.lines.map((line) => line.itemId))]
  const items = await prisma.masterItem.findMany({
    where: { tenantId, id: { in: itemIds }, deletedAt: null },
    select: { id: true, code: true, name: true },
  })
  const itemById = new Map(items.map((item) => [item.id, item]))

  const requisitionNumber = await nextCode(tenantId, 'PURCHASE_REQUISITION')
  const purpose =
    input.purpose?.trim() ||
    `Production shortage for order ${input.productionOrderId}`

  const created = await prisma.purchaseRequisition.create({
    data: {
      tenantId,
      requisitionNumber,
      requisitionDate: new Date(),
      warehouseId: input.warehouseId ?? null,
      requiredDate: input.requiredByDate ? new Date(`${input.requiredByDate.slice(0, 10)}T00:00:00.000Z`) : null,
      priority,
      purchasePurpose: purpose,
      rfqRequired: true,
      status: 'DRAFT',
      remarks: [
        input.projectRef ? `project:${input.projectRef}` : null,
        `productionOrderId:${input.productionOrderId}`,
        input.salesOrderId ? `salesOrderId:${input.salesOrderId}` : null,
        input.idempotencyKey ? `idem:${input.idempotencyKey}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
      createdById: actorId || null,
      updatedById: actorId || null,
      lines: {
        create: input.lines.map((line, index) => {
          const item = itemById.get(line.itemId)
          return {
            tenantId,
            lineNumber: index + 1,
            itemId: line.itemId,
            itemCodeSnapshot: item?.code ?? '',
            itemNameSnapshot: item?.name ?? '',
            requiredQuantity: line.quantity,
            uomId: line.uomId ?? null,
            warehouseId: line.warehouseId ?? input.warehouseId ?? null,
            preferredVendorId: line.preferredVendorId ?? null,
            requiredDate: line.requiredDate
              ? new Date(`${line.requiredDate.slice(0, 10)}T00:00:00.000Z`)
              : null,
            remarks: [
              line.remarks,
              line.productionOrderId ? `po:${line.productionOrderId}` : null,
              line.bomLineId ? `bomLine:${line.bomLineId}` : null,
              line.stageId ? `stage:${line.stageId}` : null,
              line.operationId ? `op:${line.operationId}` : null,
            ]
              .filter(Boolean)
              .join(' | ') || null,
          }
        }),
      },
    },
    include: prInclude,
  })

  if (input.submit) {
    const submitted = await submitPurchaseRequisition(tenantId, created.id, actorId, {})
    return withProductionShortageShape(submitted)
  }

  const loaded = await findPurchaseRequisitionById(tenantId, created.id)
  return withProductionShortageShape(mapPurchaseRequisitionToDto(loaded!))
}

function withProductionShortageShape<T extends { lines: Array<{ requiredQuantity: number }> }>(dto: T) {
  return {
    ...dto,
    source: 'PRODUCTION_SHORTAGE' as const,
    lines: dto.lines.map((line) => ({
      ...line,
      quantity: line.requiredQuantity,
    })),
  }
}
