/**
 * Manufacturing Phase 5C — corrections / reversals framework.
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
import { buildProductionReadySetup, cleanupProductionData } from './manufacturing/helpers/production-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

const PHASE5C_PERMS = Array.from(
  new Set([
    ...MANUFACTURING_PERMS,
    ...PERMISSIONS.filter((p) => p.startsWith('manufacturing.correction.')),
    ...PERMISSIONS.filter((p) => p.includes('.reverse')),
    ...PERMISSIONS.filter((p) => p.startsWith('inventory.')),
    'quality.decision.correct',
  ]),
) as PermissionName[]

function mfg(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 5C — corrections', () => {
  let fx: ManufacturingFixture
  let token: string
  let viewOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p5c')
    const full = await createUserWithPerms(app, ctx.tenantId, ctx.slug, PHASE5C_PERMS, 'p5c-full')
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
      ['manufacturing.work_orders.view', 'manufacturing.correction.view'] as PermissionName[],
      'p5c-view',
    )
    viewOnlyToken = viewOnly.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await prisma.manufacturingTransactionReversalLink.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.manufacturingTransactionCorrection.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
  })

  function auth(req: request.Test, t: string = token) {
    return req.set('Authorization', `Bearer ${t}`)
  }

  async function createStartedWoWithProgress() {
    const wo = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders`)
        .send({
          productItemId: fx.itemId,
          plannedQuantity: 10,
          requiredCompletionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          priority: 'MEDIUM',
        }),
    )
    expect(wo.status).toBe(201)
    const orderId = wo.body.data.id as string
    await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/release`))
    await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${orderId}/start`).send({}))
    const detail = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${orderId}/detail`))
    const stage = (detail.body.data.stages as Array<{ id: string }>)[0]!
    const progress = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/work-orders/${orderId}/progress`)
        .send({ stageId: stage.id, goodQuantity: 5 }),
    )
    expect(progress.status).toBe(201)
    const ledgerEntryId = progress.body.data.ledgerEntry.id as string
    return { orderId, ledgerEntryId }
  }

  it('previews, drafts, submits, and applies a progress quantity correction', async () => {
    const { orderId, ledgerEntryId } = await createStartedWoWithProgress()

    const preview = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/corrections/preview`)
        .send({
          transactionType: 'PRODUCTION_PROGRESS',
          correctionType: 'QUANTITY_CORRECTION',
          sourceEntityType: 'PRODUCTION_STAGE_LEDGER',
          sourceEntityId: ledgerEntryId,
          productionOrderId: orderId,
          requestedAction: 'CORRECT',
          requestedValues: { goodQuantity: 3, reworkQuantity: 0, rejectedQuantity: 0, scrapQuantity: 0 },
        }),
    )
    expect(preview.status).toBe(200)
    expect(preview.body.data.previewToken).toBeTruthy()
    expect(preview.body.data.blockers ?? []).toEqual([])

    const draft = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/corrections`)
        .send({
          transactionType: 'PRODUCTION_PROGRESS',
          correctionType: 'QUANTITY_CORRECTION',
          sourceEntityType: 'PRODUCTION_STAGE_LEDGER',
          sourceEntityId: ledgerEntryId,
          productionOrderId: orderId,
          requestedAction: 'CORRECT',
          requestedValues: { goodQuantity: 3, reworkQuantity: 0, rejectedQuantity: 0, scrapQuantity: 0 },
          reason: 'Over-recorded good qty',
          previewToken: preview.body.data.previewToken,
          idempotencyKey: `p5c-prog-${ledgerEntryId}`,
        }),
    )
    expect(draft.status).toBe(201)
    expect(draft.body.data.correctionNumber).toMatch(/^MC/)
    expect(draft.body.data.status).toBe('DRAFT')

    const submit = await auth(request(app).post(`${mfg(fx.slug)}/corrections/${draft.body.data.id}/submit`))
    expect(submit.status).toBe(200)
    expect(['APPROVED', 'PENDING_APPROVAL']).toContain(submit.body.data.status)

    let correctionId = draft.body.data.id as string
    if (submit.body.data.status === 'PENDING_APPROVAL') {
      const approved = await auth(request(app).post(`${mfg(fx.slug)}/corrections/${correctionId}/approve`))
      expect(approved.status).toBe(200)
    }

    const apply = await auth(request(app).post(`${mfg(fx.slug)}/corrections/${correctionId}/apply`).send({}))
    expect(apply.status).toBe(200)
    expect(apply.body.data.status).toBe('APPLIED')
    expect(apply.body.data.reversalTransactionId).toBeTruthy()

    const dup = await auth(request(app).post(`${mfg(fx.slug)}/corrections/${correctionId}/apply`).send({}))
    expect(dup.status).toBeGreaterThanOrEqual(400)

    const history = await auth(
      request(app).get(
        `${mfg(fx.slug)}/corrections/transactions/PRODUCTION_STAGE_LEDGER/${ledgerEntryId}/correction-history`,
      ),
    )
    expect(history.status).toBe(200)
    expect(history.body.data.length).toBeGreaterThanOrEqual(1)
  }, 90_000)

  it('blocks work order split corrections by policy', async () => {
    const preview = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/corrections/preview`)
        .send({
          transactionType: 'WORK_ORDER_SPLIT',
          sourceEntityType: 'WORK_ORDER_SPLIT',
          sourceEntityId: '00000000-0000-4000-8000-000000000001',
          requestedAction: 'REVERSE',
        }),
    )
    expect(preview.status).toBe(200)
    expect(preview.body.data.blockers.length).toBeGreaterThan(0)
  }, 30_000)

  it('denies correction create without request permission', async () => {
    const res = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/corrections`)
        .send({
          transactionType: 'PRODUCTION_PROGRESS',
          sourceEntityType: 'PRODUCTION_STAGE_LEDGER',
          sourceEntityId: '00000000-0000-4000-8000-000000000002',
          reason: 'nope',
          requestedAction: 'REVERSE',
        }),
      viewOnlyToken,
    )
    expect(res.status).toBe(403)
  }, 30_000)

  it('lists corrections for tenant', async () => {
    const list = await auth(request(app).get(`${mfg(fx.slug)}/corrections`))
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.data)).toBe(true)
  }, 30_000)
})
