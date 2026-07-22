import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import {
  cleanupPurchaseTenant,
  createSentPo,
  createSubmittedGrn,
  createTenantUser,
  dbAvailable,
  ensurePermissions,
  FULL_PURCHASE_PERMS,
  seedPurchaseMasters,
} from './helpers/purchase-live-fixture.js'

/**
 * Purchase Return — live DB integration.
 * Create / submit / complete return, tenant isolation + RBAC.
 */
const app = createApp()

describe.skipIf(!dbAvailable)('Purchase return lifecycle (live HTTP)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let approverToken = ''
  let viewerToken = ''
  let otherSlug = ''
  let otherToken = ''
  let otherTenantId = ''

  let vendorId = ''
  let uomId = ''
  let warehouseId = ''
  let locationId = ''
  let binId = ''
  let poId = ''
  let poLineId = ''
  let grnId = ''
  let grnLineId = ''

  const returnBase = (s = slug) => `/api/v1/t/${s}/purchase/returns`
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })

  beforeAll(async () => {
    await ensurePermissions()
    const main = await createTenantUser({
      app,
      slugPrefix: 'ret-life',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = main.tenantId
    slug = main.slug
    token = main.token

    const approver = await createTenantUser({
      app,
      slugPrefix: 'ret-appr',
      permissionNames: FULL_PURCHASE_PERMS,
      tenantId,
    })
    approverToken = approver.token

    const viewer = await createTenantUser({
      app,
      slugPrefix: 'ret-view',
      permissionNames: ['purchase.return.view'],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      app,
      slugPrefix: 'ret-other',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    otherSlug = other.slug
    otherToken = other.token
    otherTenantId = other.tenantId

    const masters = await seedPurchaseMasters(tenantId)
    vendorId = masters.vendorId
    uomId = masters.uomId
    warehouseId = masters.warehouseId
    locationId = masters.locationId
    binId = masters.binId

    const po = await createSentPo(app, {
      slug,
      token,
      approverToken,
      vendorId,
      uomId,
      warehouseId,
      qty: 10,
      itemCode: 'RET-ITM-1',
    })
    poId = po.poId
    poLineId = po.poLineId

    const grn = await createSubmittedGrn(app, {
      slug,
      token,
      poId,
      poLineId,
      vendorId,
      warehouseId,
      locationId,
      binId,
      receivedQuantity: 10,
      inspectionRequired: false,
    })
    grnId = grn.grnId
    grnLineId = grn.grnLineId
    expect(['SUBMITTED', 'INVENTORY_POSTED']).toContain(grn.status)
  }, 180_000)

  afterAll(async () => {
    if (tenantId) await cleanupPurchaseTenant(tenantId)
    if (otherTenantId) await cleanupPurchaseTenant(otherTenantId)
  }, 120_000)

  function draftPayload(overrides: Record<string, unknown> = {}) {
    return {
      vendorId,
      purchaseOrderId: poId,
      goodsReceiptId: grnId,
      warehouseId,
      reason: 'Defective batch',
      lines: [
        {
          goodsReceiptLineId: grnLineId,
          purchaseOrderLineId: poLineId,
          returnQuantity: 2,
        },
      ],
      ...overrides,
    }
  }

  it('creates a draft purchase return', async () => {
    const res = await request(app).post(returnBase()).set(auth()).send(draftPayload())
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.returnNumber).toMatch(/^PRT-/)
    const row = await prisma.purchaseReturn.findFirst({
      where: { id: res.body.data.id, tenantId },
    })
    expect(row?.goodsReceiptId).toBe(grnId)
  })

  it('submits and completes a purchase return', async () => {
    const created = await request(app).post(returnBase()).set(auth()).send(draftPayload())
    expect(created.status).toBe(201)
    const returnId = created.body.data.id as string

    const submit = await request(app)
      .post(`${returnBase()}/${returnId}/submit`)
      .set(auth())
      .send({})
    expect(submit.status).toBe(200)
    expect(submit.body.data.status).toBe('SUBMITTED')

    const complete = await request(app)
      .post(`${returnBase()}/${returnId}/complete`)
      .set(auth())
      .send({ remarks: 'Shipped back to vendor' })
    expect(complete.status).toBe(200)
    expect(complete.body.data.status).toBe('COMPLETED')

    const poLine = await prisma.purchaseOrderLine.findFirst({
      where: { id: poLineId, tenantId },
    })
    expect(Number(poLine?.returnedQuantity)).toBeGreaterThanOrEqual(2)
  })

  it('denies create without permission', async () => {
    const res = await request(app).post(returnBase()).set(auth(viewerToken)).send(draftPayload())
    expect(res.status).toBe(403)
  })

  it('enforces tenant isolation on GET', async () => {
    const created = await request(app).post(returnBase()).set(auth()).send(draftPayload())
    expect(created.status).toBe(201)
    const other = await request(app)
      .get(`${returnBase(otherSlug)}/${created.body.data.id}`)
      .set({ Authorization: `Bearer ${otherToken}` })
    expect(other.status).toBe(404)
  })
})
