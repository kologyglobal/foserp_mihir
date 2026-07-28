import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { ValidationError } from '../../../utils/errors.js'
import { dec, toDecimal } from '../shared/quantity.helpers.js'
import { migrateFifoOpeningStock } from './fifo-opening-stock-migration.service.js'
import {
  mapDefaultCostingMethodToValuationMethod,
  resolveValuationMethodInTx,
} from './inventory-costing.helpers.js'
import { DEFAULT_INVENTORY_SETTINGS } from '../setup/setup.service.js'
import type {
  ListCostEntriesQuery,
  ListCostLayersQuery,
  ListVariancesQuery,
  MethodChangeBody,
  UpsertStandardCostBody,
  ValuationReconciliationQuery,
} from './costing.schemas.js'

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function mapCostEntry(row: {
  id: string
  itemId: string
  warehouseId: string
  inventoryMovementId: string
  entryType: string
  valuationMethod: string
  quantity: Prisma.Decimal
  unitCost: Prisma.Decimal
  totalCost: Prisma.Decimal
  postingDate: Date
  sourceType: string
  sourceId: string | null
  workOrderId: string | null
  costLayerId: string | null
  lotId: string | null
  serialId: string | null
  isReversal: boolean
  status: string
  createdAt: Date
}) {
  return {
    id: row.id,
    itemId: row.itemId,
    warehouseId: row.warehouseId,
    inventoryMovementId: row.inventoryMovementId,
    entryType: row.entryType,
    valuationMethod: row.valuationMethod,
    quantity: dec(row.quantity),
    unitCost: dec(row.unitCost),
    totalCost: dec(row.totalCost),
    postingDate: row.postingDate.toISOString().slice(0, 10),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    workOrderId: row.workOrderId,
    costLayerId: row.costLayerId,
    lotId: row.lotId,
    serialId: row.serialId,
    isReversal: row.isReversal,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapCostLayer(row: {
  id: string
  itemId: string
  warehouseId: string
  sourceMovementId: string
  receiptDate: Date
  postingDate: Date
  originalQuantity: Prisma.Decimal
  remainingQuantity: Prisma.Decimal
  unitCost: Prisma.Decimal
  originalValue: Prisma.Decimal
  remainingValue: Prisma.Decimal
  status: string
  lotId: string | null
  serialId: string | null
  createdAt: Date
}) {
  return {
    id: row.id,
    itemId: row.itemId,
    warehouseId: row.warehouseId,
    sourceMovementId: row.sourceMovementId,
    receiptDate: row.receiptDate.toISOString().slice(0, 10),
    postingDate: row.postingDate.toISOString().slice(0, 10),
    originalQuantity: dec(row.originalQuantity),
    remainingQuantity: dec(row.remainingQuantity),
    unitCost: dec(row.unitCost),
    originalValue: dec(row.originalValue),
    remainingValue: dec(row.remainingValue),
    status: row.status,
    lotId: row.lotId,
    serialId: row.serialId,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listCostEntries(tenantId: string, query: ListCostEntriesQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.InventoryCostEntryWhereInput = {
    tenantId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.valuationMethod ? { valuationMethod: query.valuationMethod } : {}),
    ...(query.entryType ? { entryType: query.entryType } : {}),
    ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
    ...(query.inventoryMovementId ? { inventoryMovementId: query.inventoryMovementId } : {}),
    ...(query.fromDate || query.toDate
      ? {
          postingDate: {
            ...(query.fromDate ? { gte: query.fromDate } : {}),
            ...(query.toDate ? { lte: query.toDate } : {}),
          },
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.inventoryCostEntry.count({ where }),
    prisma.inventoryCostEntry.findMany({
      where,
      orderBy: [{ postingDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
  ])

  return { items: rows.map(mapCostEntry), total, page, limit }
}

export async function getCostEntry(tenantId: string, id: string) {
  const row = await prisma.inventoryCostEntry.findFirst({ where: { id, tenantId } })
  if (!row) return null
  const consumptions = await prisma.inventoryCostLayerConsumption.findMany({
    where: { tenantId, issueCostEntryId: id },
    orderBy: { createdAt: 'asc' },
  })
  return {
    ...mapCostEntry(row),
    consumptions: consumptions.map((c) => ({
      id: c.id,
      layerId: c.layerId,
      quantityConsumed: dec(c.quantityConsumed),
      unitCost: dec(c.unitCost),
      totalCost: dec(c.totalCost),
      createdAt: c.createdAt.toISOString(),
    })),
  }
}

export async function listCostLayers(tenantId: string, query: ListCostLayersQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.InventoryCostLayerWhereInput = {
    tenantId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.openOnly ? { status: 'OPEN', remainingQuantity: { gt: 0 } } : {}),
    ...(query.serialId ? { serialId: query.serialId } : {}),
    ...(query.lotId ? { lotId: query.lotId } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.inventoryCostLayer.count({ where }),
    prisma.inventoryCostLayer.findMany({
      where,
      orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
      skip,
      take,
    }),
  ])

  return { items: rows.map(mapCostLayer), total, page, limit }
}

export async function getCostLayer(tenantId: string, id: string) {
  const row = await prisma.inventoryCostLayer.findFirst({ where: { id, tenantId } })
  if (!row) return null
  const consumptions = await prisma.inventoryCostLayerConsumption.findMany({
    where: { tenantId, layerId: id },
    orderBy: { createdAt: 'asc' },
  })
  return {
    ...mapCostLayer(row),
    consumptions: consumptions.map((c) => ({
      id: c.id,
      issueCostEntryId: c.issueCostEntryId,
      quantityConsumed: dec(c.quantityConsumed),
      unitCost: dec(c.unitCost),
      totalCost: dec(c.totalCost),
      createdAt: c.createdAt.toISOString(),
    })),
  }
}

/**
 * Valuation reconciliation: physical on-hand/value vs OPEN cost-layer remaining.
 * Read-only — never mutates balances.
 */
export async function reconcileValuation(tenantId: string, query: ValuationReconciliationQuery) {
  const where = {
    tenantId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
  }

  const [balances, layerGroups] = await Promise.all([
    prisma.inventoryStockBalance.findMany({
      where,
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ itemId: 'asc' }, { warehouseId: 'asc' }],
    }),
    prisma.inventoryCostLayer.groupBy({
      by: ['itemId', 'warehouseId'],
      where: { ...where, status: 'OPEN', remainingQuantity: { gt: 0 } },
      _sum: { remainingQuantity: true, remainingValue: true },
    }),
  ])

  const layerByKey = new Map(
    layerGroups.map((g) => [
      `${g.itemId}:${g.warehouseId}`,
      {
        qty: toDecimal(g._sum.remainingQuantity),
        value: toDecimal(g._sum.remainingValue),
      },
    ]),
  )

  const method = await prisma.$transaction((tx) => resolveValuationMethodInTx(tx, tenantId))

  const rows = balances.map((b) => {
    const key = `${b.itemId}:${b.warehouseId}`
    const layers = layerByKey.get(key) ?? { qty: toDecimal(0), value: toDecimal(0) }
    const onHand = toDecimal(b.onHandQty)
    const stockValue = toDecimal(b.stockValue)
    const qtyDiff = onHand.minus(layers.qty)
    const valueDiff = stockValue.minus(layers.value)
    const qtyMatched = qtyDiff.abs().lessThanOrEqualTo(0.0001)
    const valueMatched = valueDiff.abs().lessThanOrEqualTo(0.01)
    // For non-FIFO methods, layer qty may be zero by design — flag only when FIFO/specific uses layers.
    const layersExpected = method === 'FIFO' || method === 'SPECIFIC_IDENTIFICATION'
    const status =
      !layersExpected || (qtyMatched && valueMatched)
        ? 'MATCHED'
        : 'MISMATCHED'

    return {
      itemId: b.itemId,
      warehouseId: b.warehouseId,
      item: b.item,
      warehouse: b.warehouse,
      valuationMethod: method,
      onHandQty: dec(onHand),
      layerRemainingQty: dec(layers.qty),
      qtyDifference: dec(qtyDiff),
      stockValue: dec(stockValue),
      layerRemainingValue: dec(layers.value),
      valueDifference: dec(valueDiff),
      status,
    }
  })

  const filtered = query.mismatchesOnly ? rows.filter((r) => r.status === 'MISMATCHED') : rows
  return {
    valuationMethod: method,
    total: filtered.length,
    mismatched: rows.filter((r) => r.status === 'MISMATCHED').length,
    items: filtered,
  }
}

export async function listCostVariances(tenantId: string, query: ListVariancesQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.InventoryCostVarianceWhereInput = {
    tenantId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.varianceType ? { varianceType: query.varianceType } : {}),
    ...(query.fromDate || query.toDate
      ? {
          postingDate: {
            ...(query.fromDate ? { gte: query.fromDate } : {}),
            ...(query.toDate ? { lte: query.toDate } : {}),
          },
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.inventoryCostVariance.count({ where }),
    prisma.inventoryCostVariance.findMany({
      where,
      orderBy: [{ postingDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
  ])
  return {
    items: rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      warehouseId: r.warehouseId,
      inventoryMovementId: r.inventoryMovementId,
      varianceType: r.varianceType,
      quantity: dec(r.quantity),
      standardUnitCost: dec(r.standardUnitCost),
      actualUnitCost: dec(r.actualUnitCost),
      varianceAmount: dec(r.varianceAmount),
      postingDate: r.postingDate.toISOString().slice(0, 10),
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      remarks: r.remarks,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  }
}

export async function upsertStandardCostVersion(
  tenantId: string,
  userId: string,
  body: UpsertStandardCostBody,
) {
  const item = await prisma.masterItem.findFirst({
    where: { id: body.itemId, tenantId, deletedAt: null },
    select: { id: true },
  })
  if (!item) throw new ValidationError('Item not found')

  const latest = await prisma.inventoryItemStandardCostVersion.findFirst({
    where: { tenantId, itemId: body.itemId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })
  const nextVersion = (latest?.version ?? 0) + 1

  return prisma.$transaction(async (tx) => {
    if (body.activate) {
      await tx.inventoryItemStandardCostVersion.updateMany({
        where: { tenantId, itemId: body.itemId, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED', effectiveTo: body.effectiveFrom },
      })
    }

    const created = await tx.inventoryItemStandardCostVersion.create({
      data: {
        tenantId,
        itemId: body.itemId,
        version: nextVersion,
        unitCost: body.unitCost,
        effectiveFrom: body.effectiveFrom,
        status: body.activate ? 'ACTIVE' : 'DRAFT',
        remarks: body.remarks ?? null,
        createdBy: userId,
      },
    })

    if (body.activate) {
      await tx.masterItem.update({
        where: { id: body.itemId },
        data: { standardRate: body.unitCost },
      })
    }

    return {
      id: created.id,
      itemId: created.itemId,
      version: created.version,
      unitCost: dec(created.unitCost),
      effectiveFrom: created.effectiveFrom.toISOString().slice(0, 10),
      status: created.status,
    }
  })
}

export async function changeValuationMethod(
  tenantId: string,
  userId: string,
  body: MethodChangeBody,
) {
  const toMethod = mapDefaultCostingMethodToValuationMethod(body.toMethod)
  const settingsRow = await prisma.inventorySettings.findUnique({ where: { tenantId } })
  const currentSettings = settingsRow
    ? asObject(settingsRow.settings)
    : (DEFAULT_INVENTORY_SETTINGS as unknown as Record<string, unknown>)
  const general = asObject(currentSettings.general)
  const fromMethod = mapDefaultCostingMethodToValuationMethod(general.defaultCostingMethod)

  if (fromMethod === toMethod) {
    throw new ValidationError(`Valuation method is already ${toMethod}`)
  }

  const costing = asObject(currentSettings.costing)
  const policy = asObject(costing.methodChangePolicy)
  const allowMidPeriod = policy.allowMidPeriod === true
  const effectiveDate = body.effectiveDate ?? new Date()

  if (!allowMidPeriod && !body.force) {
    // Soft gate: require force for mid-period switches unless policy allows.
    const day = effectiveDate.getUTCDate()
    if (day !== 1 && effectiveDate.getUTCMonth() === new Date().getUTCMonth()) {
      throw new ValidationError(
        'Method change mid-period requires force=true or costing.methodChangePolicy.allowMidPeriod=true',
      )
    }
  }

  const openingMigrationRequired = toMethod === 'FIFO' || toMethod === 'SPECIFIC_IDENTIFICATION'
  let openingMigrationCompleted = false
  let migrationResult: Awaited<ReturnType<typeof migrateFifoOpeningStock>> | null = null

  if (openingMigrationRequired && body.runOpeningMigration) {
    // Temporarily set method then migrate, or migrate with force then set.
    migrationResult = await migrateFifoOpeningStock({
      tenantId,
      force: true,
      createdBy: userId,
    })
    openingMigrationCompleted = migrationResult.exceptions === 0
  }

  const nextGeneral = {
    ...general,
    defaultCostingMethod: body.toMethod,
  }
  const nextCosting = {
    ...costing,
    methodChangePolicy: {
      ...policy,
      lastChangeAt: new Date().toISOString(),
      lastFrom: fromMethod,
      lastTo: toMethod,
    },
  }
  const nextSettings = {
    ...currentSettings,
    general: nextGeneral,
    costing: nextCosting,
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventorySettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        settings: nextSettings as Prisma.InputJsonValue,
        createdById: userId,
        updatedById: userId,
      },
      update: {
        settings: nextSettings as Prisma.InputJsonValue,
        version: { increment: 1 },
        updatedById: userId,
      },
    })

    await tx.inventoryValuationMethodChange.create({
      data: {
        tenantId,
        fromMethod,
        toMethod,
        effectiveDate,
        reason: body.reason,
        openingMigrationRequired,
        openingMigrationCompleted,
        createdBy: userId,
      },
    })
  })

  return {
    fromMethod,
    toMethod,
    effectiveDate: effectiveDate.toISOString().slice(0, 10),
    openingMigrationRequired,
    openingMigrationCompleted,
    migration: migrationResult
      ? {
          createdLayers: migrationResult.createdLayers,
          skipped: migrationResult.skipped,
          exceptions: migrationResult.exceptions,
        }
      : null,
  }
}
