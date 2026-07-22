import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
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

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const INVENTORY_PERMS = PERMISSIONS.filter((p) => p.startsWith('inventory.') || p.startsWith('master.')) as PermissionName[]

const VIEW_ONLY_PERMS = ['inventory.stock.view', 'master.item.view'] as PermissionName[]

const ISSUE_NO_OVERRIDE_PERMS = [
  'inventory.issues.post',
  'inventory.stock.view',
  'master.item.view',
] as PermissionName[]

function base(slug: string) {
  return `/api/v1/t/${slug}/inventory`
}

async function cleanupInventoryTenant(tenantId: string): Promise<void> {
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockReservation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.codeSeries
    .deleteMany({ where: { tenantId, entityType: { in: ['STOCK_MOVEMENT', 'STOCK_RESERVATION'] } } })
    .catch(() => {})
  await cleanupTenant(tenantId)
}

describe.skipIf(!dbAvailable)('Inventory Phase 3A — stock ledger foundation', () => {
  let fx: ManufacturingFixture
  let workOrderId: string
  let otherTenantSlug: string
  let otherTenantToken: string
  let viewOnlyToken: string
  let issueNoOverrideToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `inv-p3a-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Inventory Test Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const { userId, token } = await createUserWithPerms(app, tenant.id, slug, INVENTORY_PERMS, 'inv-admin')
    fx = await bootstrapManufacturingFixture({ tenantId: tenant.id, slug, token, userId })
    workOrderId = randomUUID()

    const other = await prisma.tenant.create({
      data: {
        name: 'Inventory Other Co',
        slug: `inv-other-${Date.now()}`,
        email: `inv-other-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
    })
    otherTenantSlug = other.slug
    const otherUser = await createUserWithPerms(app, other.id, other.slug, INVENTORY_PERMS, 'inv-other')
    otherTenantToken = otherUser.token

    const viewOnly = await createUserWithPerms(app, fx.tenantId, fx.slug, VIEW_ONLY_PERMS, 'inv-view')
    viewOnlyToken = viewOnly.token

    const issueUser = await createUserWithPerms(app, fx.tenantId, fx.slug, ISSUE_NO_OVERRIDE_PERMS, 'inv-issue')
    issueNoOverrideToken = issueUser.token
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupInventoryTenant(fx.tenantId)
    const otherTenant = await prisma.tenant.findFirst({ where: { slug: otherTenantSlug } })
    if (otherTenant) await cleanupInventoryTenant(otherTenant.id)
  })

  it('opening stock creates balance', async () => {
    const res = await request(app)
      .post(`${base(fx.slug)}/movements/opening`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        quantity: 100,
        referenceNo: 'OPN-001',
      })

    expect(res.status).toBe(201)
    expect(res.body.data.movementType).toBe('OPENING')
    expect(res.body.data.quantity).toBe('100')
    expect(res.body.data.balanceAfter).toBe('100')

    const position = await request(app)
      .get(`${base(fx.slug)}/balances/position`)
      .query({ itemId: fx.componentItemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(position.status).toBe(200)
    expect(position.body.data.onHandQty).toBe('100')
    expect(position.body.data.freeQty).toBe('100')
  })

  it('reserve reduces freeQty; cannot reserve more than free', async () => {
    const reserve = await request(app)
      .post(`${base(fx.slug)}/reservations`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        quantity: 30,
        demandType: 'WO',
        demandId: workOrderId,
      })

    expect(reserve.status).toBe(201)
    expect(reserve.body.data.status).toBe('ACTIVE')

    const position = await request(app)
      .get(`${base(fx.slug)}/balances/position`)
      .query({ itemId: fx.componentItemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(position.body.data.onHandQty).toBe('100')
    expect(position.body.data.reservedQty).toBe('30')
    expect(position.body.data.freeQty).toBe('70')

    const overReserve = await request(app)
      .post(`${base(fx.slug)}/reservations`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        quantity: 80,
        demandType: 'SO',
        demandId: randomUUID(),
      })

    expect(overReserve.status).toBe(422)
  })

  it('issue-to-wo posts negative movement and updates onHand', async () => {
    const res = await request(app)
      .post(`${base(fx.slug)}/movements/issue-to-work-order`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        quantity: 20,
        workOrderId,
      })

    expect(res.status).toBe(201)
    expect(res.body.data.movementType).toBe('ISSUE')
    expect(res.body.data.referenceType).toBe('ISSUE_TO_WO')
    expect(res.body.data.quantity).toBe('-20')

    const position = await request(app)
      .get(`${base(fx.slug)}/balances/position`)
      .query({ itemId: fx.componentItemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(position.body.data.onHandQty).toBe('80')
    expect(position.body.data.reservedQty).toBe('10')
    expect(position.body.data.freeQty).toBe('70')
  })

  it('cannot issue more than free stock', async () => {
    const res = await request(app)
      .post(`${base(fx.slug)}/movements/issue`)
      .set('Authorization', `Bearer ${issueNoOverrideToken}`)
      .send({
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        quantity: 75,
      })

    expect(res.status).toBe(422)
  })

  it('FG receipt increases onHand', async () => {
    const res = await request(app)
      .post(`${base(fx.slug)}/movements/fg-receipt`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        itemId: fx.itemId,
        warehouseId: fx.warehouseId,
        quantity: 5,
        workOrderId,
      })

    expect(res.status).toBe(201)
    expect(res.body.data.referenceType).toBe('FG_RECEIPT')
    expect(res.body.data.quantity).toBe('5')

    const position = await request(app)
      .get(`${base(fx.slug)}/balances/position`)
      .query({ itemId: fx.itemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(position.body.data.onHandQty).toBe('5')
  })

  it('return-from-wo increases onHand', async () => {
    const before = await request(app)
      .get(`${base(fx.slug)}/balances/position`)
      .query({ itemId: fx.componentItemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    const res = await request(app)
      .post(`${base(fx.slug)}/movements/return-from-work-order`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        quantity: 3,
        workOrderId,
      })

    expect(res.status).toBe(201)
    expect(res.body.data.referenceType).toBe('RETURN_FROM_WO')
    expect(res.body.data.quantity).toBe('3')

    const after = await request(app)
      .get(`${base(fx.slug)}/balances/position`)
      .query({ itemId: fx.componentItemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(Number(after.body.data.onHandQty)).toBe(Number(before.body.data.onHandQty) + 3)
  })

  it('idempotent movement replay returns same movement', async () => {
    const key = `idem-${randomUUID()}`
    const payload = {
      itemId: fx.subComponentItemId,
      warehouseId: fx.warehouseId,
      quantity: 12,
      idempotencyKey: key,
    }

    const first = await request(app)
      .post(`${base(fx.slug)}/movements/opening`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(payload)
    const second = await request(app)
      .post(`${base(fx.slug)}/movements/opening`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(payload)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.body.data.id).toBe(first.body.data.id)
    expect(second.body.data.movementNumber).toBe(first.body.data.movementNumber)
  })

  it('cancel reservation releases reserved quantity', async () => {
    const demandId = randomUUID()
    const created = await request(app)
      .post(`${base(fx.slug)}/reservations`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        itemId: fx.subComponentItemId,
        warehouseId: fx.warehouseId,
        quantity: 4,
        demandType: 'SO',
        demandId,
      })

    expect(created.status).toBe(201)

    const before = await request(app)
      .get(`${base(fx.slug)}/balances/position`)
      .query({ itemId: fx.subComponentItemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    const cancelled = await request(app)
      .post(`${base(fx.slug)}/reservations/${created.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ remarks: 'No longer needed' })

    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')

    const after = await request(app)
      .get(`${base(fx.slug)}/balances/position`)
      .query({ itemId: fx.subComponentItemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(Number(after.body.data.reservedQty)).toBe(Number(before.body.data.reservedQty) - 4)
    expect(Number(after.body.data.freeQty)).toBe(Number(before.body.data.freeQty) + 4)
  })

  it('reconciles stored balances against ledger and active reservations without mutating stock', async () => {
    const matched = await request(app)
      .get(`${base(fx.slug)}/balances/reconciliation`)
      .query({
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        mismatchesOnly: false,
      })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(matched.status).toBe(200)
    expect(matched.body.data.authoritativeSource).toBe('INVENTORY_STOCK_MOVEMENTS')
    expect(matched.body.data.rows).toHaveLength(1)
    expect(matched.body.data.rows[0].status).toBe('MATCHED')

    const balance = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: {
        tenantId: fx.tenantId,
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
      },
    })
    await prisma.inventoryStockBalance.update({
      where: { id: balance.id },
      data: { onHandQty: { increment: 1 } },
    })

    const mismatch = await request(app)
      .get(`${base(fx.slug)}/balances/reconciliation`)
      .query({ itemId: fx.componentItemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(mismatch.status).toBe(200)
    expect(mismatch.body.data.mismatchedPositions).toBe(1)
    expect(mismatch.body.data.rows[0].status).toBe('MISMATCHED')
    expect(mismatch.body.data.rows[0].onHandDifference).toBe('1')

    await prisma.inventoryStockBalance.update({
      where: { id: balance.id },
      data: { onHandQty: balance.onHandQty },
    })
  })

  it('enforces tenant isolation on balances', async () => {
    const res = await request(app)
      .get(`${base(otherTenantSlug)}/balances/position`)
      .query({ itemId: fx.componentItemId, warehouseId: fx.warehouseId })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(res.status).toBe(403)
  })

  it('returns 403 without permission for posting', async () => {
    const res = await request(app)
      .post(`${base(fx.slug)}/movements/opening`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
      .send({
        itemId: fx.componentItemId,
        warehouseId: fx.warehouseId,
        quantity: 1,
      })

    expect(res.status).toBe(403)
  })
})
