/**
 * Dispatch Phase 7C4 — Delivery Challan (document only; no stock/fulfilment).
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
  await prisma.deliveryChallanTrackingAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.deliveryChallanPackage.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.deliveryChallanLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.deliveryChallan.deleteMany({ where: { tenantId } }).catch(() => {})
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
            'DELIVERY_CHALLAN',
            'SALES_ORDER',
          ],
        },
      },
    })
    .catch(() => {})
  await cleanupTenant(tenantId)
}

describe.skipIf(!dbAvailable)('Dispatch Phase 7C4 — Delivery Challan document-only', () => {
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
  let challanId: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `dsp-7c4-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Dispatch 7C4 Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const admin = await createUserWithPerms(app, tenant.id, slug, DISPATCH_PERMS, 'dsp7c4-admin')
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
        referenceNo: 'OPN-7C4',
      })

    const draft = await request(app)
      .post(`${dsp(fx.slug)}/outbound`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        salesOrderId,
        lines: [{ itemId: fx.itemId, warehouseId: fx.warehouseId, quantity: 3, salesOrderLineId: lineId }],
      })
    expect(draft.status).toBe(201)
    dispatchId = draft.body.data.id
    dispatchLineId = draft.body.data.lines[0].id

    await request(app)
      .post(`${dsp(fx.slug)}/orders/${dispatchId}/reservations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        lines: [{ outboundDispatchLineId: dispatchLineId, quantity: 3 }],
        idempotencyKey: `7c4-res-${dispatchId}`,
      })

    const pickLists = await request(app)
      .post(`${dsp(fx.slug)}/orders/${dispatchId}/pick-lists`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: `7c4-pkl-${dispatchId}` })
    pickListId = pickLists.body.data[0].id
    pickLineId = pickLists.body.data[0].lines[0].id

    await request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/release`).set('Authorization', `Bearer ${token}`)
    await request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/start`).set('Authorization', `Bearer ${token}`)
    await request(app)
      .post(`${dsp(fx.slug)}/pick-lists/${pickListId}/pick`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pickLineId, quantity: 3, idempotencyKey: `7c4-pick-${pickLineId}` })
    await request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/complete`).set('Authorization', `Bearer ${token}`)

    const sessions = await request(app)
      .post(`${dsp(fx.slug)}/orders/${dispatchId}/packing-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: `7c4-pack-sess-${dispatchId}` })
    packingSessionId = sessions.body.data[0].id

    await request(app)
      .post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/start`)
      .set('Authorization', `Bearer ${token}`)
    const pkg = await request(app)
      .post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/packages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ packageReference: 'BOX-7C4' })
    packageId = pkg.body.data.id

    await request(app)
      .post(`${dsp(fx.slug)}/packages/${packageId}/pack`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pickLineId, quantity: 3, idempotencyKey: `7c4-pack-${packageId}` })
    await request(app)
      .post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
    await request(app)
      .post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/verify`)
      .set('Authorization', `Bearer ${token}`)
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

  it('creates draft challan from packed session', async () => {
    const before = await onHandQty()
    const res = await auth(
      request(app).post(`${dsp(fx.slug)}/orders/${dispatchId}/delivery-challans`).send({
        idempotencyKey: `7c4-dc-${dispatchId}`,
      }),
    )
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.totalQuantity).toBe(3)
    expect(res.body.data.challanNumber).toBeNull()
    challanId = res.body.data.id
    expect(await onHandQty()).toBe(before)
  })

  it('duplicate active challan blocked', async () => {
    const res = await auth(request(app).post(`${dsp(fx.slug)}/orders/${dispatchId}/delivery-challans`).send({}))
    expect(res.status).toBe(409)
  })

  it('fulfilment unchanged after challan create', async () => {
    const res = await auth(request(app).get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment`))
    expect(res.status).toBe(200)
    expect(res.body.data.lines[0].dispatchedQty).toBe(0)
  })

  it('draft challan blocks basic confirm', async () => {
    const confirm = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/confirm`))
    expect(confirm.status).toBe(409)
  })

  it('submit → approve → issue assigns number and HTML', async () => {
    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanId}/ready-for-review`))
    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanId}/approve`))
    const issued = await auth(
      request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanId}/issue`).send({
        idempotencyKey: `7c4-issue-${challanId}`,
      }),
    )
    expect(issued.status).toBe(200)
    expect(issued.body.data.status).toBe('ISSUED')
    expect(issued.body.data.challanNumber).toMatch(/^DC-/)
    expect(issued.body.data.documentGenStatus).toBe('GENERATED')

    const again = await auth(
      request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanId}/issue`).send({
        idempotencyKey: `7c4-issue-${challanId}-2`,
      }),
    )
    expect(again.status).toBe(200)
    expect(again.body.data.challanNumber).toBe(issued.body.data.challanNumber)

    const preview = await auth(request(app).get(`${dsp(fx.slug)}/delivery-challans/${challanId}/preview`))
    expect(preview.status).toBe(200)
    expect(preview.text).toContain('Delivery Challan')
    expect(preview.text).not.toContain('DRAFT — NOT ISSUED')
  })

  it('no FG_DISPATCH from issue', async () => {
    const movements = await prisma.inventoryStockMovement.count({
      where: { tenantId: fx.tenantId, referenceType: 'FG_DISPATCH' },
    })
    expect(movements).toBe(0)
  })

  it('after issued challan, confirm allowed once', async () => {
    const before = await onHandQty()
    const confirm = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/confirm`))
    expect(confirm.status).toBe(200)
    expect(await onHandQty()).toBe(before - 3)
    const fulfil = await auth(request(app).get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment`))
    expect(fulfil.body.data.lines[0].dispatchedQty).toBe(3)
  })
})
