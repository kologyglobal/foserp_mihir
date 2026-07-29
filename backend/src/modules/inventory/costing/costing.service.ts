import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
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

function mapCostEntry(
  row: {
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
    createdBy?: string | null
  },
  extras?: {
    item?: { id: string; code: string; name: string } | null
    warehouse?: { id: string; code: string; name: string } | null
  },
) {
  return {
    id: row.id,
    entryNo: `CE-${row.id.slice(0, 8).toUpperCase()}`,
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
    createdBy: row.createdBy ?? null,
    item: extras?.item ?? null,
    warehouse: extras?.warehouse ?? null,
    itemCode: extras?.item?.code ?? null,
    itemName: extras?.item?.name ?? null,
    warehouseCode: extras?.warehouse?.code ?? null,
    warehouseName: extras?.warehouse?.name ?? null,
  }
}

function mapCostLayer(
  row: {
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
  },
  extras?: {
    item?: { id: string; code: string; name: string } | null
    warehouse?: { id: string; code: string; name: string } | null
  },
) {
  return {
    id: row.id,
    layerNo: `LY-${row.id.slice(0, 8).toUpperCase()}`,
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
    item: extras?.item ?? null,
    warehouse: extras?.warehouse ?? null,
    itemCode: extras?.item?.code ?? null,
    itemName: extras?.item?.name ?? null,
    warehouseCode: extras?.warehouse?.code ?? null,
    warehouseName: extras?.warehouse?.name ?? null,
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
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ postingDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
  ])

  return {
    items: rows.map((r) => mapCostEntry(r, { item: r.item, warehouse: r.warehouse })),
    total,
    page,
    limit,
  }
}

export async function getCostEntry(tenantId: string, id: string) {
  const row = await prisma.inventoryCostEntry.findFirst({
    where: { id, tenantId },
    include: {
      item: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      inventoryMovement: {
        select: {
          id: true,
          movementNumber: true,
          movementType: true,
          referenceType: true,
          quantity: true,
          rate: true,
          value: true,
          movementDate: true,
          referenceNo: true,
        },
      },
    },
  })
  if (!row) return null
  const consumptions = await prisma.inventoryCostLayerConsumption.findMany({
    where: { tenantId, issueCostEntryId: id },
    include: {
      layer: {
        select: {
          id: true,
          receiptDate: true,
          unitCost: true,
          status: true,
          lotId: true,
          serialId: true,
          originalQuantity: true,
          remainingQuantity: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  const variances = await prisma.inventoryCostVariance.findMany({
    where: { tenantId, costEntryId: id },
    take: 20,
    orderBy: { createdAt: 'desc' },
  })
  let standardVersion = null
  if (row.valuationMethod === 'STANDARD_COST') {
    standardVersion = await prisma.inventoryItemStandardCostVersion.findFirst({
      where: {
        tenantId,
        itemId: row.itemId,
        status: 'ACTIVE',
        effectiveFrom: { lte: row.postingDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: row.postingDate } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      select: { id: true, version: true, unitCost: true, effectiveFrom: true, status: true },
    })
  }

  return {
    ...mapCostEntry(row, { item: row.item, warehouse: row.warehouse }),
    movement: row.inventoryMovement
      ? {
          id: row.inventoryMovement.id,
          movementNumber: row.inventoryMovement.movementNumber,
          movementType: row.inventoryMovement.movementType,
          referenceType: row.inventoryMovement.referenceType,
          quantity: dec(row.inventoryMovement.quantity),
          rate: dec(row.inventoryMovement.rate),
          value: dec(row.inventoryMovement.value),
          movementDate: row.inventoryMovement.movementDate.toISOString().slice(0, 10),
          referenceNo: row.inventoryMovement.referenceNo,
        }
      : null,
    consumptions: consumptions.map((c) => ({
      id: c.id,
      layerId: c.layerId,
      quantityConsumed: dec(c.quantityConsumed),
      unitCost: dec(c.unitCost),
      totalCost: dec(c.totalCost),
      createdAt: c.createdAt.toISOString(),
      layer: c.layer
        ? {
            id: c.layer.id,
            layerNo: `LY-${c.layer.id.slice(0, 8).toUpperCase()}`,
            receiptDate: c.layer.receiptDate.toISOString().slice(0, 10),
            unitCost: dec(c.layer.unitCost),
            status: c.layer.status,
            lotId: c.layer.lotId,
            serialId: c.layer.serialId,
            originalQuantity: dec(c.layer.originalQuantity),
            remainingQuantity: dec(c.layer.remainingQuantity),
          }
        : null,
    })),
    standardCost: standardVersion
      ? {
          id: standardVersion.id,
          version: standardVersion.version,
          unitCost: dec(standardVersion.unitCost),
          effectiveFrom: standardVersion.effectiveFrom.toISOString().slice(0, 10),
          status: standardVersion.status,
        }
      : null,
    variances: variances.map((v) => ({
      id: v.id,
      varianceType: v.varianceType,
      standardUnitCost: dec(v.standardUnitCost),
      actualUnitCost: dec(v.actualUnitCost),
      varianceAmount: dec(v.varianceAmount),
    })),
    specificIdentity: { lotId: row.lotId, serialId: row.serialId },
    accounting: {
      postingEnabled: false,
      note: 'Inventory↔GL trial balance deferred — operational costing is authoritative for this view.',
    },
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
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ receiptDate: 'asc' }, { createdAt: 'asc' }],
      skip,
      take,
    }),
  ])

  return {
    items: rows.map((r) => mapCostLayer(r, { item: r.item, warehouse: r.warehouse })),
    total,
    page,
    limit,
  }
}

export async function getCostLayer(tenantId: string, id: string) {
  const row = await prisma.inventoryCostLayer.findFirst({
    where: { id, tenantId },
    include: {
      item: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  })
  if (!row) return null
  const consumptions = await prisma.inventoryCostLayerConsumption.findMany({
    where: { tenantId, layerId: id },
    orderBy: { createdAt: 'asc' },
  })
  return {
    ...mapCostLayer(row, { item: row.item, warehouse: row.warehouse }),
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

  // Movements without cost entries (uncosted)
  const uncostedMovements = await prisma.inventoryStockMovement.count({
    where: {
      tenantId,
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      costEntries: { none: {} },
    },
  })

  const unidentifiedOpenLayers =
    method === 'SPECIFIC_IDENTIFICATION'
      ? await prisma.inventoryCostLayer.count({
          where: {
            tenantId,
            status: 'OPEN',
            remainingQuantity: { gt: 0 },
            serialId: null,
            lotId: null,
            ...(query.itemId ? { itemId: query.itemId } : {}),
            ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
          },
        })
      : 0

  const missingStandardItemIds =
    method === 'STANDARD_COST'
      ? await (async () => {
          const stocked = balances.filter((b) => toDecimal(b.onHandQty).greaterThan(0))
          const itemIds = [...new Set(stocked.map((b) => b.itemId))]
          if (!itemIds.length) return [] as string[]
          const [items, activeVersions] = await Promise.all([
            prisma.masterItem.findMany({
              where: { tenantId, id: { in: itemIds } },
              select: { id: true, standardRate: true },
            }),
            prisma.inventoryItemStandardCostVersion.findMany({
              where: { tenantId, itemId: { in: itemIds }, status: 'ACTIVE' },
              select: { itemId: true },
            }),
          ])
          const hasActive = new Set(activeVersions.map((v) => v.itemId))
          return items
            .filter((it) => !hasActive.has(it.id) && toDecimal(it.standardRate).lessThanOrEqualTo(0))
            .map((it) => it.id)
        })()
      : []

  const rows = balances.map((b) => {
    const key = `${b.itemId}:${b.warehouseId}`
    const layers = layerByKey.get(key) ?? { qty: toDecimal(0), value: toDecimal(0) }
    const onHand = toDecimal(b.onHandQty)
    const stockValue = toDecimal(b.stockValue)
    const avgRate = toDecimal(b.avgRate)
    const qtyDiff = onHand.minus(layers.qty)
    const valueDiff = stockValue.minus(layers.value)
    const qtyMatched = qtyDiff.abs().lessThanOrEqualTo(0.0001)
    const valueMatched = valueDiff.abs().lessThanOrEqualTo(0.01)
    const layersExpected = method === 'FIFO' || method === 'SPECIFIC_IDENTIFICATION'
    const reasonCodes: string[] = []
    if (layersExpected && !qtyMatched) reasonCodes.push('COSTED_QTY_MISMATCH')
    if (layersExpected && !valueMatched) reasonCodes.push('FIFO_LAYER_MISMATCH')
    if (onHand.lessThan(0)) reasonCodes.push('NEGATIVE_STOCK_COST_PENDING')
    if (method === 'MOVING_WEIGHTED_AVERAGE' && onHand.greaterThan(0)) {
      const implied = onHand.times(avgRate).toDecimalPlaces(2)
      if (implied.minus(stockValue).abs().greaterThan(0.05)) {
        reasonCodes.push('MOVING_AVERAGE_STATE_MISMATCH')
      }
    }
    if (method === 'STANDARD_COST' && onHand.greaterThan(0) && missingStandardItemIds.includes(b.itemId)) {
      reasonCodes.push('MISSING_STANDARD_COST')
    }
    if (method === 'SPECIFIC_IDENTIFICATION' && onHand.greaterThan(0) && layers.qty.lessThanOrEqualTo(0)) {
      reasonCodes.push('SPECIFIC_COST_NOT_IDENTIFIED')
    }
    if (onHand.greaterThan(0) && stockValue.lessThanOrEqualTo(0) && avgRate.lessThanOrEqualTo(0) && !layersExpected) {
      reasonCodes.push('OPENING_BALANCE_NOT_VALUED')
    }
    if (uncostedMovements > 0 && onHand.greaterThan(0)) {
      // Surface at row level only when this balance has zero stock value but qty — otherwise summary carries it.
      if (stockValue.isZero() && !layersExpected) reasonCodes.push('UNCOSTED_MOVEMENT')
    }
    const hardMismatch =
      (layersExpected && !(qtyMatched && valueMatched)) ||
      reasonCodes.some((c) =>
        [
          'COSTED_QTY_MISMATCH',
          'FIFO_LAYER_MISMATCH',
          'MOVING_AVERAGE_STATE_MISMATCH',
          'MISSING_STANDARD_COST',
          'SPECIFIC_COST_NOT_IDENTIFIED',
          'OPENING_BALANCE_NOT_VALUED',
          'NEGATIVE_STOCK_COST_PENDING',
        ].includes(c),
      )
    const status = hardMismatch ? 'MISMATCHED' : 'MATCHED'

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
      reasonCodes,
      costingStatus: status === 'MATCHED' ? 'Balanced' : 'Difference Found',
      accountingStatus: 'Accounting posting deferred',
      glValue: null as string | null,
      glDifference: null as string | null,
    }
  })

  const filtered = query.mismatchesOnly ? rows.filter((r) => r.status === 'MISMATCHED') : rows
  const inventoryValue = balances.reduce((s, b) => s + Number(b.stockValue), 0)
  const stockQty = balances.reduce((s, b) => s + Number(b.onHandQty), 0)
  return {
    valuationMethod: method,
    total: filtered.length,
    mismatched: rows.filter((r) => r.status === 'MISMATCHED').length,
    summary: {
      stockQuantity: stockQty,
      inventoryCostValue: inventoryValue,
      glInventoryValue: null,
      difference: null,
      uncostedMovements,
      unidentifiedOpenLayers,
      missingStandardItems: missingStandardItemIds.length,
      unpostedAccountingEvents: null,
      failedCostingEvents: 0,
      accountingEnabled: false,
      glReconciliation: 'Not Available',
      glReconciliationReason:
        'Inventory Accounting is not enabled / GL integration is not yet available.',
      note: 'Physical stock ↔ OPEN cost layers (FIFO/Specific). Inventory↔GL trial balance is deferred — GL is not shown as ₹0.',
    },
    items: filtered,
    ranAt: new Date().toISOString(),
  }
}

/** Re-run reconciliation read model (no mutation of posted costs). */
export async function runValuationReconciliation(tenantId: string, query: ValuationReconciliationQuery) {
  return reconcileValuation(tenantId, query)
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
  const readinessPreview = await assertMethodChangeExecutable(tenantId, body)
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
      lastReadiness: readinessPreview.readiness,
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
    readiness: readinessPreview.readiness,
    checks: readinessPreview.checks,
    migration: migrationResult
      ? {
          createdLayers: migrationResult.createdLayers,
          skipped: migrationResult.skipped,
          exceptions: migrationResult.exceptions,
        }
      : null,
  }
}

export async function getItemCostingSummary(tenantId: string, itemId: string) {
  const { getEffectiveValuationMethod } = await import('./inventory-costing.helpers.js')
  const item = await prisma.masterItem.findFirst({
    where: { id: itemId, tenantId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      standardRate: true,
      serialTracked: true,
      batchTracked: true,
    },
  })
  if (!item) return null

  const effective = await getEffectiveValuationMethod({ tenantId, itemId })
  const balances = await prisma.inventoryStockBalance.findMany({
    where: { tenantId, itemId },
    select: { onHandQty: true, avgRate: true, stockValue: true, warehouseId: true },
  })
  const stockQty = balances.reduce((s, b) => s + Number(b.onHandQty), 0)
  const stockValue = balances.reduce((s, b) => s + Number(b.stockValue), 0)
  const avgRate =
    stockQty > 0
      ? stockValue / stockQty
      : balances.find((b) => Number(b.avgRate) > 0)?.avgRate
        ? Number(balances.find((b) => Number(b.avgRate) > 0)!.avgRate)
        : 0

  const [lastReceipt, lastIssue, openLayers, activeStandard, specificOpen] = await Promise.all([
    prisma.inventoryCostEntry.findFirst({
      where: { tenantId, itemId, entryType: 'RECEIPT' },
      orderBy: { postingDate: 'desc' },
      select: { unitCost: true, postingDate: true, totalCost: true },
    }),
    prisma.inventoryCostEntry.findFirst({
      where: { tenantId, itemId, entryType: 'ISSUE' },
      orderBy: { postingDate: 'desc' },
      select: { unitCost: true, postingDate: true, totalCost: true },
    }),
    prisma.inventoryCostLayer.count({
      where: { tenantId, itemId, status: 'OPEN', remainingQuantity: { gt: 0 } },
    }),
    prisma.inventoryItemStandardCostVersion.findFirst({
      where: {
        tenantId,
        itemId,
        status: 'ACTIVE',
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
      select: { unitCost: true, effectiveFrom: true, version: true },
    }),
    prisma.inventoryCostLayer.count({
      where: {
        tenantId,
        itemId,
        status: 'OPEN',
        remainingQuantity: { gt: 0 },
        OR: [{ serialId: { not: null } }, { lotId: { not: null } }],
      },
    }),
  ])

  return {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    valuationMethod: effective.method,
    methodSource: effective.source,
    stockQty,
    stockValue,
    currentCost: avgRate || Number(activeStandard?.unitCost ?? item.standardRate ?? 0),
    lastReceiptCost: lastReceipt ? Number(lastReceipt.unitCost) : null,
    lastIssueCost: lastIssue ? Number(lastIssue.unitCost) : null,
    costStatus: stockQty === 0 ? 'NO_STOCK' : openLayers > 0 || stockValue > 0 ? 'VALUED' : 'ATTENTION',
    methodSpecific: {
      fifo: { openLayers },
      movingAverage: { currentMovingAverage: avgRate },
      standard: activeStandard
        ? {
            currentStandard: Number(activeStandard.unitCost),
            effectiveFrom: activeStandard.effectiveFrom.toISOString().slice(0, 10),
            version: activeStandard.version,
          }
        : {
            currentStandard: Number(item.standardRate),
            effectiveFrom: null,
            version: null,
            note: 'MasterItem.standardRate fallback',
          },
      specific: {
        trackedOpenPools: specificOpen,
        serialTracked: item.serialTracked,
        batchTracked: item.batchTracked,
      },
    },
  }
}

export async function getEffectiveMethod(tenantId: string, query: {
  itemId?: string
  legalEntityId?: string
  warehouseId?: string
  postingDate?: Date
}) {
  const { getEffectiveValuationMethod } = await import('./inventory-costing.helpers.js')
  return getEffectiveValuationMethod({
    tenantId,
    itemId: query.itemId,
    legalEntityId: query.legalEntityId,
    warehouseId: query.warehouseId,
    postingDate: query.postingDate,
  })
}

const METHOD_DESCRIPTIONS: Record<string, string> = {
  FIFO: 'Oldest eligible cost layers are consumed first.',
  MOVING_WEIGHTED_AVERAGE: 'Receipts update average cost; issues use the current average cost.',
  STANDARD_COST: 'Inventory uses approved standard cost and variances are tracked separately.',
  SPECIFIC_IDENTIFICATION: 'Tracked serial/lot/pool uses its exact identified cost.',
}

export async function getCostingOverview(tenantId: string) {
  const { getEffectiveValuationMethod } = await import('./inventory-costing.helpers.js')
  const effective = await getEffectiveValuationMethod({ tenantId })

  const [balancesAgg, entryCount, openLayers, openLayerAgg, uncostedMovements, lastMethodChange, missingStandards, unidentifiedLayers] =
    await Promise.all([
      prisma.inventoryStockBalance.aggregate({
        where: { tenantId },
        _sum: { onHandQty: true, stockValue: true },
      }),
      prisma.inventoryCostEntry.count({ where: { tenantId } }),
      prisma.inventoryCostLayer.count({
        where: { tenantId, status: 'OPEN', remainingQuantity: { gt: 0 } },
      }),
      prisma.inventoryCostLayer.aggregate({
        where: { tenantId, status: 'OPEN', remainingQuantity: { gt: 0 } },
        _sum: { remainingValue: true, remainingQuantity: true },
      }),
      prisma.inventoryStockMovement.count({
        where: { tenantId, costEntries: { none: {} } },
      }),
      prisma.inventoryValuationMethodChange.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      effective.method === 'STANDARD_COST'
        ? prisma.masterItem.count({
            where: {
              tenantId,
              deletedAt: null,
              isStockable: true,
              standardRate: { lte: 0 },
            },
          })
        : Promise.resolve(0),
      effective.method === 'SPECIFIC_IDENTIFICATION'
        ? prisma.inventoryCostLayer.count({
            where: {
              tenantId,
              status: 'OPEN',
              remainingQuantity: { gt: 0 },
              serialId: null,
              lotId: null,
            },
          })
        : Promise.resolve(0),
    ])

  const recon = await reconcileValuation(tenantId, { mismatchesOnly: false })
  const stockQty = Number(balancesAgg._sum.onHandQty ?? 0)
  const inventoryValue = Number(balancesAgg._sum.stockValue ?? 0)
  const attention: Array<{ code: string; message: string }> = []
  if (uncostedMovements > 0) {
    attention.push({
      code: 'UNCOSTED_MOVEMENT',
      message: `${uncostedMovements} stock movement(s) do not yet have cost entries.`,
    })
  }
  if (recon.mismatched > 0) {
    attention.push({
      code: 'FIFO_LAYER_MISMATCH',
      message: `${recon.mismatched} item/warehouse row(s) have quantity or value differences vs open layers.`,
    })
  }
  if (unidentifiedLayers > 0) {
    attention.push({
      code: 'SPECIFIC_COST_NOT_IDENTIFIED',
      message: `${unidentifiedLayers} open layer(s) have no serial/lot identity.`,
    })
  }
  if (missingStandards > 0) {
    attention.push({
      code: 'MISSING_STANDARD_COST',
      message: `${missingStandards} stockable item(s) may lack an approved standard cost.`,
    })
  }

  return {
    valuationMethod: effective.method,
    methodSource: effective.source,
    methodDescription: METHOD_DESCRIPTIONS[effective.method] ?? '',
    effectiveDate: effective.effectiveDate,
    defaultCostingMethodKey: effective.defaultCostingMethodKey,
    summary: {
      inventoryValue,
      stockQuantity: stockQty,
      uncostedMovements,
      unreconciledValue: recon.items
        .filter((i) => i.status === 'MISMATCHED')
        .reduce((s, i) => s + Math.abs(Number(i.valueDifference)), 0),
      glDifference: null as number | null,
      openLayers,
      openLayerValue: Number(openLayerAgg._sum.remainingValue ?? 0),
      costEntryCount: entryCount,
      reconMismatches: recon.mismatched,
    },
    policy: {
      scope: 'TENANT_INVENTORY_SETTINGS',
      effectiveFrom: lastMethodChange?.effectiveDate?.toISOString().slice(0, 10) ?? effective.effectiveDate,
      lastChangedBy: lastMethodChange?.createdBy ?? null,
      lastChangedAt: lastMethodChange?.createdAt?.toISOString() ?? null,
      lastFrom: lastMethodChange?.fromMethod ?? null,
      lastTo: lastMethodChange?.toMethod ?? null,
    },
    attention,
    accounting: {
      enabled: false,
      note: 'Inventory↔GL reconciliation deferred until inventory accounting trial balance is live.',
    },
    manufacturing: {
      note: 'WO material costs consume Inventory Cost Entries — open Manufacturing Costing for WO detail.',
      openPath: '/manufacturing',
    },
  }
}

export async function listValuationItems(
  tenantId: string,
  query: { page?: number; limit?: number; warehouseId?: string; itemId?: string; search?: string },
) {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const { getEffectiveValuationMethod } = await import('./inventory-costing.helpers.js')
  const effective = await getEffectiveValuationMethod({ tenantId })

  const where: Prisma.InventoryStockBalanceWhereInput = {
    tenantId,
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.search
      ? {
          item: {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
            ],
          },
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.inventoryStockBalance.count({ where }),
    prisma.inventoryStockBalance.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            code: true,
            name: true,
            category: { select: { name: true } },
            baseUom: { select: { code: true } },
            serialTracked: true,
            batchTracked: true,
          },
        },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ stockValue: 'desc' }, { itemId: 'asc' }],
      skip,
      take,
    }),
  ])

  const items = await Promise.all(
    rows.map(async (b) => {
      const onHand = Number(b.onHandQty)
      const value = Number(b.stockValue)
      const avg = Number(b.avgRate)
      let unitCostLabel = String(avg)
      let unitCostDisplay = avg
      if (effective.method === 'FIFO') {
        unitCostLabel = 'Layered'
        const lastIssue = await prisma.inventoryCostEntry.findFirst({
          where: { tenantId, itemId: b.itemId, warehouseId: b.warehouseId, entryType: 'ISSUE' },
          orderBy: { postingDate: 'desc' },
          select: { unitCost: true },
        })
        unitCostDisplay = lastIssue ? Number(lastIssue.unitCost) : avg
      } else if (effective.method === 'STANDARD_COST') {
        const std = await prisma.inventoryItemStandardCostVersion.findFirst({
          where: { tenantId, itemId: b.itemId, status: 'ACTIVE' },
          orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
          select: { unitCost: true },
        })
        unitCostDisplay = Number(std?.unitCost ?? avg)
        unitCostLabel = String(unitCostDisplay)
      } else if (effective.method === 'SPECIFIC_IDENTIFICATION') {
        const tracked = await prisma.inventoryCostLayer.count({
          where: {
            tenantId,
            itemId: b.itemId,
            warehouseId: b.warehouseId,
            status: 'OPEN',
            remainingQuantity: { gt: 0 },
            OR: [{ serialId: { not: null } }, { lotId: { not: null } }],
          },
        })
        unitCostLabel = `Specific (${tracked} open)`
        unitCostDisplay = onHand > 0 ? value / onHand : 0
      }

      const lastMovement = await prisma.inventoryCostEntry.findFirst({
        where: { tenantId, itemId: b.itemId, warehouseId: b.warehouseId },
        orderBy: { postingDate: 'desc' },
        select: { postingDate: true, entryType: true },
      })

      return {
        itemId: b.itemId,
        warehouseId: b.warehouseId,
        itemCode: b.item.code,
        itemName: b.item.name,
        category: b.item.category?.name ?? null,
        uom: b.item.baseUom?.code ?? null,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        valuationMethod: effective.method,
        onHandQty: onHand,
        inventoryValue: value,
        currentUnitCost: unitCostDisplay,
        unitCostLabel,
        costStatus: onHand === 0 ? 'No Stock' : value > 0 ? 'Costed' : 'Uncosted',
        lastCostMovement: lastMovement
          ? {
              postingDate: lastMovement.postingDate.toISOString().slice(0, 10),
              entryType: lastMovement.entryType,
            }
          : null,
        tracking: {
          serialTracked: b.item.serialTracked,
          batchTracked: b.item.batchTracked,
        },
      }
    }),
  )

  return { items, total, page, limit, valuationMethod: effective.method }
}

export async function listMovingAverageState(
  tenantId: string,
  query: { page?: number; limit?: number; warehouseId?: string; itemId?: string },
) {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const where: Prisma.InventoryStockBalanceWhereInput = {
    tenantId,
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.itemId ? { itemId: query.itemId } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.inventoryStockBalance.count({ where }),
    prisma.inventoryStockBalance.findMany({
      where,
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ itemId: 'asc' }],
      skip,
      take,
    }),
  ])

  const items = await Promise.all(
    rows.map(async (b) => {
      const [lastReceipt, lastIssue] = await Promise.all([
        prisma.inventoryCostEntry.findFirst({
          where: {
            tenantId,
            itemId: b.itemId,
            warehouseId: b.warehouseId,
            entryType: 'RECEIPT',
            valuationMethod: 'MOVING_WEIGHTED_AVERAGE',
          },
          orderBy: { postingDate: 'desc' },
        }),
        prisma.inventoryCostEntry.findFirst({
          where: {
            tenantId,
            itemId: b.itemId,
            warehouseId: b.warehouseId,
            entryType: 'ISSUE',
            valuationMethod: 'MOVING_WEIGHTED_AVERAGE',
          },
          orderBy: { postingDate: 'desc' },
        }),
      ])
      return {
        itemId: b.itemId,
        warehouseId: b.warehouseId,
        itemCode: b.item.code,
        itemName: b.item.name,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        quantity: dec(b.onHandQty),
        inventoryValue: dec(b.stockValue),
        currentAverageCost: dec(b.avgRate),
        lastReceipt: lastReceipt
          ? { postingDate: lastReceipt.postingDate.toISOString().slice(0, 10), unitCost: dec(lastReceipt.unitCost) }
          : null,
        lastIssue: lastIssue
          ? { postingDate: lastIssue.postingDate.toISOString().slice(0, 10), unitCost: dec(lastIssue.unitCost) }
          : null,
        lastRecalculated: b.updatedAt.toISOString(),
      }
    }),
  )

  return { items, total, page, limit }
}

export async function listStandardCostVersions(
  tenantId: string,
  query: { page?: number; limit?: number; itemId?: string; status?: string },
) {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const where: Prisma.InventoryItemStandardCostVersionWhereInput = {
    tenantId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.status ? { status: query.status as 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.inventoryItemStandardCostVersion.count({ where }),
    prisma.inventoryItemStandardCostVersion.findMany({
      where,
      include: { item: { select: { id: true, code: true, name: true, standardRate: true } } },
      orderBy: [{ itemId: 'asc' }, { version: 'desc' }],
      skip,
      take,
    }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      itemCode: r.item.code,
      itemName: r.item.name,
      unitCost: dec(r.unitCost),
      currencyCode: r.currencyCode,
      effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: r.effectiveTo?.toISOString().slice(0, 10) ?? null,
      version: r.version,
      status: r.status,
      masterStandardRate: dec(r.item.standardRate),
      difference: dec(toDecimal(r.unitCost).minus(r.item.standardRate)),
      remarks: r.remarks,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  }
}

export async function listSpecificIdentification(
  tenantId: string,
  query: { page?: number; limit?: number; itemId?: string; unidentifiedOnly?: boolean },
) {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const where: Prisma.InventoryCostLayerWhereInput = {
    tenantId,
    status: 'OPEN',
    remainingQuantity: { gt: 0 },
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.unidentifiedOnly
      ? { serialId: null, lotId: null }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.inventoryCostLayer.count({ where }),
    prisma.inventoryCostLayer.findMany({
      where,
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ receiptDate: 'desc' }],
      skip,
      take,
    }),
  ])

  return {
    items: rows.map((r) => {
      const unidentified = !r.serialId && !r.lotId
      return {
        ...mapCostLayer(r, { item: r.item, warehouse: r.warehouse }),
        identityType: r.serialId ? 'SERIAL' : r.lotId ? 'LOT' : 'POOL',
        unidentified,
        attention: unidentified ? 'SPECIFIC_COST_NOT_IDENTIFIED' : null,
        currentValue: dec(r.remainingValue),
      }
    }),
    total,
    page,
    limit,
    unidentifiedCount: await prisma.inventoryCostLayer.count({
      where: {
        tenantId,
        status: 'OPEN',
        remainingQuantity: { gt: 0 },
        serialId: null,
        lotId: null,
      },
    }),
  }
}

/**
 * Derived MA before/after history from cost entries (display-only).
 * Reconstructs running qty/value/avg by replaying RECEIPT/OPENING/ISSUE/ADJUSTMENT entries.
 * Does not invent snapshots not implied by posted cost entries.
 */
export async function listMovingAverageHistory(
  tenantId: string,
  query: { itemId: string; warehouseId?: string; limit?: number },
) {
  const take = Math.min(Math.max(query.limit ?? 50, 1), 200)
  const entries = await prisma.inventoryCostEntry.findMany({
    where: {
      tenantId,
      itemId: query.itemId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      valuationMethod: 'MOVING_WEIGHTED_AVERAGE',
    },
    include: {
      inventoryMovement: { select: { id: true, movementNumber: true, referenceType: true, referenceNo: true } },
    },
    orderBy: [{ postingDate: 'asc' }, { createdAt: 'asc' }],
    take: 5000,
  })

  let qty = toDecimal(0)
  let value = toDecimal(0)
  const history: Array<{
    costEntryId: string
    postingDate: string
    sourceType: string
    sourceDocument: string | null
    movementId: string
    entryType: string
    qtyBefore: string
    valueBefore: string
    averageBefore: string
    movementQty: string
    movementValue: string
    qtyAfter: string
    valueAfter: string
    averageAfter: string
  }> = []

  for (const e of entries) {
    const qtyBefore = qty
    const valueBefore = value
    const avgBefore = qtyBefore.isZero() ? toDecimal(0) : valueBefore.div(qtyBefore).toDecimalPlaces(4)
    const signedQty =
      e.entryType === 'ISSUE' ? toDecimal(e.quantity).neg() : toDecimal(e.quantity)
    // ISSUE totalCost is stored absolute; reduce inventory value on issue.
    const signedValue =
      e.entryType === 'ISSUE' ? toDecimal(e.totalCost).neg() : toDecimal(e.totalCost)
    qty = qty.plus(signedQty).toDecimalPlaces(4)
    if (qty.isZero()) {
      value = toDecimal(0)
    } else if (e.entryType === 'ISSUE') {
      // MA issues leave avg unchanged; value = qty × prior avg (engine stores stockValue that way).
      value = qty.times(avgBefore).toDecimalPlaces(2)
    } else {
      value = valueBefore.plus(signedValue).toDecimalPlaces(2)
    }
    if (qty.lessThan(0)) {
      // Cannot safely reconstruct negative MA path from entries alone.
      break
    }
    const avgAfter = qty.isZero() ? toDecimal(0) : value.div(qty).toDecimalPlaces(4)
    history.push({
      costEntryId: e.id,
      postingDate: e.postingDate.toISOString().slice(0, 10),
      sourceType: e.sourceType,
      sourceDocument: e.inventoryMovement?.referenceNo ?? e.inventoryMovement?.movementNumber ?? e.sourceId,
      movementId: e.inventoryMovementId,
      entryType: e.entryType,
      qtyBefore: dec(qtyBefore),
      valueBefore: dec(valueBefore),
      averageBefore: dec(avgBefore),
      movementQty: dec(signedQty),
      movementValue: dec(signedValue),
      qtyAfter: dec(qty),
      valueAfter: dec(value),
      averageAfter: dec(avgAfter),
    })
  }

  const sliced = history.slice(-take).reverse()
  return {
    itemId: query.itemId,
    warehouseId: query.warehouseId ?? null,
    reconstructed: true,
    note: 'Before/after averages are derived by replaying MOVING_WEIGHTED_AVERAGE cost entries. Not a stored snapshot ledger.',
    items: sliced,
    total: history.length,
  }
}

type ReadinessSeverity = 'PASS' | 'WARNING' | 'BLOCKED'

export async function previewValuationMethodChange(
  tenantId: string,
  body: { toMethod: 'standard' | 'average' | 'fifo' | 'specific'; effectiveDate?: Date },
) {
  const toMethod = mapDefaultCostingMethodToValuationMethod(body.toMethod)
  const settingsRow = await prisma.inventorySettings.findUnique({ where: { tenantId } })
  const currentSettings = settingsRow
    ? asObject(settingsRow.settings)
    : (DEFAULT_INVENTORY_SETTINGS as unknown as Record<string, unknown>)
  const general = asObject(currentSettings.general)
  const fromMethod = mapDefaultCostingMethodToValuationMethod(general.defaultCostingMethod)
  const costing = asObject(currentSettings.costing)
  const policy = asObject(costing.methodChangePolicy)
  const allowMidPeriod = policy.allowMidPeriod === true
  const effectiveDate = body.effectiveDate ?? new Date()

  const checks: Array<{ code: string; severity: ReadinessSeverity; message: string }> = []

  if (fromMethod === toMethod) {
    checks.push({
      code: 'SAME_METHOD',
      severity: 'BLOCKED',
      message: `Valuation method is already ${toMethod}`,
    })
  }

  const uncostedMovements = await prisma.inventoryStockMovement.count({
    where: { tenantId, costEntries: { none: {} } },
  })
  if (uncostedMovements > 0) {
    checks.push({
      code: 'UNCOSTED_MOVEMENT',
      severity: 'BLOCKED',
      message: `${uncostedMovements} stock movement(s) have no cost entry`,
    })
  }

  const negativeBalances = await prisma.inventoryStockBalance.count({
    where: { tenantId, onHandQty: { lt: 0 } },
  })
  if (negativeBalances > 0) {
    checks.push({
      code: 'NEGATIVE_STOCK',
      severity: 'BLOCKED',
      message: `${negativeBalances} balance(s) have negative on-hand quantity`,
    })
  }

  const recon = await reconcileValuation(tenantId, { mismatchesOnly: true })
  if (recon.mismatched > 0) {
    checks.push({
      code: 'RECONCILIATION_MISMATCH',
      severity: 'WARNING',
      message: `${recon.mismatched} item/warehouse row(s) are mismatched under current method`,
    })
  }

  if (!allowMidPeriod) {
    const day = effectiveDate.getUTCDate()
    if (day !== 1 && effectiveDate.getUTCMonth() === new Date().getUTCMonth()) {
      checks.push({
        code: 'MID_PERIOD',
        severity: 'WARNING',
        message: 'Effective date is mid-period; execute requires force=true unless policy allows mid-period',
      })
    }
  }

  const balances = await prisma.inventoryStockBalance.findMany({
    where: { tenantId, onHandQty: { gt: 0 } },
    include: { item: { select: { id: true, code: true, name: true, standardRate: true } } },
  })
  const inventoryValue = balances.reduce((s, b) => s + Number(b.stockValue), 0)
  const onHandQty = balances.reduce((s, b) => s + Number(b.onHandQty), 0)

  let missingStandards = 0
  if (toMethod === 'STANDARD_COST') {
    const itemIds = [...new Set(balances.map((b) => b.itemId))]
    const active = itemIds.length
      ? await prisma.inventoryItemStandardCostVersion.findMany({
          where: { tenantId, itemId: { in: itemIds }, status: 'ACTIVE' },
          select: { itemId: true },
        })
      : []
    const hasActive = new Set(active.map((a) => a.itemId))
    missingStandards = balances.filter(
      (b) => !hasActive.has(b.itemId) && Number(b.item.standardRate) <= 0,
    ).length
    if (missingStandards > 0) {
      checks.push({
        code: 'MISSING_STANDARD_COST',
        severity: 'BLOCKED',
        message: `${missingStandards} stocked item(s) lack an active standard cost / standardRate`,
      })
    }
  }

  const unidentifiedLayers =
    toMethod === 'SPECIFIC_IDENTIFICATION'
      ? await prisma.inventoryCostLayer.count({
          where: {
            tenantId,
            status: 'OPEN',
            remainingQuantity: { gt: 0 },
            serialId: null,
            lotId: null,
          },
        })
      : 0
  if (toMethod === 'SPECIFIC_IDENTIFICATION' && unidentifiedLayers > 0) {
    checks.push({
      code: 'SPECIFIC_COST_NOT_IDENTIFIED',
      severity: 'WARNING',
      message: `${unidentifiedLayers} OPEN layer(s) are unidentified (null serial/lot) — opening migration may seed pools`,
    })
  }

  if (toMethod === 'FIFO' || toMethod === 'SPECIFIC_IDENTIFICATION') {
    checks.push({
      code: 'OPENING_MIGRATION',
      severity: 'WARNING',
      message: 'Opening stock layer migration is recommended when switching to FIFO/Specific',
    })
  }

  checks.push({
    code: 'GL_INTEGRATION',
    severity: 'WARNING',
    message: 'Inventory↔GL trial balance is deferred; method change does not post GL revaluation',
  })

  const severityRank = { PASS: 0, WARNING: 1, BLOCKED: 2 }
  let overall: ReadinessSeverity = 'PASS'
  for (const c of checks) {
    if (severityRank[c.severity] > severityRank[overall]) overall = c.severity
  }
  if (checks.length === 0) overall = 'PASS'

  return {
    fromMethod,
    toMethod,
    effectiveDate: effectiveDate.toISOString().slice(0, 10),
    readiness: overall,
    checks,
    preview: {
      affectedItems: balances.length,
      onHandQty,
      currentInventoryValue: inventoryValue,
      proposedOpeningValue: inventoryValue,
      expectedDifference: 0,
      note: 'Method change does not rewrite historical cost entries. Proposed opening value equals current inventory value unless a separate revaluation is posted (not in this phase).',
      methodEvidence: {
        fifo: toMethod === 'FIFO' ? { openingMigrationRecommended: true } : null,
        movingAverage:
          toMethod === 'MOVING_WEIGHTED_AVERAGE'
            ? { openingQty: onHandQty, openingValue: inventoryValue, openingAverage: onHandQty > 0 ? inventoryValue / onHandQty : 0 }
            : null,
        standard: toMethod === 'STANDARD_COST' ? { missingStandards, proposedStandardValue: inventoryValue } : null,
        specific: toMethod === 'SPECIFIC_IDENTIFICATION' ? { unidentifiedOpenLayers: unidentifiedLayers } : null,
      },
    },
    financialDifference: {
      inventoryValueDelta: 0,
      glImpact: 'Not Available',
      glImpactReason: 'Inventory Accounting is not enabled / GL integration is not yet available.',
    },
    permissions: {
      preview: 'inventory.view_cost (or inventory.view / stock.view)',
      execute: 'inventory.setup.manage',
      approve: 'Reuse inventory.setup.manage for this phase (dedicated approve permission deferred)',
    },
  }
}

/** Gate execute: BLOCKED readiness requires force=true. */
export async function assertMethodChangeExecutable(
  tenantId: string,
  body: MethodChangeBody,
) {
  const preview = await previewValuationMethodChange(tenantId, {
    toMethod: body.toMethod,
    effectiveDate: body.effectiveDate,
  })
  if (preview.readiness === 'BLOCKED' && !body.force) {
    const blocked = preview.checks.filter((c) => c.severity === 'BLOCKED').map((c) => c.message)
    throw new ValidationError(
      `Method change blocked: ${blocked.join('; ')}. Resolve blockers or pass force=true with audit reason.`,
    )
  }
  return preview
}

