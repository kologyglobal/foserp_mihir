import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import {
  applyPurchaseInvoiceRetroCostInTx,
  planPurchaseInvoiceRetroCostReversal,
  reversePurchaseInvoiceRetroCostInTx,
} from '../src/modules/inventory/costing/purchase-invoice-retro-cost.service.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import {
  cleanupPurchaseTenant,
  createTenantUser,
  ensureLegalEntity,
  ensurePermissions,
  seedPurchaseMasters,
} from './helpers/purchase-live-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('purchase invoice retro cost adjustment (live MySQL)', () => {
  let tenantId = ''
  let actorId = ''
  let legalEntityId = ''
  let itemId = ''
  let warehouseId = ''
  let receiptMovementId = ''
  let receiptEntryId = ''

  beforeAll(async () => {
    await ensurePermissions()
    const user = await createTenantUser({
      app,
      slugPrefix: 'pi-retro',
      permissionNames: [],
    })
    tenantId = user.tenantId
    actorId = user.userId
    legalEntityId = await ensureLegalEntity(tenantId)
    const masters = await seedPurchaseMasters(tenantId)
    itemId = masters.itemId
    warehouseId = masters.warehouseId
    const receipt = await postStockMovement({
      tenantId,
      itemId,
      warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 10,
      rate: 100,
      idempotencyKey: `pi-retro-receipt:${tenantId}`,
      createdBy: actorId,
    })
    receiptMovementId = receipt.id
    const costEntry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId, inventoryMovementId: receipt.id },
    })
    receiptEntryId = costEntry.id
  })

  afterAll(async () => {
    if (tenantId) await cleanupPurchaseTenant(tenantId)
    await prisma.$disconnect()
  })

  function plan(vendorInvoiceId: string, inventoryAmount: string, ppvAmount: string) {
    return {
      lines: [{
        lineNumber: 1,
        goodsReceiptId: randomUUID(),
        goodsReceiptLineId: randomUUID(),
        grirAmount: '1000.0000',
        varianceAmount: '100.0000',
        inventoryAdjustmentAmount: inventoryAmount,
        ppvAmount,
        inventoryMovementId: receiptMovementId,
        receiptCostEntryId: receiptEntryId,
        receiptCostLayerId: null,
        itemId,
        warehouseId,
        valuationMethod: 'MOVING_WEIGHTED_AVERAGE',
        receiptQuantity: '10.0000',
        releaseQuantity: '10.0000',
      }],
      byLineNumber: {},
    }
  }

  it('capitalises full on-hand delta idempotently and reverses it', async () => {
    const vendorInvoiceId = randomUUID()
    await prisma.$transaction((tx) => applyPurchaseInvoiceRetroCostInTx(tx, {
      tenantId,
      legalEntityId,
      vendorInvoiceId,
      postingDate: new Date(),
      actorId,
      plan: plan(vendorInvoiceId, '100.0000', '0.0000'),
    }))
    await prisma.$transaction((tx) => applyPurchaseInvoiceRetroCostInTx(tx, {
      tenantId,
      legalEntityId,
      vendorInvoiceId,
      postingDate: new Date(),
      actorId,
      plan: plan(vendorInvoiceId, '100.0000', '0.0000'),
    }))
    let balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId, warehouseId },
    })
    expect(Number(balance.stockValue)).toBe(1100)
    expect(await prisma.inventoryCostEntry.count({
      where: { tenantId, sourceType: 'PURCHASE_INVOICE_COST_ADJUSTMENT', sourceId: vendorInvoiceId },
    })).toBe(1)

    await prisma.$transaction((tx) => reversePurchaseInvoiceRetroCostInTx(tx, {
      tenantId,
      legalEntityId,
      vendorInvoiceId,
      postingDate: new Date(),
      actorId,
    }))
    balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId, warehouseId },
    })
    expect(Number(balance.stockValue)).toBe(1000)
    expect(await prisma.inventoryCostEntry.count({
      where: { tenantId, sourceType: 'PURCHASE_INVOICE_COST_ADJUSTMENT_REVERSAL', sourceId: vendorInvoiceId },
    })).toBe(1)
  })

  it('capitalises only remaining stock and leaves consumed value in PPV', async () => {
    await postStockMovement({
      tenantId,
      itemId,
      warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 4,
      idempotencyKey: `pi-retro-partial-issue:${tenantId}`,
      createdBy: actorId,
    })
    const vendorInvoiceId = randomUUID()
    await prisma.$transaction((tx) => applyPurchaseInvoiceRetroCostInTx(tx, {
      tenantId,
      legalEntityId,
      vendorInvoiceId,
      postingDate: new Date(),
      actorId,
      plan: plan(vendorInvoiceId, '60.0000', '40.0000'),
    }))
    const balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId, warehouseId },
    })
    expect(Number(balance.onHandQty)).toBe(6)
    expect(Number(balance.stockValue)).toBe(660)
    const adjustment = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId, sourceType: 'PURCHASE_INVOICE_COST_ADJUSTMENT', sourceId: vendorInvoiceId },
    })
    expect(Number(adjustment.totalCost)).toBe(60)
  })

  it('creates no inventory adjustment when stock is fully consumed', async () => {
    await postStockMovement({
      tenantId,
      itemId,
      warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 6,
      idempotencyKey: `pi-retro-full-issue:${tenantId}`,
      createdBy: actorId,
    })
    const vendorInvoiceId = randomUUID()
    await prisma.$transaction((tx) => applyPurchaseInvoiceRetroCostInTx(tx, {
      tenantId,
      legalEntityId,
      vendorInvoiceId,
      postingDate: new Date(),
      actorId,
      plan: plan(vendorInvoiceId, '0.0000', '100.0000'),
    }))
    const balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId, warehouseId },
    })
    expect(Number(balance.onHandQty)).toBe(0)
    expect(Number(balance.stockValue)).toBe(0)
    expect(await prisma.inventoryCostEntry.count({
      where: { tenantId, sourceId: vendorInvoiceId },
    })).toBe(0)

    const partialInvoice = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: {
        tenantId,
        sourceType: 'PURCHASE_INVOICE_COST_ADJUSTMENT',
        totalCost: 60,
      },
      orderBy: { createdAt: 'desc' },
    })
    const reversalPlan = await planPurchaseInvoiceRetroCostReversal(prisma, {
      tenantId,
      legalEntityId,
      vendorInvoiceId: partialInvoice.sourceId!,
    })
    expect(reversalPlan.lines[0]?.inventoryReversalAmount).toBe('0.00')
    expect(reversalPlan.lines[0]?.ppvReclassificationAmount).toBe('60.00')
  })

  it('handles a lower-price credit delta and its reversal', async () => {
    const receipt = await postStockMovement({
      tenantId,
      itemId,
      warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 10,
      rate: 100,
      idempotencyKey: `pi-retro-credit-receipt:${tenantId}`,
      createdBy: actorId,
    })
    receiptMovementId = receipt.id
    receiptEntryId = (await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId, inventoryMovementId: receipt.id },
    })).id
    const vendorInvoiceId = randomUUID()
    await prisma.$transaction((tx) => applyPurchaseInvoiceRetroCostInTx(tx, {
      tenantId,
      legalEntityId,
      vendorInvoiceId,
      postingDate: new Date(),
      actorId,
      plan: plan(vendorInvoiceId, '-100.0000', '0.0000'),
    }))
    let balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId, warehouseId },
    })
    expect(Number(balance.stockValue)).toBe(900)

    await prisma.$transaction((tx) => reversePurchaseInvoiceRetroCostInTx(tx, {
      tenantId,
      legalEntityId,
      vendorInvoiceId,
      postingDate: new Date(),
      actorId,
    }))
    balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId, warehouseId },
    })
    expect(Number(balance.stockValue)).toBe(1000)
  })
})
