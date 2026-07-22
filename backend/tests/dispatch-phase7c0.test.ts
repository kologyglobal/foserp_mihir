/**
 * Dispatch Phase 7C0 — SO fulfilment projection + OutboundDispatch confirm (FG_DISPATCH).
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

function inv(slug: string) {
  return `/api/v1/t/${slug}/inventory`
}
function crm(slug: string) {
  return `/api/v1/t/${slug}/crm`
}
function dsp(slug: string) {
  return `/api/v1/t/${slug}/dispatch`
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
        entityType: { in: ['STOCK_MOVEMENT', 'STOCK_RESERVATION', 'OUTBOUND_DISPATCH', 'SALES_ORDER'] },
      },
    })
    .catch(() => {})
  await cleanupTenant(tenantId)
}

describe.skipIf(!dbAvailable)('Dispatch Phase 7C0 — fulfilment + FG_DISPATCH', () => {
  let fx: ManufacturingFixture
  let token: string
  let salesOrderId: string
  let lineId: string
  let viewOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `dsp-7c0-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Dispatch 7C0 Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const admin = await createUserWithPerms(app, tenant.id, slug, DISPATCH_PERMS, 'dsp-admin')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: admin.token,
      userId: admin.userId,
    })
    token = admin.token

    const viewOnly = await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['dispatch.view', 'crm.sales_order.view', 'inventory.stock.view'] as PermissionName[],
      'dsp-view',
    )
    viewOnlyToken = viewOnly.token

    const so = await createConfirmedSalesOrderWithLine(app, fx, token, {
      productId: fx.itemId,
      qty: 10,
      unitPrice: 5000,
    })
    salesOrderId = so.salesOrderId
    lineId = so.lineId

    const opening = await request(app)
      .post(`${inv(fx.slug)}/movements/opening`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: fx.itemId,
        warehouseId: fx.warehouseId,
        quantity: 20,
        referenceNo: 'OPN-7C0',
      })
    expect(opening.status).toBe(201)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupDispatchTenant(fx.tenantId)
  })

  function auth(req: request.Test, t = token) {
    return req.set('Authorization', `Bearer ${t}`)
  }

  it('projects SO fulfilment ordered / remaining before dispatch', async () => {
    const res = await auth(request(app).get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment`))
    expect(res.status).toBe(200)
    expect(res.body.data.salesOrderId).toBe(salesOrderId)
    expect(res.body.data.lines).toHaveLength(1)
    expect(res.body.data.lines[0].salesOrderLineId).toBe(lineId)
    expect(res.body.data.lines[0].orderedQty).toBe(10)
    expect(res.body.data.lines[0].dispatchedQty).toBe(0)
    expect(res.body.data.lines[0].remainingQty).toBe(10)
  })

  it('creates draft outbound dispatch, confirms FG_DISPATCH, updates fulfilment', async () => {
    const create = await auth(request(app).post(`${dsp(fx.slug)}/outbound`)).send({
      salesOrderId,
      remarks: '7C0 thin slice',
      lines: [
        {
          itemId: fx.itemId,
          warehouseId: fx.warehouseId,
          quantity: 4,
          salesOrderLineId: lineId,
        },
      ],
    })
    expect(create.status).toBe(201)
    expect(create.body.data.status).toBe('DRAFT')
    expect(create.body.data.dispatchNo).toMatch(/^DSP-/)
    const dispatchId = create.body.data.id as string
    const dispatchLineId = create.body.data.lines[0].id as string

    const firstReserve = await auth(
      request(app).post(`${dsp(fx.slug)}/orders/${dispatchId}/reservations`),
    ).send({
      lines: [{ outboundDispatchLineId: dispatchLineId, quantity: 2 }],
      idempotencyKey: `7c0-res-a-${dispatchId}`,
    })
    expect(firstReserve.status).toBe(201)

    const secondReserve = await auth(
      request(app).post(`${dsp(fx.slug)}/orders/${dispatchId}/reservations`),
    ).send({
      lines: [{ outboundDispatchLineId: dispatchLineId, quantity: 2 }],
      idempotencyKey: `7c0-res-b-${dispatchId}`,
    })
    expect(secondReserve.status).toBe(201)

    const firstReservationId = firstReserve.body.data[0].id as string
    const partialRelease = await auth(
      request(app).post(`${dsp(fx.slug)}/orders/${dispatchId}/reservations/release`),
    ).send({
      quantities: [{ reservationId: firstReservationId, quantity: 1 }],
      reason: 'Released before confirm',
    })
    expect(partialRelease.status).toBe(200)

    const forbidden = await auth(
      request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/confirm`),
      viewOnlyToken,
    )
    expect(forbidden.status).toBe(403)

    const confirm = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/confirm`))
    expect(confirm.status).toBe(200)
    expect(confirm.body.data.status).toBe('CONFIRMED')
    expect(confirm.body.data.lines[0].inventoryMovementId).toBeTruthy()
    expect(confirm.body.data.lines[0].inventoryMovementNo).toMatch(/^STM-/)

    const again = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/confirm`))
    expect(again.status).toBe(200)
    expect(again.body.data.status).toBe('CONFIRMED')

    const movement = await prisma.inventoryStockMovement.findFirst({
      where: { tenantId: fx.tenantId, idempotencyKey: `fg-dispatch:${dispatchId}:${confirm.body.data.lines[0].id}` },
    })
    expect(movement).toBeTruthy()
    expect(movement!.referenceType).toBe('FG_DISPATCH')
    expect(Number(movement!.quantity)).toBe(-4)

    const position = await auth(
      request(app)
        .get(`${inv(fx.slug)}/balances/position`)
        .query({ itemId: fx.itemId, warehouseId: fx.warehouseId }),
    )
    expect(position.status).toBe(200)
    expect(Number(position.body.data.onHandQty)).toBe(16)
    expect(Number(position.body.data.reservedQty)).toBe(0)
    expect(Number(position.body.data.freeQty)).toBe(16)

    const dispatchReservations = await prisma.inventoryStockReservation.findMany({
      where: {
        tenantId: fx.tenantId,
        outboundDispatchLineId: dispatchLineId,
        demandType: 'DISPATCH',
      },
      orderBy: { createdAt: 'asc' },
    })
    expect(dispatchReservations).toHaveLength(2)
    expect(dispatchReservations.every((reservation) => reservation.status === 'FULFILLED')).toBe(true)
    expect(dispatchReservations.map((reservation) => Number(reservation.fulfilledQty))).toEqual([1, 2])
    expect(dispatchReservations.map((reservation) => Number(reservation.releasedQty))).toEqual([1, 0])

    const fulfilment = await auth(request(app).get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment`))
    expect(fulfilment.status).toBe(200)
    expect(fulfilment.body.data.lines[0].dispatchedQty).toBe(4)
    expect(fulfilment.body.data.lines[0].remainingQty).toBe(6)
  })

  it('rejects over-dispatch against remaining fulfilment', async () => {
    const create = await auth(request(app).post(`${dsp(fx.slug)}/outbound`)).send({
      salesOrderId,
      lines: [
        {
          itemId: fx.itemId,
          warehouseId: fx.warehouseId,
          quantity: 7,
          salesOrderLineId: lineId,
        },
      ],
    })
    expect(create.status).toBe(400)
  })

  it('sets cancelled qty and reduces remaining', async () => {
    const res = await auth(
      request(app).post(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment/lines/${lineId}/cancelled-qty`),
    ).send({ cancelledQty: 2 })
    expect(res.status).toBe(200)
    expect(res.body.data.lines[0].cancelledQty).toBe(2)
    expect(res.body.data.lines[0].netOrderedQty).toBe(8)
    expect(res.body.data.lines[0].remainingQty).toBe(4)

    const overCancel = await auth(
      request(app).post(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment/lines/${lineId}/cancelled-qty`),
    ).send({ cancelledQty: 9 })
    expect(overCancel.status).toBe(400)
  })

  it('cancels draft outbound before confirm', async () => {
    const create = await auth(request(app).post(`${dsp(fx.slug)}/outbound`)).send({
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
    expect(create.status).toBe(201)
    const cancel = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${create.body.data.id}/cancel`)).send({
      reason: 'test cancel',
    })
    expect(cancel.status).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')
  })
})
