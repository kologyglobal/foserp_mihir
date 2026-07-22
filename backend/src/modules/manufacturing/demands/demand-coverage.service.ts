/**
 * Production Demand coverage helpers.
 * Remaining quantity is stored on ProductionDemand and must stay consistent with
 * non-cancelled Work Orders (ProductionOrder) linked via demandId.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { toDecimal } from '../shared/quantity.service.js'

const ACTIVE_WO_STATUSES = ['DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD'] as const
const COMPLETED_WO_STATUSES = ['COMPLETED', 'CLOSED'] as const

export type DemandCoverageSnapshot = {
  demandId: string
  requestedQuantity: Prisma.Decimal
  cancelledQuantity: Prisma.Decimal
  storedConvertedQuantity: Prisma.Decimal
  storedRemainingQuantity: Prisma.Decimal
  activeWorkOrderQuantity: Prisma.Decimal
  completedWorkOrderQuantity: Prisma.Decimal
  cancelledWorkOrderQuantity: Prisma.Decimal
  /** Sum of planned qty on active + completed WOs (valid conversion coverage). */
  validConvertedQuantity: Prisma.Decimal
  /** Net demand after cancellation of demand itself. */
  netDemandQuantity: Prisma.Decimal
  /** Remaining to produce from WO reality: max(0, net − validConverted). */
  derivedRemainingQuantity: Prisma.Decimal
  /** True when stored converted/remaining disagree with WO-derived coverage. */
  inconsistent: boolean
  inconsistencyMessage: string | null
}

type Tx = Prisma.TransactionClient | typeof prisma

/**
 * Restore demand balances when a Work Order is cancelled.
 * Decrements convertedQuantity by the WO planned qty and restores remainingQuantity.
 */
export async function restoreDemandOnWorkOrderCancel(
  tx: Tx,
  params: {
    tenantId: string
    demandId: string | null | undefined
    plannedQuantity: Prisma.Decimal | number | string
    userId?: string | null
  },
) {
  if (!params.demandId) return null

  const demand = await tx.productionDemand.findFirst({
    where: { id: params.demandId, tenantId: params.tenantId, deletedAt: null },
  })
  if (!demand || demand.status === 'CANCELLED') return null

  const qty = toDecimal(params.plannedQuantity)
  if (qty.lessThanOrEqualTo(0)) return demand

  const newConverted = toDecimal(demand.convertedQuantity).minus(qty)
  const clampedConverted = newConverted.lessThan(0) ? toDecimal(0) : newConverted
  const newRemaining = toDecimal(demand.remainingQuantity).plus(qty)
  // Cap remaining at net demand (requested − cancelled)
  const netDemand = toDecimal(demand.requestedQuantity).minus(toDecimal(demand.cancelledQuantity))
  const cappedRemaining = newRemaining.greaterThan(netDemand) ? netDemand : newRemaining
  const clampedRemaining = cappedRemaining.lessThan(0) ? toDecimal(0) : cappedRemaining

  let status: 'OPEN' | 'PARTIALLY_CONVERTED' | 'FULLY_CONVERTED' = 'OPEN'
  if (clampedConverted.greaterThan(0) && clampedRemaining.greaterThan(0)) status = 'PARTIALLY_CONVERTED'
  else if (clampedConverted.greaterThan(0) && clampedRemaining.lessThanOrEqualTo(0)) status = 'FULLY_CONVERTED'
  else status = 'OPEN'

  return tx.productionDemand.update({
    where: { id: demand.id },
    data: {
      convertedQuantity: clampedConverted,
      remainingQuantity: clampedRemaining,
      status,
      updatedBy: params.userId ?? demand.updatedBy,
    },
  })
}

/**
 * Compute WO-derived coverage for a demand and compare to stored balances.
 */
export async function computeDemandCoverage(
  tenantId: string,
  demandId: string,
  db: Tx = prisma,
): Promise<DemandCoverageSnapshot | null> {
  const demand = await db.productionDemand.findFirst({
    where: { id: demandId, tenantId, deletedAt: null },
  })
  if (!demand) return null

  const orders = await db.productionOrder.findMany({
    where: { tenantId, demandId, deletedAt: null },
    select: { plannedQuantity: true, status: true },
  })

  let active = toDecimal(0)
  let completed = toDecimal(0)
  let cancelled = toDecimal(0)
  for (const o of orders) {
    const q = toDecimal(o.plannedQuantity)
    if ((ACTIVE_WO_STATUSES as readonly string[]).includes(o.status)) active = active.plus(q)
    else if ((COMPLETED_WO_STATUSES as readonly string[]).includes(o.status)) completed = completed.plus(q)
    else if (o.status === 'CANCELLED') cancelled = cancelled.plus(q)
  }

  const validConverted = active.plus(completed)
  const netDemand = toDecimal(demand.requestedQuantity).minus(toDecimal(demand.cancelledQuantity))
  const derivedRemaining = netDemand.minus(validConverted)
  const clampedDerived = derivedRemaining.lessThan(0) ? toDecimal(0) : derivedRemaining

  const storedConverted = toDecimal(demand.convertedQuantity)
  const storedRemaining = toDecimal(demand.remainingQuantity)
  const inconsistent =
    !storedConverted.equals(validConverted) || !storedRemaining.equals(clampedDerived)

  return {
    demandId,
    requestedQuantity: toDecimal(demand.requestedQuantity),
    cancelledQuantity: toDecimal(demand.cancelledQuantity),
    storedConvertedQuantity: storedConverted,
    storedRemainingQuantity: storedRemaining,
    activeWorkOrderQuantity: active,
    completedWorkOrderQuantity: completed,
    cancelledWorkOrderQuantity: cancelled,
    validConvertedQuantity: validConverted,
    netDemandQuantity: netDemand,
    derivedRemainingQuantity: clampedDerived,
    inconsistent,
    inconsistencyMessage: inconsistent
      ? `Production Demand shows ${storedConverted.toString()} converted units, but linked active/completed Work Orders account for ${validConverted.toString()} units. Review the demand linkage before planning.`
      : null,
  }
}
