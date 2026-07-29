import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { NotFoundError } from '../../../utils/errors.js'
import { resolveCostingPolicy } from './costing-policy.service.js'

const D = (value: Prisma.Decimal.Value = 0) => new Prisma.Decimal(value)
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2)
const num = (value: Prisma.Decimal | null | undefined) => Number(value ?? 0)

export function allocateScrapReworkCost(
  totalActual: Prisma.Decimal.Value,
  goodQuantity: Prisma.Decimal.Value,
  scrapQuantity: Prisma.Decimal.Value,
  reworkQuantity: Prisma.Decimal.Value,
) {
  const unitCost = D(totalActual).div(Prisma.Decimal.max(D(goodQuantity), D(1)))
  return {
    unitCost,
    scrapCost: money(D(scrapQuantity).mul(unitCost)),
    reworkCost: money(D(reworkQuantity).mul(unitCost)),
  }
}

type CostEntryDraft = {
  costCategory: 'MATERIAL' | 'LABOUR' | 'MACHINE' | 'JOB_WORK' | 'OVERHEAD' | 'SCRAP' | 'REWORK' | 'VARIANCE'
  sourceEntityType: string
  sourceEntityId: string
  sourceTransactionDate: Date
  itemId?: string | null
  workCentreId?: string | null
  machineId?: string | null
  jobWorkOrderId?: string | null
  quantity?: Prisma.Decimal.Value | null
  durationMinutes?: number | null
  rate: Prisma.Decimal.Value
  amount: Prisma.Decimal.Value
  provisional: boolean
}

function plannedMinutes(operation: {
  setupTimeMinutes: Prisma.Decimal
  runTimeValue: Prisma.Decimal
  runTimeBasis: string
  plannedQuantity: Prisma.Decimal
}) {
  const run = operation.runTimeBasis === 'PER_UNIT'
    ? operation.runTimeValue.mul(operation.plannedQuantity)
    : operation.runTimeValue
  return operation.setupTimeMinutes.plus(run)
}

function overheadAmount(
  method: string,
  rate: Prisma.Decimal,
  labourMinutes: Prisma.Decimal,
  machineMinutes: Prisma.Decimal,
  goodQuantity: Prisma.Decimal,
  materialCost: Prisma.Decimal,
) {
  if (method === 'PER_LABOUR_HOUR') return labourMinutes.div(60).mul(rate)
  if (method === 'PER_MACHINE_HOUR') return machineMinutes.div(60).mul(rate)
  if (method === 'PER_GOOD_UNIT') return goodQuantity.mul(rate)
  if (method === 'PERCENT_OF_MATERIAL_COST') return materialCost.mul(rate).div(100)
  return D(0)
}

async function resolveLabourRate(args: {
  tenantId: string
  source: string
  defaultRate: Prisma.Decimal.Value
  workCentreId?: string | null
  workCentreRate?: Prisma.Decimal.Value | null
  operatorUserId?: string | null
  transactionDate: Date
}) {
  if (args.source === 'TENANT_DEFAULT') return D(args.defaultRate)
  if (args.source !== 'LABOUR_RATE_CARD') return D(args.workCentreRate ?? args.defaultRate)
  const card = await prisma.labourRateCard.findFirst({
    where: {
      tenantId: args.tenantId,
      deletedAt: null,
      isActive: true,
      effectiveFrom: { lte: args.transactionDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: args.transactionDate } }],
      AND: [
        { OR: [{ workCentreId: args.workCentreId ?? null }, { workCentreId: null }] },
        { OR: [{ operatorUserId: args.operatorUserId ?? null }, { operatorUserId: null }] },
      ],
    },
    orderBy: [{ workCentreId: 'desc' }, { operatorUserId: 'desc' }, { effectiveFrom: 'desc' }],
  })
  return D(card?.ratePerHour ?? args.workCentreRate ?? args.defaultRate)
}

async function activityBasedOverhead(args: {
  tenantId: string
  plantCode?: string | null
  startDate: Date
  endDate: Date
  labourMinutes: Prisma.Decimal
  machineMinutes: Prisma.Decimal
  goodQuantity: Prisma.Decimal
  setups: number
  fallbackRate: Prisma.Decimal
}) {
  const pools = await prisma.overheadCostPool.findMany({
    where: {
      tenantId: args.tenantId,
      deletedAt: null,
      isActive: true,
      periodStart: { lte: args.endDate },
      periodEnd: { gte: args.startDate },
      OR: [{ plantCode: args.plantCode ?? null }, { plantCode: null }],
    },
  })
  let allocated = D(0)
  for (const pool of pools) {
    const lineWhere = {
      tenantId: args.tenantId,
      batch: { productionDate: { gte: pool.periodStart, lte: pool.periodEnd } },
      ...(pool.plantCode ? { productionOrder: { plantCode: pool.plantCode } } : {}),
    }
    const aggregate = await prisma.dailyProductionLine.aggregate({
      where: lineWhere,
      _sum: { labourMinutes: true, machineMinutes: true, goodQuantity: true },
      _count: { _all: true },
    })
    const woDriver = pool.driverType === 'LABOUR_HOURS'
      ? args.labourMinutes.div(60)
      : pool.driverType === 'MACHINE_HOURS'
        ? args.machineMinutes.div(60)
        : pool.driverType === 'GOOD_UNITS'
          ? args.goodQuantity
          : D(args.setups)
    const totalDriver = pool.driverType === 'LABOUR_HOURS'
      ? D(aggregate._sum.labourMinutes ?? 0).div(60)
      : pool.driverType === 'MACHINE_HOURS'
        ? D(aggregate._sum.machineMinutes ?? 0).div(60)
        : pool.driverType === 'GOOD_UNITS'
          ? D(aggregate._sum.goodQuantity ?? 0)
          : D(aggregate._count._all)
    allocated = allocated.plus(
      totalDriver.greaterThan(0)
        ? D(pool.periodAmount).mul(woDriver).div(totalDriver)
        : woDriver.mul(args.fallbackRate),
    )
  }
  if (pools.length === 0) {
    allocated = args.labourMinutes.div(60).mul(args.fallbackRate)
  }
  return allocated
}

export async function calculateWorkOrderCost(
  tenantId: string,
  workOrderId: string,
  options: { persist: boolean; req?: Request | null },
) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: workOrderId, tenantId, deletedAt: null },
    include: {
      bomSnapshot: { include: { lines: { include: { item: { select: { standardRate: true } } } } } },
      operations: {
        include: {
          workCentre: { select: { id: true, costRate: true } },
          machine: { select: { id: true, costRate: true } },
        },
      },
      dailyLines: {
        include: {
          workCentre: { select: { id: true, costRate: true } },
          machine: { select: { id: true, costRate: true } },
        },
      },
      jobWorkOrders: true,
      finishedGoodsReceipts: { where: { deletedAt: null, status: { not: 'DRAFT' } } },
    },
  })
  if (!order) throw new NotFoundError('Work order not found')

  const policy = await resolveCostingPolicy(tenantId, order.plantCode)
  const currencyCode = policy.currencyCode
  const warnings: string[] = []
  const entries: CostEntryDraft[] = []

  let plannedMaterial = D(0)
  for (const line of order.bomSnapshot?.lines ?? []) {
    const rate = D(line.item.standardRate)
    plannedMaterial = plannedMaterial.plus(D(line.requiredQuantity).mul(rate))
    if (rate.lessThanOrEqualTo(0)) warnings.push(`INCOMPLETE_MATERIAL_RATE:${line.itemId}`)
  }

  let plannedLabourMinutes = D(0)
  let plannedMachineMinutes = D(0)
  let plannedLabour = D(0)
  let plannedMachine = D(0)
  for (const operation of order.operations) {
    const minutes = plannedMinutes(operation)
    const labourRate = await resolveLabourRate({
      tenantId,
      source: policy.labourRateSource,
      defaultRate: policy.defaultLabourRate,
      workCentreId: operation.workCentre?.id,
      workCentreRate: operation.workCentre?.costRate,
      transactionDate: order.plannedStartDate ?? new Date(),
    })
    const machineRate = policy.machineRateSource === 'WORK_CENTRE_RATE'
      ? D(operation.workCentre?.costRate ?? policy.defaultMachineRate)
      : D(operation.machine?.costRate ?? operation.workCentre?.costRate ?? policy.defaultMachineRate)
    plannedLabourMinutes = plannedLabourMinutes.plus(minutes)
    plannedMachineMinutes = plannedMachineMinutes.plus(minutes)
    plannedLabour = plannedLabour.plus(minutes.div(60).mul(labourRate))
    plannedMachine = plannedMachine.plus(minutes.div(60).mul(machineRate))
    if (minutes.greaterThan(0) && labourRate.lessThanOrEqualTo(0)) warnings.push(`INCOMPLETE_LABOUR_RATE:${operation.id}`)
    if (minutes.greaterThan(0) && machineRate.lessThanOrEqualTo(0)) warnings.push(`INCOMPLETE_MACHINE_RATE:${operation.id}`)
  }
  if (order.operations.length === 0) {
    warnings.push('INCOMPLETE_LABOUR_TIME')
    warnings.push('INCOMPLETE_MACHINE_TIME')
  }

  // Material: Inventory Cost Entry is authoritative (IV-MFG-1). Never re-run FIFO/MA here.
  const movements = await prisma.inventoryStockMovement.findMany({
    where: { tenantId, workOrderId, referenceType: { in: ['ISSUE_TO_WO', 'RETURN_FROM_WO'] } },
    include: {
      item: { select: { standardRate: true } },
      costEntries: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: {
          id: true,
          unitCost: true,
          totalCost: true,
          quantity: true,
          valuationMethod: true,
          postingDate: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  let actualMaterial = D(0)
  let provisionalCost = D(0)
  for (const movement of movements) {
    const direction = movement.referenceType === 'RETURN_FROM_WO' ? D(-1) : D(1)
    const qtyAbs = D(movement.quantity).abs()
    const costEntry = movement.costEntries[0]
    let amount: Prisma.Decimal
    let rate: Prisma.Decimal
    let provisional: boolean
    let sourceEntityType: string
    let sourceEntityId: string
    let sourceTransactionDate: Date

    if (costEntry) {
      amount = D(costEntry.totalCost).abs()
      rate = D(costEntry.unitCost)
      provisional = false
      sourceEntityType = 'INVENTORY_COST_ENTRY'
      sourceEntityId = costEntry.id
      sourceTransactionDate = costEntry.postingDate ?? movement.movementDate
    } else {
      const movementValue = D(movement.value).abs()
      const fallback = qtyAbs.mul(D(movement.item.standardRate))
      provisional = movementValue.lessThanOrEqualTo(0)
      amount = movementValue.greaterThan(0) ? movementValue : fallback
      rate = amount.div(qtyAbs.greaterThan(0) ? qtyAbs : D(1))
      sourceEntityType = 'INVENTORY_STOCK_MOVEMENT'
      sourceEntityId = movement.id
      sourceTransactionDate = movement.movementDate
      if (provisional) {
        provisionalCost = provisionalCost.plus(direction.mul(amount))
        warnings.push(
          D(movement.item.standardRate).greaterThan(0)
            ? `PROVISIONAL_MATERIAL_RATE:${movement.id}`
            : `INCOMPLETE_MATERIAL_RATE:${movement.itemId}`,
        )
      } else {
        warnings.push(`MISSING_INVENTORY_COST_ENTRY:${movement.id}`)
      }
    }

    actualMaterial = actualMaterial.plus(direction.mul(amount))
    entries.push({
      costCategory: 'MATERIAL',
      sourceEntityType,
      sourceEntityId,
      sourceTransactionDate,
      itemId: movement.itemId,
      quantity: direction.mul(qtyAbs),
      rate,
      amount: direction.mul(amount),
      provisional,
    })
  }

  let actualLabour = D(0)
  let actualMachine = D(0)
  let actualLabourMinutes = D(0)
  let actualMachineMinutes = D(0)
  for (const line of order.dailyLines) {
    const labourMinutes = D(line.labourMinutes ?? 0)
    const machineMinutes = D(line.machineMinutes ?? 0)
    const labourRate = await resolveLabourRate({
      tenantId,
      source: policy.labourRateSource,
      defaultRate: policy.defaultLabourRate,
      workCentreId: line.workCentreId,
      workCentreRate: line.workCentre?.costRate,
      operatorUserId: line.userId,
      transactionDate: line.createdAt,
    })
    const machineRate = policy.machineRateSource === 'WORK_CENTRE_RATE'
      ? D(line.workCentre?.costRate ?? policy.defaultMachineRate)
      : D(line.machine?.costRate ?? line.workCentre?.costRate ?? policy.defaultMachineRate)
    const labourAmount = labourMinutes.div(60).mul(labourRate)
    const machineAmount = machineMinutes.div(60).mul(machineRate)
    actualLabourMinutes = actualLabourMinutes.plus(labourMinutes)
    actualMachineMinutes = actualMachineMinutes.plus(machineMinutes)
    actualLabour = actualLabour.plus(labourAmount)
    actualMachine = actualMachine.plus(machineAmount)
    if (labourMinutes.greaterThan(0) && labourRate.lessThanOrEqualTo(0)) warnings.push(`INCOMPLETE_LABOUR_RATE:${line.id}`)
    if (machineMinutes.greaterThan(0) && machineRate.lessThanOrEqualTo(0)) warnings.push(`INCOMPLETE_MACHINE_RATE:${line.id}`)
    if (labourMinutes.greaterThan(0)) entries.push({
      costCategory: 'LABOUR',
      sourceEntityType: 'DAILY_PRODUCTION_LINE',
      sourceEntityId: line.id,
      sourceTransactionDate: line.createdAt,
      workCentreId: line.workCentreId,
      durationMinutes: line.labourMinutes,
      rate: labourRate,
      amount: labourAmount,
      provisional: false,
    })
    if (machineMinutes.greaterThan(0)) entries.push({
      costCategory: 'MACHINE',
      sourceEntityType: 'DAILY_PRODUCTION_LINE',
      sourceEntityId: line.id,
      sourceTransactionDate: line.createdAt,
      workCentreId: line.workCentreId,
      machineId: line.machineId,
      durationMinutes: line.machineMinutes,
      rate: machineRate,
      amount: machineAmount,
      provisional: false,
    })
  }
  if (order.dailyLines.length === 0 && ['IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(order.status)) {
    warnings.push('INCOMPLETE_LABOUR_TIME')
    warnings.push('INCOMPLETE_MACHINE_TIME')
  }

  let plannedJobWork = D(0)
  let actualJobWork = D(0)
  for (const job of order.jobWorkOrders) {
    const expected = D(job.expectedCost)
    const linked = job.invoiceStatus === 'LINKED' && job.invoiceAmount != null
    const amount = linked ? D(job.invoiceAmount!) : expected
    plannedJobWork = plannedJobWork.plus(expected)
    actualJobWork = actualJobWork.plus(amount)
    if (!linked) {
      provisionalCost = provisionalCost.plus(amount)
      warnings.push(`PROVISIONAL_JOB_WORK:${job.id}`)
    }
    entries.push({
      costCategory: 'JOB_WORK',
      sourceEntityType: 'JOB_WORK_ORDER',
      sourceEntityId: job.id,
      sourceTransactionDate: job.updatedAt,
      itemId: job.itemId,
      jobWorkOrderId: job.id,
      quantity: job.acceptedQty,
      rate: job.rate,
      amount,
      provisional: !linked,
    })
  }

  const goodQuantity = D(order.completedGoodQuantity)
  const fgReceivedQuantity = order.finishedGoodsReceipts.reduce(
    (sum, row) => sum.plus(D(row.acceptedQuantity).minus(D(row.reversedQuantity))),
    D(0),
  )
  const overheadRate = D(policy.overheadRate)
  const plannedOverhead = policy.overheadMethod === 'ACTIVITY_BASED'
    ? plannedLabourMinutes.div(60).mul(overheadRate)
    : overheadAmount(
      policy.overheadMethod,
      overheadRate,
      plannedLabourMinutes,
      plannedMachineMinutes,
      D(order.plannedQuantity),
      plannedMaterial,
    )
  const actualOverhead = policy.overheadMethod === 'ACTIVITY_BASED'
    ? await activityBasedOverhead({
      tenantId,
      plantCode: order.plantCode,
      startDate: order.actualStartAt ?? order.plannedStartDate ?? order.createdAt,
      endDate: order.actualCompletedAt ?? new Date(),
      labourMinutes: actualLabourMinutes,
      machineMinutes: actualMachineMinutes,
      goodQuantity,
      setups: order.dailyLines.length,
      fallbackRate: overheadRate,
    })
    : overheadAmount(
      policy.overheadMethod,
      overheadRate,
      actualLabourMinutes,
      actualMachineMinutes,
      goodQuantity,
      actualMaterial,
    )
  if (actualOverhead.greaterThan(0)) entries.push({
    costCategory: 'OVERHEAD',
    sourceEntityType: 'WORK_ORDER_COST_CALCULATION',
    sourceEntityId: workOrderId,
    sourceTransactionDate: new Date(),
    rate: overheadRate,
    amount: actualOverhead,
    provisional: false,
  })

  const totalPlanned = money(plannedMaterial.plus(plannedLabour).plus(plannedMachine).plus(plannedJobWork).plus(plannedOverhead))
  const totalActual = money(actualMaterial.plus(actualLabour).plus(actualMachine).plus(actualJobWork).plus(actualOverhead))
  const dailyScrapQuantity = order.dailyLines.reduce((sum, line) => sum.plus(D(line.scrapQuantity)), D(0))
  const dailyReworkQuantity = order.dailyLines.reduce((sum, line) => sum.plus(D(line.reworkQuantity)), D(0))
  const scrapQuantity = Prisma.Decimal.max(D(order.scrapQuantity), dailyScrapQuantity)
  const reworkQuantity = Prisma.Decimal.max(D(order.reworkQuantity), dailyReworkQuantity)
  const allocatedLosses = allocateScrapReworkCost(totalActual, goodQuantity, scrapQuantity, reworkQuantity)
  const allocationUnitCost = allocatedLosses.unitCost
  const scrapCost = allocatedLosses.scrapCost
  const reworkCost = allocatedLosses.reworkCost
  const costDate = order.actualCompletedAt ?? new Date()
  if (scrapCost.greaterThan(0)) entries.push({
    costCategory: 'SCRAP',
    sourceEntityType: 'PRODUCTION_ORDER_SCRAP',
    sourceEntityId: workOrderId,
    sourceTransactionDate: costDate,
    quantity: scrapQuantity,
    rate: allocationUnitCost,
    amount: scrapCost,
    provisional: false,
  })
  if (reworkCost.greaterThan(0)) entries.push({
    costCategory: 'REWORK',
    sourceEntityType: 'PRODUCTION_ORDER_REWORK',
    sourceEntityId: workOrderId,
    sourceTransactionDate: costDate,
    quantity: reworkQuantity,
    rate: allocationUnitCost,
    amount: reworkCost,
    provisional: false,
  })
  const standardCosting = policy.costingMethod === 'STANDARD_WITH_VARIANCE'
  const materialPriceVariance = standardCosting
    ? movements.reduce((sum, movement) => {
      const direction = movement.referenceType === 'RETURN_FROM_WO' ? D(-1) : D(1)
      const standard = D(movement.quantity).abs().mul(D(movement.item.standardRate))
      const costEntry = movement.costEntries[0]
      const posted = costEntry
        ? D(costEntry.totalCost).abs()
        : D(movement.value).abs()
      const actual = posted.greaterThan(0) ? posted : standard
      return sum.plus(direction.mul(actual.minus(standard)))
    }, D(0))
    : D(0)
  const materialVariance = actualMaterial.minus(plannedMaterial)
  const materialUsageVariance = standardCosting ? materialVariance.minus(materialPriceVariance) : D(0)
  const plannedAverageLabourRate = plannedLabourMinutes.greaterThan(0)
    ? plannedLabour.mul(60).div(plannedLabourMinutes)
    : D(policy.defaultLabourRate)
  const labourRateVariance = standardCosting
    ? actualLabour.minus(actualLabourMinutes.div(60).mul(plannedAverageLabourRate))
    : D(0)
  const labourEfficiencyVariance = standardCosting
    ? actualLabour.minus(plannedLabour).minus(labourRateVariance)
    : D(0)
  const conversionVariance = totalActual.minus(actualMaterial).minus(totalPlanned.minus(plannedMaterial))
  const varianceComponents = standardCosting
    ? [
      ['MATERIAL_PRICE', materialPriceVariance],
      ['MATERIAL_USAGE', materialUsageVariance],
      ['LABOUR_RATE', labourRateVariance],
      ['LABOUR_EFFICIENCY', labourEfficiencyVariance],
      ['CONVERSION_REMAINDER', conversionVariance.minus(labourRateVariance).minus(labourEfficiencyVariance)],
    ] as const
    : []
  for (const [component, amount] of varianceComponents) {
    if (amount.equals(0)) continue
    entries.push({
      costCategory: 'VARIANCE',
      sourceEntityType: 'STANDARD_COST_VARIANCE',
      sourceEntityId: `${workOrderId}:${component}`,
      sourceTransactionDate: costDate,
      rate: 0,
      amount: money(amount),
      provisional: false,
    })
    warnings.push(`STANDARD_VARIANCE_${component}:${money(amount).toFixed(2)}`)
  }
  const posted = await prisma.productionAccountingEvent.aggregate({
    where: { tenantId, productionOrderId: workOrderId, status: 'POSTED' },
    _sum: { amount: true },
  })
  const totalPosted = money(D(posted._sum.amount ?? 0))
  const uniqueWarnings = [...new Set(warnings)]
  const incomplete = uniqueWarnings.find((warning) => warning.startsWith('INCOMPLETE_'))
  const completenessStatus = incomplete
    ? incomplete.split(':')[0]
    : provisionalCost.abs().greaterThan(0)
      ? 'COMPLETE_WITH_PROVISIONAL'
      : 'COMPLETE'
  const sourceFingerprint = createHash('sha256')
    .update(JSON.stringify(entries.map((entry) => [entry.costCategory, entry.sourceEntityId, String(entry.amount)])))
    .digest('hex')
    .slice(0, 40)
  const snapshotData = {
    tenantId,
    productionOrderId: workOrderId,
    snapshotType: 'CURRENT_ACTUAL' as const,
    status: 'CALCULATED',
    calculationDate: new Date(),
    currencyCode,
    plannedQuantity: order.plannedQuantity,
    goodQuantity,
    fgReceivedQuantity,
    plannedMaterialCost: money(plannedMaterial),
    actualMaterialCost: money(actualMaterial),
    plannedLabourCost: money(plannedLabour),
    actualLabourCost: money(actualLabour),
    plannedMachineCost: money(plannedMachine),
    actualMachineCost: money(actualMachine),
    plannedJobWorkCost: money(plannedJobWork),
    actualJobWorkCost: money(actualJobWork),
    plannedOverheadCost: money(plannedOverhead),
    actualOverheadCost: money(actualOverhead),
    scrapCost,
    reworkCost,
    totalPlannedCost: totalPlanned,
    totalActualCost: totalActual,
    totalPostedCost: totalPosted,
    provisionalCost: money(provisionalCost.abs()),
    varianceAmount: money(standardCosting ? totalActual.minus(totalPlanned) : totalActual.minus(totalPosted)),
    unitPlannedCost: D(order.plannedQuantity).greaterThan(0) ? totalPlanned.div(order.plannedQuantity).toDecimalPlaces(4) : D(0),
    unitActualCost: goodQuantity.greaterThan(0) ? totalActual.div(goodQuantity).toDecimalPlaces(4) : D(0),
    completenessStatus,
    warningSummaryJson: uniqueWarnings,
    sourceFingerprint,
    createdBy: options.req?.context?.userId,
  }

  if (!options.persist) return { snapshot: { ...snapshotData, id: null, snapshotVersion: null }, entries, warnings: uniqueWarnings }

  return prisma.$transaction(async (tx) => {
    const latest = await tx.workOrderCostSnapshot.findFirst({
      where: { tenantId, productionOrderId: workOrderId },
      orderBy: { snapshotVersion: 'desc' },
      select: { snapshotVersion: true },
    })
    const snapshot = await tx.workOrderCostSnapshot.create({
      data: { ...snapshotData, warningSummaryJson: uniqueWarnings, snapshotVersion: (latest?.snapshotVersion ?? 0) + 1 },
    })

    // Drop legacy MATERIAL rows keyed only by stock movement when we now key by cost entry.
    const materialKeys = entries
      .filter((e) => e.costCategory === 'MATERIAL')
      .map((e) => ({ sourceEntityType: e.sourceEntityType, sourceEntityId: e.sourceEntityId }))
    await tx.workOrderCostEntry.deleteMany({
      where: {
        tenantId,
        productionOrderId: workOrderId,
        costCategory: 'MATERIAL',
        ...(materialKeys.length > 0
          ? {
              NOT: {
                OR: materialKeys.map((k) => ({
                  sourceEntityType: k.sourceEntityType,
                  sourceEntityId: k.sourceEntityId,
                })),
              },
            }
          : {}),
      },
    })

    for (const entry of entries) {
      await tx.workOrderCostEntry.upsert({
        where: {
          tenantId_costCategory_sourceEntityType_sourceEntityId: {
            tenantId,
            costCategory: entry.costCategory,
            sourceEntityType: entry.sourceEntityType,
            sourceEntityId: entry.sourceEntityId,
          },
        },
        create: {
          ...entry,
          tenantId,
          productionOrderId: workOrderId,
          costSnapshotId: snapshot.id,
          currencyCode,
          createdBy: options.req?.context?.userId,
        },
        update: {
          ...entry,
          productionOrderId: workOrderId,
          costSnapshotId: snapshot.id,
          currencyCode,
        },
      })
    }
    return { snapshot, entries, warnings: uniqueWarnings }
  })
}

export async function listCostDetails(tenantId: string, workOrderId: string) {
  const rows = await prisma.workOrderCostEntry.findMany({
    where: { tenantId, productionOrderId: workOrderId },
    orderBy: [{ sourceTransactionDate: 'asc' }, { createdAt: 'asc' }],
  })

  const costEntryIds = rows
    .filter((r) => r.costCategory === 'MATERIAL' && r.sourceEntityType === 'INVENTORY_COST_ENTRY')
    .map((r) => r.sourceEntityId)
  const movementIds = rows
    .filter((r) => r.costCategory === 'MATERIAL' && r.sourceEntityType === 'INVENTORY_STOCK_MOVEMENT')
    .map((r) => r.sourceEntityId)

  const [invEntries, movementCostEntries, items] = await Promise.all([
    costEntryIds.length
      ? prisma.inventoryCostEntry.findMany({
          where: { tenantId, id: { in: costEntryIds } },
          select: {
            id: true,
            valuationMethod: true,
            inventoryMovementId: true,
            lotId: true,
            serialId: true,
            unitCost: true,
            totalCost: true,
            quantity: true,
            postingDate: true,
            itemId: true,
          },
        })
      : Promise.resolve([]),
    movementIds.length
      ? prisma.inventoryCostEntry.findMany({
          where: { tenantId, inventoryMovementId: { in: movementIds } },
          select: {
            id: true,
            valuationMethod: true,
            inventoryMovementId: true,
            lotId: true,
            serialId: true,
            unitCost: true,
            totalCost: true,
            quantity: true,
            postingDate: true,
            itemId: true,
          },
        })
      : Promise.resolve([]),
    prisma.masterItem.findMany({
      where: {
        tenantId,
        id: { in: [...new Set(rows.map((r) => r.itemId).filter(Boolean) as string[])] },
        deletedAt: null,
      },
      select: { id: true, code: true, name: true, baseUom: { select: { code: true } } },
    }),
  ])

  const invById = new Map(invEntries.map((e) => [e.id, e]))
  const invByMovement = new Map(movementCostEntries.map((e) => [e.inventoryMovementId, e]))
  const itemById = new Map(items.map((i) => [i.id, i]))

  return rows.map((row) => {
    const inv =
      row.sourceEntityType === 'INVENTORY_COST_ENTRY'
        ? invById.get(row.sourceEntityId)
        : row.sourceEntityType === 'INVENTORY_STOCK_MOVEMENT'
          ? invByMovement.get(row.sourceEntityId)
          : undefined
    const item = row.itemId ? itemById.get(row.itemId) : undefined
    return {
      ...row,
      itemCode: item?.code ?? null,
      itemName: item?.name ?? null,
      uom: item?.baseUom?.code ?? null,
      valuationMethod: inv?.valuationMethod ?? null,
      inventoryCostEntryId: inv?.id ?? (row.sourceEntityType === 'INVENTORY_COST_ENTRY' ? row.sourceEntityId : null),
      inventoryMovementId: inv?.inventoryMovementId ?? (row.sourceEntityType === 'INVENTORY_STOCK_MOVEMENT' ? row.sourceEntityId : null),
      costSource:
        row.sourceEntityType === 'INVENTORY_COST_ENTRY'
          ? 'INVENTORY_COST_ENTRY'
          : row.sourceEntityType === 'INVENTORY_STOCK_MOVEMENT'
            ? 'INVENTORY_STOCK_MOVEMENT'
            : row.sourceEntityType,
    }
  })
}

export async function getCostTrace(tenantId: string, workOrderId: string, entryId: string) {
  const entry = await prisma.workOrderCostEntry.findFirst({
    where: { id: entryId, tenantId, productionOrderId: workOrderId },
  })
  if (!entry) throw new NotFoundError('Work-order cost entry not found')

  const order = await prisma.productionOrder.findFirst({
    where: { id: workOrderId, tenantId, deletedAt: null },
    select: { id: true, orderNumber: true },
  })

  let inventoryCostEntry: Awaited<ReturnType<typeof prisma.inventoryCostEntry.findFirst>> = null
  let movement: Awaited<ReturnType<typeof prisma.inventoryStockMovement.findFirst>> = null
  let layerConsumptions: Array<{
    id: string
    quantityConsumed: Prisma.Decimal
    unitCost: Prisma.Decimal
    totalCost: Prisma.Decimal
    layer: {
      id: string
      unitCost: Prisma.Decimal
      receiptDate: Date
      remainingQuantity: Prisma.Decimal
      originalQuantity: Prisma.Decimal
      status: string
      lotId: string | null
      serialId: string | null
    }
  }> = []
  let standardVersion: { id: string; version: number; unitCost: Prisma.Decimal; effectiveFrom: Date; status: string } | null = null
  let variances: Array<{
    id: string
    varianceType: string
    standardUnitCost: Prisma.Decimal
    actualUnitCost: Prisma.Decimal
    varianceAmount: Prisma.Decimal
  }> = []

  if (entry.costCategory === 'MATERIAL') {
    if (entry.sourceEntityType === 'INVENTORY_COST_ENTRY') {
      inventoryCostEntry = await prisma.inventoryCostEntry.findFirst({
        where: { id: entry.sourceEntityId, tenantId },
      })
    } else if (entry.sourceEntityType === 'INVENTORY_STOCK_MOVEMENT') {
      inventoryCostEntry = await prisma.inventoryCostEntry.findFirst({
        where: { tenantId, inventoryMovementId: entry.sourceEntityId },
      })
      movement = await prisma.inventoryStockMovement.findFirst({
        where: { id: entry.sourceEntityId, tenantId },
      })
    }

    if (inventoryCostEntry) {
      if (!movement) {
        movement = await prisma.inventoryStockMovement.findFirst({
          where: { id: inventoryCostEntry.inventoryMovementId, tenantId },
        })
      }
      layerConsumptions = await prisma.inventoryCostLayerConsumption.findMany({
        where: { tenantId, issueCostEntryId: inventoryCostEntry.id },
        include: {
          layer: {
            select: {
              id: true,
              unitCost: true,
              receiptDate: true,
              remainingQuantity: true,
              originalQuantity: true,
              status: true,
              lotId: true,
              serialId: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      if (inventoryCostEntry.valuationMethod === 'STANDARD_COST' && inventoryCostEntry.itemId) {
        standardVersion = await prisma.inventoryItemStandardCostVersion.findFirst({
          where: {
            tenantId,
            itemId: inventoryCostEntry.itemId,
            status: 'ACTIVE',
            effectiveFrom: { lte: inventoryCostEntry.postingDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: inventoryCostEntry.postingDate } }],
          },
          orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
          select: { id: true, version: true, unitCost: true, effectiveFrom: true, status: true },
        })
        variances = await prisma.inventoryCostVariance.findMany({
          where: { tenantId, costEntryId: inventoryCostEntry.id },
          select: {
            id: true,
            varianceType: true,
            standardUnitCost: true,
            actualUnitCost: true,
            varianceAmount: true,
          },
          take: 20,
        })
      }
    }
  }

  const item = entry.itemId
    ? await prisma.masterItem.findFirst({
        where: { id: entry.itemId, tenantId, deletedAt: null },
        select: { id: true, code: true, name: true, baseUom: { select: { code: true } } },
      })
    : null

  return {
    workOrder: order,
    costEntry: entry,
    item: item
      ? { id: item.id, itemCode: item.code, itemName: item.name, uom: item.baseUom?.code ?? null }
      : null,
    inventoryCostEntry,
    inventoryMovement: movement
      ? {
          id: movement.id,
          movementNumber: movement.movementNumber,
          movementType: movement.movementType,
          referenceType: movement.referenceType,
          quantity: movement.quantity,
          rate: movement.rate,
          value: movement.value,
          movementDate: movement.movementDate,
          warehouseId: movement.warehouseId,
        }
      : null,
    valuationMethod: inventoryCostEntry?.valuationMethod ?? null,
    fifoLayers: layerConsumptions.map((c) => ({
      consumptionId: c.id,
      quantityConsumed: c.quantityConsumed,
      unitCost: c.unitCost,
      totalCost: c.totalCost,
      layerId: c.layer.id,
      receiptDate: c.layer.receiptDate,
      layerUnitCost: c.layer.unitCost,
      layerStatus: c.layer.status,
      lotId: c.layer.lotId,
      serialId: c.layer.serialId,
    })),
    specificIdentity: inventoryCostEntry
      ? { lotId: inventoryCostEntry.lotId, serialId: inventoryCostEntry.serialId }
      : null,
    standardCost: standardVersion,
    variances,
  }
}

export async function listCostSnapshots(tenantId: string, workOrderId: string) {
  return prisma.workOrderCostSnapshot.findMany({
    where: { tenantId, productionOrderId: workOrderId },
    orderBy: { snapshotVersion: 'desc' },
  })
}

export async function getCostSummary(tenantId: string, workOrderId: string) {
  const order = await prisma.productionOrder.findFirst({ where: { id: workOrderId, tenantId, deletedAt: null }, select: { id: true } })
  if (!order) throw new NotFoundError('Work order not found')
  const latest = await prisma.workOrderCostSnapshot.findFirst({
    where: { tenantId, productionOrderId: workOrderId },
    orderBy: { snapshotVersion: 'desc' },
  })
  const events = await prisma.productionAccountingEvent.groupBy({
    by: ['status'],
    where: { tenantId, productionOrderId: workOrderId },
    _count: { _all: true },
  })
  if (!latest) {
    return {
      snapshot: null,
      completenessStatus: 'NOT_CALCULATED',
      warnings: ['NOT_CALCULATED'],
      accountingStatus: events,
      allowedActions: ['CALCULATE'],
    }
  }
  const warnings = Array.isArray(latest.warningSummaryJson) ? latest.warningSummaryJson : []
  return {
    snapshot: latest,
    warnings,
    accountingStatus: events,
    allowedActions: ['RECALCULATE', ...(latest.completenessStatus.startsWith('INCOMPLETE') ? [] : ['RECORD_ABSORPTION', 'FINANCIAL_CLOSE_PREVIEW'])],
  }
}

export const decimalToNumber = num
