import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { migrateFifoOpeningStock } from '../src/modules/inventory/costing/fifo-opening-stock-migration.service.js'
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

describe.skipIf(!dbAvailable)('FIFO opening-stock migration', () => {
  let fx: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `inv-fifo-open-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'FIFO Opening Mig Test Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'inv-fifo-open-user')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })

    // Start on average so receipts do not create FIFO layers.
    await prisma.inventorySettings.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        settings: {
          ...DEFAULT_INVENTORY_SETTINGS,
          general: {
            ...DEFAULT_INVENTORY_SETTINGS.general,
            defaultCostingMethod: 'average',
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
            defaultCostingMethod: 'average',
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

  it('seeds OPEN layers for existing on-hand without changing quantity, then FIFO issue works', async () => {
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 10,
      rate: 10,
      idempotencyKey: `avg-opn-${fx.tenantId}`,
    })
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'INW',
      quantity: 10,
      rate: 20,
      idempotencyKey: `avg-inw-${fx.tenantId}`,
    })

    const before = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
    })
    expect(before.onHandQty.toString()).toBe('20')
    expect(before.avgRate.toString()).toBe('15')
    expect(before.stockValue.toString()).toBe('300')

    const layersBefore = await prisma.inventoryCostLayer.count({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId },
    })
    expect(layersBefore).toBe(0)

    // Switch to FIFO — issues would fail without opening migration.
    await prisma.inventorySettings.update({
      where: { tenantId: fx.tenantId },
      data: {
        settings: {
          ...DEFAULT_INVENTORY_SETTINGS,
          general: {
            ...DEFAULT_INVENTORY_SETTINGS.general,
            defaultCostingMethod: 'fifo',
          },
        },
      },
    })

    await expect(
      postStockMovement({
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        movementType: 'ISSUE',
        referenceType: 'ISS',
        quantity: 1,
        idempotencyKey: `fifo-fail-${fx.tenantId}`,
      }),
    ).rejects.toThrow(/FIFO cost layers insufficient/i)

    const preview = await migrateFifoOpeningStock({
      tenantId: fx.tenantId,
      dryRun: true,
    })
    expect(preview.createdLayers).toBe(1)
    expect(preview.rows[0]?.action).toBe('CREATE_LAYER')
    expect(preview.rows[0]?.gapQty).toBe('20')

    const migrated = await migrateFifoOpeningStock({
      tenantId: fx.tenantId,
      dryRun: false,
      createdBy: fx.userId,
    })
    expect(migrated.createdLayers).toBe(1)
    expect(migrated.exceptions).toBe(0)

    const afterMigrateBalance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
    })
    // Physical qty must be unchanged by migration.
    expect(afterMigrateBalance.onHandQty.toString()).toBe('20')
    expect(afterMigrateBalance.stockValue.toString()).toBe('300')

    const openLayers = await prisma.inventoryCostLayer.findMany({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        status: 'OPEN',
      },
    })
    expect(openLayers).toHaveLength(1)
    expect(openLayers[0].remainingQuantity.toString()).toBe('20')
    expect(openLayers[0].unitCost.toString()).toBe('15')
    expect(openLayers[0].remainingValue.toString()).toBe('300')

    // Idempotent re-run should skip.
    const rerun = await migrateFifoOpeningStock({ tenantId: fx.tenantId })
    expect(rerun.createdLayers).toBe(0)
    expect(rerun.skipped).toBeGreaterThanOrEqual(1)

    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 5,
      idempotencyKey: `fifo-ok-${fx.tenantId}`,
    })
    expect(issue.rate.toString()).toBe('15')
    expect(issue.value.toString()).toBe('75')

    const layerAfterIssue = await prisma.inventoryCostLayer.findFirstOrThrow({
      where: { id: openLayers[0].id },
    })
    expect(layerAfterIssue.remainingQuantity.toString()).toBe('15')
    expect(layerAfterIssue.remainingValue.toString()).toBe('225')
  })
})
