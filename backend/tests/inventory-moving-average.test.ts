import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Inventory moving-average valuation', () => {
  let fx: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `inv-ma-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Inventory Valuation Test Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'inv-ma-user')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await prisma.inventoryStockMovement.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockBalance.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.codeSeries.deleteMany({
      where: { tenantId: fx.tenantId, entityType: 'STOCK_MOVEMENT' },
    }).catch(() => {})
    await cleanupTenant(fx.tenantId)
  })

  it('weights receipts and values issues at the current average', async () => {
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 10,
      rate: 10,
    })
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'INW',
      quantity: 10,
      rate: 20,
    })

    const afterReceipts = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
    })
    expect(afterReceipts.avgRate.toString()).toBe('15')

    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 5,
    })
    const remaining = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
    })

    expect(issue.rate.toString()).toBe('15')
    expect(remaining.onHandQty.toString()).toBe('15')
    expect(remaining.avgRate.toString()).toBe('15')
    expect(remaining.stockValue.toString()).toBe('225')
  })
})
