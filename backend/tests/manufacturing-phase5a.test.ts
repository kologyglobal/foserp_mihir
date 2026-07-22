/**
 * Manufacturing Phase 5A — Work Order runtime changes.
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

const PHASE5A_PERMS = Array.from(
  new Set([
    ...MANUFACTURING_PERMS,
    ...PERMISSIONS.filter((p) => p.startsWith('manufacturing.runtime_change.')),
    ...PERMISSIONS.filter((p) => p.startsWith('inventory.')),
    ...PERMISSIONS.filter((p) => p.startsWith('quality.')),
    ...PERMISSIONS.filter((p) => p.startsWith('manufacturing.job_work.')),
  ]),
) as PermissionName[]

function mfg(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 5A — runtime changes', () => {
  let fx: ManufacturingFixture
  let setup: ProductionReadySetup
  let token: string
  let viewOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p5a')
    const full = await createUserWithPerms(app, ctx.tenantId, ctx.slug, PHASE5A_PERMS, 'p5a-full')
    fx = await bootstrapManufacturingFixture({
      tenantId: ctx.tenantId,
      slug: ctx.slug,
      token: full.token,
      userId: full.userId,
    })
    token = full.token
    setup = await buildProductionReadySetup(app, fx)
    const viewOnly = await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['manufacturing.work_orders.view', 'manufacturing.runtime_change.view'] as PermissionName[],
      'p5a-view',
    )
    viewOnlyToken = viewOnly.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await prisma.productionRuntimeChange.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.manufacturingRuntimeChangeRule.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.jobWorkMaterialLine.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.jobWorkOrder.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
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

  function rcBase(orderId: string) {
    return `${mfg(fx.slug)}/work-orders/${orderId}/runtime-changes`
  }

  it('creates draft priority change, submits (low risk), applies', async () => {
    const orderId = await createStartedWo()
    const draft = await auth(
      request(app)
        .post(rcBase(orderId))
        .send({
          changeType: 'PRIORITY_CHANGE',
          reason: 'Customer escalation',
          proposedValue: { priority: 'HIGH' },
          idempotencyKey: `p5a-pri-${orderId}`,
        }),
    )
    expect(draft.status).toBe(201)
    expect(draft.body.data.status).toBe('DRAFT')
    expect(draft.body.data.changeNumber).toMatch(/^RC/)

    const submit = await auth(request(app).post(`${rcBase(orderId)}/${draft.body.data.id}/submit`))
    expect(submit.status).toBe(200)
    // Low-risk default → APPROVED on submit
    expect(['APPROVED', 'PENDING_APPROVAL']).toContain(submit.body.data.status)

    const changeId = draft.body.data.id as string
    if (submit.body.data.status === 'PENDING_APPROVAL') {
      const approved = await auth(request(app).post(`${rcBase(orderId)}/${changeId}/approve`).send({}))
      expect(approved.status).toBe(200)
    }

    const apply = await auth(request(app).post(`${rcBase(orderId)}/${changeId}/apply`).send({}))
    expect(apply.status).toBe(200)
    expect(apply.body.data.status).toBe('APPLIED')

    const header = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}`))
    expect(header.body.data.priority).toBe('HIGH')

    const dup = await auth(request(app).post(`${rcBase(orderId)}/${changeId}/apply`).send({}))
    expect(dup.status).toBeGreaterThanOrEqual(400)
  }, 60_000)

  it('blocks quantity below completed good quantity', async () => {
    const orderId = await createStartedWo(10)
    // Header completedGoodQuantity only rolls up from the final stage; set it
    // directly so this test isolates runtime-change validation (not the full
    // stage pipeline).
    await prisma.productionOrder.update({
      where: { id: orderId },
      data: { completedGoodQuantity: 4, completionPercent: 40 },
    })

    const preview = await auth(
      request(app)
        .post(`${rcBase(orderId)}/preview`)
        .send({
          changeType: 'QUANTITY_CHANGE',
          proposedValue: { plannedQuantity: 2 },
        }),
    )
    expect(preview.status).toBeGreaterThanOrEqual(400)

    const create = await auth(
      request(app)
        .post(rcBase(orderId))
        .send({
          changeType: 'QUANTITY_CHANGE',
          reason: 'Cut demand',
          proposedValue: { plannedQuantity: 2 },
        }),
    )
    expect(create.status).toBeGreaterThanOrEqual(400)
  }, 60_000)

  it('increases planned quantity without rewriting completed qty', async () => {
    const orderId = await createStartedWo(10)
    const detailBefore = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}`))
    const completedBefore = String(detailBefore.body.data.completedGoodQuantity ?? '0')

    const draft = await auth(
      request(app)
        .post(rcBase(orderId))
        .send({
          changeType: 'QUANTITY_CHANGE',
          reason: 'Extra demand',
          proposedValue: { plannedQuantity: 12 },
        }),
    )
    expect(draft.status).toBe(201)
    await auth(request(app).post(`${rcBase(orderId)}/${draft.body.data.id}/submit`))
    let change = (
      await auth(request(app).get(`${rcBase(orderId)}/${draft.body.data.id}`))
    ).body.data
    if (change.status === 'PENDING_APPROVAL') {
      await auth(request(app).post(`${rcBase(orderId)}/${change.id}/approve`).send({}))
    }
    const apply = await auth(request(app).post(`${rcBase(orderId)}/${draft.body.data.id}/apply`).send({}))
    expect(apply.status).toBe(200)

    const after = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}`))
    expect(Number(after.body.data.plannedQuantity)).toBe(12)
    expect(String(after.body.data.completedGoodQuantity ?? '0')).toBe(completedBefore)
  }, 60_000)

  it('stage hold does not place whole WO on hold', async () => {
    const orderId = await createStartedWo()
    const detail = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}/detail`))
    const stage = (detail.body.data.stages as Array<{ id: string }>)[0]

    const draft = await auth(
      request(app)
        .post(rcBase(orderId))
        .send({
          changeType: 'STAGE_HOLD',
          stageId: stage.id,
          reason: 'Fixture missing',
          proposedValue: { remarks: 'Waiting fixture' },
        }),
    )
    expect(draft.status).toBe(201)
    await auth(request(app).post(`${rcBase(orderId)}/${draft.body.data.id}/submit`))
    let change = (await auth(request(app).get(`${rcBase(orderId)}/${draft.body.data.id}`))).body.data
    if (change.status === 'PENDING_APPROVAL') {
      await auth(request(app).post(`${rcBase(orderId)}/${change.id}/approve`).send({}))
    }
    const apply = await auth(request(app).post(`${rcBase(orderId)}/${draft.body.data.id}/apply`).send({}))
    expect(apply.status).toBe(200)

    const wo = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}`))
    expect(wo.body.data.status).not.toBe('ON_HOLD')
    const detailAfter = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}/detail`))
    const held = (detailAfter.body.data.stages as Array<{ id: string; status: string }>).find((s) => s.id === stage.id)
    expect(['ON_HOLD', 'BLOCKED']).toContain(held?.status)
  }, 60_000)

  it('view-only user cannot create runtime changes', async () => {
    const orderId = await createStartedWo()
    const res = await auth(
      request(app)
        .post(rcBase(orderId))
        .send({
          changeType: 'PRIORITY_CHANGE',
          reason: 'Nope',
          proposedValue: { priority: 'URGENT' },
        }),
      viewOnlyToken,
    )
    expect(res.status).toBe(403)
  }, 45_000)

  it('convert remaining operation to job work creates JW draft only', async () => {
    const orderId = await createStartedWo()
    const detail = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}/detail`))
    const op = (detail.body.data.operations as Array<{ id: string; status: string }>)[0]
    expect(op).toBeTruthy()

    const draft = await auth(
      request(app)
        .post(rcBase(orderId))
        .send({
          changeType: 'CONVERT_TO_JOB_WORK',
          operationId: op.id,
          reason: 'Capacity overflow',
          proposedValue: {
            vendorId: fx.vendorId,
            processName: 'Outsourced machining',
            itemId: fx.itemId,
            orderedQty: 5,
            rate: 100,
            rateBasis: 'PER_PIECE',
            materialWarehouseId: fx.warehouseId,
            receiptWarehouseId: fx.warehouseId,
            materialLines: [{ itemId: fx.subComponentItemId, requiredQty: 5 }],
          },
        }),
    )
    expect(draft.status).toBe(201)
    const submit = await auth(request(app).post(`${rcBase(orderId)}/${draft.body.data.id}/submit`))
    expect(submit.status).toBe(200)
    expect(submit.body.data.status).toBe('PENDING_APPROVAL')

    const approved = await auth(
      request(app).post(`${rcBase(orderId)}/${draft.body.data.id}/approve`).send({ remarks: 'OK' }),
    )
    expect(approved.status).toBe(200)

    const apply = await auth(request(app).post(`${rcBase(orderId)}/${draft.body.data.id}/apply`).send({}))
    expect(apply.status).toBe(200)
    expect(apply.body.data.status).toBe('APPLIED')
    expect(apply.body.data.jobWorkOrderId).toBeTruthy()

    const jw = await auth(request(app).get(`${mfg(fx.slug)}/job-work/${apply.body.data.jobWorkOrderId}`))
    expect(jw.status).toBe(200)
    expect(jw.body.data.status).toBe('DRAFT')

    const movements = await prisma.inventoryStockMovement.count({
      where: { tenantId: fx.tenantId, referenceType: 'SUBCON_OUT' },
    })
    expect(movements).toBe(0)
  }, 90_000)
})
