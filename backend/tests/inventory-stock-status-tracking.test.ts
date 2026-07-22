import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { InventoryPostingService } from '../src/modules/inventory/shared/stock-posting.service.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Inventory stock status and tracking', () => {
  let fx: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `inv-status-${Date.now()}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Inventory Status Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'inventory-status')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await prisma.inventorySerialMovement.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.inventoryStockMovement.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.inventorySerial.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.inventoryBatchBalance.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.inventoryBatch.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.inventoryStockBalance.deleteMany({ where: { tenantId: fx.tenantId } })
    await cleanupTenant(fx.tenantId)
  })

  it('keeps QC hold out of unrestricted free quantity', async () => {
    await InventoryPostingService.post({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      stockStatus: 'QC_HOLD',
      quantity: 10,
    })
    const balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, warehouseId: fx.warehouseId },
    })
    expect(balance.onHandQty.toString()).toBe('10')
    expect(balance.qcHoldQty.toString()).toBe('10')
  })

  it('transfers QC hold without changing on-hand', async () => {
    await InventoryPostingService.transferStatus({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      fromStockStatus: 'QC_HOLD',
      stockStatus: 'UNRESTRICTED',
      quantity: 7,
      idempotencyKey: 'status-release-1',
    })
    await InventoryPostingService.transferStatus({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      fromStockStatus: 'QC_HOLD',
      stockStatus: 'REJECTED',
      quantity: 3,
      idempotencyKey: 'status-reject-1',
    })
    const balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, warehouseId: fx.warehouseId },
    })
    expect(balance.onHandQty.toString()).toBe('10')
    expect(balance.qcHoldQty.toString()).toBe('0')
    expect(balance.rejectedQty.toString()).toBe('3')
  })

  it('creates tenant-scoped batch positions and movement snapshots', async () => {
    await prisma.masterItem.update({
      where: { id: fx.subComponentItemId },
      data: { batchTracked: true },
    })
    const movement = await InventoryPostingService.post({
      tenantId: fx.tenantId,
      itemId: fx.subComponentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 5,
      batchNumber: 'BATCH-001',
    })
    expect(movement.batchNumberSnapshot).toBe('BATCH-001')
    const position = await prisma.inventoryBatchBalance.findFirstOrThrow({
      where: { tenantId: fx.tenantId, itemId: fx.subComponentItemId },
    })
    expect(position.quantity.toString()).toBe('5')
    expect(position.stockStatus).toBe('UNRESTRICTED')
  })
})
