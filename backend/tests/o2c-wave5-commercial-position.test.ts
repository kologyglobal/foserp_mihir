/**
 * O2C Wave 5 — commercial position read API + closed SO dispatch guard.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'
import { createConfirmedSalesOrderWithLine } from './manufacturing/helpers/production-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const WAVE5_PERMS = PERMISSIONS.filter(
  (p) =>
    p.startsWith('dispatch.') ||
    p.startsWith('inventory.') ||
    p.startsWith('crm.sales_order.') ||
    p.startsWith('crm.company.') ||
    p.startsWith('master.'),
) as PermissionName[]

function crm(slug: string) {
  return `/api/v1/t/${slug}/crm`
}
function dsp(slug: string) {
  return `/api/v1/t/${slug}/dispatch`
}

async function cleanupWave5Tenant(tenantId: string): Promise<void> {
  await prisma.outboundDispatchLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.outboundDispatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesOrderLineFulfilment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmSalesOrder.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await cleanupTenant(tenantId)
}

describe.skipIf(!dbAvailable)('O2C Wave 5 — commercial position + closed SO dispatch guard', () => {
  let fx: ManufacturingFixture
  let token: string
  let salesOrderId: string
  let companyId: string
  let lineId: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `o2c-w5-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'O2C Wave 5 Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const admin = await createUserWithPerms(app, tenant.id, slug, WAVE5_PERMS, 'o2c-w5-admin')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: admin.token,
      userId: admin.userId,
    })
    token = admin.token

    const so = await createConfirmedSalesOrderWithLine(app, fx, token, {
      productId: fx.itemId,
      qty: 2,
      unitPrice: 5000,
    })
    salesOrderId = so.salesOrderId
    lineId = so.lineId
    companyId = so.companyId
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupWave5Tenant(fx.tenantId)
  })

  it('returns commercial position with ops tiles and hidden money without AR permission', async () => {
    const res = await request(app)
      .get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/commercial-position`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.success).toBe(true)
    const data = res.body.data
    expect(data.salesOrderId).toBe(salesOrderId)
    expect(data.ops.orderedQty).toBeGreaterThan(0)
    expect(data.ops.dispatchedQty).toBe(0)
    expect(data.moneyVisible).toBe(false)
    expect(data.money).toBeNull()
    expect(data.fulfilment.totals.remainingQty).toBeGreaterThan(0)
  })

  it('blocks outbound dispatch create when sales order is closed', async () => {
    await request(app)
      .post(`${crm(fx.slug)}/sales-orders/${salesOrderId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const res = await request(app)
      .post(`${dsp(fx.slug)}/outbound-dispatches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        salesOrderId,
        lines: [
          {
            itemId: fx.itemId,
            warehouseId: fx.warehouseId,
            quantity: 1,
            salesOrderLineId: lineId,
          },
        ],
      })
      .expect(422)

    expect(res.body.message).toMatch(/closed sales order/i)
  })

  it('returns company commercial position aggregate', async () => {
    const res = await request(app)
      .get(`${crm(fx.slug)}/companies/${companyId}/commercial-position`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.data.companyId).toBe(companyId)
    expect(res.body.data.salesOrderCount).toBeGreaterThanOrEqual(1)
    expect(res.body.data.ops.orderedQty).toBeGreaterThan(0)
  })
})
