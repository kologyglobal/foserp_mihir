/**
 * Manufacturing Phase 4B — Job Work / subcontracting foundation.
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

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const PHASE4B_PERMS = Array.from(
  new Set([
    ...MANUFACTURING_PERMS,
    ...PERMISSIONS.filter((p) => p.startsWith('inventory.')),
    ...PERMISSIONS.filter((p) => p.startsWith('quality.')),
  ]),
) as PermissionName[]

function mfg(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

function inv(slug: string) {
  return `/api/v1/t/${slug}/inventory`
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 4B — Job Work / subcontracting', () => {
  let fx: ManufacturingFixture
  let token: string

  function auth(req: request.Test, t?: string) {
    return req.set('Authorization', `Bearer ${t ?? token}`)
  }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p4b')
    const fullUser = await createUserWithPerms(app, ctx.tenantId, ctx.slug, PHASE4B_PERMS, 'p4b-full')
    fx = await bootstrapManufacturingFixture({
      tenantId: ctx.tenantId,
      slug: ctx.slug,
      token: fullUser.token,
      userId: fullUser.userId,
    })
    token = fullUser.token

    await auth(request(app).post(`${inv(fx.slug)}/movements/opening`).send({
      itemId: fx.subComponentItemId,
      warehouseId: fx.warehouseId,
      quantity: 100,
      movementDate: new Date().toISOString(),
      idempotencyKey: `jw-open-${fx.tenantId}`,
    }))
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await prisma.jobWorkDispatchLine.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.jobWorkDispatch.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.jobWorkReceipt.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.jobWorkMaterialLine.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.manufacturingQualityInspection.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.jobWorkOrder.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupTenant(fx.tenantId)
    }
  })

  async function createDraft(overrides: Record<string, unknown> = {}) {
    const res = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work`)
        .send({
          vendorId: fx.vendorId,
          processName: 'Welding',
          itemId: fx.itemId,
          orderedQty: 10,
          rate: 100,
          rateBasis: 'PER_PIECE',
          materialWarehouseId: fx.warehouseId,
          receiptWarehouseId: fx.warehouseId,
          qualityRequired: false,
          materialLines: [{ itemId: fx.subComponentItemId, requiredQty: 10 }],
          ...overrides,
        }),
    )
    expect(res.status).toBe(201)
    return res.body.data as { id: string; jwNumber: string; status: string; materialLines: Array<{ id: string }> }
  }

  it('creates draft job work with JW- number', async () => {
    const jw = await createDraft({ idempotencyKey: `jw-create-${Date.now()}` })
    expect(jw.status).toBe('DRAFT')
    expect(jw.jwNumber).toMatch(/^JW/)
    expect(jw.materialLines).toHaveLength(1)
  }, 45_000)

  it('dispatches material → MATERIAL_SENT and posts SUBCON_OUT', async () => {
    const jw = await createDraft()
    const lineId = jw.materialLines[0].id
    const dispatch = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work/${jw.id}/dispatch`)
        .send({ lines: [{ materialLineId: lineId, quantity: 10 }], vendorChallan: 'VC-1' }),
    )
    expect(dispatch.status).toBe(200)
    expect(dispatch.body.data.status).toBe('MATERIAL_SENT')

    const ledger = await auth(
      request(app).get(`${inv(fx.slug)}/ledger`).query({ itemId: fx.subComponentItemId, warehouseId: fx.warehouseId }),
    )
    expect(ledger.status).toBe(200)
    const movements = ledger.body.data as Array<{ referenceType: string }>
    expect(movements.some((m) => m.referenceType === 'SUBCON_OUT')).toBe(true)
  }, 45_000)

  it('partial then full receive → PARTIALLY_RECEIVED then RECEIVED', async () => {
    const jw = await createDraft()
    const lineId = jw.materialLines[0].id
    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work/${jw.id}/dispatch`)
        .send({ lines: [{ materialLineId: lineId, quantity: 10 }] }),
    )

    const partial = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work/${jw.id}/receive`)
        .send({ receivedQty: 4, acceptedQty: 4 }),
    )
    expect(partial.status).toBe(200)
    expect(partial.body.data.status).toBe('PARTIALLY_RECEIVED')

    const full = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work/${jw.id}/receive`)
        .send({ receivedQty: 6, acceptedQty: 6 }),
    )
    expect(full.status).toBe(200)
    expect(full.body.data.status).toBe('RECEIVED')
  }, 45_000)

  it('qualityRequired receive creates SUBCONTRACT_RETURN inspection', async () => {
    const jw = await createDraft({ qualityRequired: true })
    const lineId = jw.materialLines[0].id
    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work/${jw.id}/dispatch`)
        .send({ lines: [{ materialLineId: lineId, quantity: 10 }] }),
    )
    const receive = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work/${jw.id}/receive`)
        .send({ receivedQty: 10, acceptedQty: 10 }),
    )
    expect(receive.status).toBe(200)
    const inspections = await prisma.manufacturingQualityInspection.findMany({
      where: { tenantId: fx.tenantId, jobWorkOrderId: jw.id },
    })
    expect(inspections).toHaveLength(1)
    expect(inspections[0].category).toBe('SUBCONTRACT_RETURN')
  }, 45_000)

  it('reconcile + close happy path', async () => {
    const jw = await createDraft()
    const lineId = jw.materialLines[0].id
    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work/${jw.id}/dispatch`)
        .send({ lines: [{ materialLineId: lineId, quantity: 10 }] }),
    )
    await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work/${jw.id}/receive`)
        .send({ receivedQty: 10, acceptedQty: 10 }),
    )
    const recon = await auth(
      request(app)
        .post(`${mfg(fx.slug)}/job-work/${jw.id}/reconcile`)
        .send({ lines: [{ materialLineId: lineId, consumedQty: 10, returnedQty: 0, scrapReturnedQty: 0 }] }),
    )
    expect(recon.status).toBe(200)
    expect(recon.body.data.status).toBe('RECEIVED')

    const close = await auth(request(app).post(`${mfg(fx.slug)}/job-work/${jw.id}/close`))
    expect(close.status).toBe(200)
    expect(close.body.data.status).toBe('CLOSED')
  }, 45_000)

  it('cancels draft job work', async () => {
    const jw = await createDraft()
    const cancel = await auth(
      request(app).post(`${mfg(fx.slug)}/job-work/${jw.id}/cancel`).send({ reason: 'Not needed' }),
    )
    expect(cancel.status).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')
  }, 45_000)
})
