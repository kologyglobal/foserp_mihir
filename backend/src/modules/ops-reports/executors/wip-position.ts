import { prisma } from '../../../config/database.js'
import { toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

const OPEN_STATUSES = ['DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD']

/**
 * WIP = material issued to a work order but not yet returned (custody still with the WO).
 * No parallel stock ledger — Inventory remains the SoT for physical stock; this is a
 * custody view over ProductionOrderMaterial only.
 */
export async function executeWipPosition(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters } = ctx
  const f = filters as { workOrderId?: string; productItemId?: string; warehouseId?: string }

  const where: Record<string, unknown> = {
    tenantId,
    productionOrder: { status: { in: OPEN_STATUSES }, deletedAt: null },
    issuedQty: { gt: 0 },
  }
  if (f.workOrderId) where.productionOrderId = f.workOrderId
  if (f.productItemId) where.itemId = f.productItemId
  if (f.warehouseId) where.warehouseId = f.warehouseId

  const materials = await prisma.productionOrderMaterial.findMany({
    where: where as never,
    select: {
      id: true,
      issuedQty: true,
      returnedQty: true,
      status: true,
      productionOrder: { select: { orderNumber: true } },
      item: { select: { code: true, name: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  })

  const rows: ReportRow[] = materials
    .map((m) => {
      const issued = toNum(m.issuedQty)
      const returned = toNum(m.returnedQty)
      const wip = Math.max(0, issued - returned)
      return {
        orderNumber: m.productionOrder.orderNumber,
        itemCode: m.item.code,
        itemName: m.item.name,
        warehouse: m.warehouse?.name ?? null,
        issuedQty: issued,
        returnedQty: returned,
        wipQuantity: wip,
        status: m.status,
      }
    })
    .filter((r) => r.wipQuantity > 0)

  return {
    rows,
    summary: {
      lineCount: rows.length,
      totalWipQuantity: rows.reduce((s, r) => s + Number(r.wipQuantity), 0),
    },
    warnings: [],
  }
}
