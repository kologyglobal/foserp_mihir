import { prisma } from '../../../config/database.js'
import { normalizeStatusFilterList, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

const CLOSED_ORDER_STATUSES = ['COMPLETED', 'CLOSED', 'CANCELLED']

export async function executeMaterialReadiness(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters } = ctx
  const f = filters as { status?: string | string[]; workOrderId?: string; warehouseId?: string; productItemId?: string }

  const where: Record<string, unknown> = {
    tenantId,
    productionOrder: { status: { notIn: CLOSED_ORDER_STATUSES }, deletedAt: null },
  }
  const statuses = normalizeStatusFilterList(f.status)
  if (statuses) where.status = { in: statuses }
  if (f.workOrderId) where.productionOrderId = f.workOrderId
  if (f.warehouseId) where.warehouseId = f.warehouseId
  if (f.productItemId) where.itemId = f.productItemId

  const materials = await prisma.productionOrderMaterial.findMany({
    where: where as never,
    select: {
      id: true,
      requiredQty: true,
      reservedQty: true,
      issuedQty: true,
      shortageQty: true,
      status: true,
      productionOrder: { select: { orderNumber: true } },
      item: { select: { code: true, name: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  })

  const rows: ReportRow[] = materials.map((m) => ({
    id: m.id,
    orderNumber: m.productionOrder.orderNumber,
    itemCode: m.item.code,
    itemName: m.item.name,
    warehouse: m.warehouse?.name ?? null,
    requiredQty: toNum(m.requiredQty),
    reservedQty: toNum(m.reservedQty),
    issuedQty: toNum(m.issuedQty),
    shortageQty: toNum(m.shortageQty),
    status: m.status,
  }))

  return {
    rows,
    summary: {
      lineCount: rows.length,
      shortLines: rows.filter((r) => r.status === 'SHORT').length,
      totalShortageQty: rows.reduce((s, r) => s + Number(r.shortageQty), 0),
    },
    warnings: materials.length >= 5000 ? ['Result set capped at 5000 material lines — narrow filters for a complete view.'] : [],
  }
}
