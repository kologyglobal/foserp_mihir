import { Prisma, type ProductionOrder } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { toDecimal } from '../shared/quantity.service.js'
import { createProductionOrderRecord } from '../shared/production-order-factory.service.js'
import { logProductionActivity } from '../shared/activity.service.js'

/**
 * Prefer Tank SA first so multilevel explode mirrors demo FE WO-0001 family
 * (SA-TANK-ASM → chassis → run gear → paint → …).
 */
export const PREFERRED_CHILD_ITEM_CODES = [
  'SA-TANK-ASM',
  'SA-CHASSIS',
  'SA-RUN-GEAR',
  'SA-PAINT-SYS',
] as const

function childRank(itemCode: string): number {
  const idx = PREFERRED_CHILD_ITEM_CODES.indexOf(itemCode as (typeof PREFERRED_CHILD_ITEM_CODES)[number])
  return idx === -1 ? 999 : idx
}

export interface ChildBomLineCandidate {
  bomLineId: string
  itemId: string
  itemCode: string
  itemName: string
  quantityPerParent: Prisma.Decimal
  sequence: number
  stockedSemiFinished: boolean
}

/**
 * BOM lines marked `childProductionOrderRequired` under the parent's active BOM version.
 * Sorted Tank-first, then BOM sequence.
 */
export async function listChildBomCandidates(
  tenantId: string,
  bomVersionId: string,
): Promise<ChildBomLineCandidate[]> {
  const lines = await prisma.manufacturingBomLine.findMany({
    where: {
      tenantId,
      bomVersionId,
      deletedAt: null,
      childProductionOrderRequired: true,
      phantomAssembly: false,
    },
    include: { item: { select: { id: true, code: true, name: true } } },
    orderBy: [{ sequence: 'asc' }],
  })

  return lines
    .map((line) => ({
      bomLineId: line.id,
      itemId: line.itemId,
      itemCode: line.item.code,
      itemName: line.item.name,
      quantityPerParent: toDecimal(line.quantity),
      sequence: line.sequence,
      stockedSemiFinished: line.stockedSemiFinished,
    }))
    .sort((a, b) => {
      const rankDiff = childRank(a.itemCode) - childRank(b.itemCode)
      if (rankDiff !== 0) return rankDiff
      return a.sequence - b.sequence
    })
}

export interface GenerateChildOrdersResult {
  parent: ProductionOrder
  children: ProductionOrder[]
  skipped: Array<{ itemCode: string; reason: string }>
}

/**
 * Create DRAFT child work orders for BOM lines with `childProductionOrderRequired`.
 * Idempotent: skips itemIds that already have a non-deleted child under this parent.
 */
export async function generateChildOrdersForParent(
  tenantId: string,
  userId: string,
  parentOrderId: string,
  options?: { force?: boolean },
): Promise<GenerateChildOrdersResult> {
  const parent = await prisma.productionOrder.findFirst({
    where: { id: parentOrderId, tenantId, deletedAt: null },
    include: { manufacturingProfile: true },
  })
  if (!parent) throw new NotFoundError('Work order not found')

  if (!options?.force && !parent.manufacturingProfile.childProductionOrdersEnabled) {
    throw new ValidationError(
      'Child production orders are disabled on this manufacturing profile — enable childProductionOrdersEnabled or pass force=true',
    )
  }

  const candidates = await listChildBomCandidates(tenantId, parent.bomVersionId)
  if (candidates.length === 0) {
    return { parent, children: [], skipped: [] }
  }

  const existingChildren = await prisma.productionOrder.findMany({
    where: { tenantId, parentProductionOrderId: parent.id, deletedAt: null },
    select: { id: true, productItemId: true, orderNumber: true },
  })
  const existingByItem = new Set(existingChildren.map((c) => c.productItemId))

  const created: ProductionOrder[] = []
  const skipped: Array<{ itemCode: string; reason: string }> = []

  await prisma.$transaction(async (tx) => {
    for (const candidate of candidates) {
      if (existingByItem.has(candidate.itemId)) {
        skipped.push({ itemCode: candidate.itemCode, reason: 'Child work order already exists for this item' })
        continue
      }

      const childQty = toDecimal(parent.plannedQuantity).mul(candidate.quantityPerParent)
      if (childQty.lessThanOrEqualTo(0)) {
        skipped.push({ itemCode: candidate.itemCode, reason: 'Computed child quantity is zero' })
        continue
      }

      try {
        const child = await createProductionOrderRecord(tx, {
          tenantId,
          userId,
          demandId: parent.demandId,
          sourceType: parent.sourceType,
          sourceDocumentId: parent.sourceDocumentId,
          sourceLineReference: parent.sourceLineReference,
          salesOrderId: parent.salesOrderId,
          customerId: parent.customerId,
          projectRef: parent.projectRef,
          productItemId: candidate.itemId,
          plannedQuantity: childQty,
          requiredCompletionDate: parent.requiredCompletionDate,
          plannedStartDate: parent.plannedStartDate,
          priority: parent.priority,
          plantCode: parent.plantCode,
          managerId: parent.managerId,
          supervisorId: parent.supervisorId,
          notes: `Child WO for ${candidate.itemCode} under ${parent.orderNumber}`,
          parentProductionOrderId: parent.id,
          idempotencyKey: `child:${parent.id}:${candidate.itemId}`,
        })
        created.push(child)
        existingByItem.add(candidate.itemId)
      } catch (err) {
        skipped.push({
          itemCode: candidate.itemCode,
          reason: err instanceof Error ? err.message : 'Failed to create child work order',
        })
      }
    }

    if (created.length > 0) {
      await logProductionActivity(
        {
          tenantId,
          productionOrderId: parent.id,
          activityType: 'CREATED',
          userId,
          message: `Generated ${created.length} child work order(s): ${created.map((c) => c.orderNumber).join(', ')}`,
          newValue: { childOrderIds: created.map((c) => c.id) },
        },
        tx,
      )
    }
  })

  const refreshedParent = await prisma.productionOrder.findFirstOrThrow({
    where: { id: parent.id },
  })

  return { parent: refreshedParent, children: created, skipped }
}
