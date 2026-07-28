import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ValidationError } from '../../../utils/errors.js'
import { toDecimal } from '../shared/quantity.helpers.js'

const MIGRATION_VERSION = 1

export interface FifoOpeningMigrationOptions {
  tenantId: string
  dryRun?: boolean
  /** When true, run even if defaultCostingMethod is not fifo (prepare layers before switch). */
  force?: boolean
  createdBy?: string | null
  /** Optional filter — migrate only these item ids. */
  itemIds?: string[]
  /** Optional filter — migrate only these warehouse ids. */
  warehouseIds?: string[]
}

export interface FifoOpeningMigrationRowResult {
  itemId: string
  warehouseId: string
  onHandQty: string
  openLayerQty: string
  gapQty: string
  unitCost: string
  layerValue: string
  action: 'CREATE_LAYER' | 'SKIP_COVERED' | 'EXCEPTION_OVERALLOCATED' | 'SKIP_ZERO'
  movementId?: string
  costLayerId?: string
  costEntryId?: string
  message?: string
}

export interface FifoOpeningMigrationResult {
  tenantId: string
  dryRun: boolean
  valuationMethod: string
  version: number
  createdLayers: number
  skipped: number
  exceptions: number
  rows: FifoOpeningMigrationRowResult[]
}

function mapDefaultCostingMethod(value: unknown): string {
  if (value === 'fifo') return 'FIFO'
  if (value === 'standard') return 'STANDARD_COST'
  if (value === 'specific') return 'SPECIFIC_IDENTIFICATION'
  return 'MOVING_WEIGHTED_AVERAGE'
}

async function resolveConfiguredMethod(tenantId: string): Promise<string> {
  const settings = await prisma.inventorySettings.findUnique({
    where: { tenantId },
    select: { settings: true },
  })
  if (!settings || typeof settings.settings !== 'object' || settings.settings === null) {
    return 'MOVING_WEIGHTED_AVERAGE'
  }
  const root = settings.settings as Record<string, unknown>
  const general = root.general
  if (typeof general !== 'object' || general === null) return 'MOVING_WEIGHTED_AVERAGE'
  return mapDefaultCostingMethod((general as Record<string, unknown>).defaultCostingMethod)
}

function deriveUnitCost(onHandQty: Prisma.Decimal, avgRate: Prisma.Decimal, stockValue: Prisma.Decimal): Prisma.Decimal {
  if (onHandQty.greaterThan(0) && stockValue.greaterThan(0)) {
    return stockValue.div(onHandQty).toDecimalPlaces(4)
  }
  return avgRate.toDecimalPlaces(4)
}

function idempotencyKey(tenantId: string, itemId: string, warehouseId: string): string {
  return `fifo-open-mig:v${MIGRATION_VERSION}:${tenantId}:${itemId}:${warehouseId}`
}

/**
 * Seeds OPEN FIFO cost layers for existing physical on-hand gaps.
 *
 * Does NOT change InventoryStockBalance quantities.
 * Creates a synthetic OPENING movement (balanceAfter = current on-hand) as the layer source,
 * then InventoryCostLayer + InventoryCostEntry.
 *
 * Gap = onHandQty − Σ OPEN remainingQuantity (item+warehouse).
 * When layers already cover on-hand, the row is skipped (idempotent).
 * When OPEN layers exceed on-hand, the row is reported as an exception (no auto-fix).
 */
export async function migrateFifoOpeningStock(
  options: FifoOpeningMigrationOptions,
): Promise<FifoOpeningMigrationResult> {
  const dryRun = Boolean(options.dryRun)
  const valuationMethod = await resolveConfiguredMethod(options.tenantId)

  if (valuationMethod !== 'FIFO' && valuationMethod !== 'SPECIFIC_IDENTIFICATION' && !options.force) {
    throw new ValidationError(
      'Opening-stock layer migration requires defaultCostingMethod=fifo or specific (or pass force=true to prepare layers before switching)',
    )
  }

  const balances = await prisma.inventoryStockBalance.findMany({
    where: {
      tenantId: options.tenantId,
      onHandQty: { gt: 0 },
      ...(options.itemIds?.length ? { itemId: { in: options.itemIds } } : {}),
      ...(options.warehouseIds?.length ? { warehouseId: { in: options.warehouseIds } } : {}),
    },
    orderBy: [{ itemId: 'asc' }, { warehouseId: 'asc' }],
  })

  const rows: FifoOpeningMigrationRowResult[] = []
  let createdLayers = 0
  let skipped = 0
  let exceptions = 0

  for (const balance of balances) {
    const onHandQty = toDecimal(balance.onHandQty)
    if (!onHandQty.greaterThan(0)) {
      skipped += 1
      rows.push({
        itemId: balance.itemId,
        warehouseId: balance.warehouseId,
        onHandQty: onHandQty.toString(),
        openLayerQty: '0',
        gapQty: '0',
        unitCost: '0',
        layerValue: '0',
        action: 'SKIP_ZERO',
      })
      continue
    }

    const openAgg = await prisma.inventoryCostLayer.aggregate({
      where: {
        tenantId: options.tenantId,
        itemId: balance.itemId,
        warehouseId: balance.warehouseId,
        status: 'OPEN',
        remainingQuantity: { gt: 0 },
      },
      _sum: { remainingQuantity: true },
    })
    const openLayerQty = toDecimal(openAgg._sum.remainingQuantity)
    const gapQty = onHandQty.minus(openLayerQty).toDecimalPlaces(4)

    if (gapQty.lessThan(0)) {
      exceptions += 1
      rows.push({
        itemId: balance.itemId,
        warehouseId: balance.warehouseId,
        onHandQty: onHandQty.toString(),
        openLayerQty: openLayerQty.toString(),
        gapQty: gapQty.toString(),
        unitCost: '0',
        layerValue: '0',
        action: 'EXCEPTION_OVERALLOCATED',
        message: 'OPEN cost layers exceed on-hand quantity; manual reconciliation required',
      })
      continue
    }

    if (gapQty.isZero()) {
      skipped += 1
      rows.push({
        itemId: balance.itemId,
        warehouseId: balance.warehouseId,
        onHandQty: onHandQty.toString(),
        openLayerQty: openLayerQty.toString(),
        gapQty: '0',
        unitCost: toDecimal(balance.avgRate).toString(),
        layerValue: '0',
        action: 'SKIP_COVERED',
        message: 'OPEN layers already cover on-hand quantity',
      })
      continue
    }

    const unitCost = deriveUnitCost(onHandQty, toDecimal(balance.avgRate), toDecimal(balance.stockValue))
    // Prefer preserving stockValue when seeding a full covering layer for the entire on-hand.
    const layerValue =
      openLayerQty.isZero() && toDecimal(balance.stockValue).greaterThan(0)
        ? toDecimal(balance.stockValue).toDecimalPlaces(2)
        : gapQty.times(unitCost).toDecimalPlaces(2)
    const effectiveUnitCost = gapQty.isZero()
      ? unitCost
      : layerValue.div(gapQty).toDecimalPlaces(4)

    const key = idempotencyKey(options.tenantId, balance.itemId, balance.warehouseId)

    if (dryRun) {
      createdLayers += 1
      rows.push({
        itemId: balance.itemId,
        warehouseId: balance.warehouseId,
        onHandQty: onHandQty.toString(),
        openLayerQty: openLayerQty.toString(),
        gapQty: gapQty.toString(),
        unitCost: effectiveUnitCost.toString(),
        layerValue: layerValue.toString(),
        action: 'CREATE_LAYER',
        message: `dry-run would create OPEN layer via ${key}`,
      })
      continue
    }

    const result = await prisma.$transaction(async (tx) => {
      const postingDate = new Date()
      const baseKey = key

      const priorMigrations = await tx.inventoryStockMovement.findMany({
        where: {
          tenantId: options.tenantId,
          itemId: balance.itemId,
          warehouseId: balance.warehouseId,
          idempotencyKey: { startsWith: baseKey },
        },
        select: { id: true, idempotencyKey: true },
        orderBy: { createdAt: 'asc' },
      })

      // Prefer reusing the latest migration movement only when its OPEN layer still has qty.
      // If prior layers are CONSUMED/missing while a gap remains, mint a new synthetic movement.
      let movement =
        priorMigrations.length > 0
          ? await tx.inventoryStockMovement.findFirst({
              where: { id: priorMigrations[priorMigrations.length - 1].id },
            })
          : null

      let reused = false
      if (movement) {
        const openFromMovement = await tx.inventoryCostLayer.findFirst({
          where: {
            tenantId: options.tenantId,
            sourceMovementId: movement.id,
            status: 'OPEN',
            remainingQuantity: { gt: 0 },
          },
        })
        if (openFromMovement) {
          // Gap should already be covered by openAgg; treat as idempotent no-op.
          reused = true
          const entry = await tx.inventoryCostEntry.findFirst({
            where: { tenantId: options.tenantId, inventoryMovementId: movement.id },
          })
          return {
            movementId: movement.id,
            costLayerId: openFromMovement.id,
            costEntryId: entry?.id,
            reused: true,
          }
        }
        movement = null
      }

      const movementKey =
        priorMigrations.length === 0 ? baseKey : `${baseKey}:r${priorMigrations.length + 1}`
      const movementNumber = await nextCode(options.tenantId, 'STOCK_MOVEMENT', tx)
      movement = await tx.inventoryStockMovement.create({
        data: {
          tenantId: options.tenantId,
          movementNumber,
          movementDate: postingDate,
          movementType: 'OPENING',
          referenceType: 'OPN',
          quantity: gapQty,
          rate: effectiveUnitCost.toDecimalPlaces(2),
          value: layerValue,
          // Physical balance is unchanged — this movement is valuation seed only.
          balanceAfter: onHandQty,
          itemId: balance.itemId,
          warehouseId: balance.warehouseId,
          referenceNo: `FIFO-OPEN-MIG-V${MIGRATION_VERSION}`,
          remarks: 'FIFO opening-stock migration — synthetic valuation layer (no quantity change)',
          idempotencyKey: movementKey,
          createdBy: options.createdBy ?? null,
        },
      })

      const layer = await tx.inventoryCostLayer.create({
        data: {
          tenantId: options.tenantId,
          legalEntityId: null,
          itemId: balance.itemId,
          warehouseId: balance.warehouseId,
          lotId: null,
          serialId: null,
          sourceMovementId: movement.id,
          receiptDate: postingDate,
          postingDate,
          originalQuantity: gapQty,
          remainingQuantity: gapQty,
          unitCost: effectiveUnitCost,
          originalValue: layerValue,
          remainingValue: layerValue,
          currencyCode: 'INR',
          status: 'OPEN',
        },
      })

      const entry = await tx.inventoryCostEntry.create({
        data: {
          tenantId: options.tenantId,
          legalEntityId: null,
          itemId: balance.itemId,
          warehouseId: balance.warehouseId,
          inventoryMovementId: movement.id,
          entryType: 'OPENING',
          valuationMethod: 'FIFO',
          quantity: gapQty,
          unitCost: effectiveUnitCost,
          totalCost: layerValue,
          currencyCode: 'INR',
          postingDate,
          sourceType: 'FIFO_OPENING_MIGRATION',
          sourceId: movementKey,
          sourceLineId: null,
          lotId: null,
          serialId: null,
          workOrderId: null,
          costLayerId: layer.id,
          costCalculationReference: `FIFO_OPEN_MIG:${movement.id}`,
          reversalOfId: null,
          correctionOfId: null,
          isReversal: false,
          status: 'POSTED',
          createdBy: options.createdBy ?? null,
        },
      })

      return {
        movementId: movement.id,
        costLayerId: layer.id,
        costEntryId: entry.id,
        reused,
      }
    })

    if (result.reused) {
      skipped += 1
      rows.push({
        itemId: balance.itemId,
        warehouseId: balance.warehouseId,
        onHandQty: onHandQty.toString(),
        openLayerQty: openLayerQty.toString(),
        gapQty: gapQty.toString(),
        unitCost: effectiveUnitCost.toString(),
        layerValue: layerValue.toString(),
        action: 'SKIP_COVERED',
        movementId: result.movementId,
        costLayerId: result.costLayerId,
        costEntryId: result.costEntryId,
        message: 'Idempotent reuse of prior FIFO opening migration movement',
      })
    } else {
      createdLayers += 1
      rows.push({
        itemId: balance.itemId,
        warehouseId: balance.warehouseId,
        onHandQty: onHandQty.toString(),
        openLayerQty: openLayerQty.toString(),
        gapQty: gapQty.toString(),
        unitCost: effectiveUnitCost.toString(),
        layerValue: layerValue.toString(),
        action: 'CREATE_LAYER',
        movementId: result.movementId,
        costLayerId: result.costLayerId,
        costEntryId: result.costEntryId,
      })
    }
  }

  if (!dryRun) {
    const settingsRow = await prisma.inventorySettings.findUnique({ where: { tenantId: options.tenantId } })
    if (settingsRow) {
      const current =
        settingsRow.settings && typeof settingsRow.settings === 'object' && !Array.isArray(settingsRow.settings)
          ? ({ ...(settingsRow.settings as Record<string, unknown>) } as Record<string, unknown>)
          : {}
      const costing =
        current.costing && typeof current.costing === 'object' && !Array.isArray(current.costing)
          ? ({ ...(current.costing as Record<string, unknown>) } as Record<string, unknown>)
          : {}
      costing.fifoOpeningStockMigration = {
        version: MIGRATION_VERSION,
        lastRunAt: new Date().toISOString(),
        createdLayers,
        skipped,
        exceptions,
      }
      current.costing = costing
      await prisma.inventorySettings.update({
        where: { tenantId: options.tenantId },
        data: {
          settings: current as Prisma.InputJsonValue,
          updatedById: options.createdBy ?? undefined,
        },
      })
    }
  }

  return {
    tenantId: options.tenantId,
    dryRun,
    valuationMethod,
    version: MIGRATION_VERSION,
    createdLayers,
    skipped,
    exceptions,
    rows,
  }
}
