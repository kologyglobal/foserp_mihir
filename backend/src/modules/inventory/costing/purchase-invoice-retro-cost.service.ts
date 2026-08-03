import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import type { VendorInvoiceGrirReleasePlan } from '../../accounting/payables/vendor-invoices/calculation/vendor-invoice-grir-release.service.js'
import { toDecimal } from '../shared/quantity.helpers.js'

function postingKey(vendorInvoiceId: string, lineNumber: number): string {
  return `PI_RETRO:${vendorInvoiceId}:${lineNumber}:POST`
}

function reversalKey(vendorInvoiceId: string, lineNumber: number): string {
  return `PI_RETRO:${vendorInvoiceId}:${lineNumber}:REVERSE`
}

async function updateValuationInTx(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string
    itemId: string
    warehouseId: string
    costLayerId: string | null
    stockAdjustment: Prisma.Decimal
    layerOriginalAdjustment: Prisma.Decimal
  },
) {
  const balance = await tx.inventoryStockBalance.findFirst({
    where: {
      tenantId: args.tenantId,
      itemId: args.itemId,
      warehouseId: args.warehouseId,
    },
  })
  if (!balance) throw new Error('Inventory balance missing for purchase invoice retro cost adjustment')
  const stockValue = toDecimal(balance.stockValue).plus(args.stockAdjustment).toDecimalPlaces(2)
  if (stockValue.lessThan(0)) throw new Error('Purchase invoice retro cost adjustment would make stock value negative')
  const avgRate = balance.onHandQty.isZero()
    ? toDecimal(0)
    : stockValue.div(balance.onHandQty).toDecimalPlaces(4)
  await tx.inventoryStockBalance.update({
    where: { id: balance.id },
    data: { stockValue, avgRate },
  })

  if (args.costLayerId) {
    const layer = await tx.inventoryCostLayer.findFirst({
      where: { id: args.costLayerId, tenantId: args.tenantId },
    })
    if (!layer) throw new Error('Receipt cost layer missing for purchase invoice retro cost adjustment')
    const originalValue = toDecimal(layer.originalValue)
      .plus(args.layerOriginalAdjustment)
      .toDecimalPlaces(2)
    const remainingValue = toDecimal(layer.remainingValue)
      .plus(args.stockAdjustment)
      .toDecimalPlaces(2)
    if (originalValue.lessThan(0) || remainingValue.lessThan(0)) {
      throw new Error('Purchase invoice retro cost adjustment would make a cost layer negative')
    }
    const unitCost = layer.originalQuantity.isZero()
      ? toDecimal(0)
      : originalValue.div(layer.originalQuantity).toDecimalPlaces(4)
    await tx.inventoryCostLayer.update({
      where: { id: layer.id },
      data: { originalValue, remainingValue, unitCost },
    })
  }
  return { balance, stockValue, avgRate }
}

/**
 * Applies the inventory-capitalised portion of a GR/IR price variance inside the
 * Vendor Invoice posting transaction. Original receipt entries are immutable.
 */
export async function applyPurchaseInvoiceRetroCostInTx(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string
    legalEntityId: string
    vendorInvoiceId: string
    postingDate: Date
    actorId: string | null
    plan: VendorInvoiceGrirReleasePlan
  },
) {
  for (const line of args.plan.lines) {
    const adjustment = toDecimal(line.inventoryAdjustmentAmount)
    if (adjustment.isZero()) continue
    const key = postingKey(args.vendorInvoiceId, line.lineNumber)
    const existing = await tx.inventoryStockMovement.findFirst({
      where: { tenantId: args.tenantId, idempotencyKey: key },
    })
    if (existing) continue

    const { balance } = await updateValuationInTx(tx, {
      tenantId: args.tenantId,
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      costLayerId: line.receiptCostLayerId,
      stockAdjustment: adjustment,
      layerOriginalAdjustment: toDecimal(line.varianceAmount),
    })
    const movement = await tx.inventoryStockMovement.create({
      data: {
        tenantId: args.tenantId,
        movementNumber: await nextCode(args.tenantId, 'STOCK_MOVEMENT', tx),
        movementDate: args.postingDate,
        movementType: 'ADJUSTMENT',
        referenceType: 'CONTROLLED_ADJUSTMENT',
        quantity: 0,
        rate: 0,
        value: adjustment.abs(),
        balanceAfter: balance.onHandQty,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        referenceNo: args.vendorInvoiceId,
        remarks: 'Purchase invoice retro cost adjustment',
        idempotencyKey: key,
        createdBy: args.actorId,
      },
    })
    const entry = await tx.inventoryCostEntry.create({
      data: {
        tenantId: args.tenantId,
        legalEntityId: args.legalEntityId,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        inventoryMovementId: movement.id,
        entryType: 'ADJUSTMENT',
        valuationMethod: line.valuationMethod as never,
        quantity: 0,
        unitCost: 0,
        totalCost: adjustment,
        postingDate: args.postingDate,
        sourceType: 'PURCHASE_INVOICE_COST_ADJUSTMENT',
        sourceId: args.vendorInvoiceId,
        sourceLineId: String(line.lineNumber),
        costLayerId: line.receiptCostLayerId,
        costCalculationReference: `PI_RETRO:${args.vendorInvoiceId}:${line.lineNumber}`,
        correctionOfId: line.receiptCostEntryId,
        createdBy: args.actorId,
      },
    })
    await tx.inventoryCostVariance.create({
      data: {
        tenantId: args.tenantId,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        inventoryMovementId: movement.id,
        costEntryId: entry.id,
        varianceType: 'PURCHASE_PRICE',
        quantity: toDecimal(line.releaseQuantity),
        standardUnitCost: toDecimal(line.grirAmount).div(toDecimal(line.releaseQuantity)),
        actualUnitCost: toDecimal(line.grirAmount)
          .plus(line.varianceAmount)
          .div(toDecimal(line.releaseQuantity)),
        varianceAmount: toDecimal(line.varianceAmount),
        postingDate: args.postingDate,
        sourceType: 'PURCHASE_INVOICE',
        sourceId: args.vendorInvoiceId,
        remarks: `Capitalised ${adjustment.toFixed(2)}; PPV ${line.ppvAmount}`,
        createdBy: args.actorId,
      },
    })
  }
}

/** Reverses the exact immutable corrections created by the original Vendor Invoice. */
export async function reversePurchaseInvoiceRetroCostInTx(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string
    legalEntityId: string
    vendorInvoiceId: string
    postingDate: Date
    actorId: string | null
    plan?: PurchaseInvoiceRetroReversalPlan
  },
) {
  const originals = await tx.inventoryCostEntry.findMany({
    where: {
      tenantId: args.tenantId,
      legalEntityId: args.legalEntityId,
      sourceType: 'PURCHASE_INVOICE_COST_ADJUSTMENT',
      sourceId: args.vendorInvoiceId,
      isReversal: false,
    },
    orderBy: { sourceLineId: 'asc' },
  })
  const planned = args.plan ?? await planPurchaseInvoiceRetroCostReversal(tx, {
    tenantId: args.tenantId,
    legalEntityId: args.legalEntityId,
    vendorInvoiceId: args.vendorInvoiceId,
  })
  const plannedByEntry = new Map(planned.lines.map((row) => [row.costEntryId, row]))
  const variances = originals.length
    ? await tx.inventoryCostVariance.findMany({
        where: { tenantId: args.tenantId, costEntryId: { in: originals.map((row) => row.id) } },
      })
    : []
  const varianceByEntry = new Map(variances.map((row) => [row.costEntryId, row]))
  for (const original of originals) {
    const lineNumber = Number(original.sourceLineId ?? 0)
    const key = reversalKey(args.vendorInvoiceId, lineNumber)
    const existing = await tx.inventoryStockMovement.findFirst({
      where: { tenantId: args.tenantId, idempotencyKey: key },
    })
    if (existing) continue
    const variance = varianceByEntry.get(original.id)
    const plannedLine = plannedByEntry.get(original.id)
    const reversalAmount = toDecimal(plannedLine?.inventoryReversalAmount ?? original.totalCost)
    if (reversalAmount.isZero()) continue
    await updateValuationInTx(tx, {
      tenantId: args.tenantId,
      itemId: original.itemId,
      warehouseId: original.warehouseId,
      costLayerId: original.costLayerId,
      stockAdjustment: reversalAmount.negated(),
      layerOriginalAdjustment: toDecimal(variance?.varianceAmount ?? original.totalCost).negated(),
    })
    const balance = await tx.inventoryStockBalance.findFirstOrThrow({
      where: {
        tenantId: args.tenantId,
        itemId: original.itemId,
        warehouseId: original.warehouseId,
      },
    })
    const movement = await tx.inventoryStockMovement.create({
      data: {
        tenantId: args.tenantId,
        movementNumber: await nextCode(args.tenantId, 'STOCK_MOVEMENT', tx),
        movementDate: args.postingDate,
        movementType: 'ADJUSTMENT',
        referenceType: 'ADJUSTMENT_REVERSAL',
        quantity: 0,
        rate: 0,
        value: reversalAmount.abs(),
        balanceAfter: balance.onHandQty,
        itemId: original.itemId,
        warehouseId: original.warehouseId,
        referenceNo: args.vendorInvoiceId,
        remarks: 'Purchase invoice retro cost reversal',
        idempotencyKey: key,
        createdBy: args.actorId,
      },
    })
    await tx.inventoryCostEntry.create({
      data: {
        tenantId: args.tenantId,
        legalEntityId: args.legalEntityId,
        itemId: original.itemId,
        warehouseId: original.warehouseId,
        inventoryMovementId: movement.id,
        entryType: 'ADJUSTMENT',
        valuationMethod: original.valuationMethod,
        quantity: 0,
        unitCost: 0,
        totalCost: reversalAmount.negated(),
        postingDate: args.postingDate,
        sourceType: 'PURCHASE_INVOICE_COST_ADJUSTMENT_REVERSAL',
        sourceId: args.vendorInvoiceId,
        sourceLineId: original.sourceLineId,
        costLayerId: original.costLayerId,
        costCalculationReference: `PI_RETRO_REVERSE:${args.vendorInvoiceId}:${lineNumber}`,
        reversalOfId: original.id,
        isReversal: true,
        createdBy: args.actorId,
      },
    })
  }
}

export interface PurchaseInvoiceRetroReversalPlanLine {
  costEntryId: string
  sourceLineNumber: number
  inventoryReversalAmount: string
  ppvReclassificationAmount: string
}

export interface PurchaseInvoiceRetroReversalPlan {
  lines: PurchaseInvoiceRetroReversalPlanLine[]
}

/**
 * Reversal allocation is based on stock still on hand at reversal time. Any
 * originally capitalised delta already consumed is reclassified to PPV.
 */
export async function planPurchaseInvoiceRetroCostReversal(
  client: Prisma.TransactionClient | typeof prisma,
  args: { tenantId: string; legalEntityId: string; vendorInvoiceId: string },
): Promise<PurchaseInvoiceRetroReversalPlan> {
  const originals = await client.inventoryCostEntry.findMany({
    where: {
      tenantId: args.tenantId,
      legalEntityId: args.legalEntityId,
      sourceType: 'PURCHASE_INVOICE_COST_ADJUSTMENT',
      sourceId: args.vendorInvoiceId,
      isReversal: false,
    },
    orderBy: { sourceLineId: 'asc' },
  })
  if (!originals.length) return { lines: [] }
  const [variances, balances] = await Promise.all([
    client.inventoryCostVariance.findMany({
      where: { tenantId: args.tenantId, costEntryId: { in: originals.map((row) => row.id) } },
    }),
    client.inventoryStockBalance.findMany({
      where: {
        tenantId: args.tenantId,
        OR: originals.map((row) => ({ itemId: row.itemId, warehouseId: row.warehouseId })),
      },
    }),
  ])
  const varianceByEntry = new Map(variances.map((row) => [row.costEntryId, row]))
  const availableByStock = new Map(
    balances.map((row) => [`${row.itemId}:${row.warehouseId}`, toDecimal(row.onHandQty).abs()]),
  )
  const lines: PurchaseInvoiceRetroReversalPlanLine[] = []
  for (const original of originals) {
    const variance = varianceByEntry.get(original.id)
    const quantity = toDecimal(variance?.quantity ?? 0).abs()
    const fullVariance = toDecimal(variance?.varianceAmount ?? original.totalCost)
    const unitDelta = quantity.isZero() ? toDecimal(0) : fullVariance.abs().div(quantity)
    const attributableQty = unitDelta.isZero()
      ? toDecimal(0)
      : toDecimal(original.totalCost).abs().div(unitDelta)
    const stockKey = `${original.itemId}:${original.warehouseId}`
    const available = availableByStock.get(stockKey) ?? toDecimal(0)
    const reversalQty = available.greaterThan(attributableQty) ? attributableQty : available
    availableByStock.set(stockKey, available.minus(reversalQty))
    const inventoryAbs = unitDelta.times(reversalQty).toDecimalPlaces(2)
    const inventoryReversal = toDecimal(original.totalCost).isNegative()
      ? inventoryAbs.negated()
      : inventoryAbs
    lines.push({
      costEntryId: original.id,
      sourceLineNumber: Number(original.sourceLineId ?? 0),
      inventoryReversalAmount: inventoryReversal.toFixed(2),
      ppvReclassificationAmount: toDecimal(original.totalCost)
        .minus(inventoryReversal)
        .toDecimalPlaces(2)
        .toFixed(2),
    })
  }
  return { lines }
}
