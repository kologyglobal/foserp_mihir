/**
 * Quality Phase 4B — parameters, inspection plans, snapshot + decide gating.
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

function quality(slug: string) {
  return `/api/v1/t/${slug}/quality`
}

function mfg(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

describe.skipIf(!dbAvailable)('Quality Phase 4B — parameters + inspection plans', () => {
  let fx: ManufacturingFixture
  let setup: ProductionReadySetup
  let token: string
  let paramId: string
  let planId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'qc-4b')
    fx = await bootstrapManufacturingFixture(ctx)
    setup = await buildProductionReadySetup(app, fx)

    await prisma.manufacturingStageGroup.update({
      where: { id: setup.stage1Id, tenantId: fx.tenantId },
      data: { qualityRequired: true },
    })

    const fullUser = await createUserWithPerms(app, fx.tenantId, fx.slug, TEST_PERMS, 'qc4b-full')
    token = fullUser.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupProductionData(fx.tenantId)
      await prisma.qualityInspectionParameterResult.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityNcr.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityInspection.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityInspectionPlanLine.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityInspectionPlan.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityParameter.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupTenant(fx.tenantId)
    }
  })

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`)
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
    return { orderId, stage1 }
  }

  it('creates QC parameter', async () => {
    const res = await auth(request(app).post(`${quality(fx.slug)}/parameters`)).send({
      parameterCode: 'qp-fit',
      parameterName: 'Fit check',
      parameterType: 'BOOLEAN',
      mandatory: true,
      severity: 'MAJOR',
      passFailRule: 'BOOLEAN_TRUE',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.parameterCode).toBe('QP-FIT')
    paramId = res.body.data.id
  })

  it('creates and activates inspection plan with lines', async () => {
    const res = await auth(request(app).post(`${quality(fx.slug)}/inspection-plans`)).send({
      planCode: 'ip-stage',
      planName: 'Stage in-process plan',
      category: 'IN_PROCESS',
      status: 'ACTIVE',
      itemId: fx.itemId,
      lines: [{ parameterId: paramId, sortOrder: 0 }],
    })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('ACTIVE')
    expect(res.body.data.lines).toHaveLength(1)
    planId = res.body.data.id

    await prisma.manufacturingProfile.updateMany({
      where: { tenantId: fx.tenantId },
      data: { defaultQualityPlanRef: 'IP-STAGE' },
    })
  })

  it('lists parameters and plans', async () => {
    const params = await auth(request(app).get(`${quality(fx.slug)}/parameters`))
    expect(params.status).toBe(200)
    expect(params.body.data.length).toBeGreaterThanOrEqual(1)

    const plans = await auth(request(app).get(`${quality(fx.slug)}/inspection-plans?status=ACTIVE`))
    expect(plans.status).toBe(200)
    expect(plans.body.data.some((p: { id: string }) => p.id === planId)).toBe(true)
  })

  it('stage QC inspection snapshots plan; PASS blocked without results; PASS with results', async () => {
    const { orderId, stage1 } = await createReleasedStartedWo(5)

    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/progress`)
        .send({ stageId: stage1.id, goodQuantity: 5 }),
    )

    const complete = await auth(
      request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage1.id }),
    )
    expect(complete.status).toBe(200)
    expect(complete.body.data.awaitingQuality).toBe(true)

    const inspectionId = complete.body.data.inspection.id as string
    const detail = await auth(request(app).get(`${quality(fx.slug)}/inspections/${inspectionId}`))
    expect(detail.status).toBe(200)
    expect(detail.body.data.inspectionPlanId).toBe(planId)
    expect(Array.isArray(detail.body.data.parameterSnapshot)).toBe(true)
    expect(detail.body.data.parameterSnapshot.length).toBeGreaterThanOrEqual(1)
    expect(detail.body.data.inspectionPlan?.planCode).toBe('IP-STAGE')

    const blocked = await auth(request(app).post(`${quality(fx.slug)}/inspections/${inspectionId}/decide`)).send({
      decision: 'PASS',
      acceptedQty: 5,
    })
    expect(blocked.status).toBe(400)

    const passed = await auth(request(app).post(`${quality(fx.slug)}/inspections/${inspectionId}/decide`)).send({
      decision: 'PASS',
      acceptedQty: 5,
      parameterResults: [{ parameterId: paramId, measuredValue: 'true', passed: true }],
    })
    expect(passed.status).toBe(200)
    expect(passed.body.data.inspection.status).toBe('PASSED')
    expect(passed.body.data.inspection.parameterResults?.length).toBeGreaterThanOrEqual(1)
  }, 60_000)

  it('deactivates parameter and plan', async () => {
    const p = await auth(request(app).post(`${quality(fx.slug)}/parameters/${paramId}/deactivate`))
    expect(p.status).toBe(200)
    expect(p.body.data.active).toBe(false)

    const plan = await auth(request(app).post(`${quality(fx.slug)}/inspection-plans/${planId}/deactivate`))
    expect(plan.status).toBe(200)
    expect(plan.body.data.status).toBe('INACTIVE')
  })
})
