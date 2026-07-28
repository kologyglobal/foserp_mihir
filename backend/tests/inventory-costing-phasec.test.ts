import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
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

describe.skipIf(!dbAvailable)('Inventory costing Phase C (standard + APIs)', () => {
  let fx: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `inv-cost-c-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Inventory Costing C Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'inv-cost-c-user')
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
            defaultCostingMethod: 'standard',
            manufacturingCostSource: 'actual_work_order',
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
            defaultCostingMethod: 'standard',
            manufacturingCostSource: 'actual_work_order',
          },
        },
        updatedById: user.userId,
      },
    })

    await prisma.masterItem.update({
      where: { id: fx.componentItemId },
      data: { standardRate: 100 },
    })
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await prisma.inventoryCostVariance.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryItemStandardCostVersion.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryValuationMethodChange.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryCostLayerConsumption.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryCostEntry.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryCostLayer.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockMovement.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockBalance.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventorySettings.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await cleanupTenant(fx.tenantId)
  })

  it('values receipts at standard and records purchase price variance', async () => {
    await costingService.upsertStandardCostVersion(fx.tenantId, fx.userId, {
      itemId: fx.componentItemId,
      unitCost: 100,
      effectiveFrom: new Date('2026-01-01'),
      activate: true,
    })

    const movement = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 10,
      rate: 120, // actual purchase
      idempotencyKey: `std-inw-${fx.tenantId}`,
    })

    expect(movement.rate.toString()).toBe('100')
    expect(movement.value.toString()).toBe('1000')

    const variance = await prisma.inventoryCostVariance.findFirst({
      where: { tenantId: fx.tenantId, inventoryMovementId: movement.id },
    })
    expect(variance).toBeTruthy()
    expect(variance!.varianceAmount.toString()).toBe('200')
    expect(variance!.varianceType).toBe('STANDARD_RECEIPT')

    const entries = await costingService.listCostEntries(fx.tenantId, {
      page: 1,
      limit: 20,
      sortOrder: 'desc',
      itemId: fx.componentItemId,
    })
    expect(entries.total).toBeGreaterThanOrEqual(1)
    expect(entries.items[0]?.valuationMethod).toBe('STANDARD_COST')
  })

  it('supports method change to fifo with opening migration', async () => {
    const result = await costingService.changeValuationMethod(fx.tenantId, fx.userId, {
      toMethod: 'fifo',
      reason: 'Switch to FIFO for Phase C verification',
      force: true,
      runOpeningMigration: true,
    })
    expect(result.toMethod).toBe('FIFO')
    expect(result.openingMigrationRequired).toBe(true)

    const layers = await costingService.listCostLayers(fx.tenantId, {
      page: 1,
      limit: 50,
      sortOrder: 'asc',
      itemId: fx.componentItemId,
      openOnly: true,
    })
    expect(layers.total).toBeGreaterThanOrEqual(1)

    const recon = await costingService.reconcileValuation(fx.tenantId, {
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      mismatchesOnly: false,
    })
    expect(recon.valuationMethod).toBe('FIFO')
    expect(recon.items[0]?.status).toBe('MATCHED')
  })
})
