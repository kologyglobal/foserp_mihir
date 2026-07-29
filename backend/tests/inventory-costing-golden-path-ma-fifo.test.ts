/**
 * Golden path — Moving Weighted Average:
 * Opening/GRN → MA → ISSUE_TO_WO → InventoryCostEntry → WO material consume
 * → RETURN → idempotent correction → reconciliation
 *
 * Also mirrors FIFO WO consume match for issue layers.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import { reconcileValuation } from '../src/modules/inventory/costing/costing.service.js'
import { DEFAULT_INVENTORY_SETTINGS } from '../src/modules/inventory/setup/setup.service.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'
import { randomUUID } from 'node:crypto'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

async function setCostingMethod(tenantId: string, userId: string, method: 'average' | 'fifo') {
  await prisma.inventorySettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      settings: {
        ...DEFAULT_INVENTORY_SETTINGS,
        general: { ...DEFAULT_INVENTORY_SETTINGS.general, defaultCostingMethod: method },
      },
      createdById: userId,
      updatedById: userId,
    },
    update: {
      settings: {
        ...DEFAULT_INVENTORY_SETTINGS,
        general: { ...DEFAULT_INVENTORY_SETTINGS.general, defaultCostingMethod: method },
      },
      updatedById: userId,
    },
  })
}

/** Replicates IV-MFG-1 WO material source selection from cost entry / movement. */
async function resolveWoMaterialFromInventory(tenantId: string, workOrderId: string) {
  const movements = await prisma.inventoryStockMovement.findMany({
    where: { tenantId, workOrderId, referenceType: { in: ['ISSUE_TO_WO', 'RETURN_FROM_WO'] } },
    include: {
      costEntries: { orderBy: { createdAt: 'asc' }, take: 1 },
      item: { select: { standardRate: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  let total = 0
  const lines: Array<{
    movementId: string
    source: 'INVENTORY_COST_ENTRY' | 'INVENTORY_STOCK_MOVEMENT'
    costEntryId: string | null
    amount: number
    unitCost: number
  }> = []
  for (const m of movements) {
    const direction = m.referenceType === 'RETURN_FROM_WO' ? -1 : 1
    const qty = Math.abs(Number(m.quantity))
    const ce = m.costEntries[0]
    if (ce) {
      const amount = Math.abs(Number(ce.totalCost))
      lines.push({
        movementId: m.id,
        source: 'INVENTORY_COST_ENTRY',
        costEntryId: ce.id,
        amount: direction * amount,
        unitCost: Number(ce.unitCost),
      })
      total += direction * amount
    } else {
      const movementValue = Math.abs(Number(m.value))
      const fallback = qty * Number(m.item.standardRate)
      const amount = movementValue > 0 ? movementValue : fallback
      lines.push({
        movementId: m.id,
        source: 'INVENTORY_STOCK_MOVEMENT',
        costEntryId: null,
        amount: direction * amount,
        unitCost: qty > 0 ? amount / qty : 0,
      })
      total += direction * amount
    }
  }
  return { total, lines, movements }
}

describe.skipIf(!dbAvailable)('Golden path — Moving Weighted Average', () => {
  let fx: ManufacturingFixture
  const workOrderId = randomUUID()

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `gp-ma-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'MA Golden Path Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'gp-ma-user')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })
    await setCostingMethod(tenant.id, user.userId, 'average')
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await prisma.inventoryCostLayerConsumption.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryCostEntry.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryCostLayer.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockMovement.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockBalance.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventorySettings.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.codeSeries.deleteMany({ where: { tenantId: fx.tenantId, entityType: 'STOCK_MOVEMENT' } }).catch(() => {})
    await cleanupTenant(fx.tenantId)
  })

  it('MA: receipts → issue to WO → exact cost entry → return → no duplicate → recon', async () => {
    // Opening 600 @ 70 + GRN 400 @ 80 → MA = (42000+32000)/1000 = 74 exactly
    // (avoids qty×avgRate(4dp) rounding drift seen with 73.3333…)
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 600,
      rate: 70,
      idempotencyKey: `gp-ma-opn-${fx.tenantId}`,
    })
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 400,
      rate: 80,
      idempotencyKey: `gp-ma-grn-${fx.tenantId}`,
    })

    const afterReceipts = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, warehouseId: fx.warehouseId },
    })
    expect(Number(afterReceipts.onHandQty)).toBe(1000)
    expect(Number(afterReceipts.avgRate)).toBe(74)
    expect(Number(afterReceipts.stockValue)).toBe(74_000)

    const receiptEntries = await prisma.inventoryCostEntry.count({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, entryType: { in: ['RECEIPT', 'OPENING'] } },
    })
    expect(receiptEntries).toBe(2)

    // Issue 250 to WO — must use current MA (74), ignore caller rate
    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 250,
      rate: 1, // ignored for MA issues
      workOrderId,
      idempotencyKey: `gp-ma-issue-${fx.tenantId}`,
    })

    expect(Number(issue.rate)).toBe(74)
    expect(Number(issue.value)).toBe(18_500)

    const issueEntries = await prisma.inventoryCostEntry.findMany({
      where: { tenantId: fx.tenantId, inventoryMovementId: issue.id },
    })
    expect(issueEntries).toHaveLength(1)
    expect(issueEntries[0].valuationMethod).toBe('MOVING_WEIGHTED_AVERAGE')
    expect(Number(issueEntries[0].unitCost)).toBe(74)
    expect(Number(issueEntries[0].totalCost)).toBe(18_500)

    const afterIssue = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, warehouseId: fx.warehouseId },
    })
    expect(Number(afterIssue.onHandQty)).toBe(750)
    expect(Number(afterIssue.avgRate)).toBe(74)
    expect(Number(afterIssue.stockValue)).toBe(55_500)

    // Idempotent re-post — same movement, still exactly one cost entry
    const issueAgain = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 250,
      workOrderId,
      idempotencyKey: `gp-ma-issue-${fx.tenantId}`,
    })
    expect(issueAgain.id).toBe(issue.id)
    expect(
      await prisma.inventoryCostEntry.count({ where: { tenantId: fx.tenantId, inventoryMovementId: issue.id } }),
    ).toBe(1)

    // WO material must consume exact Inventory Cost Entry (== inventory issue value)
    const woMaterial = await resolveWoMaterialFromInventory(fx.tenantId, workOrderId)
    expect(woMaterial.lines).toHaveLength(1)
    expect(woMaterial.lines[0].source).toBe('INVENTORY_COST_ENTRY')
    expect(woMaterial.lines[0].costEntryId).toBe(issueEntries[0].id)
    expect(woMaterial.total).toBe(18_500)
    expect(woMaterial.total).toBe(Math.abs(Number(issue.value)))

    // Return 50 — MA return without rate uses current average (not inventing FIFO layer restore)
    const ret = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'RETURN_FROM_WO',
      quantity: 50,
      workOrderId,
      idempotencyKey: `gp-ma-ret-${fx.tenantId}`,
    })
    expect(Number(ret.rate)).toBe(74)
    expect(Number(ret.value)).toBe(3_700)
    const retEntry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: ret.id },
    })
    expect(retEntry.valuationMethod).toBe('MOVING_WEIGHTED_AVERAGE')
    expect(Number(retEntry.unitCost)).toBe(74)
    expect(Number(retEntry.totalCost)).toBe(3_700)
    expect(
      await prisma.inventoryCostEntry.count({ where: { tenantId: fx.tenantId, inventoryMovementId: ret.id } }),
    ).toBe(1)

    const afterReturn = await resolveWoMaterialFromInventory(fx.tenantId, workOrderId)
    expect(afterReturn.lines).toHaveLength(2)
    expect(afterReturn.lines.every((l) => l.source === 'INVENTORY_COST_ENTRY')).toBe(true)
    expect(afterReturn.total).toBe(18_500 - 3_700) // 14800

    // Correction: new idempotency key → separate movement (not silent rewrite / no duplicate on original)
    const correction = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 10,
      workOrderId,
      idempotencyKey: `gp-ma-corr-${fx.tenantId}`,
    })
    expect(correction.id).not.toBe(issue.id)
    expect(Number(correction.rate)).toBe(74)
    expect(Number(correction.value)).toBe(740)
    expect(
      await prisma.inventoryCostEntry.count({
        where: { tenantId: fx.tenantId, workOrderId, entryType: 'ISSUE' },
      }),
    ).toBe(2) // original 250 + correction 10

    const woNet = await resolveWoMaterialFromInventory(fx.tenantId, workOrderId)
    expect(woNet.total).toBe(18_500 - 3_700 + 740) // 15540
    expect(woNet.lines.every((l) => l.source === 'INVENTORY_COST_ENTRY')).toBe(true)

    // FG receipt at WO material net cost
    const fg = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.itemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'FG_RECEIPT',
      quantity: 1,
      rate: woNet.total,
      workOrderId,
      idempotencyKey: `gp-ma-fg-${fx.tenantId}`,
    })
    const fgEntry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: fg.id },
    })
    expect(Number(fgEntry.totalCost)).toBe(15_540)
    expect(
      await prisma.inventoryCostEntry.count({ where: { tenantId: fx.tenantId, inventoryMovementId: fg.id } }),
    ).toBe(1)

    const recon = await reconcileValuation(fx.tenantId, { mismatchesOnly: false })
    expect(recon.valuationMethod).toBe('MOVING_WEIGHTED_AVERAGE')
    expect(recon.items.every((r) => r.status === 'MATCHED')).toBe(true)
  })
})

describe.skipIf(!dbAvailable)('Golden path — FIFO issue/return + WO cost match', () => {
  let fx: ManufacturingFixture
  const workOrderId = randomUUID()

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `gp-fifo-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'FIFO Golden Path Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'gp-fifo-user')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })
    await setCostingMethod(tenant.id, user.userId, 'fifo')
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await prisma.inventoryCostLayerConsumption.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryCostEntry.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryCostLayer.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockMovement.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventoryStockBalance.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.inventorySettings.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.codeSeries.deleteMany({ where: { tenantId: fx.tenantId, entityType: 'STOCK_MOVEMENT' } }).catch(() => {})
    await cleanupTenant(fx.tenantId)
  })

  it('FIFO: layers → WO issue exact layer cost → return restore → correction → FG → recon', async () => {
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 40,
      rate: 60,
      movementDate: new Date('2026-01-01'),
      idempotencyKey: `gp-fifo-a-${fx.tenantId}`,
    })
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 60,
      rate: 70,
      movementDate: new Date('2026-01-02'),
      idempotencyKey: `gp-fifo-b-${fx.tenantId}`,
    })

    const layers = await prisma.inventoryCostLayer.findMany({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, status: 'OPEN' },
      orderBy: { receiptDate: 'asc' },
    })
    expect(layers).toHaveLength(2)
    expect(Number(layers[0].remainingQuantity)).toBe(40)
    expect(Number(layers[0].unitCost)).toBe(60)
    expect(Number(layers[1].remainingQuantity)).toBe(60)
    expect(Number(layers[1].unitCost)).toBe(70)

    // Need 100 → 40@60 + 60@70 = 2400+4200 = 6600
    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 100,
      rate: 1, // ignored — layer costs win
      workOrderId,
      movementDate: new Date('2026-01-03'),
      idempotencyKey: `gp-fifo-iss-${fx.tenantId}`,
    })
    expect(Number(issue.value)).toBe(6600)
    expect(Number(issue.rate)).toBe(66)

    const issueEntry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: issue.id },
    })
    expect(issueEntry.valuationMethod).toBe('FIFO')
    expect(Number(issueEntry.totalCost)).toBe(6600)

    const consumptions = await prisma.inventoryCostLayerConsumption.findMany({
      where: { tenantId: fx.tenantId, issueCostEntryId: issueEntry.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(consumptions).toHaveLength(2)
    expect(Number(consumptions[0].totalCost) + Number(consumptions[1].totalCost)).toBe(6600)

    const wo = await resolveWoMaterialFromInventory(fx.tenantId, workOrderId)
    expect(wo.lines[0].source).toBe('INVENTORY_COST_ENTRY')
    expect(wo.lines[0].costEntryId).toBe(issueEntry.id)
    expect(wo.total).toBe(6600)

    // Return 30 — FIFO restore ignores wrong caller rate
    const ret = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'RETURN_FROM_WO',
      quantity: 30,
      workOrderId,
      rate: 999,
      movementDate: new Date('2026-01-04'),
      idempotencyKey: `gp-fifo-ret-${fx.tenantId}`,
    })
    const retEntry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: ret.id },
    })
    expect(retEntry.valuationMethod).toBe('FIFO')
    expect(Number(ret.rate)).not.toBe(999)
    expect(
      await prisma.inventoryCostEntry.count({ where: { tenantId: fx.tenantId, inventoryMovementId: ret.id } }),
    ).toBe(1)

    const afterRet = await resolveWoMaterialFromInventory(fx.tenantId, workOrderId)
    expect(afterRet.total).toBeCloseTo(6600 - Number(retEntry.totalCost), 2)
    expect(afterRet.lines.every((l) => l.source === 'INVENTORY_COST_ENTRY')).toBe(true)

    // Idempotent issue — no duplicate cost entry
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 100,
      workOrderId,
      idempotencyKey: `gp-fifo-iss-${fx.tenantId}`,
    })
    expect(
      await prisma.inventoryCostEntry.count({ where: { tenantId: fx.tenantId, inventoryMovementId: issue.id } }),
    ).toBe(1)

    // Correction issue against restored layers (new key)
    const correction = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 10,
      workOrderId,
      movementDate: new Date('2026-01-05'),
      idempotencyKey: `gp-fifo-corr-${fx.tenantId}`,
    })
    expect(correction.id).not.toBe(issue.id)
    const corrEntry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: correction.id },
    })
    expect(corrEntry.valuationMethod).toBe('FIFO')

    const woNet = await resolveWoMaterialFromInventory(fx.tenantId, workOrderId)
    expect(woNet.lines.every((l) => l.source === 'INVENTORY_COST_ENTRY')).toBe(true)
    expect(woNet.total).toBeCloseTo(6600 - Number(retEntry.totalCost) + Number(corrEntry.totalCost), 2)

    const fg = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.itemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'FG_RECEIPT',
      quantity: 1,
      rate: woNet.total,
      workOrderId,
      movementDate: new Date('2026-01-06'),
      idempotencyKey: `gp-fifo-fg-${fx.tenantId}`,
    })
    expect(
      await prisma.inventoryCostEntry.count({ where: { tenantId: fx.tenantId, inventoryMovementId: fg.id } }),
    ).toBe(1)

    const recon = await reconcileValuation(fx.tenantId, { mismatchesOnly: false })
    expect(recon.valuationMethod).toBe('FIFO')
    expect(recon.items.every((r) => r.status === 'MATCHED')).toBe(true)
  })
})
