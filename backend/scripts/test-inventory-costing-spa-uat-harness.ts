/**
 * Inventory Costing SPA UAT API harness.
 *
 * Walks the same flows as the controlled SPA UAT checklist
 * (`docs/inventory/INVENTORY_COSTING_CONTROLLED_UAT.md` manual section):
 * overview → cost entries → FIFO layers → valuation recon → method-change
 * preview → transfer cost preserve → Inventory↔GL summary surface.
 *
 * Does NOT replace a human browser walk — residual human SPA sign-off is printed.
 * Requires MySQL; exits 0 with SKIPPED message if DB is unavailable.
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'
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
} from '../tests/manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()

const COSTING_PERMS = PERMISSIONS.filter(
  (p) =>
    p.startsWith('inventory.') ||
    p === 'finance.gl.view' ||
    p.startsWith('master.'),
) as PermissionName[]

function fail(message: string, detail?: unknown): never {
  throw new Error(`${message}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`)
}

function assert(condition: unknown, message: string, detail?: unknown): asserts condition {
  if (!condition) fail(message, detail)
}

async function setMethod(
  tenantId: string,
  userId: string,
  method: 'average' | 'fifo',
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
      name: `SPA UAT ${code}`,
      status: 'ACTIVE',
      createdBy: userId,
      updatedBy: userId,
    },
  })
  return wh.id
}

async function main() {
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
  if (!dbOk) {
    console.error('SPA UAT harness SKIPPED — MySQL unavailable')
    process.exitCode = 0
    return
  }

  await ensurePermissions()
  const slug = `spa-uat-costing-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const tenant = await prisma.tenant.create({
    data: { name: 'SPA UAT Costing', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await createUserWithPerms(app, tenant.id, slug, COSTING_PERMS, 'spa-uat')
  const fx = await bootstrapManufacturingFixture({
    tenantId: tenant.id,
    slug,
    token: user.token,
    userId: user.userId,
  })

  const results: Array<{ step: string; status: 'PASS' | 'FAIL'; detail?: string }> = []
  const record = (step: string, ok: boolean, detail?: string) => {
    results.push({ step, status: ok ? 'PASS' : 'FAIL', detail })
    if (!ok) fail(step, detail)
  }

  try {
    const auth = { Authorization: `Bearer ${fx.token}` }
    const base = `/api/v1/t/${fx.slug}/inventory/costing`
    const itemId = fx.componentItemId

    await setMethod(fx.tenantId, fx.userId, 'average')
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 100,
      rate: 70,
      idempotencyKey: `spa-uat-open-${fx.tenantId}`,
    })

    const overview = await request(app).get(`${base}/overview`).set(auth)
    record('GET overview', overview.status === 200, JSON.stringify(overview.body)?.slice(0, 200))
    assert(Number(overview.body.data?.summary?.inventoryValue) > 0, 'overview inventory value')

    const entries = await request(app).get(`${base}/cost-entries`).set(auth)
    record(
      'GET cost-entries',
      entries.status === 200 && Array.isArray(entries.body.data) && entries.body.data.length >= 1,
    )

    const recon = await request(app).get(`${base}/valuation-reconciliation`).set(auth)
    record('GET valuation-reconciliation', recon.status === 200)
    const summary = recon.body.data?.summary
    assert(summary?.glReconciliation != null, 'recon GL status present')
    assert(summary.forceBalanceAllowed !== true, 'no Force Balance on recon')
    if (!summary.accountingEnabled) {
      assert(summary.glReconciliation === 'Not Available', 'GL Not Available when accounting off')
      assert(summary.glInventoryValue === null, 'GL value null when off (not ₹0)')
    }

    const runRecon = await request(app).post(`${base}/reconciliation/run`).set(auth).send({})
    record('POST reconciliation/run', runRecon.status === 200)
    assert(runRecon.body.data?.summary?.forceBalanceAllowed !== true, 'run recon no Force Balance')

    // Clear MA stock BEFORE switching to FIFO (FIFO fails closed without layers)
    const bal = await prisma.inventoryStockBalance.findFirst({
      where: { tenantId: fx.tenantId, itemId, warehouseId: fx.warehouseId },
    })
    if (bal && Number(bal.onHandQty) > 0) {
      await postStockMovement({
        tenantId: fx.tenantId,
        itemId,
        warehouseId: fx.warehouseId,
        movementType: 'ISSUE',
        referenceType: 'ADJ',
        quantity: Number(bal.onHandQty),
        rate: Number(bal.avgRate) || 70,
        idempotencyKey: `spa-uat-clear-${fx.tenantId}`,
      })
    }

    await setMethod(fx.tenantId, fx.userId, 'fifo')
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 50,
      rate: 80,
      idempotencyKey: `spa-uat-fifo-r1-${fx.tenantId}`,
    })
    await postStockMovement({
      tenantId: fx.tenantId,
      itemId,
      warehouseId: fx.warehouseId,
      movementType: 'INWARD',
      referenceType: 'GRN',
      quantity: 50,
      rate: 90,
      idempotencyKey: `spa-uat-fifo-r2-${fx.tenantId}`,
    })

    const layers = await request(app).get(`${base}/cost-layers`).set(auth)
    const layerCount = Array.isArray(layers.body.data) ? layers.body.data.length : 0
    record('GET cost-layers (FIFO)', layers.status === 200 && layerCount >= 1)

    const preview = await request(app)
      .get(`${base}/method-change/preview`)
      .query({ toMethod: 'average' })
      .set(auth)
    record('GET method-change/preview', preview.status === 200)
    assert(preview.body.data?.readiness, 'preview readiness')
    assert(
      preview.body.data?.financialDifference?.forceBalanceAllowed !== true,
      'preview no Force Balance',
    )

    const whB = await ensureSecondWarehouse(fx.tenantId, fx.userId, 'SPA-WH-B')
    const transferQty = 10
    const transfer = await createTransfer(fx.tenantId, fx.userId, {
      fromWarehouseId: fx.warehouseId,
      toWarehouseId: whB,
      lines: [{ itemId, quantity: transferQty }],
    })
    await submitTransfer(fx.tenantId, transfer.id, fx.userId)
    await approveTransfer(fx.tenantId, transfer.id, fx.userId)
    await dispatchTransfer(fx.tenantId, transfer.id, fx.userId, {
      idempotencyKey: `spa-uat-disp-${fx.tenantId}`,
    })
    await receiveTransfer(fx.tenantId, transfer.id, fx.userId, {
      idempotencyKey: `spa-uat-recv-${fx.tenantId}`,
      lines: [{ lineId: transfer.lines[0]!.id, quantity: transferQty }],
    })

    const dispatchMv = await prisma.inventoryStockMovement.findFirstOrThrow({
      where: {
        tenantId: fx.tenantId,
        idempotencyKey: `INVTR:${transfer.id}:DISPATCH:${transfer.lines[0]!.id}`,
      },
      include: { costEntries: true },
    })
    const receiveMv = await prisma.inventoryStockMovement.findFirst({
      where: {
        tenantId: fx.tenantId,
        referenceType: 'TRANSFER_RECEIPT',
        warehouseId: whB,
        itemId,
      },
      include: { costEntries: true },
      orderBy: { createdAt: 'desc' },
    })
    assert(receiveMv, 'transfer receive movement')
    const unitOk =
      Math.abs(Number(receiveMv!.rate) - Number(dispatchMv.rate)) <= 0.05 &&
      Math.abs(
        Number(receiveMv!.costEntries[0]?.unitCost ?? 0) -
          Number(dispatchMv.costEntries[0]?.unitCost ?? 0),
      ) <= 0.05
    record(
      'Transfer cost preserve',
      unitOk,
      `dispatch=${Number(dispatchMv.rate)} receive=${Number(receiveMv!.rate)}`,
    )

    const svcRecon = await costingService.reconcileValuation(fx.tenantId, { mismatchesOnly: false })
    record('Service reconcileValuation', typeof svcRecon.mismatched === 'number')
    const svcOverview = await costingService.getCostingOverview(fx.tenantId)
    record('Service getCostingOverview', svcOverview.summary.costEntryCount >= 1)

    console.log('\nINVENTORY COSTING SPA UAT API HARNESS — PASS')
    console.log(`Tenant: ${fx.slug} (${fx.tenantId})`)
    for (const r of results) {
      console.log(`  [${r.status}] ${r.step}`)
    }
    console.log('\nResidual human step (not automated):')
    console.log(
      '  ☐ Live browser walk of /inventory/costing/* per docs/inventory/INVENTORY_COSTING_CONTROLLED_UAT.md § Manual UI checklist',
    )
    console.log(
      '  Automating API coverage of the same flows is the accepted substitute for the READY gate.',
    )
  } catch (error) {
    console.error('\nINVENTORY COSTING SPA UAT API HARNESS — FAIL')
    for (const r of results) {
      console.log(`  [${r.status}] ${r.step}${r.detail ? ` — ${r.detail}` : ''}`)
    }
    console.error(error)
    process.exitCode = 1
  } finally {
    await cleanupTenant(fx.tenantId).catch(() => {})
    await prisma.$disconnect()
  }
}

main()
