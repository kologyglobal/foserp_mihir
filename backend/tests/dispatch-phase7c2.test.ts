/**
 * Dispatch Phase 7C2 — FG reservation + allocation-only picking.
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
  await prisma.dispatchPickEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPickLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPickList.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchTrackingAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
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
          in: [
            'STOCK_MOVEMENT',
            'STOCK_RESERVATION',
            'OUTBOUND_DISPATCH',
            'DISPATCH_REQUIREMENT',
            'DISPATCH_PICK_LIST',
            'SALES_ORDER',
          ],
        },
      },
    })
    .catch(() => {})
  await cleanupTenant(tenantId)
}

describe.skipIf(!dbAvailable)('Dispatch Phase 7C2 — reservation + picking', () => {
  let fx: ManufacturingFixture
  let token: string
  let salesOrderId: string
  let lineId: string
  let dispatchId: string
  let dispatchLineId: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `dsp-7c2-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Dispatch 7C2 Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const admin = await createUserWithPerms(app, tenant.id, slug, DISPATCH_PERMS, 'dsp7c2-admin')
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
        referenceNo: 'OPN-7C2',
      })

    const draft = await request(app)
      .post(`${dsp(fx.slug)}/outbound`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        salesOrderId,
        lines: [
          {
            itemId: fx.itemId,
            warehouseId: fx.warehouseId,
            quantity: 3,
            salesOrderLineId: lineId,
          },
        ],
      })
    expect(draft.status).toBe(201)
    dispatchId = draft.body.data.id
    dispatchLineId = draft.body.data.lines[0].id
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupDispatchTenant(fx.tenantId)
  })

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`)
  }

  async function onHandQty(): Promise<number> {
    const bal = await prisma.inventoryStockBalance.findFirst({
      where: { tenantId: fx.tenantId, itemId: fx.itemId, warehouseId: fx.warehouseId },
    })
    return Number(bal?.onHandQty ?? 0)
  }

  it('reserve does not change onHand', async () => {
    const before = await onHandQty()
    const res = await auth(
      request(app).post(`${dsp(fx.slug)}/orders/${dispatchId}/reservations`).send({
        lines: [{ outboundDispatchLineId: dispatchLineId, quantity: 2 }],
        idempotencyKey: `7c2-res-${dispatchId}`,
      }),
    )
    expect(res.status).toBe(201)
    const after = await onHandQty()
    expect(after).toBe(before)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  it('over-reserve blocked', async () => {
    const res = await auth(
      request(app).post(`${dsp(fx.slug)}/orders/${dispatchId}/reservations`).send({
        lines: [{ outboundDispatchLineId: dispatchLineId, quantity: 10 }],
      }),
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('pick does not create FG_DISPATCH movement', async () => {
    const pickLists = await auth(
      request(app).post(`${dsp(fx.slug)}/orders/${dispatchId}/pick-lists`).send({
        idempotencyKey: `7c2-pkl-${dispatchId}`,
      }),
    )
    expect(pickLists.status).toBe(201)
    const pickListId = pickLists.body.data[0].id as string
    const pickLineId = pickLists.body.data[0].lines[0].id as string

    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/release`))
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/start`))
    const pick = await auth(
      request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/pick`).send({
        pickLineId,
        quantity: 1,
        idempotencyKey: `7c2-pick-${pickLineId}`,
      }),
    )
    expect(pick.status).toBe(200)

    const movements = await prisma.inventoryStockMovement.count({
      where: { tenantId: fx.tenantId, referenceType: 'FG_DISPATCH' },
    })
    expect(movements).toBe(0)
  })

  it('pick cannot exceed reserved', async () => {
    const lists = await auth(request(app).get(`${dsp(fx.slug)}/pick-lists`).query({ outboundDispatchId: dispatchId }))
    const pickListId = lists.body.data[0].id as string
    const pickLineId = lists.body.data[0].lines[0].id as string
    const res = await auth(
      request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/pick`).send({
        pickLineId,
        quantity: 99,
      }),
    )
    expect(res.status).toBe(409)
  })

  it('unpick preserves history', async () => {
    const lists = await auth(request(app).get(`${dsp(fx.slug)}/pick-lists`).query({ outboundDispatchId: dispatchId }))
    const pickListId = lists.body.data[0].id as string
    const pickLineId = lists.body.data[0].lines[0].id as string

    const unpick = await auth(
      request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/unpick`).send({
        pickLineId,
        quantity: 1,
      }),
    )
    expect(unpick.status).toBe(200)

    const events = await prisma.dispatchPickEvent.findMany({
      where: { pickLineId },
      orderBy: { performedAt: 'asc' },
    })
    expect(events.some((e) => e.eventType === 'PICK')).toBe(true)
    expect(events.some((e) => e.eventType === 'UNPICK')).toBe(true)
  })

  it('fulfilment unchanged after reserve+pick', async () => {
    const res = await auth(request(app).get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment`))
    expect(res.status).toBe(200)
    expect(res.body.data.lines[0].dispatchedQty).toBe(0)
    expect(res.body.data.lines[0].remainingQty).toBe(5)
  })

  it('7C0 confirm blocked when partial pick list active', async () => {
    const confirm = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/confirm`))
    expect(confirm.status).toBe(409)
  })
})
