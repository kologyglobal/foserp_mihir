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

const app = createApp()

describe.skipIf(!dbAvailable)('Purchase GRNI report (live HTTP)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let approverToken = ''
  let masters: Awaited<ReturnType<typeof seedPurchaseMasters>>

  beforeAll(async () => {
    await ensurePermissions()
    const main = await createTenantUser({
      app,
      slugPrefix: 'grni',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = main.tenantId
    slug = main.slug
    token = main.token
    const approver = await createTenantUser({
      app,
      slugPrefix: 'grni-appr',
      permissionNames: FULL_PURCHASE_PERMS,
      tenantId,
    })
    approverToken = approver.token
    masters = await seedPurchaseMasters(tenantId)
  }, 180_000)

  afterAll(async () => {
    if (tenantId) await cleanupPurchaseTenant(tenantId)
  }, 120_000)

  it('lists open GRNI qty for posted GRN without invoice', async () => {
    const po = await createSentPo(app, {
      slug,
      token,
      approverToken,
      vendorId: masters.vendorId,
      uomId: masters.uomId,
      warehouseId: masters.warehouseId,
      qty: 10,
      itemId: masters.itemId,
      itemCode: masters.itemCode,
    })
    const grn = await createSubmittedGrn(app, {
      slug,
      token,
      poId: po.poId,
      poLineId: po.poLineId,
      vendorId: masters.vendorId,
      warehouseId: masters.warehouseId,
      locationId: masters.locationId,
      binId: masters.binId,
      receivedQuantity: 10,
      inspectionRequired: false,
    })
    expect(['SUBMITTED', 'RECEIVING_COMPLETED', 'INVENTORY_POSTED', 'FULLY_ACCEPTED']).toContain(
      grn.status,
    )

    const res = await request(app)
      .get(`/api/v1/t/${slug}/purchase/reports/grni`)
      .set({ Authorization: `Bearer ${token}` })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.rows)).toBe(true)
    const hit = res.body.data.rows.find(
      (r: { goodsReceiptId: string }) => r.goodsReceiptId === grn.grnId,
    )
    expect(hit).toBeTruthy()
    expect(Number(hit.openQty)).toBeGreaterThan(0)
  })
})
