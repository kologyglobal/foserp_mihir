import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import * as costingService from '../src/modules/inventory/costing/costing.service.js'
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

describe.skipIf(!dbAvailable)('Inventory specific identification valuation', () => {
  let fx: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `inv-spec-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Inventory Specific ID Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'inv-spec-user')
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
            defaultCostingMethod: 'specific',
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
            defaultCostingMethod: 'specific',
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
    await prisma.inventoryLotMovement.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryLot.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockMovement.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockBalance.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryValuationMethodChange.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventorySettings.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await cleanupTenant(fx.tenantId)
  })

  it('requires serial or lot on movements', async () => {
    await expect(
      postStockMovement({
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        movementType: 'INWARD',
        referenceType: 'INW',
        quantity: 5,
        rate: 10,
        idempotencyKey: `spec-no-id-${fx.tenantId}`,
      }),
    ).rejects.toThrow(/serial or lot/i)
  })

  it('creates lot-scoped layers and issues only that lot cost', async () => {
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'INW',
      quantity: 10,
      rate: 10,
      lotNumber: 'LOT-A',
      movementDate: new Date('2026-01-01'),
      idempotencyKey: `spec-r-a-${fx.tenantId}`,
    })
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'INW',
      quantity: 10,
      rate: 20,
      lotNumber: 'LOT-B',
      movementDate: new Date('2026-01-02'),
      idempotencyKey: `spec-r-b-${fx.tenantId}`,
    })

    const layers = await prisma.inventoryCostLayer.findMany({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId },
      orderBy: [{ receiptDate: 'asc' }, { id: 'asc' }],
    })
    expect(layers).toHaveLength(2)
    expect(layers[0].lotId).toBeTruthy()
    expect(layers[1].lotId).toBeTruthy()
    expect(layers[0].lotId).not.toBe(layers[1].lotId)

    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 5,
      lotNumber: 'LOT-B',
      movementDate: new Date('2026-01-03'),
      idempotencyKey: `spec-i-b-${fx.tenantId}`,
    })

    expect(issue.rate.toString()).toBe('20')
    expect(issue.value.toString()).toBe('100')

    const entry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: issue.id },
    })
    expect(entry.valuationMethod).toBe('SPECIFIC_IDENTIFICATION')
    expect(entry.lotId).toBe(layers[1].lotId)

    const layerB = await prisma.inventoryCostLayer.findUniqueOrThrow({ where: { id: layers[1].id } })
    expect(layerB.remainingQuantity.toString()).toBe('5')
    const layerA = await prisma.inventoryCostLayer.findUniqueOrThrow({ where: { id: layers[0].id } })
    expect(layerA.remainingQuantity.toString()).toBe('10')
  })

  it('runs opening migration on switch to specific and consumes unassigned pool', async () => {
    // Leave physical on-hand, strip layers, switch average → specific with migration.
    await prisma.inventoryCostLayerConsumption.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.inventoryCostEntry.updateMany({
      where: { tenantId: fx.tenantId },
      data: { costLayerId: null },
    })
    await prisma.inventoryCostLayer.deleteMany({ where: { tenantId: fx.tenantId } })

    await costingService.changeValuationMethod(fx.tenantId, fx.userId, {
      toMethod: 'average',
      reason: 'Temp average before specific migration check',
      force: true,
      runOpeningMigration: false,
    })
    const result = await costingService.changeValuationMethod(fx.tenantId, fx.userId, {
      toMethod: 'specific',
      reason: 'Back to specific with opening layers',
      force: true,
      runOpeningMigration: true,
    })
    expect(result.toMethod).toBe('SPECIFIC_IDENTIFICATION')
    expect(result.openingMigrationRequired).toBe(true)
    expect(result.openingMigrationCompleted).toBe(true)
    expect(result.migration?.createdLayers ?? 0).toBeGreaterThanOrEqual(1)

    const poolLayer = await prisma.inventoryCostLayer.findFirst({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        status: 'OPEN',
        serialId: null,
        lotId: null,
        remainingQuantity: { gt: 0 },
      },
    })
    expect(poolLayer).toBeTruthy()

    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 1,
      lotNumber: 'LOT-MIG-POOL',
      idempotencyKey: `spec-mig-pool-${fx.tenantId}`,
    })
    expect(Number(issue.rate.toString())).toBeGreaterThan(0)
    expect(Number(issue.value.toString())).toBeGreaterThan(0)

    const poolAfter = await prisma.inventoryCostLayer.findUniqueOrThrow({
      where: { id: poolLayer!.id },
    })
    expect(Number(poolAfter.remainingQuantity.toString())).toBe(
      Number(poolLayer!.remainingQuantity.toString()) - 1,
    )
  })
})
