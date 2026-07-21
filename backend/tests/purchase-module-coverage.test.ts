import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'

/**
 * Remaining Purchase coverage gaps after Phase 15:
 * - Cross-tenant document GET by id
 * - HTTP double-approve planning idempotency
 * - RFQ → VQ → comparison → award → create-PO (+ duplicate blocked)
 */
const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

async function ensurePermissions() {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({
        where: { name },
        create: { name, module, description: name },
        update: {},
      })
      .catch(() => {})
  }
}

async function createTenantUser(opts: {
  slugPrefix: string
  permissionNames: PermissionName[]
}) {
  const { hashPassword } = await import('../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${opts.slugPrefix}-${Date.now()}`
  const tenant = await prisma.tenant.create({
    data: { name: 'Purchase Coverage', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Cov',
      lastName: 'Tester',
      email: `user-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const perms = await prisma.permission.findMany({
    where: { name: { in: opts.permissionNames } },
  })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Role ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id } })
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })
  return {
    tenantId: tenant.id,
    userId: user.id,
    slug,
    token: loginRes.body.data?.accessToken as string,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.purchaseOrderLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } })
  await prisma.vendorComparisonLine.deleteMany({ where: { tenantId } })
  await prisma.vendorComparison.deleteMany({ where: { tenantId } })
  await prisma.vendorQuotationLine.deleteMany({ where: { tenantId } })
  await prisma.vendorQuotation.deleteMany({ where: { tenantId } })
  await prisma.rfqVendor.deleteMany({ where: { tenantId } })
  await prisma.requestForQuotationLine.deleteMany({ where: { tenantId } })
  await prisma.requestForQuotation.deleteMany({ where: { tenantId } })
  await prisma.purchasePlanningRow.deleteMany({ where: { tenantId } })
  await prisma.purchaseApproval.deleteMany({ where: { tenantId } })
  await prisma.purchaseStatusHistory.deleteMany({ where: { tenantId } })
  await prisma.purchaseRequisitionLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseRequisition.deleteMany({ where: { tenantId } })
  await prisma.masterVendor.deleteMany({ where: { tenantId } })
  await prisma.masterUom.deleteMany({ where: { tenantId } })
  await prisma.auditLog.deleteMany({ where: { tenantId } })
  await prisma.codeSeries.deleteMany({ where: { tenantId } })
  await prisma.userRole.deleteMany({ where: { tenantId } })
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } })
  await prisma.role.deleteMany({ where: { tenantId } })
  await prisma.user.deleteMany({ where: { tenantId } })
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

const FULL_PURCHASE_PERMS = PERMISSIONS.filter((p) => p.startsWith('purchase.')) as PermissionName[]

describe.skipIf(!dbAvailable)('Purchase module coverage gaps', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let uomId = ''
  let vendorId = ''

  const prBase = () => `/api/v1/t/${slug}/purchase/requisitions`
  const ppsBase = () => `/api/v1/t/${slug}/purchase/planning-sheet`
  const rfqBase = () => `/api/v1/t/${slug}/purchase/rfqs`
  const vqBase = () => `/api/v1/t/${slug}/purchase/vendor-quotations`
  const cmpBase = () => `/api/v1/t/${slug}/purchase/comparisons`

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createTenantUser({
      slugPrefix: 'pcov',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = ctx.tenantId
    slug = ctx.slug
    token = ctx.token
    expect(token).toBeTruthy()

    const uom = await prisma.masterUom.create({
      data: { tenantId, code: `U-${Date.now()}`, name: 'EA', status: 'ACTIVE' },
    })
    uomId = uom.id
    const vendor = await prisma.masterVendor.create({
      data: { tenantId, code: `V-${Date.now()}`, name: 'Coverage Vendor', status: 'ACTIVE' },
    })
    vendorId = vendor.id
  }, 90_000)

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId)
  })

  function auth(t = token) {
    return { Authorization: `Bearer ${t}` }
  }

  it('rejects cross-tenant PR and planning GET by id', async () => {
    const createRes = await request(app)
      .post(prBase())
      .set(auth())
      .send({
        requisitionDate: '2026-07-01',
        requiredDate: '2026-07-20',
        departmentId: 'dept-ops',
        rfqRequired: false,
        priority: 'NORMAL',
        lines: [
          {
            itemCode: 'X1',
            itemName: 'Cross Tenant',
            requiredQuantity: 2,
            estimatedRate: 5,
            uomId,
            requiredDate: '2026-07-20',
          },
        ],
      })
    expect(createRes.status).toBe(201)
    const prId = createRes.body.data.id as string
    await request(app).post(`${prBase()}/${prId}/submit`).set(auth()).send({})
    await request(app).post(`${prBase()}/${prId}/approve`).set(auth()).send({})

    const planning = await prisma.purchasePlanningRow.findFirst({
      where: { tenantId, purchaseRequisitionId: prId, deletedAt: null },
    })
    expect(planning).toBeTruthy()

    const other = await createTenantUser({
      slugPrefix: 'pcov-other',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    try {
      const prOther = await request(app)
        .get(`/api/v1/t/${other.slug}/purchase/requisitions/${prId}`)
        .set(auth(other.token))
      expect([403, 404]).toContain(prOther.status)

      const ppsOther = await request(app)
        .get(`/api/v1/t/${other.slug}/purchase/planning-sheet/${planning!.id}`)
        .set(auth(other.token))
      expect([403, 404]).toContain(ppsOther.status)
    } finally {
      await cleanupTenant(other.tenantId)
    }
  }, 90_000)

  it('double-approve via HTTP does not duplicate planning rows', async () => {
    const createRes = await request(app)
      .post(prBase())
      .set(auth())
      .send({
        requisitionDate: '2026-07-01',
        requiredDate: '2026-07-20',
        departmentId: 'dept-ops',
        rfqRequired: false,
        priority: 'NORMAL',
        lines: [
          {
            itemCode: 'D1',
            itemName: 'Double Approve',
            requiredQuantity: 3,
            estimatedRate: 4,
            uomId,
            requiredDate: '2026-07-20',
          },
          {
            itemCode: 'D2',
            itemName: 'Double Approve 2',
            requiredQuantity: 5,
            estimatedRate: 6,
            uomId,
            requiredDate: '2026-07-20',
          },
        ],
      })
    const prId = createRes.body.data.id as string
    await request(app).post(`${prBase()}/${prId}/submit`).set(auth()).send({})
    const first = await request(app).post(`${prBase()}/${prId}/approve`).set(auth()).send({})
    expect(first.status).toBe(200)

    const before = await prisma.purchasePlanningRow.count({
      where: { tenantId, purchaseRequisitionId: prId, deletedAt: null },
    })
    expect(before).toBe(2)

    const second = await request(app).post(`${prBase()}/${prId}/approve`).set(auth()).send({})
    expect([400, 409, 422]).toContain(second.status)

    const after = await prisma.purchasePlanningRow.count({
      where: { tenantId, purchaseRequisitionId: prId, deletedAt: null },
    })
    expect(after).toBe(2)
  }, 90_000)

  it('RFQ path: award comparison → create PO; duplicate create-PO blocked', async () => {
    const createRes = await request(app)
      .post(prBase())
      .set(auth())
      .send({
        requisitionDate: '2026-07-01',
        requiredDate: '2026-07-20',
        departmentId: 'dept-ops',
        rfqRequired: true,
        priority: 'NORMAL',
        lines: [
          {
            itemCode: 'R1',
            itemName: 'RFQ Item',
            requiredQuantity: 4,
            estimatedRate: 10,
            uomId,
            preferredVendorId: vendorId,
            requiredDate: '2026-07-20',
          },
        ],
      })
    expect(createRes.status).toBe(201)
    const prId = createRes.body.data.id as string
    await request(app).post(`${prBase()}/${prId}/submit`).set(auth()).send({})
    await request(app).post(`${prBase()}/${prId}/approve`).set(auth()).send({})

    const planningCount = await prisma.purchasePlanningRow.count({
      where: { tenantId, purchaseRequisitionId: prId, deletedAt: null },
    })
    expect(planningCount).toBe(0)

    const rfqRes = await request(app)
      .post(`${prBase()}/${prId}/convert-to-rfq`)
      .set(auth())
      .send({ vendorIds: [vendorId] })
    expect(rfqRes.status).toBe(201)
    const rfqId = rfqRes.body.data.id as string

    await request(app).post(`${rfqBase()}/${rfqId}/send`).set(auth()).send({})

    const rfqDetail = await request(app).get(`${rfqBase()}/${rfqId}`).set(auth())
    const rfqLineId = rfqDetail.body.data.lines[0].id as string

    const vqRes = await request(app)
      .post(vqBase())
      .set(auth())
      .send({
        requestForQuotationId: rfqId,
        vendorId,
        quotationDate: '2026-07-05',
        lines: [
          {
            requestForQuotationLineId: rfqLineId,
            itemCodeSnapshot: 'R1',
            itemNameSnapshot: 'RFQ Item',
            quantity: 4,
            uomId,
            rate: 11,
          },
        ],
      })
    expect(vqRes.status).toBe(201)
    const vqId = vqRes.body.data.id as string
    const submitVq = await request(app).post(`${vqBase()}/${vqId}/submit`).set(auth()).send({})
    expect(submitVq.status).toBe(200)

    const cmpRes = await request(app)
      .post(cmpBase())
      .set(auth())
      .send({ requestForQuotationId: rfqId })
    expect(cmpRes.status).toBe(201)
    const comparisonId = cmpRes.body.data.id as string

    const award = await request(app)
      .post(`${cmpBase()}/${comparisonId}/award`)
      .set(auth())
      .send({ awardedVendorQuotationId: vqId, selectionReason: 'Best landed cost' })
    expect(award.status).toBe(200)

    const poRes = await request(app)
      .post(`${cmpBase()}/${comparisonId}/create-po`)
      .set(auth())
      .send({})
    expect(poRes.status).toBe(201)
    expect(poRes.body.data.id).toBeTruthy()

    const dup = await request(app)
      .post(`${cmpBase()}/${comparisonId}/create-po`)
      .set(auth())
      .send({})
    expect(dup.status).toBe(409)

    const poCount = await prisma.purchaseOrder.count({
      where: { tenantId, vendorComparisonId: comparisonId, deletedAt: null },
    })
    expect(poCount).toBe(1)

    const stamped = await prisma.purchaseRequisitionLine.findMany({
      where: { tenantId, purchaseRequisitionId: prId },
    })
    expect(stamped.length).toBeGreaterThan(0)
    for (const line of stamped) {
      expect(line.status).toBe('CONVERTED')
      expect(line.purchaseOrderId).toBe(poRes.body.data.id)
      expect(line.purchaseOrderNumberSnapshot).toBeTruthy()
    }

    // RFQ path must never create planning rows for this PR
    expect(
      await prisma.purchasePlanningRow.count({
        where: { tenantId, purchaseRequisitionId: prId, deletedAt: null },
      }),
    ).toBe(0)
  }, 120_000)

  it('planning create-po loser returns business conflict (not unhandled 500)', async () => {
    const createRes = await request(app)
      .post(prBase())
      .set(auth())
      .send({
        requisitionDate: '2026-07-01',
        requiredDate: '2026-07-20',
        departmentId: 'dept-ops',
        rfqRequired: false,
        priority: 'NORMAL',
        lines: [
          {
            itemCode: 'C2',
            itemName: 'Conflict Map',
            requiredQuantity: 2,
            estimatedRate: 5,
            uomId,
            requiredDate: '2026-07-20',
          },
        ],
      })
    const prId = createRes.body.data.id as string
    await request(app).post(`${prBase()}/${prId}/submit`).set(auth()).send({})
    await request(app).post(`${prBase()}/${prId}/approve`).set(auth()).send({})
    const row = await prisma.purchasePlanningRow.findFirst({
      where: { tenantId, purchaseRequisitionId: prId, deletedAt: null },
    })
    expect(row).toBeTruthy()

    await request(app)
      .post(`${ppsBase()}/bulk-select-vendor`)
      .set(auth())
      .send({ rowIds: [row!.id], vendorId, expectedRate: 12, negotiatedRate: 11 })
    await request(app)
      .post(`${ppsBase()}/bulk-status`)
      .set(auth())
      .send({ rowIds: [row!.id], status: 'APPROVED' })

    const [a, b] = await Promise.all([
      request(app).post(`${ppsBase()}/create-po`).set(auth()).send({ rowIds: [row!.id] }),
      request(app).post(`${ppsBase()}/create-po`).set(auth()).send({ rowIds: [row!.id] }),
    ])
    const statuses = [a.status, b.status]
    expect(statuses).toContain(201)
    const loser = statuses.find((s) => s !== 201)!
    expect([400, 409, 422]).toContain(loser)
    expect(loser).not.toBe(500)

    expect(
      await prisma.purchaseOrder.count({
        where: { tenantId, purchaseRequisitionId: prId, deletedAt: null },
      }),
    ).toBe(1)
  }, 90_000)
})
