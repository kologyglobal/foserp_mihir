/**
 * Manufacturing Phase 7A — warehouse mapping, material position, FG, store workbench, close readiness.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { type PermissionName } from '../src/constants/permissions.js'
import { resolveMaterialClosePolicy } from '../src/modules/manufacturing/materials/material-close-policy.js'
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

const PHASE7A_PERMS = Array.from(
  new Set([
    ...MANUFACTURING_PERMS,
    'manufacturing.warehouse_mapping.view',
    'manufacturing.warehouse_mapping.manage',
    'manufacturing.store_workbench.view',
    'manufacturing.material_position.view',
    'manufacturing.fg_receipt.view',
    'manufacturing.fg_receipt.create',
    'manufacturing.fg_receipt.post',
    'manufacturing.fg_receipt.reverse',
    'manufacturing.work_order.close_readiness',
    'manufacturing.wip_stock.view',
  ]),
) as PermissionName[]

function mfg(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 7A', () => {
  let fx: ManufacturingFixture
  let token: string
  let workOrderId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p7a')
    const full = await createUserWithPerms(app, ctx.tenantId, ctx.slug, PHASE7A_PERMS, 'p7a-full')
    fx = await bootstrapManufacturingFixture({
      tenantId: ctx.tenantId,
      slug: ctx.slug,
      token: full.token,
      userId: full.userId,
    })
    token = full.token
    await buildProductionReadySetup(app, fx)

    const wo = await request(app)
      .post(`${mfg(fx.slug)}/work-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        productItemId: fx.itemId,
        plannedQuantity: 2,
        requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    expect(wo.status).toBe(201)
    workOrderId = wo.body.data.id as string
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await prisma.productionFinishedGoodsReceipt.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.manufacturingWarehouseMapping.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
  })

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`)
  }

  it('resolves material close policy default TOLERANCE_BASED', () => {
    const policy = resolveMaterialClosePolicy()
    expect(policy.policy).toBe('TOLERANCE_BASED')
    expect(policy.openReservationBlocksClose).toBe(true)
  })

  it('creates warehouse mapping and reports readiness', async () => {
    const create = await auth(
      request(app).post(`${mfg(fx.slug)}/warehouse-mappings`).send({
        rawMaterialWarehouseId: fx.warehouseId,
        finishedGoodsWarehouseId: fx.warehouseId,
        wipWarehouseId: fx.warehouseId,
        isDefault: true,
        isActive: true,
      }),
    )
    expect([200, 201]).toContain(create.status)
    expect(create.body?.data?.id).toBeTruthy()

    const readiness = await auth(request(app).get(`${mfg(fx.slug)}/warehouse-mappings/readiness`))
    expect(readiness.status).toBe(200)

    const resolve = await auth(request(app).get(`${mfg(fx.slug)}/warehouse-mappings/resolve`))
    expect(resolve.status).toBe(200)
  })

  it('exposes store workbench summary and queue endpoints', async () => {
    for (const path of [
      '/store-workbench/summary',
      '/store-workbench/reservations',
      '/store-workbench/issues',
      '/store-workbench/returns',
      '/store-workbench/wip',
      '/store-workbench/finished-goods',
      '/store-workbench/reconciliation',
    ]) {
      const res = await auth(request(app).get(`${mfg(fx.slug)}${path}`))
      expect(res.status).toBe(200)
    }
    const summary = await auth(request(app).get(`${mfg(fx.slug)}/store-workbench/summary`))
    expect(summary.body?.data?.kpis).toBeTruthy()
  })

  it('returns material position, reconciliation, wip, fg eligibility, close readiness', async () => {
    const position = await auth(
      request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/materials/position`),
    )
    expect(position.status).toBe(200)
    expect(Array.isArray(position.body?.data?.lines)).toBe(true)

    const recon = await auth(
      request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/materials/reconciliation`),
    )
    expect(recon.status).toBe(200)
    expect(recon.body?.data?.closePolicy?.policy).toBeTruthy()

    const wip = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/wip-position`))
    expect(wip.status).toBe(200)

    const fg = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/fg-eligibility`))
    expect(fg.status).toBe(200)
    expect(fg.body?.data?.eligibleQuantity).toBeDefined()

    const close = await auth(
      request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/close-readiness`),
    )
    expect(close.status).toBe(200)
    expect(typeof close.body?.data?.readyToClose).toBe('boolean')
    expect(Array.isArray(close.body?.data?.checks)).toBe(true)
  })

  it('rejects cross-tenant warehouse on mapping create', async () => {
    const other = await createManufacturingAdminTenant(app, 'mfg-p7a-x')
    const otherFx = await bootstrapManufacturingFixture({
      tenantId: other.tenantId,
      slug: other.slug,
      token: other.token,
      userId: other.userId,
    })
    try {
      const res = await auth(
        request(app).post(`${mfg(fx.slug)}/warehouse-mappings`).send({
          rawMaterialWarehouseId: otherFx.warehouseId,
          finishedGoodsWarehouseId: fx.warehouseId,
          isDefault: false,
          isActive: true,
        }),
      )
      expect(res.status).toBeGreaterThanOrEqual(400)
    } finally {
      await cleanupTenant(other.tenantId)
    }
  })
})
