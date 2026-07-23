import type { Request } from 'express'
import { listMyWork } from '../assignments/my-work.service.js'
import type { ListMyWorkQuery } from '../assignments/assignment.schemas.js'

export type KioskAssignmentCard = {
  id: string
  productionOrderId: string
  workOrderNo: string
  productItemId: string | null
  productCode: string | null
  productName: string | null
  productLabel: string
  stageId: string
  stageCode: string | null
  stageName: string | null
  operationId: string | null
  operationCode: string | null
  operationName: string | null
  machineLabel: string | null
  workCentreLabel: string | null
  assignedQuantity: string
  completedQuantity: string
  balanceQuantity: string
  status: string
  workInstruction: string | null
  allowedActions: unknown
  assignmentDate: string | null
  startedAt: string | null
  pausedAt: string | null
}

function qty(value: unknown): string {
  if (value == null) return '0'
  return String(value)
}

function balance(assigned: string, completed: string): string {
  const n = Math.max(0, Number(assigned) - Number(completed))
  return Number.isFinite(n) ? String(n) : '0'
}

/** Mobile/tablet kiosk projection of operator my-work. */
export async function listShopfloorKiosk(req: Request, tenantId: string, query: ListMyWorkQuery) {
  const result = await listMyWork(req, tenantId, query)
  const cards: KioskAssignmentCard[] = result.items.map((item) => {
    const order = item.productionOrder as
      | {
          id: string
          orderNumber: string
          productItemId?: string | null
          productItem?: { id: string; code: string; name: string } | null
        }
      | null
      | undefined
    const product = order?.productItem
    const productLabel =
      product != null ? `${product.code} · ${product.name}` : 'Product'
    const assignedQuantity = qty(item.assignedQuantity)
    const completedQuantity = qty(item.completedQuantity)
    const machine = item.machine as { code?: string | null; name?: string | null } | null | undefined
    const workCentre = item.workCentre as { code?: string | null; name?: string | null } | null | undefined
    const stage = item.stage as { id?: string; code?: string | null; name?: string | null } | null | undefined
    const operation = item.operation as { id?: string; code?: string | null; name?: string | null } | null | undefined

    return {
      id: item.id,
      productionOrderId: item.productionOrderId,
      workOrderNo: order?.orderNumber ?? 'Work Order',
      productItemId: order?.productItemId ?? product?.id ?? null,
      productCode: product?.code ?? null,
      productName: product?.name ?? null,
      productLabel,
      stageId: item.stageId,
      stageCode: stage?.code ?? null,
      stageName: stage?.name ?? null,
      operationId: item.operationId,
      operationCode: operation?.code ?? null,
      operationName: operation?.name ?? null,
      machineLabel: machine ? `${machine.code ?? ''} ${machine.name ?? ''}`.trim() || null : null,
      workCentreLabel: workCentre ? `${workCentre.code ?? ''} ${workCentre.name ?? ''}`.trim() || null : null,
      assignedQuantity,
      completedQuantity,
      balanceQuantity: balance(assignedQuantity, completedQuantity),
      status: item.status,
      workInstruction: item.workInstruction,
      allowedActions: (item as { allowedActions?: unknown }).allowedActions ?? null,
      assignmentDate: item.assignmentDate ? String(item.assignmentDate) : null,
      startedAt: item.startedAt ? String(item.startedAt) : null,
      pausedAt: item.pausedAt ? String(item.pausedAt) : null,
    }
  })

  return {
    items: cards,
    total: result.total,
    page: result.page,
    limit: result.limit,
    summary: {
      openCount: cards.filter((c) => c.status !== 'COMPLETED' && c.status !== 'CANCELLED').length,
      inProgressCount: cards.filter((c) => c.status === 'IN_PROGRESS').length,
      pausedCount: cards.filter((c) => c.status === 'PAUSED').length,
    },
  }
}
