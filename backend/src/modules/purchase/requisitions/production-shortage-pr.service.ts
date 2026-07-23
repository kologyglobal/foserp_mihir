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

/** Prefer production / stores for WO shortage; fall back to purchase / any dept. */
const SHORTAGE_DEPARTMENT_CODES = ['production', 'stores', 'purchase', 'procurement'] as const

async function resolveShortageDepartmentId(
  tenantId: string,
  explicitId?: string | null,
): Promise<string | null> {
  if (explicitId?.trim()) return explicitId.trim()

  for (const code of SHORTAGE_DEPARTMENT_CODES) {
    const row = await prisma.crmMaster.findFirst({
      where: {
        tenantId,
        kind: 'departments',
        code,
        deletedAt: null,
        status: 'active',
      },
      select: { id: true },
    })
    if (row) return row.id
  }

  const any = await prisma.crmMaster.findFirst({
    where: { tenantId, kind: 'departments', deletedAt: null },
    select: { id: true },
    orderBy: { sortOrder: 'asc' },
  })
  return any?.id ?? null
}

function parseDateOnly(value: string | undefined | null): Date | null {
  if (!value?.trim()) return null
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function defaultRequiredDateFromNow(daysAhead = 7): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + daysAhead)
  return d
}

/**
 * Manufacturing materials shortage → Purchase Requisition adapter.
 * Uses the current PurchaseRequisition schema (not the legacy requisition.* stack).
 *
 * Defaults for the planning-sheet → PO gold path:
 * - requestedById = caller (or explicit)
 * - departmentId = production/stores/purchase CRM master (or explicit)
 * - requiredDate = requiredByDate → WO requiredCompletionDate → +7 days
 * - rfqRequired = false unless caller opts in
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
  const [items, workOrder, departmentId] = await Promise.all([
    prisma.masterItem.findMany({
      where: { tenantId, id: { in: itemIds }, deletedAt: null },
      select: { id: true, code: true, name: true },
    }),
    prisma.productionOrder.findFirst({
      where: { tenantId, id: input.productionOrderId, deletedAt: null },
      select: { requiredCompletionDate: true },
    }),
    resolveShortageDepartmentId(tenantId, input.departmentId),
  ])
  const itemById = new Map(items.map((item) => [item.id, item]))

  const requisitionNumber = await nextCode(tenantId, 'PURCHASE_REQUISITION')
  const purpose =
    input.purpose?.trim() ||
    `Production shortage for order ${input.productionOrderId}`

  const requiredDate =
    parseDateOnly(input.requiredByDate) ??
    (workOrder?.requiredCompletionDate
      ? new Date(
          `${workOrder.requiredCompletionDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
        )
      : null) ??
    defaultRequiredDateFromNow(7)

  const requestedById = (input.requestedById?.trim() || actorId) || null
  // Production shortage → planning/PO gold path; callers may opt into RFQ.
  const rfqRequired = input.rfqRequired === true

  const created = await prisma.purchaseRequisition.create({
    data: {
      tenantId,
      requisitionNumber,
      requisitionDate: new Date(),
      departmentId,
      requestedById,
      warehouseId: input.warehouseId ?? null,
      requiredDate,
      priority,
      purchasePurpose: purpose,
      rfqRequired,
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
            requiredDate: parseDateOnly(line.requiredDate) ?? requiredDate,
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
