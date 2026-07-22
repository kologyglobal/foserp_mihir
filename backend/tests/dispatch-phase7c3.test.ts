/**
 * Dispatch Phase 7C3 — operational packing (no stock movement).
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
  await prisma.dispatchPackingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPackageLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPackage.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPackingSession.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPackageType.deleteMany({ where: { tenantId } }).catch(() => {})
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
            'DISPATCH_PACKING_SESSION',
            'DISPATCH_PACKAGE',
            'SALES_ORDER',
          ],
        },
      },
    })
    .catch(() => {})
  await cleanupTenant(tenantId)
}

describe.skipIf(!dbAvailable)('Dispatch Phase 7C3 — operational packing', () => {
  let fx: ManufacturingFixture
  let token: string
  let salesOrderId: string
  let lineId: string
  let dispatchId: string
  let dispatchLineId: string
  let pickListId: string
  let pickLineId: string
  let packingSessionId: string
  let packageId: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `dsp-7c3-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Dispatch 7C3 Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const admin = await createUserWithPerms(app, tenant.id, slug, DISPATCH_PERMS, 'dsp7c3-admin')
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
        referenceNo: 'OPN-7C3',
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

    await request(app)
      .post(`${dsp(fx.slug)}/orders/${dispatchId}/reservations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        lines: [{ outboundDispatchLineId: dispatchLineId, quantity: 3 }],
        idempotencyKey: `7c3-res-${dispatchId}`,
      })

    const pickLists = await request(app)
      .post(`${dsp(fx.slug)}/orders/${dispatchId}/pick-lists`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: `7c3-pkl-${dispatchId}` })
    expect(pickLists.status).toBe(201)
    pickListId = pickLists.body.data[0].id as string
    pickLineId = pickLists.body.data[0].lines[0].id as string

    await request(app)
      .post(`${dsp(fx.slug)}/pick-lists/${pickListId}/release`)
      .set('Authorization', `Bearer ${token}`)
    await request(app)
      .post(`${dsp(fx.slug)}/pick-lists/${pickListId}/start`)
      .set('Authorization', `Bearer ${token}`)
    await request(app)
      .post(`${dsp(fx.slug)}/pick-lists/${pickListId}/pick`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pickLineId, quantity: 3, idempotencyKey: `7c3-pick-${pickLineId}` })
    await request(app)
      .post(`${dsp(fx.slug)}/pick-lists/${pickListId}/complete`)
      .set('Authorization', `Bearer ${token}`)

    const sessions = await request(app)
      .post(`${dsp(fx.slug)}/orders/${dispatchId}/packing-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: `7c3-pack-sess-${dispatchId}` })
    expect(sessions.status).toBe(201)
    packingSessionId = sessions.body.data[0].id as string

    await request(app)
      .post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/start`)
      .set('Authorization', `Bearer ${token}`)

    const pkg = await request(app)
      .post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/packages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ packageReference: 'BOX-1' })
    expect(pkg.status).toBe(201)
    packageId = pkg.body.data.id as string
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

  it('packing does not change onHand', async () => {
    const before = await onHandQty()
    const res = await auth(
      request(app).post(`${dsp(fx.slug)}/packages/${packageId}/pack`).send({
        pickLineId,
        quantity: 1,
        idempotencyKey: `7c3-pack-1-${packageId}`,
      }),
    )
    expect(res.status).toBe(200)
    const after = await onHandQty()
    expect(after).toBe(before)
  })

  it('pack above picked blocked', async () => {
    const res = await auth(
      request(app).post(`${dsp(fx.slug)}/packages/${packageId}/pack`).send({
        pickLineId,
        quantity: 99,
      }),
    )
    expect(res.status).toBe(409)
  })

  it('partial pack → PARTIALLY_PACKED', async () => {
    const session = await auth(request(app).get(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}`))
    expect(session.status).toBe(200)
    expect(session.body.data.status).toBe('PARTIALLY_PACKED')
    expect(session.body.data.totalPackedQuantity).toBe(1)
  })

  it('unpack preserves PACK event', async () => {
    const lines = await auth(request(app).get(`${dsp(fx.slug)}/packages/${packageId}`))
    const packageLineId = lines.body.data.lines[0].id as string

    const unpack = await auth(
      request(app).post(`${dsp(fx.slug)}/packages/${packageId}/unpack`).send({
        packageLineId,
        quantity: 1,
      }),
    )
    expect(unpack.status).toBe(200)

    const events = await prisma.dispatchPackingEvent.findMany({
      where: { packingSessionId, eventType: { in: ['PACK', 'UNPACK'] } },
      orderBy: { performedAt: 'asc' },
    })
    expect(events.some((e) => e.eventType === 'PACK')).toBe(true)
    expect(events.some((e) => e.eventType === 'UNPACK')).toBe(true)
  })

  it('fulfilment unchanged', async () => {
    const res = await auth(request(app).get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment`))
    expect(res.status).toBe(200)
    expect(res.body.data.lines[0].dispatchedQty).toBe(0)
    expect(res.body.data.lines[0].remainingQty).toBe(5)
  })

  it('no FG_DISPATCH movement from pack', async () => {
    await auth(
      request(app).post(`${dsp(fx.slug)}/packages/${packageId}/pack`).send({
        pickLineId,
        quantity: 1,
        idempotencyKey: `7c3-pack-2-${packageId}`,
      }),
    )
    const movements = await prisma.inventoryStockMovement.count({
      where: { tenantId: fx.tenantId, referenceType: 'FG_DISPATCH' },
    })
    expect(movements).toBe(0)
  })

  it('confirm blocked when packing incomplete', async () => {
    const confirm = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/confirm`))
    expect(confirm.status).toBe(409)
  })

  it('after PACKED/VERIFIED + qty match, confirm allowed', async () => {
    await auth(
      request(app).post(`${dsp(fx.slug)}/packages/${packageId}/pack`).send({
        pickLineId,
        quantity: 2,
        idempotencyKey: `7c3-pack-3-${packageId}`,
      }),
    )
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/complete`))
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/verify`))

    const confirm = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/confirm`))
    expect(confirm.status).toBe(200)
  })
})
