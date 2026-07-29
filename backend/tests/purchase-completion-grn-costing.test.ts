/**
 * Purchase completion — GRN → Inventory Costing evidence (no QI path).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { DEFAULT_INVENTORY_SETTINGS } from '../src/modules/inventory/setup/setup.service.js'
import {
  cleanupPurchaseTenant,
  createSentPo,
  createSubmittedGrn,
  createTenantUser,
  dbAvailable,
  ensurePermissions,
  FULL_PURCHASE_PERMS,
  seedPurchaseMasters,
} from './helpers/purchase-live-fixture.js'

const app = createApp()

describe.skipIf(!dbAvailable)('Purchase completion — GRN → Inventory Costing', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let userId = ''
  let masters: Awaited<ReturnType<typeof seedPurchaseMasters>>

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createTenantUser({
      app,
      slugPrefix: 'pur-cost',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = ctx.tenantId
    slug = ctx.slug
    token = ctx.token
    userId = ctx.userId
    masters = await seedPurchaseMasters(tenantId)
    await prisma.inventorySettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        settings: {
          ...DEFAULT_INVENTORY_SETTINGS,
          general: { ...DEFAULT_INVENTORY_SETTINGS.general, defaultCostingMethod: 'average' },
        },
        createdById: userId,
        updatedById: userId,
      },
      update: {
        settings: {
          ...DEFAULT_INVENTORY_SETTINGS,
          general: { ...DEFAULT_INVENTORY_SETTINGS.general, defaultCostingMethod: 'average' },
        },
        updatedById: userId,
      },
    })
  })

  afterAll(async () => {
    if (tenantId) await cleanupPurchaseTenant(tenantId)
  })

  it('submitted non-QC GRN posts stock movement + inventory cost entry', async () => {
    const { poId, poLineId } = await createSentPo(app, {
      slug,
      token,
      approverToken: token,
      vendorId: masters.vendorId,
      uomId: masters.uomId,
      warehouseId: masters.warehouseId,
      itemId: masters.itemId,
      itemCode: masters.itemCode,
      qty: 10,
    })

    const { grnId } = await createSubmittedGrn(app, {
      slug,
      token,
      poId,
      poLineId,
      vendorId: masters.vendorId,
      warehouseId: masters.warehouseId,
      locationId: masters.locationId,
      binId: masters.binId,
      receivedQuantity: 10,
      inspectionRequired: false,
    })

    const grn = await prisma.goodsReceipt.findFirstOrThrow({ where: { id: grnId, tenantId } })
    const movements = await prisma.inventoryStockMovement.findMany({
      where: { tenantId, referenceNo: grn.grnNumber },
      include: { costEntries: true },
    })
    expect(movements.length).toBeGreaterThanOrEqual(1)
    const inward = movements.find((m) => m.movementType === 'INWARD')
    expect(inward).toBeTruthy()
    expect(inward!.costEntries.length).toBe(1)
    // createSentPo fixture rate is 100
    expect(Number(inward!.costEntries[0]!.unitCost)).toBeCloseTo(100, 2)
    expect(Number(inward!.costEntries[0]!.totalCost)).toBeCloseTo(1000, 2)
    expect(
      await prisma.inventoryCostEntry.count({
        where: { tenantId, inventoryMovementId: inward!.id },
      }),
    ).toBe(1)
  })
})
