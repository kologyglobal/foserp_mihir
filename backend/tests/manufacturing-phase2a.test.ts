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
  createConfirmedSalesOrderWithLine,
  createOpenSalesOrderWithLine,
  createProductionCapableToken,
  PRODUCTION_TEST_PERMS,
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

describe.skipIf(!dbAvailable)('Manufacturing Phase 2A — production demands + work orders', () => {
  let fx: ManufacturingFixture
  let prodToken: string
  let setup: ProductionReadySetup

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p2a')
    fx = await bootstrapManufacturingFixture(ctx)
    const prodUser = await createProductionCapableToken(app, fx)
    prodToken = prodUser.token
    setup = await buildProductionReadySetup(app, fx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
  })

  function auth(req: request.Test, token: string = fx.token) {
    return req.set('Authorization', `Bearer ${token}`)
  }

  // ─── Manual demand + manual work order ──────────────────────────────────

  describe('manual demand + work order creation', () => {
    it('creates a manual demand and a manual work order for a ready profile', async () => {
      const demand = await auth(
        request(app)
          .post(`${base(fx.slug)}/demands`)
          .send({ productItemId: fx.itemId, requestedQuantity: 20, uomId: fx.uomId, priority: 'HIGH' }),
      )
      expect(demand.status).toBe(201)
      expect(demand.body.data.status).toBe('OPEN')
      expect(Number(demand.body.data.remainingQuantity)).toBe(20)

      const wo = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders`)
          .send({
            productItemId: fx.itemId,
            plannedQuantity: 10,
            requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
      )
      expect(wo.status).toBe(201)
      expect(wo.body.data.status).toBe('DRAFT')
      expect(wo.body.data.workOrderNo).toBe(wo.body.data.orderNumber)
      expect(Number(wo.body.data.plannedQuantity)).toBe(10)
    }, 30_000)

    it('rejects manual work order idempotency key reuse by returning the same order', async () => {
      const idempotencyKey = `wo-idem-${Date.now()}`
      const body = {
        productItemId: fx.itemId,
        plannedQuantity: 5,
        requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        idempotencyKey,
      }
      const first = await auth(request(app).post(`${base(fx.slug)}/work-orders`).send(body))
      expect(first.status).toBe(201)
      const second = await auth(request(app).post(`${base(fx.slug)}/work-orders`).send(body))
      expect(second.status).toBe(201)
      expect(second.body.data.id).toBe(first.body.data.id)
    }, 30_000)
  })

  // ─── Sales order demand conversion ───────────────────────────────────────

  describe('sales order demand conversion', () => {
    it('blocks conversion of a line on an unconfirmed (open) sales order', async () => {
      const so = await createOpenSalesOrderWithLine(app, fx, prodToken, { productId: fx.itemId, qty: 8 })
      const res = await auth(
        request(app)
          .post(`${base(fx.slug)}/demand-sources/sales-orders/${so.salesOrderId}/lines/${so.lineId}/convert`)
          .send({ quantity: 4 }),
      )
      expect(res.status).toBe(400)
    }, 30_000)

    it('converts a confirmed SO line partially, tracks remaining, blocks over-conversion, and is idempotent', async () => {
      const so = await createConfirmedSalesOrderWithLine(app, fx, prodToken, { productId: fx.itemId, qty: 10 })

      const eligibility = await auth(
        request(app).get(`${base(fx.slug)}/demand-sources/sales-orders/${so.salesOrderId}/lines`),
      )
      expect(eligibility.status).toBe(200)
      expect(eligibility.body.data.lines[0].eligible).toBe(true)
      expect(Number(eligibility.body.data.lines[0].remainingQuantity)).toBe(10)

      const idempotencyKey = `so-convert-${Date.now()}`
      const convert1 = await auth(
        request(app)
          .post(`${base(fx.slug)}/demand-sources/sales-orders/${so.salesOrderId}/lines/${so.lineId}/convert`)
          .send({ quantity: 6, idempotencyKey }),
      )
      expect(convert1.status).toBe(201)
      expect(convert1.body.data.demand.status).toBe('PARTIALLY_CONVERTED')
      expect(Number(convert1.body.data.demand.remainingQuantity)).toBe(4)
      expect(Number(convert1.body.data.order.plannedQuantity)).toBe(6)
      const firstOrderId = convert1.body.data.order.id as string

      // Duplicate convert with the same idempotency key returns the same order, no double-decrement.
      const convertDup = await auth(
        request(app)
          .post(`${base(fx.slug)}/demand-sources/sales-orders/${so.salesOrderId}/lines/${so.lineId}/convert`)
          .send({ quantity: 6, idempotencyKey }),
      )
      expect(convertDup.status).toBe(201)
      expect(convertDup.body.data.order.id).toBe(firstOrderId)

      const demandAfterDup = await prisma.productionDemand.findFirst({ where: { tenantId: fx.tenantId, sourceLineKey: `${so.salesOrderId}:${so.lineId}` } })
      expect(Number(demandAfterDup?.remainingQuantity)).toBe(4)

      // Over-converting the remaining quantity is blocked.
      const overConvert = await auth(
        request(app)
          .post(`${base(fx.slug)}/demand-sources/sales-orders/${so.salesOrderId}/lines/${so.lineId}/convert`)
          .send({ quantity: 999 }),
      )
      expect(overConvert.status).toBe(400)

      // Converting exactly the remainder fully converts the demand.
      const convertRemainder = await auth(
        request(app)
          .post(`${base(fx.slug)}/demand-sources/sales-orders/${so.salesOrderId}/lines/${so.lineId}/convert`)
          .send({ quantity: 4 }),
      )
      expect(convertRemainder.status).toBe(201)
      expect(convertRemainder.body.data.demand.status).toBe('FULLY_CONVERTED')
      expect(Number(convertRemainder.body.data.demand.remainingQuantity)).toBe(0)

      const soAfter = await prisma.crmSalesOrder.findFirst({ where: { id: so.salesOrderId } })
      expect(soAfter?.status).toBe('in_production')
    }, 30_000)
  })

  // ─── Release, snapshotting, and full execution lifecycle ────────────────

  describe('release, execution, and completion', () => {
    it('releases a work order into immutable BOM/routing snapshots with correct initial stage readiness', async () => {
      const wo = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders`)
          .send({
            productItemId: fx.itemId,
            plannedQuantity: 10,
            requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
      )
      expect(wo.status).toBe(201)
      const orderId = wo.body.data.id as string

      const released = await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/release`))
      expect(released.status).toBe(200)
      expect(released.body.data.status).toBe('READY')
      expect(released.body.data.releasedAt).toBeTruthy()

      const detail = await auth(request(app).get(`${base(fx.slug)}/work-orders/${orderId}/detail`))
      expect(detail.status).toBe(200)
      expect(detail.body.data.bomSnapshot.lines).toHaveLength(1)
      expect(Number(detail.body.data.bomSnapshot.lines[0].requiredQuantity)).toBe(20) // qty 2 * planned 10 / base 1
      expect(detail.body.data.stages).toHaveLength(3)

      const stage1 = detail.body.data.stages.find((s: { sourceStageGroupId: string }) => s.sourceStageGroupId === setup.stage1Id)
      const stage2 = detail.body.data.stages.find((s: { sourceStageGroupId: string }) => s.sourceStageGroupId === setup.stage2Id)
      const stage3 = detail.body.data.stages.find((s: { sourceStageGroupId: string }) => s.sourceStageGroupId === setup.stage3Id)
      // Parallel stages with no predecessor dependencies are both READY at release.
      expect(stage1.status).toBe('READY')
      expect(stage2.status).toBe('READY')
      // The assembly stage depends on both parallel stages, so it starts NOT_STARTED.
      expect(stage3.status).toBe('NOT_STARTED')

      // A later BOM revision must not retroactively change the already-released snapshot.
      const revised = await auth(request(app).post(`${base(fx.slug)}/bom-versions/${setup.bomVersionId}/revise`))
      expect(revised.status).toBe(201)
      const newBomVersionId = revised.body.data.id as string
      await auth(
        request(app)
          .post(`${base(fx.slug)}/bom-versions/${newBomVersionId}/lines`)
          .send({ itemId: fx.componentItemId, quantity: '99', uomId: fx.uomId, lineType: 'RAW_MATERIAL' }),
      )
      await auth(request(app).post(`${base(fx.slug)}/bom-versions/${newBomVersionId}/activate`))
      // Re-point the profile's default to the newly activated version (mirrors real usage) so later
      // tests that create new work orders keep resolving an ACTIVE default BOM version.
      await auth(request(app).patch(`${base(fx.slug)}/profiles/${setup.profileId}`).send({ defaultBomVersionId: newBomVersionId }))

      const detailAfterRevision = await auth(request(app).get(`${base(fx.slug)}/work-orders/${orderId}/detail`))
      expect(detailAfterRevision.body.data.bomSnapshot.lines).toHaveLength(1)
      expect(Number(detailAfterRevision.body.data.bomSnapshot.lines[0].requiredQuantity)).toBe(20)
    }, 30_000)

    it('runs start -> progress -> stage complete -> successor readiness -> complete without touching inventory', async () => {
      const wo = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders`)
          .send({
            productItemId: fx.itemId,
            plannedQuantity: 10,
            requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
      )
      const orderId = wo.body.data.id as string
      await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/release`))

      const detail0 = await auth(request(app).get(`${base(fx.slug)}/work-orders/${orderId}/detail`))
      const stages = detail0.body.data.stages as Array<{ id: string; sourceStageGroupId: string }>
      const stage1 = stages.find((s) => s.sourceStageGroupId === setup.stage1Id)!
      const stage2 = stages.find((s) => s.sourceStageGroupId === setup.stage2Id)!
      const stage3 = stages.find((s) => s.sourceStageGroupId === setup.stage3Id)!

      const started = await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/start`).send({}))
      expect(started.status).toBe(200)
      expect(started.body.data.status).toBe('IN_PROGRESS')

      // Negative quantities are rejected by schema validation.
      const negativeProgress = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders/${orderId}/progress`)
          .send({ stageId: stage1.id, goodQuantity: -1 }),
      )
      expect(negativeProgress.status).toBe(400)

      const progressKey = `progress-${Date.now()}`
      const progress1 = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders/${orderId}/progress`)
          .send({ stageId: stage1.id, goodQuantity: 10, idempotencyKey: progressKey }),
      )
      expect(progress1.status).toBe(201)
      // Non-final stage progress does not roll up into the order's completed quantity.
      expect(Number(progress1.body.data.order.completedGoodQuantity)).toBe(0)

      // Duplicate progress submission with the same idempotency key does not double count.
      const progressDup = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders/${orderId}/progress`)
          .send({ stageId: stage1.id, goodQuantity: 10, idempotencyKey: progressKey }),
      )
      expect(progressDup.status).toBe(201)
      expect(progressDup.body.data.ledgerEntry.id).toBe(progress1.body.data.ledgerEntry.id)

      const completeStage1 = await auth(
        request(app).post(`${base(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage1.id }),
      )
      expect(completeStage1.status).toBe(200)
      expect(completeStage1.body.data.stage.status).toBe('COMPLETED')
      // Stage 3 (assembly) is still blocked on the parallel welding stage.
      expect(completeStage1.body.data.promotedStages).toHaveLength(0)

      await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/progress`).send({ stageId: stage2.id, goodQuantity: 10 }))
      const completeStage2 = await auth(
        request(app).post(`${base(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage2.id }),
      )
      expect(completeStage2.status).toBe(200)
      // Now that both parallel predecessors are done, the assembly stage becomes READY.
      expect(completeStage2.body.data.promotedStages.some((s: { id: string }) => s.id === stage3.id)).toBe(true)

      const finalProgress = await auth(
        request(app).post(`${base(fx.slug)}/work-orders/${orderId}/progress`).send({ stageId: stage3.id, goodQuantity: 10 }),
      )
      expect(finalProgress.status).toBe(201)
      // The final stage's output rolls up to the work order total.
      expect(Number(finalProgress.body.data.order.completedGoodQuantity)).toBe(10)
      expect(Number(finalProgress.body.data.order.completionPercent)).toBe(100)

      const completeStage3 = await auth(
        request(app).post(`${base(fx.slug)}/work-orders/${orderId}/stages/complete`).send({ stageId: stage3.id }),
      )
      expect(completeStage3.status).toBe(200)

      const completed = await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/complete`).send({}))
      expect(completed.status).toBe(200)
      expect(completed.body.data.order.status).toBe('COMPLETED')
      // Phase 3C: profile has finishedGoodsWarehouseId — FG receipt is posted on complete.
      expect(completed.body.data.warnings).not.toContain('FINISHED_GOODS_RECEIPT_PENDING')
      expect(completed.body.data.warnings).not.toContain('QUALITY_INTEGRATION_PENDING')
    }, 45_000)

    it('cannot complete a work order while a mandatory stage is incomplete', async () => {
      const wo = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders`)
          .send({
            productItemId: fx.itemId,
            plannedQuantity: 5,
            requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
      )
      const orderId = wo.body.data.id as string
      await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/release`))
      await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/start`).send({}))

      const res = await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/complete`).send({}))
      expect(res.status).toBe(400)
    }, 30_000)
  })

  // ─── Hold / resume ────────────────────────────────────────────────────────

  describe('hold and resume', () => {
    it('holds a work order and resumes it back to its prior status', async () => {
      const wo = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders`)
          .send({
            productItemId: fx.itemId,
            plannedQuantity: 5,
            requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
      )
      const orderId = wo.body.data.id as string
      await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/release`))
      await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/start`).send({}))

      const held = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders/${orderId}/hold`)
          .send({ reasonCategory: 'MATERIAL', remarks: 'Waiting on raw steel' }),
      )
      expect(held.status).toBe(200)
      expect(held.body.data.status).toBe('ON_HOLD')
      expect(held.body.data.healthStatus).toBe('BLOCKED')

      const resumed = await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/resume`).send({}))
      expect(resumed.status).toBe(200)
      expect(resumed.body.data.status).toBe('IN_PROGRESS')
    }, 30_000)
  })

  // ─── Progress correction ──────────────────────────────────────────────────

  describe('progress correction', () => {
    it('reverses an over-recorded progress entry via a correction', async () => {
      const wo = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders`)
          .send({
            productItemId: fx.itemId,
            plannedQuantity: 10,
            requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
      )
      const orderId = wo.body.data.id as string
      await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/release`))
      await auth(request(app).post(`${base(fx.slug)}/work-orders/${orderId}/start`).send({}))

      const detail = await auth(request(app).get(`${base(fx.slug)}/work-orders/${orderId}/detail`))
      const stage1 = (detail.body.data.stages as Array<{ id: string; sourceStageGroupId: string }>).find(
        (s) => s.sourceStageGroupId === setup.stage1Id,
      )!

      const recorded = await auth(
        request(app).post(`${base(fx.slug)}/work-orders/${orderId}/progress`).send({ stageId: stage1.id, goodQuantity: 8 }),
      )
      expect(recorded.status).toBe(201)

      const corrected = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders/${orderId}/progress/correct`)
          .send({ ledgerEntryId: recorded.body.data.ledgerEntry.id, goodQuantity: 6, reason: 'Miscount, corrected to 6' }),
      )
      expect(corrected.status).toBe(201)
      expect(Number(corrected.body.data.stage.goodQuantity)).toBe(6)
    }, 30_000)
  })

  // ─── Tenant isolation & permissions ───────────────────────────────────────

  describe('tenant isolation and permissions', () => {
    it('returns 403 when creating a work order without permission', async () => {
      const restrictedPerms = PRODUCTION_TEST_PERMS.filter((p) => !p.startsWith('manufacturing.work_orders.'))
      const restricted = await createUserWithPerms(app, fx.tenantId, fx.slug, restrictedPerms, 'wo-restricted')

      const res = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders`)
          .send({
            productItemId: fx.itemId,
            plannedQuantity: 1,
            requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        restricted.token,
      )
      expect(res.status).toBe(403)
    }, 30_000)

    it('does not allow a different tenant to read another tenant work order', async () => {
      const wo = await auth(
        request(app)
          .post(`${base(fx.slug)}/work-orders`)
          .send({
            productItemId: fx.itemId,
            plannedQuantity: 1,
            requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
      )
      const orderId = wo.body.data.id as string

      const otherCtx = await createManufacturingAdminTenant(app, 'mfg-p2a-other')
      const otherFx = await bootstrapManufacturingFixture(otherCtx)
      try {
        const res = await auth(request(app).get(`${base(otherFx.slug)}/work-orders/${orderId}`), otherFx.token)
        expect(res.status).toBe(404)
      } finally {
        await cleanupTenant(otherFx.tenantId)
      }
    }, 30_000)
  })
})
