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
import {
  buildProductionReadySetup,
  cleanupProductionData,
  type ProductionReadySetup,
} from './manufacturing/helpers/production-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const PURCHASE_PERMS = PERMISSIONS.filter(
  (p) => p.startsWith('purchase.requisition.') || p.startsWith('master.'),
) as PermissionName[]

const SETUP_PERMS = Array.from(
  new Set([
    ...PURCHASE_PERMS,
    ...PERMISSIONS.filter((p) => p.startsWith('manufacturing.')),
  ]),
) as PermissionName[]

const APPROVER_PERMS = [
  'purchase.requisition.view',
  'purchase.requisition.create',
  'purchase.requisition.edit',
  'purchase.requisition.submit',
  'purchase.requisition.approve',
  'purchase.requisition.cancel',
  'master.item.view',
] as PermissionName[]

const VIEW_ONLY_PERMS = ['purchase.requisition.view', 'master.item.view'] as PermissionName[]

function base(slug: string) {
  return `/api/v1/t/${slug}/purchase/requisitions`
}

function mfgBase(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

async function cleanupPurchaseTenant(tenantId: string): Promise<void> {
  await prisma.purchaseRequisitionLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.purchaseRequisition.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.codeSeries
    .deleteMany({ where: { tenantId, entityType: 'PURCHASE_REQUISITION' } })
    .catch(() => {})
  await cleanupProductionData(tenantId)
  await cleanupTenant(tenantId)
}

describe.skipIf(!dbAvailable)('Purchase Phase 3B — purchase requisition foundation', () => {
  let fx: ManufacturingFixture
  let setup: ProductionReadySetup
  let workOrderId: string
  let nonPurchasableItemId: string
  let approverToken: string
  let viewOnlyToken: string
  let otherTenantSlug: string
  let otherTenantToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `pr-p3b-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Purchase PR Test Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const { userId, token } = await createUserWithPerms(app, tenant.id, slug, SETUP_PERMS, 'pr-admin')
    fx = await bootstrapManufacturingFixture({ tenantId: tenant.id, slug, token, userId })
    setup = await buildProductionReadySetup(app, fx)

    const nonPurchasable = await prisma.masterItem.create({
      data: {
        tenantId: fx.tenantId,
        code: `NP-${Date.now()}`.slice(-24),
        name: 'Non Purchasable Item',
        categoryId: (await prisma.masterItemCategory.findFirst({ where: { tenantId: fx.tenantId } }))!.id,
        baseUomId: fx.uomId,
        itemType: 'raw_material',
        isPurchasable: false,
      },
    })
    nonPurchasableItemId = nonPurchasable.id

    const wo = await request(app)
      .post(`${mfgBase(fx.slug)}/work-orders`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        productItemId: fx.itemId,
        plannedQuantity: 5,
        requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    workOrderId = wo.body.data.id as string

    const approver = await createUserWithPerms(app, fx.tenantId, fx.slug, APPROVER_PERMS, 'pr-approver')
    approverToken = approver.token

    const viewOnly = await createUserWithPerms(app, fx.tenantId, fx.slug, VIEW_ONLY_PERMS, 'pr-view')
    viewOnlyToken = viewOnly.token

    const other = await prisma.tenant.create({
      data: {
        name: 'Purchase Other Co',
        slug: `pr-other-${Date.now()}`,
        email: `pr-other-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
    })
    otherTenantSlug = other.slug
    const otherUser = await createUserWithPerms(app, other.id, other.slug, PURCHASE_PERMS, 'pr-other')
    otherTenantToken = otherUser.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupPurchaseTenant(fx.tenantId)
    const otherTenant = await prisma.tenant.findFirst({ where: { slug: otherTenantSlug } })
    if (otherTenant) await cleanupPurchaseTenant(otherTenant.id)
  })

  function auth(token: string) {
    return (req: request.Test) => req.set('Authorization', `Bearer ${token}`)
  }

  it('creates manual draft with lines', async () => {
    const res = await auth(fx.token)(
      request(app)
        .post(base(fx.slug))
        .send({
          priority: 'HIGH',
          purpose: 'Urgent chassis parts',
          warehouseId: fx.warehouseId,
          lines: [{ itemId: fx.subComponentItemId, quantity: 10, warehouseId: fx.warehouseId, uomId: fx.uomId }],
        }),
    )

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.source).toBe('MANUAL')
    expect(res.body.data.prNumber).toMatch(/^PR-/)
    expect(res.body.data.lines).toHaveLength(1)
    expect(res.body.data.lines[0].quantity).toBe('10')
  })

  it('submit → approve lifecycle', async () => {
    const created = await auth(fx.token)(
      request(app)
        .post(base(fx.slug))
        .send({
          lines: [{ itemId: fx.subComponentItemId, quantity: 4 }],
        }),
    )
    expect(created.status).toBe(201)
    const id = created.body.data.id as string

    const submitted = await auth(fx.token)(request(app).post(`${base(fx.slug)}/${id}/submit`))
    expect(submitted.status).toBe(200)
    expect(submitted.body.data.status).toBe('SUBMITTED')

    const approved = await auth(approverToken)(request(app).post(`${base(fx.slug)}/${id}/approve`))
    expect(approved.status).toBe(200)
    expect(approved.body.data.status).toBe('APPROVED')
    expect(approved.body.data.approvedBy).toBeTruthy()
  })

  it('rejects submitted requisition with reason', async () => {
    const created = await auth(fx.token)(
      request(app)
        .post(base(fx.slug))
        .send({ lines: [{ itemId: fx.subComponentItemId, quantity: 2 }] }),
    )
    const id = created.body.data.id as string
    await auth(fx.token)(request(app).post(`${base(fx.slug)}/${id}/submit`))

    const rejected = await auth(approverToken)(
      request(app).post(`${base(fx.slug)}/${id}/reject`).send({ reason: 'Budget not approved' }),
    )
    expect(rejected.status).toBe(200)
    expect(rejected.body.data.status).toBe('REJECTED')
    expect(rejected.body.data.rejectionReason).toBe('Budget not approved')
  })

  it('cancels draft requisition', async () => {
    const created = await auth(fx.token)(
      request(app)
        .post(base(fx.slug))
        .send({ lines: [{ itemId: fx.subComponentItemId, quantity: 1 }] }),
    )
    const id = created.body.data.id as string

    const cancelled = await auth(fx.token)(
      request(app).post(`${base(fx.slug)}/${id}/cancel`).send({ reason: 'No longer needed' }),
    )
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')
  })

  it('from-production-shortage creates PRODUCTION_SHORTAGE source with WO refs', async () => {
    const res = await auth(fx.token)(
      request(app)
        .post(`${base(fx.slug)}/from-production-shortage`)
        .send({
          productionOrderId: workOrderId,
          warehouseId: fx.warehouseId,
          purpose: 'Material shortage on WO',
          lines: [
            {
              itemId: fx.subComponentItemId,
              quantity: 6,
              bomLineId: setup.bomLineId,
              stageId: randomUUID(),
              operationId: randomUUID(),
            },
          ],
        }),
    )

    expect(res.status).toBe(201)
    expect(res.body.data.source).toBe('PRODUCTION_SHORTAGE')
    expect(res.body.data.productionOrderId).toBe(workOrderId)
    expect(res.body.data.lines[0].productionOrderId).toBe(workOrderId)
    expect(res.body.data.lines[0].bomLineId).toBe(setup.bomLineId)

    const listed = await auth(fx.token)(request(app).get(`${base(fx.slug)}/by-production-order/${workOrderId}`))
    expect(listed.status).toBe(200)
    expect(listed.body.data.some((row: { id: string }) => row.id === res.body.data.id)).toBe(true)
  })

  it('idempotent create returns same requisition', async () => {
    const key = `idem-${randomUUID()}`
    const payload = {
      idempotencyKey: key,
      lines: [{ itemId: fx.subComponentItemId, quantity: 3 }],
    }

    const first = await auth(fx.token)(request(app).post(base(fx.slug)).send(payload))
    const second = await auth(fx.token)(request(app).post(base(fx.slug)).send(payload))

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.body.data.id).toBe(first.body.data.id)
    expect(second.body.data.prNumber).toBe(first.body.data.prNumber)
  })

  it('cannot edit after submit', async () => {
    const created = await auth(fx.token)(
      request(app)
        .post(base(fx.slug))
        .send({ lines: [{ itemId: fx.subComponentItemId, quantity: 2 }] }),
    )
    const id = created.body.data.id as string
    await auth(fx.token)(request(app).post(`${base(fx.slug)}/${id}/submit`))

    const patch = await auth(fx.token)(
      request(app).patch(`${base(fx.slug)}/${id}`).send({ purpose: 'Changed after submit' }),
    )
    expect(patch.status).toBe(422)
  })

  it('cannot submit without lines', async () => {
    const created = await auth(fx.token)(request(app).post(base(fx.slug)).send({ purpose: 'Empty PR' }))
    expect(created.status).toBe(201)

    const submit = await auth(fx.token)(request(app).post(`${base(fx.slug)}/${created.body.data.id}/submit`))
    expect(submit.status).toBe(422)
  })

  it('rejects non-purchasable item', async () => {
    const res = await auth(fx.token)(
      request(app)
        .post(base(fx.slug))
        .send({ lines: [{ itemId: nonPurchasableItemId, quantity: 1 }] }),
    )
    expect(res.status).toBe(422)
    expect(res.body.message ?? res.body.error?.message).toMatch(/not purchasable/i)
  })

  it('enforces tenant isolation', async () => {
    const created = await auth(fx.token)(
      request(app)
        .post(base(fx.slug))
        .send({ lines: [{ itemId: fx.subComponentItemId, quantity: 1 }] }),
    )
    const id = created.body.data.id as string

    const crossTenant = await auth(otherTenantToken)(request(app).get(`${base(otherTenantSlug)}/${id}`))
    expect(crossTenant.status).toBe(404)
  })

  it('returns 403 without permission', async () => {
    const res = await auth(viewOnlyToken)(request(app).post(base(fx.slug)).send({ purpose: 'Denied' }))
    expect(res.status).toBe(403)
  })
})
