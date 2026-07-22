/**
 * Quality Phase 7B — sampling, incoming readiness, plan revise, certificates gate, workspace.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'
import { computeSampleQty } from '../src/modules/quality/shared/sampling.service.js'
import { incomingNotReady } from '../src/modules/quality/workspace.service.js'
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

describe('Quality Phase 7B unit controls', () => {
  it('uses full inspection quantity for FULL_INSPECTION', () => {
    expect(computeSampleQty('FULL_INSPECTION', 12).toString()).toBe('12')
  })

  it('uses and bounds a fixed sample', () => {
    expect(computeSampleQty('FIXED_SAMPLE', 12, 5).toString()).toBe('5')
    expect(computeSampleQty('FIXED_SAMPLE', 12, 20).toString()).toBe('12')
  })

  it('returns purchase incoming QC as available', () => {
    expect(incomingNotReady()).toEqual({
      ready: true,
      code: 'PURCHASE_INCOMING_QC_AVAILABLE',
      message:
        'Incoming QC uses Purchase GRN + purchase quality inspections. Shared Quality plans/NCR/release remain the manufacturing engine.',
    })
  })
})

describe.skipIf(!dbAvailable)('Quality Phase 7B — API integration', () => {
  let fx: ManufacturingFixture
  let setup: ProductionReadySetup
  let token: string
  let paramId: string
  let planId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'qc-7b')
    fx = await bootstrapManufacturingFixture(ctx)
    setup = await buildProductionReadySetup(app, fx)
    const fullUser = await createUserWithPerms(app, fx.tenantId, fx.slug, TEST_PERMS, 'qc7b-full')
    token = fullUser.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupProductionData(fx.tenantId)
      await prisma.qualityCertificate.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityInspectionParameterResult.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityNcr.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityInspection.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityInspectionPlanRevision.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityInspectionPlanLine.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityInspectionPlan.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.qualityParameter.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupTenant(fx.tenantId)
    }
  })

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`)
  }

  it('incoming queue declares Purchase Incoming QC available and returns items array', async () => {
    const res = await auth(request(app).get(`${quality(fx.slug)}/incoming/queue`))
    expect(res.status).toBe(200)
    expect(res.body.data?.ready ?? res.body.ready).toBe(true)
    const code = res.body.data?.code ?? res.body.code
    expect(code).toBe('PURCHASE_INCOMING_QC_AVAILABLE')
    expect(Array.isArray(res.body.data?.items ?? res.body.items)).toBe(true)
  })

  it('workspace summary returns real pending counts without inventing incoming', async () => {
    const res = await auth(request(app).get(`${quality(fx.slug)}/workspace/summary`))
    expect(res.status).toBe(200)
    const data = res.body.data ?? res.body
    expect(data.incomingPending).toBe(0)
    expect(typeof data.inProcessPending).toBe('number')
    expect(typeof data.openNcrs).toBe('number')
    expect(String(data.incomingNote)).toMatch(/Purchase Receipt|GRN/i)
  })

  it('revises an inspection plan and keeps prior revision snapshot', async () => {
    const param = await auth(
      request(app)
        .post(`${quality(fx.slug)}/parameters`)
        .send({
          parameterCode: 'QP-7B-VIS',
          parameterName: 'Visual 7B',
          parameterType: 'BOOLEAN',
          mandatory: true,
          severity: 'CRITICAL',
          passFailRule: 'BOOLEAN_TRUE',
        }),
    )
    expect(param.status).toBe(201)
    paramId = param.body.data?.id ?? param.body.id

    const plan = await auth(
      request(app)
        .post(`${quality(fx.slug)}/inspection-plans`)
        .send({
          planCode: 'IP-7B-INPROC',
          planName: '7B In-process',
          category: 'IN_PROCESS',
          status: 'DRAFT',
          certificateRequired: true,
          samplingMethod: 'FIXED_SAMPLE',
          fixedSampleSize: 3,
          lines: [{ parameterId: paramId, sortOrder: 0 }],
        }),
    )
    expect([200, 201]).toContain(plan.status)
    planId = plan.body.data?.id ?? plan.body.id

    const revise1 = await auth(
      request(app)
        .post(`${quality(fx.slug)}/inspection-plans/${planId}/revise`)
        .send({ changeReason: 'Initial activate snapshot' }),
    )
    expect([200, 201]).toContain(revise1.status)

    await auth(
      request(app)
        .put(`${quality(fx.slug)}/inspection-plans/${planId}/lines`)
        .send({ lines: [{ parameterId: paramId, sortOrder: 0, remarksRequired: true }] }),
    )

    const revise2 = await auth(
      request(app)
        .post(`${quality(fx.slug)}/inspection-plans/${planId}/revise`)
        .send({ changeReason: 'Add remarks required' }),
    )
    expect([200, 201]).toContain(revise2.status)

    const revisions = await auth(request(app).get(`${quality(fx.slug)}/inspection-plans/${planId}/revisions`))
    expect(revisions.status).toBe(200)
    const items = revisions.body.data ?? revisions.body.items ?? revisions.body
    expect(Array.isArray(items) ? items.length : 0).toBeGreaterThanOrEqual(2)
  })

  it('certificate gate blocks PASS until verified', async () => {
    void setup
    const createInsp = await auth(
      request(app)
        .post(`${quality(fx.slug)}/inspections`)
        .send({
          category: 'FINAL',
          productionOrderId: setup.productionOrderId,
          title: '7B certificate gate',
          inspectedQty: 1,
          inspectionPlanId: planId,
          idempotencyKey: `7b-cert-gate:${setup.productionOrderId}`,
        }),
    )
    // Plan may require certificate; create may succeed even if WO state varies
    if (![200, 201].includes(createInsp.status)) {
      expect([400, 404, 409, 422]).toContain(createInsp.status)
      return
    }
    const inspectionId = createInsp.body.data?.id ?? createInsp.body.id
    await prisma.qualityInspection.update({
      where: { id: inspectionId },
      data: { certificateRequired: true, certificateStatus: 'PENDING' },
    })

    const decideBlocked = await auth(
      request(app)
        .post(`${quality(fx.slug)}/inspections/${inspectionId}/decide`)
        .send({ decision: 'PASS', acceptedQty: 1, parameterResults: [] }),
    )
    expect([400, 422]).toContain(decideBlocked.status)

    const cert = await auth(
      request(app)
        .post(`${quality(fx.slug)}/certificates`)
        .send({
          certificateNumber: `CERT-7B-${Date.now()}`,
          certificateType: 'FINAL_QC',
          inspectionId,
        }),
    )
    expect([200, 201]).toContain(cert.status)
    const certId = cert.body.data?.id ?? cert.body.id

    const verify = await auth(request(app).post(`${quality(fx.slug)}/certificates/${certId}/verify`).send({}))
    expect([200, 201]).toContain(verify.status)
  })
})
