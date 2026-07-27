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

describe.skipIf(!dbAvailable)('FIFO RETURN_FROM_WO layer restore', () => {
  let fx: ManufacturingFixture
  const workOrderId = `wo-fifo-ret-${Date.now()}`

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `inv-fifo-ret-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'FIFO Return Restore Test Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'inv-fifo-ret-user')
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
    await prisma.codeSeries
      .deleteMany({ where: { tenantId: fx.tenantId, entityType: 'STOCK_MOVEMENT' } })
      .catch(() => {})
    await cleanupTenant(fx.tenantId)
  })

  it('restores originally consumed layer cost on RETURN_FROM_WO (ignores wrong caller rate)', async () => {
    // Two receipts at different costs
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'INW',
      quantity: 10,
      rate: 10,
      movementDate: new Date('2026-02-01'),
      idempotencyKey: `ret-r1-${fx.tenantId}`,
    })
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'INW',
      quantity: 10,
      rate: 20,
      movementDate: new Date('2026-02-02'),
      idempotencyKey: `ret-r2-${fx.tenantId}`,
    })

    const layers = await prisma.inventoryCostLayer.findMany({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId },
      orderBy: [{ receiptDate: 'asc' }, { id: 'asc' }],
    })
    expect(layers).toHaveLength(2)

    // Issue 8 to WO → consumes 8 from layer@10
    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 8,
      workOrderId,
      movementDate: new Date('2026-02-03'),
      idempotencyKey: `ret-iss-${fx.tenantId}`,
    })
    expect(issue.rate.toString()).toBe('10')
    expect(issue.value.toString()).toBe('80')

    const layer0AfterIssue = await prisma.inventoryCostLayer.findFirstOrThrow({
      where: { id: layers[0].id },
    })
    expect(layer0AfterIssue.remainingQuantity.toString()).toBe('2')
    expect(layer0AfterIssue.status).toBe('OPEN')

    // Return 5 with a WRONG caller rate (99) — must restore @ original 10, not 99
    const ret = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'RETURN_FROM_WO',
      quantity: 5,
      workOrderId,
      rate: 99,
      movementDate: new Date('2026-02-04'),
      idempotencyKey: `ret-ret1-${fx.tenantId}`,
      reversalOfMovementId: issue.id,
    })

    expect(ret.rate.toString()).toBe('10')
    expect(ret.value.toString()).toBe('50')

    const layer0AfterReturn = await prisma.inventoryCostLayer.findFirstOrThrow({
      where: { id: layers[0].id },
    })
    expect(layer0AfterReturn.remainingQuantity.toString()).toBe('7')
    expect(layer0AfterReturn.status).toBe('OPEN')
    expect(layer0AfterReturn.remainingValue.toString()).toBe('70')

    // No extra receipt layer for the restored qty (full restore, no remainder)
    const layerCount = await prisma.inventoryCostLayer.count({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId },
    })
    expect(layerCount).toBe(2)

    const returnEntry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: ret.id },
    })
    expect(returnEntry.isReversal).toBe(true)
    expect(returnEntry.unitCost.toString()).toBe('10')
    expect(returnEntry.totalCost.toString()).toBe('50')

    const restoreRows = await prisma.inventoryCostLayerConsumption.findMany({
      where: {
        tenantId: fx.tenantId,
        issueCostEntryId: returnEntry.id,
        quantityConsumed: { lt: 0 },
      },
    })
    expect(restoreRows).toHaveLength(1)
    expect(restoreRows[0].layerId).toBe(layers[0].id)
    expect(restoreRows[0].quantityConsumed.toString()).toBe('-5')

    // Subsequent issue should consume restored oldest layer first @10
    const issue2 = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 3,
      movementDate: new Date('2026-02-05'),
      idempotencyKey: `ret-iss2-${fx.tenantId}`,
    })
    expect(issue2.rate.toString()).toBe('10')
  })
})
