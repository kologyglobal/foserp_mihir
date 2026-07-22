import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { collectQualityBlockers, type QualityBlocker } from '../../quality/shared/blockers.service.js'
import { addDec, subDec, toDecimal } from '../shared/quantity.service.js'
import { dec } from '../shared/manufacturing.mappers.js'

export type WipPositionLabel = 'LOGICAL' | 'STOCKED'

export type WipStagePosition = {
  stageId: string
  stageCode: string
  stageName: string
  displayOrder: number
  stageStatus: string
  wipMode: string
  label: WipPositionLabel
  goodCompleted: string
  physicallyReceived: string
  sentForward: string
  waiting: string
  qualityBlockers: QualityBlocker[]
}

function clampNonNegative(value: ReturnType<typeof toDecimal>) {
  return value.lessThan(0) ? toDecimal(0) : value
}

function resolveLabel(wipTrackingMethod: string): WipPositionLabel {
  if (wipTrackingMethod === 'STOCKED_SEMI_FINISHED' || wipTrackingMethod === 'BOTH') {
    return 'STOCKED'
  }
  return 'LOGICAL'
}

/**
 * WIP position by stage for a work order.
 * ISSUE_TO_WO is custody (ADR-037) — this view does not double-decrement stock.
 * Stocked physical receipts use ProductionWipMovement (LOCATION_WIP / MATERIAL_RELOCATE) with physicalPosted.
 */
export async function getWipPosition(tenantId: string, workOrderId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: workOrderId, tenantId, deletedAt: null },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      manufacturingProfile: { select: { wipTrackingMethod: true } },
      stages: {
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          displayOrder: true,
          status: true,
          goodQuantity: true,
        },
      },
    },
  })
  if (!order) throw new NotFoundError('Work order not found')

  const wipMode = order.manufacturingProfile.wipTrackingMethod
  const label = resolveLabel(wipMode)

  const [movements, qualityBlockers] = await Promise.all([
    prisma.productionWipMovement.findMany({
      where: {
        tenantId,
        productionOrderId: workOrderId,
        deletedAt: null,
        status: 'POSTED',
        movementType: { in: ['LOCATION_WIP', 'MATERIAL_RELOCATE'] },
      },
      select: {
        stageId: true,
        quantity: true,
        physicalPosted: true,
        movementType: true,
      },
    }),
    collectQualityBlockers(tenantId, workOrderId),
  ])

  const physicalByStage = new Map<string, ReturnType<typeof toDecimal>>()
  for (const m of movements) {
    if (!m.stageId || !m.physicalPosted) continue
    physicalByStage.set(m.stageId, addDec(physicalByStage.get(m.stageId) ?? 0, m.quantity))
  }

  const blockersByStage = new Map<string, QualityBlocker[]>()
  const orderLevelBlockers: QualityBlocker[] = []
  for (const b of qualityBlockers) {
    if (b.stageId) {
      const list = blockersByStage.get(b.stageId) ?? []
      list.push(b)
      blockersByStage.set(b.stageId, list)
    } else {
      orderLevelBlockers.push(b)
    }
  }

  const stages: WipStagePosition[] = order.stages.map((stage, index) => {
    const goodCompleted = toDecimal(stage.goodQuantity)
    const physicallyReceived = physicalByStage.get(stage.id) ?? toDecimal(0)
    const next = order.stages[index + 1]
    const sentForward = next
      ? toDecimal(next.goodQuantity).lessThan(goodCompleted)
        ? toDecimal(next.goodQuantity)
        : goodCompleted
      : toDecimal(0)
    const waitingBase = label === 'STOCKED' ? physicallyReceived : goodCompleted
    const waiting = clampNonNegative(subDec(waitingBase, sentForward))

    return {
      stageId: stage.id,
      stageCode: stage.code,
      stageName: stage.name,
      displayOrder: stage.displayOrder,
      stageStatus: stage.status,
      wipMode,
      label,
      goodCompleted: dec(goodCompleted)!,
      physicallyReceived: dec(physicallyReceived)!,
      sentForward: dec(sentForward)!,
      waiting: dec(waiting)!,
      qualityBlockers: [...(blockersByStage.get(stage.id) ?? []), ...orderLevelBlockers],
    }
  })

  return {
    productionOrderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    wipMode,
    label,
    qualityBlockersSummary: {
      total: qualityBlockers.length,
      byCode: qualityBlockers.reduce<Record<string, number>>((acc, b) => {
        acc[b.code] = (acc[b.code] ?? 0) + 1
        return acc
      }, {}),
    },
    stages,
  }
}
