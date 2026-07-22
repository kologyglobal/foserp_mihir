/**
 * Manufacturing Phase 5B — WIP / material / WO transfers.
 */
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
} from './manufacturing/helpers/production-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const PHASE5B_PERMS = Array.from(
  new Set([
    ...MANUFACTURING_PERMS,
    ...PERMISSIONS.filter((p) => p.startsWith('inventory.')),
    'manufacturing.wip.move',
    'manufacturing.materials.transfer',
  ]),
) as PermissionName[]

function mfg(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

function inv(slug: string) {
  return `/api/v1/t/${slug}/inventory`
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 5B — WIP transfers', () => {
  let fx: ManufacturingFixture
  let token: string
  let viewOnlyToken: string
  let wipWarehouseId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p5b')
    const full = await createUserWithPerms(app, ctx.tenantId, ctx.slug, PHASE5B_PERMS, 'p5b-full')
    fx = await bootstrapManufacturingFixture({
      tenantId: ctx.tenantId,
      slug: ctx.slug,
      token: full.token,
      userId: full.userId,
    })
    token = full.token
    await buildProductionReadySetup(app, fx)

    const wipWh = await prisma.masterWarehouse.create({
      data: {
        tenantId: fx.tenantId,
        code: `WIP-${Date.now()}`,
        name: 'WIP Assembly',
        warehouseType: 'wip',
        status: 'ACTIVE',
      },
    })
    wipWarehouseId = wipWh.id

    const viewOnly = await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['manufacturing.work_orders.view'] as PermissionName[],
      'p5b-view',
    )
    viewOnlyToken = viewOnly.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await prisma.productionWipMovement.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.inventoryStockMovement.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.inventoryStockBalance.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
  })

  function auth(req: request.Test, t: string = token) {
    return req.set('Authorization', `Bearer ${t}`)
  }

  async function createStartedWo(plannedQuantity = 10) {
    const wo = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders`)
        .send({
          productItemId: fx.itemId,
          plannedQuantity,
          requiredCompletionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          priority: 'MEDIUM',
        }),
    )
    expect(wo.status).toBe(201)
    const orderId = wo.body.data.id as string
    await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/release`))
    await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/start`).send({}))
    return orderId
  }

  async function postOpeningStock(itemId: string, warehouseId: string, quantity: number) {
    const res = await auth(
      request(app)
        .post(`${inv(fx.slug)}/movements/opening`)
        .send({ itemId, warehouseId, quantity, idempotencyKey: `p5b-opn-${itemId}-${warehouseId}-${quantity}-${Date.now()}` }),
    )
    expect(res.status).toBe(201)
  }

  it('posts LOCATION_WIP as activity-only when profile is LOGICAL_WIP', async () => {
    const orderId = await createStartedWo()
    const res = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/wip-movements`)
        .send({
          movementType: 'LOCATION_WIP',
          quantity: 3,
          fromWarehouseId: fx.warehouseId,
          toWarehouseId: wipWarehouseId,
          reason: 'Move to assembly bay',
          idempotencyKey: `p5b-loc-${orderId}`,
        }),
    )
    expect(res.status).toBe(201)
    expect(res.body.data.movementNumber).toMatch(/^WM/)
    expect(res.body.data.status).toBe('POSTED')
    expect(res.body.data.physicalPosted).toBe(false)
    expect(res.body.data.outboundMovementId).toBeNull()

    const dup = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/wip-movements`)
        .send({
          movementType: 'LOCATION_WIP',
          quantity: 3,
          fromWarehouseId: fx.warehouseId,
          toWarehouseId: wipWarehouseId,
          reason: 'Move to assembly bay',
          idempotencyKey: `p5b-loc-${orderId}`,
        }),
    )
    expect(dup.status).toBe(201)
    expect(dup.body.data.id).toBe(res.body.data.id)

    const list = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}/wip-movements`))
    expect(list.status).toBe(200)
    expect(list.body.data.items.length).toBeGreaterThanOrEqual(1)
  }, 60_000)

  it('rejects same-warehouse LOCATION_WIP', async () => {
    const orderId = await createStartedWo()
    const res = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/wip-movements`)
        .send({
          movementType: 'LOCATION_WIP',
          quantity: 1,
          fromWarehouseId: fx.warehouseId,
          toWarehouseId: fx.warehouseId,
          reason: 'noop',
        }),
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
  }, 60_000)

  it('view-only user cannot post transfers', async () => {
    const orderId = await createStartedWo()
    const res = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/wip-movements`)
        .send({
          movementType: 'LOCATION_WIP',
          quantity: 1,
          fromWarehouseId: fx.warehouseId,
          toWarehouseId: wipWarehouseId,
          reason: 'denied',
        }),
      viewOnlyToken,
    )
    expect(res.status).toBe(403)
  }, 60_000)

  it('posts WO_TO_WO with physical inventory and activity on both orders', async () => {
    const sourceId = await createStartedWo(5)
    const targetId = await createStartedWo(5)
    await postOpeningStock(fx.itemId, fx.warehouseId, 20)

    const res = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${sourceId}/transfer-to/${targetId}`)
        .send({
          quantity: 2,
          fromWarehouseId: fx.warehouseId,
          toWarehouseId: wipWarehouseId,
          reason: 'Balance load to sister WO',
          idempotencyKey: `p5b-wo2wo-${sourceId}`,
        }),
    )
    expect(res.status).toBe(201)
    expect(res.body.data.movementType).toBe('WO_TO_WO')
    expect(res.body.data.physicalPosted).toBe(true)
    expect(res.body.data.outboundMovementId).toBeTruthy()
    expect(res.body.data.inboundMovementId).toBeTruthy()
    expect(res.body.data.targetProductionOrderId).toBe(targetId)

    const targetList = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${targetId}/wip-movements`))
    expect(targetList.status).toBe(200)
    expect(targetList.body.data.items.some((m: { id: string }) => m.id === res.body.data.id)).toBe(true)

    const srcActs = await prisma.productionActivity.findMany({
      where: { tenantId: fx.tenantId, productionOrderId: sourceId, activityType: 'WO_TO_WO_TRANSFERRED' },
    })
    const tgtActs = await prisma.productionActivity.findMany({
      where: { tenantId: fx.tenantId, productionOrderId: targetId, activityType: 'WO_TO_WO_TRANSFERRED' },
    })
    expect(srcActs.length).toBeGreaterThanOrEqual(1)
    expect(tgtActs.length).toBeGreaterThanOrEqual(1)
  }, 90_000)

  it('isolates tenant — other tenant cannot list movements', async () => {
    const orderId = await createStartedWo()
    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/wip-movements`)
        .send({
          movementType: 'LOCATION_WIP',
          quantity: 1,
          fromWarehouseId: fx.warehouseId,
          toWarehouseId: wipWarehouseId,
          reason: 'tenant A',
        }),
    )

    const other = await createManufacturingAdminTenant(app, 'mfg-p5b-x')
    const otherUser = await createUserWithPerms(app, other.tenantId, other.slug, PHASE5B_PERMS, 'p5b-x')
    const sneak = await auth(
      request(app).get(`${mfg(other.slug)}/work-orders/${orderId}/wip-movements`),
      otherUser.token,
    )
    expect(sneak.status).toBeGreaterThanOrEqual(400)

    await prisma.productionWipMovement.deleteMany({ where: { tenantId: other.tenantId } }).catch(() => {})
    await cleanupProductionData(other.tenantId).catch(() => {})
    await cleanupTenant(other.tenantId).catch(() => {})
  }, 90_000)
})
