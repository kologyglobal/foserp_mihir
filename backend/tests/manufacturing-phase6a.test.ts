/**
 * Manufacturing Phase 6A — Production Planning workbench.
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

const PHASE6A_PERMS = Array.from(
  new Set([
    ...MANUFACTURING_PERMS,
    'manufacturing.production_plan.view',
    'manufacturing.production_plan.create',
    'manufacturing.production_plan.edit',
    'manufacturing.production_plan.release',
    'manufacturing.production_plan.close',
    'manufacturing.production_plan.create_work_order',
    ...PERMISSIONS.filter((p) => p.startsWith('inventory.')),
  ]),
) as PermissionName[]

function mfg(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 6A — Production plans', () => {
  let fx: ManufacturingFixture
  let token: string
  let viewOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p6a')
    const full = await createUserWithPerms(app, ctx.tenantId, ctx.slug, PHASE6A_PERMS, 'p6a-full')
    fx = await bootstrapManufacturingFixture({
      tenantId: ctx.tenantId,
      slug: ctx.slug,
      token: full.token,
      userId: full.userId,
    })
    token = full.token
    await buildProductionReadySetup(app, fx)

    const viewOnly = await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['manufacturing.work_orders.view'] as PermissionName[],
      'p6a-view',
    )
    viewOnlyToken = viewOnly.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await prisma.productionPlanLine.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.productionPlan.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
  })

  function auth(req: request.Test, t: string = token) {
    return req.set('Authorization', `Bearer ${t}`)
  }

  it('creates, releases, nets, and generates draft WOs', async () => {
    const create = await auth(request(app).post(`${mfg(fx.slug)}/plans`)).send({
      planName: 'Week 30 Plan',
      planDate: '2026-07-20',
      sourceType: 'MANUAL',
      warehouseId: fx.warehouseId,
      periodFrom: '2026-07-20',
      periodTo: '2026-08-03',
      lines: [
        {
          productItemId: fx.itemId,
          demandQuantity: 5,
          requiredDate: '2026-08-01',
        },
      ],
    })
    expect(create.status).toBe(201)
    expect(create.body.data.status).toBe('DRAFT')
    expect(create.body.data.planNumber).toMatch(/^PP-/)
    const planId = create.body.data.id as string

    const forbidden = await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/release`), viewOnlyToken)
    expect(forbidden.status).toBe(403)

    const release = await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/release`))
    expect(release.status).toBe(200)
    expect(release.body.data.status).toBe('PLANNED')

    const netting = await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/preview-netting`))
    expect(netting.status).toBe(200)
    expect(netting.body.data.lines).toHaveLength(1)
    expect(Number(netting.body.data.lines[0].suggestedQuantity)).toBeGreaterThan(0)

    const gen = await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/generate-work-orders`)).send({})
    expect(gen.status).toBe(200)
    expect(gen.body.data.created).toHaveLength(1)
    expect(gen.body.data.plan.status).toBe('WORK_ORDERS_CREATED')
    expect(gen.body.data.created[0].orderNumber).toMatch(/^WO-/)

    const wo = await prisma.productionOrder.findFirst({
      where: { id: gen.body.data.created[0].productionOrderId, tenantId: fx.tenantId },
    })
    expect(wo?.sourceType).toBe('PRODUCTION_PLAN')
    expect(wo?.status).toBe('DRAFT')

    const close = await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/close`))
    expect(close.status).toBe(200)
    expect(close.body.data.status).toBe('CLOSED')
  }, 120_000)

  it('blocks generate on draft and cancel after WOs', async () => {
    const create = await auth(request(app).post(`${mfg(fx.slug)}/plans`)).send({
      planName: 'Guard Plan',
      planDate: '2026-07-21',
      sourceType: 'FORECAST',
      warehouseId: fx.warehouseId,
      lines: [{ productItemId: fx.itemId, demandQuantity: 50, requiredDate: '2026-08-10' }],
    })
    const planId = create.body.data.id as string

    const genDraft = await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/generate-work-orders`)).send({})
    expect([400, 422]).toContain(genDraft.status)

    await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/release`))
    await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/preview-netting`))
    const gen = await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/generate-work-orders`)).send({})
    expect(gen.status).toBe(200)
    expect(gen.body.data.created.length).toBeGreaterThanOrEqual(1)

    const cancel = await auth(request(app).post(`${mfg(fx.slug)}/plans/${planId}/cancel`)).send({
      reason: 'Should fail',
    })
    expect([400, 422]).toContain(cancel.status)
  }, 120_000)

  it('lists plans with tenant isolation', async () => {
    const list = await auth(request(app).get(`${mfg(fx.slug)}/plans`))
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.data)).toBe(true)
    expect(list.body.data.length).toBeGreaterThanOrEqual(1)
  })
})
