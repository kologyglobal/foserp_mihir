import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createManufacturingAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'
import {
  buildProductionReadySetup,
  cleanupProductionData,
  createProductionCapableToken,
  type ProductionReadySetup,
} from './manufacturing/helpers/production-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

function base(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

const OPERATOR_PERMS = [
  'manufacturing.view',
  'manufacturing.operator.my_work',
  'manufacturing.operator.start',
  'manufacturing.operator.pause',
  'manufacturing.operator.complete',
  'manufacturing.issue.report',
  'manufacturing.issue.view',
  'manufacturing.downtime.view',
  'master.item.view',
] as const

describe.skipIf(!dbAvailable)('Manufacturing Phase 2B — assignments, daily production, issues', () => {
  let fx: ManufacturingFixture
  let setup: ProductionReadySetup
  let orderId: string
  let stage1Id: string
  let op1Id: string
  let machineId: string
  let workCentreId: string
  let operatorUserId: string
  let operatorToken: string
  let otherOperatorToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p2b')
    fx = await bootstrapManufacturingFixture(ctx)
    setup = await buildProductionReadySetup(app, fx)

    const operator = await createUserWithPerms(app, fx.tenantId, fx.slug, [...OPERATOR_PERMS], 'operator')
    operatorUserId = operator.userId
    operatorToken = operator.token
    const otherOperator = await createUserWithPerms(app, fx.tenantId, fx.slug, [...OPERATOR_PERMS], 'operator2')
    otherOperatorToken = otherOperator.token

    const wc = await request(app)
      .post(`${base(fx.slug)}/work-centres`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ code: `WC-${Date.now()}`, name: 'Cutting WC' })
    workCentreId = wc.body.data.id as string

    const machine = await request(app)
      .post(`${base(fx.slug)}/machines`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ code: `MC-${Date.now()}`, name: 'Cutting Machine', workCentreId })
    machineId = machine.body.data.id as string

    const wo = await request(app)
      .post(`${base(fx.slug)}/work-orders`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        productItemId: fx.itemId,
        plannedQuantity: 10,
        requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    orderId = wo.body.data.id as string
    await request(app).post(`${base(fx.slug)}/work-orders/${orderId}/release`).set('Authorization', `Bearer ${fx.token}`)
    await request(app).post(`${base(fx.slug)}/work-orders/${orderId}/start`).set('Authorization', `Bearer ${fx.token}`).send({})

    const detail = await request(app)
      .get(`${base(fx.slug)}/work-orders/${orderId}/detail`)
      .set('Authorization', `Bearer ${fx.token}`)
    const stages = detail.body.data.stages as Array<{ id: string; sourceStageGroupId: string }>
    stage1Id = stages.find((s) => s.sourceStageGroupId === setup.stage1Id)!.id
    const ops = detail.body.data.operations as Array<{ id: string; sourceOperationId: string }>
    op1Id = ops.find((o) => o.sourceOperationId === setup.op1Id)!.id
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
  })

  function admin(req: request.Test) {
    return req.set('Authorization', `Bearer ${fx.token}`)
  }

  function operator(req: request.Test) {
    return req.set('Authorization', `Bearer ${operatorToken}`)
  }

  it('assigns operator + machine and rejects OUT_OF_SERVICE machine', async () => {
    await admin(
      request(app).post(`${base(fx.slug)}/machines/${machineId}/status`).send({ status: 'OUT_OF_SERVICE' }),
    ).expect(200)

    const rejected = await admin(
      request(app)
        .post(`${base(fx.slug)}/assignments`)
        .send({
          productionOrderId: orderId,
          stageId: stage1Id,
          operationId: op1Id,
          userId: operatorUserId,
          machineId,
          assignmentDate: new Date().toISOString().slice(0, 10),
          assignedQuantity: 5,
          shiftCode: 'A',
        }),
    )
    expect(rejected.status).toBe(422)

    await admin(
      request(app).post(`${base(fx.slug)}/machines/${machineId}/status`).send({ status: 'AVAILABLE' }),
    ).expect(200)

    const created = await admin(
      request(app)
        .post(`${base(fx.slug)}/assignments`)
        .send({
          productionOrderId: orderId,
          stageId: stage1Id,
          operationId: op1Id,
          userId: operatorUserId,
          machineId,
          assignmentDate: new Date().toISOString().slice(0, 10),
          assignedQuantity: 5,
          shiftCode: 'A',
        }),
    )
    expect(created.status).toBe(201)
    expect(created.body.data.status).toBe('ASSIGNED')
  }, 30_000)

  it('reassignment preserves history chain', async () => {
    const list = await admin(request(app).get(`${base(fx.slug)}/work-orders/${orderId}/assignments`))
    const assignmentId = list.body.data[0].id as string

    const reassigned = await admin(
      request(app)
        .post(`${base(fx.slug)}/assignments/${assignmentId}/reassign`)
        .send({ userId: operatorUserId, assignedQuantity: 5, shiftCode: 'B', reason: 'Shift change' }),
    )
    expect(reassigned.status).toBe(200)
    const newId = reassigned.body.data.id as string

    const history = await admin(request(app).get(`${base(fx.slug)}/assignments/${newId}/history`))
    expect(history.status).toBe(200)
    expect(history.body.data.length).toBeGreaterThanOrEqual(2)
    expect(history.body.data.some((a: { id: string }) => a.id === assignmentId)).toBe(true)
  }, 30_000)

  it('my-work returns only own assignments for operator', async () => {
    const mine = await operator(request(app).get(`${base(fx.slug)}/my-work`))
    expect(mine.status).toBe(200)
    expect(mine.body.data.every((a: { userId: string }) => a.userId === operatorUserId)).toBe(true)
    expect(mine.body.data[0].allowedActions).toBeDefined()

    const otherView = await request(app)
      .get(`${base(fx.slug)}/my-work?userId=${operatorUserId}`)
      .set('Authorization', `Bearer ${otherOperatorToken}`)
    expect(otherView.status).toBe(403)
  }, 30_000)

  it('start/pause/resume/complete posts ledger and is idempotent on complete', async () => {
    const myWork = await operator(request(app).get(`${base(fx.slug)}/my-work`))
    const assignmentId = myWork.body.data.find((a: { status: string }) => a.status === 'ASSIGNED')?.id as string

    await operator(request(app).post(`${base(fx.slug)}/assignments/${assignmentId}/accept`)).expect(200)
    await operator(request(app).post(`${base(fx.slug)}/assignments/${assignmentId}/start`)).expect(200)

    const machineAfterStart = await prisma.manufacturingMachine.findFirst({ where: { id: machineId } })
    expect(machineAfterStart?.status).toBe('IN_USE')

    await operator(
      request(app)
        .post(`${base(fx.slug)}/assignments/${assignmentId}/pause`)
        .send({ reasonType: 'MACHINE_BREAKDOWN', startDowntime: true }),
    ).expect(200)

    await operator(request(app).post(`${base(fx.slug)}/assignments/${assignmentId}/resume`)).expect(200)

    const completeKey = `assign-complete-${Date.now()}`
    const complete1 = await operator(
      request(app)
        .post(`${base(fx.slug)}/assignments/${assignmentId}/complete`)
        .send({ goodQuantity: 3, idempotencyKey: completeKey }),
    )
    expect(complete1.status).toBe(200)

    const ledgerCount1 = await prisma.productionStageLedger.count({ where: { tenantId: fx.tenantId, idempotencyKey: completeKey } })
    expect(ledgerCount1).toBe(1)

    const complete2 = await operator(
      request(app)
        .post(`${base(fx.slug)}/assignments/${assignmentId}/complete`)
        .send({ goodQuantity: 3, idempotencyKey: completeKey }),
    )
    expect(complete2.status).toBe(200)

    const ledgerCount2 = await prisma.productionStageLedger.count({ where: { tenantId: fx.tenantId, idempotencyKey: completeKey } })
    expect(ledgerCount2).toBe(1)
  }, 30_000)

  it('daily draft multi-line atomic submit and duplicate submit blocked', async () => {
    const wo2 = await admin(
      request(app)
        .post(`${base(fx.slug)}/work-orders`)
        .send({
          productItemId: fx.itemId,
          plannedQuantity: 4,
          requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
    )
    const order2Id = wo2.body.data.id as string
    await admin(request(app).post(`${base(fx.slug)}/work-orders/${order2Id}/release`))
    await admin(request(app).post(`${base(fx.slug)}/work-orders/${order2Id}/start`).send({}))
    const detail2 = await admin(request(app).get(`${base(fx.slug)}/work-orders/${order2Id}/detail`))
    const stage2 = detail2.body.data.stages.find((s: { sourceStageGroupId: string }) => s.sourceStageGroupId === setup.stage1Id)!

    const batch = await admin(
      request(app)
        .post(`${base(fx.slug)}/daily-production`)
        .send({ productionDate: new Date().toISOString().slice(0, 10), shiftCode: 'A' }),
    )
    expect(batch.status).toBe(201)
    const batchId = batch.body.data.id as string

    await admin(
      request(app)
        .post(`${base(fx.slug)}/daily-production/${batchId}/lines`)
        .send({
          productionOrderId: orderId,
          stageId: stage1Id,
          goodQuantity: 1,
          idempotencyKey: `daily-${Date.now()}-1`,
        }),
    ).expect(201)

    await admin(
      request(app)
        .post(`${base(fx.slug)}/daily-production/${batchId}/lines`)
        .send({
          productionOrderId: order2Id,
          stageId: stage2.id,
          goodQuantity: 2,
          idempotencyKey: `daily-${Date.now()}-2`,
        }),
    ).expect(201)

    const submit = await admin(request(app).post(`${base(fx.slug)}/daily-production/${batchId}/submit`))
    expect(submit.status).toBe(200)
    expect(submit.body.data.batch.status).toBe('SUBMITTED')
    expect(submit.body.data.ledgerEntryIds).toHaveLength(2)

    const dupSubmit = await admin(request(app).post(`${base(fx.slug)}/daily-production/${batchId}/submit`))
    expect(dupSubmit.status).toBe(422)
  }, 30_000)

  it('report/acknowledge/resolve issue; blocking issue does not ON_HOLD work order', async () => {
    const reported = await operator(
      request(app)
        .post(`${base(fx.slug)}/issues`)
        .send({
          productionOrderId: orderId,
          stageId: stage1Id,
          issueType: 'MATERIAL_SHORTAGE',
          title: 'Missing steel sheet',
          productionBlocked: true,
          stageWideBlock: true,
          startDowntime: false,
        }),
    )
    expect(reported.status).toBe(201)

    const orderBefore = await prisma.productionOrder.findFirst({ where: { id: orderId } })
    expect(orderBefore?.status).toBe('IN_PROGRESS')

    const issueId = reported.body.data.id as string
    await admin(request(app).post(`${base(fx.slug)}/issues/${issueId}/acknowledge`).send({})).expect(200)
    await admin(
      request(app)
        .post(`${base(fx.slug)}/issues/${issueId}/resolve`)
        .send({ resolution: 'Material delivered', endDowntime: true }),
    ).expect(200)

    const orderAfter = await prisma.productionOrder.findFirst({ where: { id: orderId } })
    expect(orderAfter?.status).toBe('IN_PROGRESS')
  }, 30_000)

  it('enforces tenant isolation on assignments', async () => {
    const otherTenant = await createManufacturingAdminTenant(app, 'mfg-p2b-other')
    const otherFx = await bootstrapManufacturingFixture(otherTenant)
    try {
      const res = await request(app)
        .get(`${base(otherFx.slug)}/assignments`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(res.status).toBe(403)
    } finally {
      await cleanupProductionData(otherFx.tenantId)
      await cleanupTenant(otherFx.tenantId)
    }
  }, 30_000)

  it('returns 403 when operator tries to create assignment without manage permission', async () => {
    const res = await operator(
      request(app)
        .post(`${base(fx.slug)}/assignments`)
        .send({
          productionOrderId: orderId,
          stageId: stage1Id,
          userId: operatorUserId,
          assignmentDate: new Date().toISOString().slice(0, 10),
          assignedQuantity: 1,
        }),
    )
    expect(res.status).toBe(403)
  }, 30_000)
})
