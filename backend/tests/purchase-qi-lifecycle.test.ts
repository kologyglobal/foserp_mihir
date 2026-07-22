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
  type PurchaseMasterIds,
} from './helpers/purchase-live-fixture.js'

/**
 * Purchase Quality Inspection — live DB integration.
 * Create QI from GRN (QC_PENDING) → complete → tenant isolation + RBAC.
 */
const app = createApp()

describe.skipIf(!dbAvailable)('Purchase quality inspection lifecycle (live HTTP)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let approverToken = ''
  let viewerToken = ''
  let otherSlug = ''
  let otherToken = ''
  let otherTenantId = ''
  let masters: PurchaseMasterIds

  const qiBase = (s = slug) => `/api/v1/t/${s}/purchase/quality-inspections`
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })

  async function freshQcPendingGrn() {
    const { poId, poLineId } = await createSentPo(app, {
      slug,
      token,
      approverToken,
      vendorId: masters.vendorId,
      uomId: masters.uomId,
      warehouseId: masters.warehouseId,
      qty: 10,
      itemCode: `QI-${Date.now()}`,
    })
    return createSubmittedGrn(app, {
      slug,
      token,
      poId,
      poLineId,
      vendorId: masters.vendorId,
      warehouseId: masters.warehouseId,
      locationId: masters.locationId,
      binId: masters.binId,
      receivedQuantity: 10,
      inspectionRequired: true,
    })
  }

  beforeAll(async () => {
    await ensurePermissions()
    const main = await createTenantUser({
      app,
      slugPrefix: 'qi-life',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = main.tenantId
    slug = main.slug
    token = main.token

    const approver = await createTenantUser({
      app,
      slugPrefix: 'qi-appr',
      permissionNames: FULL_PURCHASE_PERMS,
      tenantId,
    })
    approverToken = approver.token

    const viewer = await createTenantUser({
      app,
      slugPrefix: 'qi-view',
      permissionNames: ['purchase.qi.view'],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      app,
      slugPrefix: 'qi-other',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    otherSlug = other.slug
    otherToken = other.token
    otherTenantId = other.tenantId

    masters = await seedPurchaseMasters(tenantId)
  }, 180_000)

  afterAll(async () => {
    if (tenantId) await cleanupPurchaseTenant(tenantId)
    if (otherTenantId) await cleanupPurchaseTenant(otherTenantId)
  }, 120_000)

  it('creates a QI from a QC_PENDING GRN', async () => {
    const grn = await freshQcPendingGrn()
    expect(grn.status).toBe('QC_PENDING')
    const held = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId: grn.grn.lines[0].itemId, warehouseId: masters.warehouseId },
    })
    expect(held.onHandQty.toString()).toBe('10')
    expect(held.qcHoldQty.toString()).toBe('10')

    const res = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.inspectionNumber).toMatch(/^PQI-/)
    expect(res.body.data.lines.length).toBeGreaterThan(0)
    const row = await prisma.purchaseQualityInspection.findFirst({
      where: { id: res.body.data.id, tenantId },
    })
    expect(row?.goodsReceiptId).toBe(grn.grnId)
  })

  it('completes a QI with ACCEPT outcome', async () => {
    const grn = await freshQcPendingGrn()
    const created = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(created.status).toBe(201)
    const qiId = created.body.data.id as string

    const complete = await request(app)
      .post(`${qiBase()}/${qiId}/complete`)
      .set(auth())
      .send({ outcome: 'ACCEPT' })
    expect(complete.status).toBe(200)
    expect(complete.body.data.status).toBe('ACCEPTED')

    const grnRow = await prisma.goodsReceipt.findFirst({
      where: { id: grn.grnId, tenantId },
    })
    expect(['FULLY_ACCEPTED', 'INVENTORY_POSTED']).toContain(grnRow?.status)
    const released = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId: grn.grn.lines[0].itemId, warehouseId: masters.warehouseId },
    })
    expect(released.onHandQty.toString()).toBe('10')
    expect(released.qcHoldQty.toString()).toBe('0')
    expect(released.rejectedQty.toString()).toBe('0')
  })

  it('denies create without permission', async () => {
    const grn = await freshQcPendingGrn()
    const res = await request(app)
      .post(qiBase())
      .set(auth(viewerToken))
      .send({ goodsReceiptId: grn.grnId })
    expect(res.status).toBe(403)
  })

  it('enforces tenant isolation on GET', async () => {
    const grn = await freshQcPendingGrn()
    const created = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(created.status).toBe(201)
    const other = await request(app)
      .get(`${qiBase(otherSlug)}/${created.body.data.id}`)
      .set({ Authorization: `Bearer ${otherToken}` })
    expect(other.status).toBe(404)
  })
})
