/**
 * Quality Phase 4A — inspections, NCRs, production hold/blocker enforcement.
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
  type ProductionReadySetup,
} from './manufacturing/helpers/production-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const QUALITY_PERMS = PERMISSIONS.filter((p) => p.startsWith('quality.')) as PermissionName[]
const TEST_PERMS = [...MANUFACTURING_PERMS, ...QUALITY_PERMS] as PermissionName[]

function mfg(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

function quality(slug: string) {
  return `/api/v1/t/${slug}/quality`
}

describe.skipIf(!dbAvailable)('Quality Phase 4A — inspections + NCR + WO blockers', () => {
  let fx: ManufacturingFixture
  let setup: ProductionReadySetup
  let token: string
  let viewOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'qc-4a')
    fx = await bootstrapManufacturingFixture(ctx)
    setup = await buildProductionReadySetup(app, fx)

    await prisma.manufacturingStageGroup.update({
      where: { id: setup.stage1Id, tenantId: fx.tenantId },
      data: { qualityRequired: true },
    })

    const fullUser = await createUserWithPerms(app, fx.tenantId, fx.slug, TEST_PERMS, 'qc-full')
    token = fullUser.token

    const viewUser = await createUserWithPerms(app, fx.tenantId, fx.slug, ['quality.view'] as PermissionName[], 'qc-view')
    viewOnlyToken = viewUser.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupProductionData(fx.tenantId)
      await prisma.qualityNcr.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityInspection.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupTenant(fx.tenantId)
    }
  })

  function auth(req: request.Test, t: string = token) {
    return req.set('Authorization', `Bearer ${t}`)
  }

  async function createReleasedStartedWo(plannedQuantity = 10) {
    const wo = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders`)
        .send({
          productItemId: fx.itemId,
          plannedQuantity,
          requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
    )
    expect(wo.status).toBe(201)
    const orderId = wo.body.data.id as string
    await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/release`))
    await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/start`).send({}))
    const detail = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}/detail`))
    const stages = detail.body.data.stages as Array<{ id: string; sourceStageGroupId: string; status: string }>
    const stage1 = stages.find((s) => s.sourceStageGroupId === setup.stage1Id)!
    return { orderId, stage1, stages, orderNumber: wo.body.data.orderNumber as string }
  }

  it('completing a qualityRequired stage sets QC_PENDING and creates IN_PROCESS inspection', async () => {
    const { orderId, stage1 } = await createReleasedStartedWo()

    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/progress`)
        .send({ stageId: stage1.id, goodQuantity: 10 }),
    )

    const complete = await auth(
      request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage1.id }),
    )
    expect(complete.status).toBe(200)
    expect(complete.body.data.awaitingQuality).toBe(true)
    expect(complete.body.data.stage.status).toBe('QC_PENDING')
    expect(complete.body.data.inspection.category).toBe('IN_PROCESS')
    expect(complete.body.data.inspection.status).toBe('PENDING')
    expect(complete.body.data.promotedStages ?? []).toHaveLength(0)

    const dup = await auth(
      request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage1.id }),
    )
    expect(dup.status).toBeGreaterThanOrEqual(400)
    expect(dup.status).toBeLessThan(500)
  }, 45_000)

  it('PASS on IN_PROCESS inspection completes stage and promotes successor', async () => {
    const { orderId, stage1, stages } = await createReleasedStartedWo()

    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/progress`)
        .send({ stageId: stage1.id, goodQuantity: 10 }),
    )
    const complete = await auth(
      request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage1.id }),
    )
    const inspectionId = complete.body.data.inspection.id as string

    const pass = await auth(
      request(app).post(`${quality(fx.slug)}/inspections/${inspectionId}/decide`).send({ decision: 'PASS' }),
    )
    expect(pass.status).toBe(200)
    expect(pass.body.data.inspection.status).toBe('PASSED')

    const detail = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}/detail`))
    const stage1After = detail.body.data.stages.find((s: { id: string }) => s.id === stage1.id)
    expect(stage1After.status).toBe('COMPLETED')
    const stage3 = detail.body.data.stages.find((s: { sourceStageGroupId: string }) => s.sourceStageGroupId === setup.stage3Id)
    expect(stage3.status).toBe('NOT_STARTED')
  }, 45_000)

  it('REJECT creates NCR and blocks work order completion', async () => {
    const { orderId, stage1 } = await createReleasedStartedWo(5)

    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/progress`)
        .send({ stageId: stage1.id, goodQuantity: 5 }),
    )
    const complete = await auth(
      request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage1.id }),
    )
    const inspectionId = complete.body.data.inspection.id as string

    const reject = await auth(
      request(app)
        .post(`${quality(fx.slug)}/inspections/${inspectionId}/decide`).send({ decision: 'REJECT', severity: 'MAJOR' }),
    )
    expect(reject.status).toBe(200)
    expect(reject.body.data.ncr.ncrNumber).toMatch(/^NCR-/)

    const blockers = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}/quality-blockers`))
    expect(blockers.status).toBe(200)
    expect(blockers.body.data.blockers.some((b: { code: string }) => b.code === 'OPEN_NCR')).toBe(true)
  }, 45_000)

  it('blocks WO complete until FINAL PASS when product qcRequired', async () => {
    await prisma.masterItem.update({ where: { id: fx.itemId }, data: { qcRequired: true } })

    const { orderId, stage1, stages } = await createReleasedStartedWo(4)
    const stage2 = stages.find((s) => s.sourceStageGroupId === setup.stage2Id)!
    const stage3 = stages.find((s) => s.sourceStageGroupId === setup.stage3Id)!

    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/progress`)
        .send({ stageId: stage1.id, goodQuantity: 4 }),
    )
    const complete1 = await auth(
      request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage1.id }),
    )
    await auth(
      request(app)
        .post(`${quality(fx.slug)}/inspections/${complete1.body.data.inspection.id}/decide`)
        .send({ decision: 'PASS' }),
    )

    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/progress`)
        .send({ stageId: stage2.id, goodQuantity: 4 }),
    )
    await auth(
      request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage2.id }),
    )

    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/progress`)
        .send({ stageId: stage3.id, goodQuantity: 4 }),
    )
    await auth(
      request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage3.id }),
    )

    const blocked = await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/complete`).send({}))
    expect(blocked.status).toBe(400)
    expect(blocked.body.message).toMatch(/FINAL quality inspection/i)

    const finalInsp = await auth(
      request(app)
        .post(`${quality(fx.slug)}/inspections`)
        .send({ category: 'FINAL', productionOrderId: orderId }),
    )
    expect(finalInsp.status).toBe(201)

    await auth(
      request(app)
        .post(`${quality(fx.slug)}/inspections/${finalInsp.body.data.id}/decide`)
        .send({ decision: 'PASS' }),
    )

    const completed = await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/complete`).send({}))
    expect(completed.status).toBe(200)
    expect(completed.body.data.order.qualityStatus).toBe('PASSED')
    expect(completed.body.data.warnings).not.toContain('QUALITY_INTEGRATION_PENDING')

    await prisma.masterItem.update({ where: { id: fx.itemId }, data: { qcRequired: false } })
  }, 120_000)

  it('enforces tenant isolation and 403 without submit permission', async () => {
    const list = await auth(request(app).get(`${quality(fx.slug)}/inspections`), viewOnlyToken)
    expect(list.status).toBe(200)

    const { orderId, stage1 } = await createReleasedStartedWo(3)
    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/progress`)
        .send({ stageId: stage1.id, goodQuantity: 3 }),
    )
    const complete = await auth(
      request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage1.id }),
    )
    const inspectionId = complete.body.data.inspection.id as string

    const forbidden = await auth(
      request(app).post(`${quality(fx.slug)}/inspections/${inspectionId}/decide`).send({ decision: 'PASS' }),
      viewOnlyToken,
    )
    expect(forbidden.status).toBe(403)

    const otherCtx = await createManufacturingAdminTenant(app, 'qc-other')
    const otherFx = await bootstrapManufacturingFixture(otherCtx)
    const otherViewer = await createUserWithPerms(app, otherFx.tenantId, otherFx.slug, ['quality.view'], 'qc-other-view')
    const cross = await request(app)
      .get(`${quality(otherFx.slug)}/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${otherViewer.token}`)
    expect(cross.status).toBe(404)
    await cleanupProductionData(otherFx.tenantId)
    await cleanupTenant(otherFx.tenantId)
  }, 60_000)
})
