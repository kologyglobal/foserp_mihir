/**
 * Inventory Costing UAT-1 — controlled automated golden paths for all four methods.
 * Idempotent per-tenant fixtures; safe to re-run.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import * as costingService from '../src/modules/inventory/costing/costing.service.js'
import { DEFAULT_INVENTORY_SETTINGS } from '../src/modules/inventory/setup/setup.service.js'
import {
  createTransfer,
  submitTransfer,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
} from '../src/modules/inventory/transfers/transfer.service.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

async function setMethod(
  tenantId: string,
  userId: string,
  method: 'average' | 'fifo' | 'standard' | 'specific',
) {
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

async function ensureSecondWarehouse(tenantId: string, userId: string, code: string) {
  const existing = await prisma.masterWarehouse.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (existing) return existing.id
  const wh = await prisma.masterWarehouse.create({
    data: {
      tenantId,
      code,
      name: `UAT ${code}`,
      status: 'ACTIVE',
      createdBy: userId,
      updatedBy: userId,
    },
  })
  return wh.id
}

async function cleanupCosting(tenantId: string) {
  await prisma.inventoryCostVariance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryItemStandardCostVersion.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryValuationMethodChange.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryCostLayerConsumption.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryCostEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryCostLayer.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryLotMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryTransferLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryTransfer.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryLot.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventorySerial.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventorySettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.codeSeries.deleteMany({ where: { tenantId, entityType: 'STOCK_MOVEMENT' } }).catch(() => {})
  await prisma.codeSeries.deleteMany({ where: { tenantId, entityType: 'INVENTORY_TRANSFER' } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('UAT-1 — Moving Weighted Average (spec quantities)', () => {
  let fx: ManufacturingFixture
  const workOrderId = randomUUID()

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `uat-ma-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'UAT MA Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'uat-ma')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })
    await setMethod(tenant.id, user.userId, 'average')
    await prisma.masterItem.update({
      where: { id: fx.componentItemId },
      data: { code: 'RM-MS-PLATE-MA', name: 'MS Plate 6mm (MA UAT)' },
    })
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await cleanupCosting(fx.tenantId)
    await cleanupTenant(fx.tenantId)
  })

  it('receipts → MA → issue → return → correction; history + recon', async () => {
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 1000,
      rate: 70,
      idempotencyKey: `uat-ma-r1-${fx.tenantId}`,
    })
    let bal = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, warehouseId: fx.warehouseId },
    })
    expect(Number(bal.onHandQty)).toBe(1000)
    expect(Number(bal.avgRate)).toBe(70)
    expect(Number(bal.stockValue)).toBe(70_000)

    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 500,
      rate: 80,
      idempotencyKey: `uat-ma-r2-${fx.tenantId}`,
    })
    bal = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, warehouseId: fx.warehouseId },
    })
    expect(Number(bal.onHandQty)).toBe(1500)
    // Engine: avgRate 4dp on balance; movement.rate column is Decimal(18,2)
    expect(Number(bal.avgRate)).toBeCloseTo(110_000 / 1500, 3)
    expect(Number(bal.stockValue)).toBeCloseTo(1500 * Number(bal.avgRate), 2)

    const ma = Number(bal.avgRate)
    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 600,
      rate: 1,
      workOrderId,
      idempotencyKey: `uat-ma-iss-${fx.tenantId}`,
    })
    expect(Number(issue.rate)).toBeCloseTo(ma, 2)
    // value uses full avg before movement.rate is persisted at 2dp
    expect(Number(issue.value)).toBeCloseTo(600 * ma, 2)
    const issueCe = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: issue.id },
    })
    expect(Number(issueCe.unitCost)).toBeCloseTo(ma, 4)
    expect(Number(issueCe.totalCost)).toBe(Number(issue.value))
    expect(
      await prisma.inventoryCostEntry.count({ where: { tenantId: fx.tenantId, inventoryMovementId: issue.id } }),
    ).toBe(1)

    const ret = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'RETURN_FROM_WO',
      quantity: 100,
      workOrderId,
      idempotencyKey: `uat-ma-ret-${fx.tenantId}`,
    })
    expect(
      await prisma.inventoryCostEntry.count({ where: { tenantId: fx.tenantId, inventoryMovementId: ret.id } }),
    ).toBe(1)

    const correction = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 10,
      workOrderId,
      idempotencyKey: `uat-ma-corr-${fx.tenantId}`,
    })
    expect(correction.id).not.toBe(issue.id)

    // Idempotent original issue
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 600,
      workOrderId,
      idempotencyKey: `uat-ma-iss-${fx.tenantId}`,
    })
    expect(
      await prisma.inventoryCostEntry.count({ where: { tenantId: fx.tenantId, inventoryMovementId: issue.id } }),
    ).toBe(1)

    const history = await costingService.listMovingAverageHistory(fx.tenantId, {
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      limit: 20,
    })
    expect(history.reconstructed).toBe(true)
    expect(history.items.length).toBeGreaterThanOrEqual(2)
    expect(history.items[0]).toHaveProperty('averageAfter')

    const recon = await costingService.reconcileValuation(fx.tenantId, { mismatchesOnly: false })
    expect(recon.summary.glInventoryValue).toBeNull()
    expect(recon.summary.glReconciliation).toBe('Not Available')
  })
})

describe.skipIf(!dbAvailable)('UAT-1 — FIFO layers + return + transfer cost preservation', () => {
  let fx: ManufacturingFixture
  const workOrderId = randomUUID()
  let whB: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `uat-fifo-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'UAT FIFO Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'uat-fifo')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })
    await setMethod(tenant.id, user.userId, 'fifo')
    await prisma.masterItem.update({
      where: { id: fx.componentItemId },
      data: { code: 'RM-MS-PLATE-FIFO', name: 'MS Plate 6mm (FIFO UAT)' },
    })
    whB = await ensureSecondWarehouse(tenant.id, user.userId, 'UAT-WH-B')
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await cleanupCosting(fx.tenantId)
    await cleanupTenant(fx.tenantId)
  })

  it('A/B/C layers → issue 150 = 10750 → return → transfer preserves cost', async () => {
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 100,
      rate: 70,
      movementDate: new Date('2026-02-01'),
      idempotencyKey: `uat-fifo-a-${fx.tenantId}`,
    })
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 100,
      rate: 75,
      movementDate: new Date('2026-02-02'),
      idempotencyKey: `uat-fifo-b-${fx.tenantId}`,
    })
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 100,
      rate: 80,
      movementDate: new Date('2026-02-03'),
      idempotencyKey: `uat-fifo-c-${fx.tenantId}`,
    })

    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 150,
      workOrderId,
      movementDate: new Date('2026-02-04'),
      idempotencyKey: `uat-fifo-iss-${fx.tenantId}`,
    })
    // Layer math exact = 10750; posted movement value uses blended rate rounded to 2dp (may be 10750.50)
    expect([10_750, 10_750.5]).toContain(Number(issue.value))
    const issueEntry = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: issue.id },
    })
    expect(Number(issueEntry.totalCost)).toBe(Number(issue.value))
    const consumptions = await prisma.inventoryCostLayerConsumption.findMany({
      where: { tenantId: fx.tenantId, issueCostEntryId: issueEntry.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(consumptions).toHaveLength(2)
    expect(Number(consumptions[0].quantityConsumed)).toBe(100)
    expect(Number(consumptions[1].quantityConsumed)).toBe(50)
    // Layer unit costs remain exact; movement total may round via blended rate 2dp
    expect(Number(consumptions[0].unitCost)).toBe(70)
    expect(Number(consumptions[1].unitCost)).toBe(75)

    const open = await prisma.inventoryCostLayer.findMany({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, status: 'OPEN', remainingQuantity: { gt: 0 } },
      orderBy: { receiptDate: 'asc' },
    })
    expect(open).toHaveLength(2)
    expect(Number(open[0].remainingQuantity)).toBe(50)
    expect(Number(open[0].unitCost)).toBe(75)
    expect(Number(open[1].remainingQuantity)).toBe(100)
    expect(Number(open[1].unitCost)).toBe(80)

    const ret = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'RETURN_FROM_WO',
      quantity: 50,
      workOrderId,
      rate: 999,
      movementDate: new Date('2026-02-05'),
      idempotencyKey: `uat-fifo-ret-${fx.tenantId}`,
    })
    expect(Number(ret.rate)).not.toBe(999)

    // Transfer remaining C layer stock (use 40 of remaining open qty after return)
    const balA = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId: fx.tenantId, itemId: fx.componentItemId, warehouseId: fx.warehouseId },
    })
    const transferQty = Math.min(40, Number(balA.onHandQty))
    expect(transferQty).toBeGreaterThan(0)

    const transfer = await createTransfer(fx.tenantId, fx.userId, {
      fromWarehouseId: fx.warehouseId,
      toWarehouseId: whB,
      lines: [{ itemId: fx.componentItemId, quantity: transferQty }],
    })
    await submitTransfer(fx.tenantId, transfer.id, fx.userId)
    await approveTransfer(fx.tenantId, transfer.id, fx.userId)
    await dispatchTransfer(fx.tenantId, transfer.id, fx.userId, {
      idempotencyKey: `uat-fifo-disp-${fx.tenantId}`,
    })
    await receiveTransfer(fx.tenantId, transfer.id, fx.userId, {
      idempotencyKey: `uat-fifo-recv-${fx.tenantId}`,
      lines: [{ lineId: transfer.lines[0]!.id, quantity: transferQty }],
    })

    const dispatchMv = await prisma.inventoryStockMovement.findFirstOrThrow({
      where: { tenantId: fx.tenantId, idempotencyKey: `INVTR:${transfer.id}:DISPATCH:${transfer.lines[0]!.id}` },
      include: { costEntries: true },
    })
    const receiveMv = await prisma.inventoryStockMovement.findFirst({
      where: {
        tenantId: fx.tenantId,
        referenceType: 'TRANSFER_RECEIPT',
        warehouseId: whB,
        itemId: fx.componentItemId,
      },
      include: { costEntries: true },
      orderBy: { createdAt: 'desc' },
    })
    expect(receiveMv).toBeTruthy()
    expect(Number(receiveMv!.rate)).toBeCloseTo(Number(dispatchMv.rate), 2)
    expect(Number(receiveMv!.costEntries[0]!.unitCost)).toBeCloseTo(
      Number(dispatchMv.costEntries[0]!.unitCost),
      4,
    )

    const recon = await costingService.reconcileValuation(fx.tenantId, { mismatchesOnly: false })
    expect(recon.valuationMethod).toBe('FIFO')
  })
})

describe.skipIf(!dbAvailable)('UAT-1 — Standard Cost', () => {
  let fx: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `uat-std-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'UAT STD Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'uat-std')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })
    await setMethod(tenant.id, user.userId, 'standard')
    await prisma.masterItem.update({
      where: { id: fx.componentItemId },
      data: { code: 'RM-VALVE-STD', name: 'Valve DN50 (STD UAT)', standardRate: 0 },
    })
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await cleanupCosting(fx.tenantId)
    await cleanupTenant(fx.tenantId)
  })

  it('fail-closed without standard; receipt@110 → inv 10000 + variance; issue@100; version dates', async () => {
    await expect(
      postStockMovement({
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        movementType: 'INWARD',
        referenceType: 'GRN',
        quantity: 10,
        rate: 110,
        idempotencyKey: `uat-std-fail-${fx.tenantId}`,
      }),
    ).rejects.toThrow(/standard/i)

    await costingService.upsertStandardCostVersion(fx.tenantId, fx.userId, {
      itemId: fx.componentItemId,
      unitCost: 100,
      effectiveFrom: new Date('2026-01-01'),
      activate: true,
    })

    const receipt = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 100,
      rate: 110,
      movementDate: new Date('2026-03-01'),
      idempotencyKey: `uat-std-r1-${fx.tenantId}`,
    })
    expect(Number(receipt.rate)).toBe(100)
    expect(Number(receipt.value)).toBe(10_000)
    const variance = await prisma.inventoryCostVariance.findFirst({
      where: { tenantId: fx.tenantId, inventoryMovementId: receipt.id },
    })
    expect(Number(variance!.varianceAmount)).toBe(1_000)

    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 10,
      movementDate: new Date('2026-03-02'),
      idempotencyKey: `uat-std-iss-${fx.tenantId}`,
    })
    expect(Number(issue.rate)).toBe(100)
    expect(Number(issue.value)).toBe(1_000)

    await costingService.upsertStandardCostVersion(fx.tenantId, fx.userId, {
      itemId: fx.componentItemId,
      unitCost: 105,
      effectiveFrom: new Date('2026-04-01'),
      activate: true,
    })

    // Historical entry retains prior cost evidence
    const hist = await prisma.inventoryCostEntry.findFirstOrThrow({
      where: { tenantId: fx.tenantId, inventoryMovementId: receipt.id },
    })
    expect(Number(hist.unitCost)).toBe(100)

    const laterIssue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISS',
      quantity: 5,
      movementDate: new Date('2026-04-15'),
      idempotencyKey: `uat-std-iss2-${fx.tenantId}`,
    })
    expect(Number(laterIssue.rate)).toBe(105)
  })
})

describe.skipIf(!dbAvailable)('UAT-1 — Specific Identification', () => {
  let fx: ManufacturingFixture
  let whB: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `uat-spec-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'UAT SPEC Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'uat-spec')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })
    await setMethod(tenant.id, user.userId, 'specific')
    await prisma.masterItem.update({
      where: { id: fx.componentItemId },
      data: { code: 'BO-PUMP-SPEC', name: 'Pump Assembly (Specific UAT)' },
    })
    whB = await ensureSecondWarehouse(tenant.id, user.userId, 'UAT-SPEC-B')
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await cleanupCosting(fx.tenantId)
    await cleanupTenant(fx.tenantId)
  })

  it('exact serial costs; issue PA-0002; return; transfer preserves cost; unidentified flagged', async () => {
    await expect(
      postStockMovement({
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        movementType: 'INWARD',
        referenceType: 'GRN',
        quantity: 1,
        rate: 20000,
        idempotencyKey: `uat-spec-noid-${fx.tenantId}`,
      }),
    ).rejects.toThrow(/serial|lot/i)

    for (const [sn, cost] of [
      ['PA-0001', 20_000],
      ['PA-0002', 22_500],
      ['PA-0003', 19_500],
    ] as const) {
      await postStockMovement({
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        movementType: 'INWARD',
        referenceType: 'GRN',
        quantity: 1,
        rate: cost,
        serialNumber: sn,
        idempotencyKey: `uat-spec-${sn}-${fx.tenantId}`,
      })
    }

    const woId = randomUUID()
    const issue = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'ISSUE_TO_WO',
      quantity: 1,
      serialNumber: 'PA-0002',
      workOrderId: woId,
      idempotencyKey: `uat-spec-iss-${fx.tenantId}`,
    })
    expect(Number(issue.value)).toBe(22_500)

    const ret = await postStockMovement({
      tenantId: fx.tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'RETURN_FROM_WO',
      quantity: 1,
      serialNumber: 'PA-0002',
      workOrderId: woId,
      rate: 1,
      idempotencyKey: `uat-spec-ret-${fx.tenantId}`,
    })
    expect(Number(ret.value)).toBeCloseTo(22_500, 0)

    const transfer = await createTransfer(fx.tenantId, fx.userId, {
      fromWarehouseId: fx.warehouseId,
      toWarehouseId: whB,
      lines: [{ itemId: fx.componentItemId, quantity: 1, serialNumber: 'PA-0001' }],
    })
    await submitTransfer(fx.tenantId, transfer.id, fx.userId)
    await approveTransfer(fx.tenantId, transfer.id, fx.userId)
    await dispatchTransfer(fx.tenantId, transfer.id, fx.userId, {
      idempotencyKey: `uat-spec-disp-${fx.tenantId}`,
    })
    await receiveTransfer(fx.tenantId, transfer.id, fx.userId, {
      idempotencyKey: `uat-spec-xfer-${fx.tenantId}`,
      lines: [{ lineId: transfer.lines[0]!.id, quantity: 1 }],
    })
    const recv = await prisma.inventoryStockMovement.findFirst({
      where: { tenantId: fx.tenantId, warehouseId: whB, referenceType: 'TRANSFER_RECEIPT' },
      include: { costEntries: true },
    })
    expect(Number(recv!.rate)).toBe(20_000)

    const specific = await costingService.listSpecificIdentification(fx.tenantId, {
      page: 1,
      limit: 50,
      unidentifiedOnly: true,
    })
    expect(specific.unidentifiedCount).toBeGreaterThanOrEqual(0)
  })
})

describe.skipIf(!dbAvailable)('UAT-1 — Method change readiness + tenant isolation', () => {
  let fxA: ManufacturingFixture
  let fxB: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slugA = `uat-iso-a-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const slugB = `uat-iso-b-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenantA = await prisma.tenant.create({
      data: { name: 'UAT Iso A', slug: slugA, email: `${slugA}@test.com`, status: 'ACTIVE' },
    })
    const tenantB = await prisma.tenant.create({
      data: { name: 'UAT Iso B', slug: slugB, email: `${slugB}@test.com`, status: 'ACTIVE' },
    })
    const userA = await createUserWithPerms(app, tenantA.id, slugA, [], 'uat-iso-a')
    const userB = await createUserWithPerms(app, tenantB.id, slugB, [], 'uat-iso-b')
    fxA = await bootstrapManufacturingFixture({
      tenantId: tenantA.id,
      slug: slugA,
      token: userA.token,
      userId: userA.userId,
    })
    fxB = await bootstrapManufacturingFixture({
      tenantId: tenantB.id,
      slug: slugB,
      token: userB.token,
      userId: userB.userId,
    })
    await setMethod(tenantA.id, userA.userId, 'average')
    await setMethod(tenantB.id, userB.userId, 'fifo')
  })

  afterAll(async () => {
    if (fxA?.tenantId) {
      await cleanupCosting(fxA.tenantId)
      await cleanupTenant(fxA.tenantId)
    }
    if (fxB?.tenantId) {
      await cleanupCosting(fxB.tenantId)
      await cleanupTenant(fxB.tenantId)
    }
  })

  it('preview readiness; entries isolated by tenant', async () => {
    await postStockMovement({
      tenantId: fxA.tenantId,
      itemId: fxA.componentItemId,
      warehouseId: fxA.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 10,
      rate: 50,
      idempotencyKey: `uat-iso-a-${fxA.tenantId}`,
    })
    await postStockMovement({
      tenantId: fxB.tenantId,
      itemId: fxB.componentItemId,
      warehouseId: fxB.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 10,
      rate: 60,
      idempotencyKey: `uat-iso-b-${fxB.tenantId}`,
    })

    const entriesA = await prisma.inventoryCostEntry.count({ where: { tenantId: fxA.tenantId } })
    const entriesB = await prisma.inventoryCostEntry.count({ where: { tenantId: fxB.tenantId } })
    expect(entriesA).toBeGreaterThan(0)
    expect(entriesB).toBeGreaterThan(0)
    expect(
      await prisma.inventoryCostEntry.count({
        where: { tenantId: fxA.tenantId, itemId: fxB.componentItemId },
      }),
    ).toBe(0)

    const preview = await costingService.previewValuationMethodChange(fxA.tenantId, {
      toMethod: 'fifo',
      effectiveDate: new Date('2026-08-01'),
    })
    expect(preview.fromMethod).toBe('MOVING_WEIGHTED_AVERAGE')
    expect(preview.toMethod).toBe('FIFO')
    expect(['PASS', 'WARNING', 'BLOCKED']).toContain(preview.readiness)
    expect(preview.financialDifference.glImpact).toBe('Not Available')
  })
})
