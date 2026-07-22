import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createManufacturingAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  MANUFACTURING_PERMS,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'
import {
  buildProductionReadySetup,
  cleanupProductionData,
  type ProductionReadySetup,
} from './manufacturing/helpers/production-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const PHASE3C_PERMS = Array.from(
  new Set([
    ...MANUFACTURING_PERMS,
    ...PERMISSIONS.filter((p) => p.startsWith('inventory.')),
    ...PERMISSIONS.filter((p) => p.startsWith('purchase.requisition.')),
  ]),
) as PermissionName[]

const MATERIALS_VIEW_ONLY = ['manufacturing.work_orders.view', 'manufacturing.materials.view'] as PermissionName[]

function mfgBase(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

function invBase(slug: string) {
  return `/api/v1/t/${slug}/inventory`
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 3C — production materials integration', () => {
  let fx: ManufacturingFixture
  let setup: ProductionReadySetup
  let viewOnlyToken: string
  let otherTenantSlug: string
  let otherTenantToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p3c')
    const fullUser = await createUserWithPerms(app, ctx.tenantId, ctx.slug, PHASE3C_PERMS, 'p3c-full')
    fx = await bootstrapManufacturingFixture({ tenantId: ctx.tenantId, slug: ctx.slug, token: fullUser.token, userId: fullUser.userId })
    setup = await buildProductionReadySetup(app, fx)

    const viewOnly = await createUserWithPerms(app, fx.tenantId, fx.slug, MATERIALS_VIEW_ONLY, 'p3c-view')
    viewOnlyToken = viewOnly.token

    const other = await prisma.tenant.create({
      data: {
        name: 'Materials Other Co',
        slug: `mfg-p3c-other-${Date.now()}`,
        email: `mfg-p3c-other-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
    })
    otherTenantSlug = other.slug
    const otherUser = await createUserWithPerms(app, other.id, other.slug, PHASE3C_PERMS, 'p3c-other')
    otherTenantToken = otherUser.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
    const other = await prisma.tenant.findFirst({ where: { slug: otherTenantSlug } })
    if (other) {
      await cleanupProductionData(other.id)
      await cleanupTenant(other.id)
    }
  })

  function auth(req: request.Test, token: string = fx.token) {
    return req.set('Authorization', `Bearer ${token}`)
  }

  async function createReleasedWorkOrder(plannedQuantity = 10): Promise<string> {
    const wo = await auth(
      request(app)
        .post(`${mfgBase(fx.slug)}/work-orders`)
        .send({
          productItemId: fx.itemId,
          plannedQuantity,
          requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
    )
    expect(wo.status).toBe(201)
    const orderId = wo.body.data.id as string
    const released = await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/release`))
    expect(released.status).toBe(200)
    expect(released.body.data.materialControlStatus).toBe('ACTIVE')
    return orderId
  }

  async function postOpeningStock(itemId: string, quantity: number) {
    const res = await auth(
      request(app).post(`${invBase(fx.slug)}/movements/opening`).send({
        itemId,
        warehouseId: fx.warehouseId,
        quantity,
        referenceNo: `OPN-P3C-${Date.now()}`,
      }),
    )
    expect(res.status).toBe(201)
  }

  async function runWorkOrderToCompletable(orderId: string) {
    const detail = await auth(request(app).get(`${mfgBase(fx.slug)}/work-orders/${orderId}/detail`))
    const stages = detail.body.data.stages as Array<{ id: string; sourceStageGroupId: string }>
    const stage1 = stages.find((s) => s.sourceStageGroupId === setup.stage1Id)!
    const stage2 = stages.find((s) => s.sourceStageGroupId === setup.stage2Id)!
    const stage3 = stages.find((s) => s.sourceStageGroupId === setup.stage3Id)!

    await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/start`).send({}))
    await auth(
      request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/progress`).send({ stageId: stage1.id, goodQuantity: 10 }),
    )
    await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage1.id }))
    await auth(
      request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/progress`).send({ stageId: stage2.id, goodQuantity: 10 }),
    )
    await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage2.id }))
    await auth(
      request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/progress`).send({ stageId: stage3.id, goodQuantity: 10 }),
    )
    await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage3.id }))
  }

  it('release auto-syncs material rows from BOM snapshot (ACTIVE control status)', async () => {
    const orderId = await createReleasedWorkOrder()

    const materials = await auth(request(app).get(`${mfgBase(fx.slug)}/work-orders/${orderId}/materials`))
    expect(materials.status).toBe(200)
    expect(materials.body.data).toHaveLength(1)
    expect(Number(materials.body.data[0].requiredQty)).toBe(20)
    expect(materials.body.data[0].status).toBe('OPEN')

    const order = await prisma.productionOrder.findFirst({ where: { id: orderId } })
    expect(order?.materialControlStatus).toBe('ACTIVE')

    const resync = await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/materials/sync-requirements`))
    expect(resync.status).toBe(200)
    expect(resync.body.data.createdCount).toBe(0)
    expect(resync.body.data.skippedCount).toBe(1)
  }, 30_000)

  it('reserves materials against opening stock and issues reduce inventory', async () => {
    await postOpeningStock(fx.subComponentItemId, 100)
    const orderId = await createReleasedWorkOrder()

    const materials = await auth(request(app).get(`${mfgBase(fx.slug)}/work-orders/${orderId}/materials`))
    const materialId = materials.body.data[0].id as string

    const reserved = await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/materials/reserve`).send({}))
    expect(reserved.status).toBe(200)
    expect(reserved.body.data.results[0].status).toBe('RESERVED')
    expect(Number(reserved.body.data.results[0].reservedQty)).toBe(20)

    const issueKey = `issue-${Date.now()}`
    const issued = await auth(
      request(app)
        .post(`${mfgBase(fx.slug)}/work-orders/${orderId}/materials/issue`)
        .send({ materialId, quantity: 5, idempotencyKey: issueKey }),
    )
    expect(issued.status).toBe(201)
    expect(Number(issued.body.data.issuedQty)).toBe(5)

    const movements = await prisma.inventoryStockMovement.count({
      where: { tenantId: fx.tenantId, workOrderId: orderId, referenceType: 'ISSUE_TO_WO' },
    })
    expect(movements).toBeGreaterThanOrEqual(1)

    const balance = await prisma.inventoryStockBalance.findFirst({
      where: { tenantId: fx.tenantId, itemId: fx.subComponentItemId, warehouseId: fx.warehouseId },
    })
    expect(Number(balance?.onHandQty)).toBe(95)
  }, 45_000)

  it('creates a purchase requisition from material shortages', async () => {
    await prisma.inventoryStockBalance.deleteMany({
      where: { tenantId: fx.tenantId, itemId: fx.subComponentItemId, warehouseId: fx.warehouseId },
    })
    await prisma.inventoryStockReservation.deleteMany({
      where: { tenantId: fx.tenantId, itemId: fx.subComponentItemId, warehouseId: fx.warehouseId },
    })

    const orderId = await createReleasedWorkOrder(10)

    const reserved = await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/materials/reserve`).send({}))
    expect(reserved.status).toBe(200)
    expect(reserved.body.data.results[0].status).toBe('SHORT')
    expect(Number(reserved.body.data.results[0].shortageQty)).toBe(20)

    const pr = await auth(
      request(app)
        .post(`${mfgBase(fx.slug)}/work-orders/${orderId}/materials/shortage-requisition`)
        .send({ idempotencyKey: `shortage-${orderId}` }),
    )
    expect(pr.status).toBe(201)
    expect(pr.body.data.requisition.source).toBe('PRODUCTION_SHORTAGE')
    expect(pr.body.data.requisition.lines).toHaveLength(1)
    expect(Number(pr.body.data.requisition.lines[0].quantity)).toBe(20)

    const linked = await prisma.productionOrderMaterial.findFirst({
      where: { productionOrderId: orderId, tenantId: fx.tenantId },
    })
    expect(linked?.purchaseRequisitionId).toBe(pr.body.data.requisition.id)
  }, 30_000)

  it('completing a work order posts FG receipt when FG warehouse is configured', async () => {
    await postOpeningStock(fx.subComponentItemId, 200)
    const orderId = await createReleasedWorkOrder()
    await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/materials/reserve`).send({}))

    await runWorkOrderToCompletable(orderId)

    const completed = await auth(request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/complete`).send({}))
    expect(completed.status).toBe(200)
    expect(completed.body.data.warnings).not.toContain('FINISHED_GOODS_RECEIPT_PENDING')

    const fgMovement = await prisma.inventoryStockMovement.findFirst({
      where: {
        tenantId: fx.tenantId,
        workOrderId: orderId,
        referenceType: 'FG_RECEIPT',
        itemId: fx.itemId,
      },
    })
    expect(fgMovement).toBeTruthy()
    expect(Number(fgMovement?.quantity)).toBe(10)
  }, 60_000)

  it('enforces tenant isolation on materials endpoints', async () => {
    const orderId = await createReleasedWorkOrder()
    const res = await auth(request(app).get(`${mfgBase(otherTenantSlug)}/work-orders/${orderId}/materials`), otherTenantToken)
    expect(res.status).toBe(404)
  }, 30_000)

  it('returns 403 when reserve permission is missing', async () => {
    const orderId = await createReleasedWorkOrder()
    const res = await auth(
      request(app).post(`${mfgBase(fx.slug)}/work-orders/${orderId}/materials/reserve`).send({}),
      viewOnlyToken,
    )
    expect(res.status).toBe(403)
  }, 30_000)
})
