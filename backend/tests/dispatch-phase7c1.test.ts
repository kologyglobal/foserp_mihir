/**
 * Dispatch Phase 7C1 — requirements sync, readiness, draft-from-requirements.
 * Skips when MySQL is unavailable (same pattern as 7C0).
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

const DISPATCH_PERMS = PERMISSIONS.filter(
  (p) =>
    p.startsWith('dispatch.') ||
    p.startsWith('inventory.') ||
    p.startsWith('crm.sales_order.') ||
    p.startsWith('crm.company.') ||
    p.startsWith('master.'),
) as PermissionName[]

function dsp(slug: string) {
  return `/api/v1/t/${slug}/dispatch`
}
function crm(slug: string) {
  return `/api/v1/t/${slug}/crm`
}
function inv(slug: string) {
  return `/api/v1/t/${slug}/inventory`
}

async function cleanupDispatchTenant(tenantId: string): Promise<void> {
  await prisma.outboundDispatchLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.outboundDispatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchRequirement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesOrderLineFulfilment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockReservation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmSalesOrder.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.codeSeries
    .deleteMany({
      where: {
        tenantId,
        entityType: {
          in: ['STOCK_MOVEMENT', 'STOCK_RESERVATION', 'OUTBOUND_DISPATCH', 'DISPATCH_REQUIREMENT', 'SALES_ORDER'],
        },
      },
    })
    .catch(() => {})
  await cleanupTenant(tenantId)
}

describe.skipIf(!dbAvailable)('Dispatch Phase 7C1 — requirements + workbench draft', () => {
  let fx: ManufacturingFixture
  let token: string
  let salesOrderId: string
  let lineId: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `dsp-7c1-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Dispatch 7C1 Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const admin = await createUserWithPerms(app, tenant.id, slug, DISPATCH_PERMS, 'dsp7c1-admin')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: admin.token,
      userId: admin.userId,
    })
    token = admin.token

    const so = await createConfirmedSalesOrderWithLine(app, fx, token, {
      productId: fx.itemId,
      qty: 5,
      unitPrice: 5000,
    })
    salesOrderId = so.salesOrderId
    lineId = so.lineId

    await request(app)
      .post(`${inv(fx.slug)}/movements/opening`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: fx.itemId,
        warehouseId: fx.warehouseId,
        quantity: 20,
        referenceNo: 'OPN-7C1',
      })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupDispatchTenant(fx.tenantId)
  })

  it('synchronises requirements and returns workbench summary', async () => {
    const sync = await request(app)
      .post(`${dsp(fx.slug)}/requirements/synchronise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ salesOrderId })
    expect(sync.status).toBe(200)
    expect(sync.body.data.created + sync.body.data.updated + sync.body.data.unchanged).toBeGreaterThan(0)

    const list = await request(app)
      .get(`${dsp(fx.slug)}/requirements`)
      .query({ salesOrderId, limit: 20 })
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.data)).toBe(true)
    expect(list.body.data.length).toBeGreaterThan(0)
    expect(list.body.data[0].salesOrderLineId).toBe(lineId)

    const summary = await request(app)
      .get(`${dsp(fx.slug)}/workbench/summary`)
      .set('Authorization', `Bearer ${token}`)
    expect(summary.status).toBe(200)
    expect(summary.body.data.allActiveRequirements).toBeGreaterThan(0)
  })

  it('creates draft dispatch from requirements without confirming stock', async () => {
    const list = await request(app)
      .get(`${dsp(fx.slug)}/requirements`)
      .query({ salesOrderId, limit: 20 })
      .set('Authorization', `Bearer ${token}`)
    const reqId = list.body.data[0].id as string
    const fingerprint = list.body.data[0].sourceFingerprint as string

    const draft = await request(app)
      .post(`${dsp(fx.slug)}/orders/from-requirements`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        requirementIds: [reqId],
        lines: [{ requirementId: reqId, quantity: 1, warehouseId: fx.warehouseId }],
        planBeforeStockAllowed: true,
        sourceFingerprintByRequirement: { [reqId]: fingerprint },
        idempotencyKey: `7c1-draft-${reqId}`,
      })
    expect(draft.status).toBe(201)
    expect(draft.body.data.status).toBe('DRAFT')
    expect(draft.body.data.planningSource).toBe('WORKBENCH_7C1')
    expect(draft.body.data.lines[0].dispatchRequirementId).toBe(reqId)

    const movements = await prisma.inventoryStockMovement.count({
      where: { tenantId: fx.tenantId, referenceType: 'FG_DISPATCH' },
    })
    expect(movements).toBe(0)
  })

  it('exposes CRM fulfilment-summary and dispatch-history', async () => {
    const summary = await request(app)
      .get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment-summary`)
      .set('Authorization', `Bearer ${token}`)
    expect(summary.status).toBe(200)
    expect(summary.body.data.salesOrderId).toBe(salesOrderId)
    expect(Array.isArray(summary.body.data.lines)).toBe(true)

    const history = await request(app)
      .get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/dispatch-history`)
      .set('Authorization', `Bearer ${token}`)
    expect(history.status).toBe(200)
    expect(Array.isArray(history.body.data.items)).toBe(true)
    expect(history.body.data.items.length).toBeGreaterThan(0)
  })
})
