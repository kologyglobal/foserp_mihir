import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import { DEFAULT_INVENTORY_SETTINGS } from '../src/modules/inventory/setup/setup.service.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Inventory FIFO cost layers', () => {
  let fx: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `inv-fifo-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Inventory FIFO Test Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'inv-fifo-user')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })

    await prisma.inventorySettings.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        settings: {
          ...DEFAULT_INVENTORY_SETTINGS,
          general: {
            ...DEFAULT_INVENTORY_SETTINGS.general,
            defaultCostingMethod: 'fifo',
          },
        },
        createdById: user.userId,
        updatedById: user.userId,
      },
      update: {
        settings: {
          ...DEFAULT_INVENTORY_SETTINGS,
          general: {
            ...DEFAULT_INVENTORY_SETTINGS.general,
            defaultCostingMethod: 'fifo',
          },
        },
        updatedById: user.userId,
      },
    })
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await prisma.inventoryCostLayerConsumption.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryCostEntry.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryCostLayer.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockMovement.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockBalance.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventorySettings.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.codeSeries.deleteMany({
      where: { tenantId: fx.tenantId, entityType: 'STOCK_MOVEMENT' },
    }).catch(() => {})
    await cleanupTenant(fx.tenantId)
  })

  it('creates OPEN layers on receipts and consumes oldest layer on issue', async () => {
    // Receipt 1: 10 @ 10 → OPEN layer
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 10,
      rate: 10,
      movementDate: new Date('2026-01-01'),
      idempotencyKey: `fifo-r1-${fx.tenantId}`,
    })
    // Receipt 2: 10 @ 20 → newer OPEN layer
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'INW',
      quantity: 10,
      rate: 20,
      movementDate: new Date('2026-01-02'),
      idempotencyKey: `fifo-r2-${fx.tenantId}`,
    })

    const layersAfterReceipts = await prisma.inventoryCostLayer.findMany({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
      orderBy: [{ receiptDate: 'asc' }, { id: 'asc' }],
    })
    expect(layersAfterReceipts).toHaveLength(2)
    expect(layersAfterReceipts.every((l) => l.status === 'OPEN')).toBe(true)
    expect(layersAfterReceipts[0].remainingQuantity.toString()).toBe('10')
    expect(layersAfterReceipts[0].unitCost.toString()).toBe('10')
    expect(layersAfterReceipts[1].remainingQuantity.toString()).toBe('10')
    expect(layersAfterReceipts[1].unitCost.toString()).toBe('20')

    const costEntriesAfterReceipts = await prisma.inventoryCostEntry.findMany({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId },
    })
    expect(costEntriesAfterReceipts).toHaveLength(2)
    expect(costEntriesAfterReceipts.every((e) => e.valuationMethod === 'FIFO')).toBe(true)
    expect(costEntriesAfterReceipts.every((e) => e.costLayerId != null)).toBe(true)

    // Issue 5 → should consume oldest layer only @ 10
    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 5,
      movementDate: new Date('2026-01-03'),
      idempotencyKey: `fifo-i1-${fx.tenantId}`,
    })

    expect(issue.rate.toString()).toBe('10')
    expect(issue.value.toString()).toBe('50')

    const layersAfterIssue = await prisma.inventoryCostLayer.findMany({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
      orderBy: [{ receiptDate: 'asc' }, { id: 'asc' }],
    })
    expect(layersAfterIssue[0].remainingQuantity.toString()).toBe('5')
    expect(layersAfterIssue[0].remainingValue.toString()).toBe('50')
    expect(layersAfterIssue[0].status).toBe('OPEN')
    expect(layersAfterIssue[1].remainingQuantity.toString()).toBe('10')
    expect(layersAfterIssue[1].status).toBe('OPEN')

    const issueEntry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: {
        tenantId: fx.tenantId,
        inventoryMovementId: issue.id,
      },
    })
    expect(issueEntry.valuationMethod).toBe('FIFO')
    expect(issueEntry.unitCost.toString()).toBe('10')
    expect(issueEntry.totalCost.toString()).toBe('50')

    const consumptions = await prisma.inventoryCostLayerConsumption.findMany({
      where: { tenantId: fx.tenantId, issueCostEntryId: issueEntry.id },
    })
    expect(consumptions).toHaveLength(1)
    expect(consumptions[0].layerId).toBe(layersAfterIssue[0].id)
    expect(consumptions[0].quantityConsumed.toString()).toBe('5')
    expect(consumptions[0].unitCost.toString()).toBe('10')
    expect(consumptions[0].totalCost.toString()).toBe('50')

    const balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
    })
    // Remaining: 5@10 + 10@20 = 250; qty 15 → avgRate 16.6667
    expect(balance.onHandQty.toString()).toBe('15')
    expect(balance.stockValue.toString()).toBe('250')
    expect(Number(balance.avgRate.toString())).toBeCloseTo(16.6667, 4)

    // Issue 8 → consume remaining 5@10 then 3@20 = 50 + 60 = 110; rate = 13.75
    const issue2 = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 8,
      movementDate: new Date('2026-01-04'),
      idempotencyKey: `fifo-i2-${fx.tenantId}`,
    })

    expect(issue2.rate.toString()).toBe('13.75')
    expect(issue2.value.toString()).toBe('110')

    const layersFinal = await prisma.inventoryCostLayer.findMany({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
      orderBy: [{ receiptDate: 'asc' }, { id: 'asc' }],
    })
    expect(layersFinal[0].remainingQuantity.toString()).toBe('0')
    expect(layersFinal[0].status).toBe('CONSUMED')
    expect(layersFinal[1].remainingQuantity.toString()).toBe('7')
    expect(layersFinal[1].remainingValue.toString()).toBe('140')
    expect(layersFinal[1].status).toBe('OPEN')

    const balanceFinal = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
    })
    expect(balanceFinal.onHandQty.toString()).toBe('7')
    expect(balanceFinal.stockValue.toString()).toBe('140')
    expect(balanceFinal.avgRate.toString()).toBe('20')
  })
})
