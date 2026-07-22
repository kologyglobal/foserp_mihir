import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import {
  cleanupPurchaseTenant,
  createSentPo,
  createSubmittedGrn,
  createTenantUser,
  dbAvailable,
  ensureLegalEntity,
  ensurePermissions,
  FULL_PURCHASE_PERMS,
  seedPurchaseMasters,
} from './helpers/purchase-live-fixture.js'

/**
 * Purchase Invoice — live DB integration (HTTP).
 * Direct invoice, PO/GRN matched lifecycle, AP handoff preview, tenant isolation + RBAC.
 */
const app = createApp()

describe.skipIf(!dbAvailable)('Purchase invoice lifecycle (live HTTP)', () => {
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

  const invoiceBase = (s = slug) => `/api/v1/t/${s}/purchase/invoices`
  const setupBase = (s = slug) => `/api/v1/t/${s}/purchase/setup`
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })

  async function putSetup(body: Record<string, unknown>) {
    const current = await request(app).get(setupBase()).set(auth())
    const version = current.body.data?.version ?? 0
    return request(app)
      .put(setupBase())
      .set(auth())
      .send({ ...body, version })
  }

  beforeAll(async () => {
    await ensurePermissions()
    const main = await createTenantUser({
      app,
      slugPrefix: 'pi-life',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = main.tenantId
    slug = main.slug
    token = main.token

    const approver = await createTenantUser({
      app,
      slugPrefix: 'pi-appr',
      permissionNames: FULL_PURCHASE_PERMS,
      tenantId,
    })
    approverToken = approver.token

    const viewer = await createTenantUser({
      app,
      slugPrefix: 'pi-view',
      permissionNames: ['purchase.invoice.view'],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      app,
      slugPrefix: 'pi-other',
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
    await ensureLegalEntity(tenantId)

    const setupRes = await putSetup({
      allowDirectInvoice: true,
      invoiceMatchTolerances: {
        requirePoMatch: false,
        requireGrnMatch: false,
      },
    })
    expect(setupRes.status).toBe(200)

    const po = await createSentPo(app, {
      slug,
      token,
      approverToken,
      vendorId,
      uomId,
      warehouseId,
      qty: 10,
      itemCode: 'PI-ITM-1',
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
  }, 180_000)

  afterAll(async () => {
    if (tenantId) await cleanupPurchaseTenant(tenantId)
    if (otherTenantId) await cleanupPurchaseTenant(otherTenantId)
  }, 120_000)

  it('creates a direct purchase invoice', async () => {
    const res = await request(app)
      .post(invoiceBase())
      .set(auth())
      .send({
        vendorId,
        lines: [{ quantity: 5, rate: 100, taxRatePct: 0, itemCode: 'DIR-1', itemName: 'Direct Item' }],
      })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.invoiceNumber).toMatch(/^PI-/)
    expect(res.body.data.isDirectInvoice).toBe(true)
  })

  it('creates a matched invoice from PO + GRN and posts with AP handoff preview', async () => {
    const create = await request(app)
      .post(invoiceBase())
      .set(auth())
      .send({
        vendorId,
        purchaseOrderId: poId,
        goodsReceiptId: grnId,
        lines: [
          {
            purchaseOrderLineId: poLineId,
            goodsReceiptLineId: grnLineId,
            quantity: 10,
            rate: 100,
            taxRatePct: 0,
          },
        ],
      })
    expect(create.status).toBe(201)
    const invoiceId = create.body.data.id as string

    const preview = await request(app)
      .get(`${invoiceBase()}/${invoiceId}/ap-handoff-preview`)
      .set(auth())
    expect(preview.status).toBe(200)
    expect(preview.body.data.vendorId).toBe(vendorId)
    expect(preview.body.data.lineCount).toBe(1)

    await request(app).post(`${invoiceBase()}/${invoiceId}/submit`).set(auth()).send({})
    await request(app)
      .post(`${invoiceBase()}/${invoiceId}/approve`)
      .set({ Authorization: `Bearer ${approverToken}` })
      .send({})
    const post = await request(app).post(`${invoiceBase()}/${invoiceId}/post`).set(auth()).send({})
    expect(post.status).toBe(200)
    expect(post.body.data.status).toBe('POSTED')
    expect(post.body.data.apHandoff?.vendorInvoiceId ?? post.body.data.vendorInvoiceId).toBeTruthy()
  })

  it('denies create without permission', async () => {
    const res = await request(app)
      .post(invoiceBase())
      .set(auth(viewerToken))
      .send({
        vendorId,
        lines: [{ quantity: 1, rate: 10, taxRatePct: 0 }],
      })
    expect(res.status).toBe(403)
  })

  it('enforces tenant isolation on GET', async () => {
    const created = await request(app)
      .post(invoiceBase())
      .set(auth())
      .send({
        vendorId,
        lines: [{ quantity: 1, rate: 10, taxRatePct: 0 }],
      })
    expect(created.status).toBe(201)
    const other = await request(app)
      .get(`${invoiceBase(otherSlug)}/${created.body.data.id}`)
      .set({ Authorization: `Bearer ${otherToken}` })
    expect(other.status).toBe(404)
  })
})
