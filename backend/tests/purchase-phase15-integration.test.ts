import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'
import { syncPurchasePlanningRowsFromApprovedPr } from '../src/modules/purchase/planning/purchase-planning-sync.service.js'

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
    data: { name: 'Phase15 Purchase', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'P15',
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

const FULL_PURCHASE_PERMS = PERMISSIONS.filter(
  (p) => p.startsWith('purchase.pr.') || p.startsWith('purchase.planning.') || p.startsWith('purchase.po.'),
) as PermissionName[]

describe.skipIf(!dbAvailable)('Phase 15 — purchase integration', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let userId = ''
  let uomId = ''
  let vendorA = ''
  let vendorB = ''

  const prBase = () => `/api/v1/t/${slug}/purchase/requisitions`
  const ppsBase = () => `/api/v1/t/${slug}/purchase/planning-sheet`

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createTenantUser({
      slugPrefix: 'p15',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = ctx.tenantId
    slug = ctx.slug
    token = ctx.token
    userId = ctx.userId
    expect(token).toBeTruthy()

    const uom = await prisma.masterUom.create({
      data: { tenantId, code: `U-${Date.now()}`, name: 'EA', status: 'ACTIVE' },
    })
    uomId = uom.id
    const va = await prisma.masterVendor.create({
      data: { tenantId, code: `VA-${Date.now()}`, name: 'Vendor A', status: 'ACTIVE' },
    })
    const vb = await prisma.masterVendor.create({
      data: { tenantId, code: `VB-${Date.now()}`, name: 'Vendor B', status: 'ACTIVE' },
    })
    vendorA = va.id
    vendorB = vb.id
  }, 90_000)

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId)
  })

  function auth(t = token) {
    return { Authorization: `Bearer ${t}` }
  }

  function prBody(overrides: Record<string, unknown> = {}) {
    return {
      requisitionDate: '2026-07-01',
      requiredDate: '2026-07-20',
      departmentId: 'dept-ops',
      rfqRequired: false,
      priority: 'NORMAL',
      lines: [
        {
          itemCode: 'A-1',
          itemName: 'Item A',
          requiredQuantity: 10,
          estimatedRate: 5,
          uomId,
          requiredDate: '2026-07-20',
        },
      ],
      ...overrides,
    }
  }

  async function createSubmitApprove(body: Record<string, unknown>) {
    const createRes = await request(app).post(prBase()).set(auth()).send(body)
    expect(createRes.status).toBe(201)
    const id = createRes.body.data.id as string
    const submit = await request(app).post(`${prBase()}/${id}/submit`).set(auth()).send({})
    expect(submit.status).toBe(200)
    const approve = await request(app).post(`${prBase()}/${id}/approve`).set(auth()).send({})
    expect(approve.status).toBe(200)
    return id
  }

  async function readyPlanningRowsForPo(rowIds: string[], vendorId: string) {
    await request(app)
      .post(`${ppsBase()}/bulk-select-vendor`)
      .set(auth())
      .send({ rowIds, vendorId, expectedRate: 12, negotiatedRate: 11 })
    await request(app)
      .post(`${ppsBase()}/bulk-status`)
      .set(auth())
      .send({ rowIds, status: 'APPROVED' })
  }

  it('1. Approving an RFQ-required PR creates zero Planning rows', async () => {
    const id = await createSubmitApprove(prBody({ rfqRequired: true }))
    const count = await prisma.purchasePlanningRow.count({
      where: { tenantId, purchaseRequisitionId: id, deletedAt: null },
    })
    expect(count).toBe(0)
  }, 60_000)

  it('2–3. Direct PR creates one row per valid line; sync is idempotent', async () => {
    const id = await createSubmitApprove(
      prBody({
        rfqRequired: false,
        lines: [
          { itemCode: 'L1', itemName: 'Line 1', requiredQuantity: 4, estimatedRate: 2, uomId },
          { itemCode: 'L2', itemName: 'Line 2', requiredQuantity: 6, estimatedRate: 3, uomId },
        ],
      }),
    )
    const first = await prisma.purchasePlanningRow.findMany({
      where: { tenantId, purchaseRequisitionId: id, deletedAt: null },
    })
    expect(first).toHaveLength(2)

    const again = await syncPurchasePlanningRowsFromApprovedPr(id, tenantId, userId)
    expect(again.created).toBe(0)
    expect(again.skipped).toBe(2)
    const second = await prisma.purchasePlanningRow.count({
      where: { tenantId, purchaseRequisitionId: id, deletedAt: null },
    })
    expect(second).toBe(2)
  }, 60_000)

  it('4. Invalid PR lines are ignored by sync', async () => {
    const id = await createSubmitApprove(
      prBody({
        lines: [{ itemCode: 'OK', itemName: 'Valid', requiredQuantity: 3, estimatedRate: 1, uomId }],
      }),
    )
    await prisma.purchaseRequisitionLine.create({
      data: {
        tenantId,
        purchaseRequisitionId: id,
        lineNumber: 99,
        itemCodeSnapshot: '',
        itemNameSnapshot: '',
        requiredQuantity: 0,
        estimatedRate: 0,
        estimatedAmount: 0,
        uomId: null,
        status: 'OPEN',
      },
    })
    const result = await syncPurchasePlanningRowsFromApprovedPr(id, tenantId, userId)
    expect(result.created).toBe(0)
    expect(result.skipped).toBeGreaterThanOrEqual(1)
    const count = await prisma.purchasePlanningRow.count({
      where: { tenantId, purchaseRequisitionId: id, deletedAt: null },
    })
    expect(count).toBe(1)
  }, 60_000)

  it('7. Tenant isolation is enforced on planning list', async () => {
    const other = await createTenantUser({
      slugPrefix: 'p15-other',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    try {
      await createSubmitApprove(prBody({ purchasePurpose: 'tenant-a' }))
      const listOther = await request(app)
        .get(`/api/v1/t/${other.slug}/purchase/planning-sheet`)
        .set(auth(other.token))
      expect(listOther.status).toBe(200)
      expect(listOther.body.data).toEqual([])
    } finally {
      await cleanupTenant(other.tenantId)
    }
  }, 90_000)

  it('8. Unauthorized users cannot approve PRs', async () => {
    const { hashPassword } = await import('../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const email = `no-approve-${Date.now()}@test.com`
    const user = await prisma.user.create({
      data: {
        tenantId,
        firstName: 'No',
        lastName: 'Approve',
        email,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const perms = await prisma.permission.findMany({
      where: { name: { in: ['purchase.pr.view', 'purchase.pr.create', 'purchase.pr.submit'] } },
    })
    const role = await prisma.role.create({
      data: {
        tenantId,
        name: `No Approve ${Date.now()}`,
        rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })
    const login = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'Test@123',
      tenantSlug: slug,
    })
    const limitedToken = login.body.data?.accessToken as string

    const createRes = await request(app)
      .post(prBase())
      .set(auth())
      .send(prBody({ rfqRequired: true }))
    const id = createRes.body.data.id as string
    await request(app).post(`${prBase()}/${id}/submit`).set(auth()).send({})

    const denied = await request(app)
      .post(`${prBase()}/${id}/approve`)
      .set(auth(limitedToken))
      .send({})
    expect(denied.status).toBe(403)
  }, 90_000)

  it('9. Unauthorized users cannot create POs from planning', async () => {
    const { hashPassword } = await import('../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const email = `no-po-${Date.now()}@test.com`
    const user = await prisma.user.create({
      data: {
        tenantId,
        firstName: 'No',
        lastName: 'Po',
        email,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const perms = await prisma.permission.findMany({
      where: { name: { in: ['purchase.planning.view', 'purchase.pr.view'] } },
    })
    const role = await prisma.role.create({
      data: {
        tenantId,
        name: `No PO ${Date.now()}`,
        rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })
    const login = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'Test@123',
      tenantSlug: slug,
    })
    const limitedToken = login.body.data?.accessToken as string

    const denied = await request(app)
      .post(`${ppsBase()}/create-po`)
      .set(auth(limitedToken))
      .send({ rowIds: ['00000000-0000-4000-8000-000000000001'] })
    expect(denied.status).toBe(403)
  }, 60_000)
  it('9–13 + 14–15. Create PO groups by vendor, links lines, updates PR conversion', async () => {
    const id = await createSubmitApprove(
      prBody({
        rfqRequired: false,
        lines: [
          { itemCode: 'G1', itemName: 'Group 1', requiredQuantity: 5, estimatedRate: 10, uomId },
          { itemCode: 'G2', itemName: 'Group 2', requiredQuantity: 7, estimatedRate: 8, uomId },
          { itemCode: 'G3', itemName: 'Group 3', requiredQuantity: 2, estimatedRate: 9, uomId },
        ],
      }),
    )
    const rows = await prisma.purchasePlanningRow.findMany({
      where: { tenantId, purchaseRequisitionId: id, deletedAt: null },
      orderBy: { planningNumber: 'asc' },
    })
    expect(rows).toHaveLength(3)

    // Partial: first two → vendor A, create PO → partially_converted
    await readyPlanningRowsForPo([rows[0].id, rows[1].id], vendorA)
    const partial = await request(app)
      .post(`${ppsBase()}/create-po`)
      .set(auth())
      .send({ rowIds: [rows[0].id, rows[1].id] })
    expect(partial.status).toBe(201)
    expect(partial.body.data.orderCount).toBe(1)
    expect(partial.body.data.vendorCount).toBe(1)

    const prPartial = await prisma.purchaseRequisition.findUnique({ where: { id } })
    expect(prPartial?.status).toBe('PARTIALLY_CONVERTED')

    const poLines = await prisma.purchaseOrderLine.findMany({
      where: { tenantId, purchasePlanningRowId: { in: [rows[0].id, rows[1].id] } },
    })
    expect(poLines).toHaveLength(2)

    const stampedPrLines = await prisma.purchaseRequisitionLine.findMany({
      where: { tenantId, id: { in: [rows[0].purchaseRequisitionLineId, rows[1].purchaseRequisitionLineId] } },
    })
    expect(stampedPrLines).toHaveLength(2)
    for (const line of stampedPrLines) {
      expect(line.status).toBe('CONVERTED')
      expect(line.purchaseOrderId).toBeTruthy()
      expect(line.purchaseOrderNumberSnapshot).toBeTruthy()
    }

    // Complete: remaining row → vendor B
    await readyPlanningRowsForPo([rows[2].id], vendorB)
    const full = await request(app)
      .post(`${ppsBase()}/create-po`)
      .set(auth())
      .send({ rowIds: [rows[2].id] })
    expect(full.status).toBe(201)
    expect(full.body.data.orderCount).toBe(1)

    const prFull = await prisma.purchaseRequisition.findUnique({ where: { id } })
    expect(prFull?.status).toBe('CONVERTED_TO_PO')

    // 11–12 multi-vendor in one call
    const id2 = await createSubmitApprove(
      prBody({
        lines: [
          { itemCode: 'M1', itemName: 'Multi 1', requiredQuantity: 3, estimatedRate: 4, uomId },
          { itemCode: 'M2', itemName: 'Multi 2', requiredQuantity: 3, estimatedRate: 4, uomId },
        ],
      }),
    )
    const multi = await prisma.purchasePlanningRow.findMany({
      where: { tenantId, purchaseRequisitionId: id2, deletedAt: null },
    })
    await readyPlanningRowsForPo([multi[0].id], vendorA)
    await readyPlanningRowsForPo([multi[1].id], vendorB)
    const grouped = await request(app)
      .post(`${ppsBase()}/create-po`)
      .set(auth())
      .send({ rowIds: [multi[0].id, multi[1].id] })
    expect(grouped.status).toBe(201)
    expect(grouped.body.data.orderCount).toBe(2)
    expect(grouped.body.data.vendorCount).toBe(2)
  }, 120_000)

  it('10. RFQ-required PR lines cannot use Planning PO endpoint', async () => {
    // Seed a planning-like row linked to RFQ PR (should not happen in happy path)
    const id = await createSubmitApprove(prBody({ rfqRequired: true }))
    const line = await prisma.purchaseRequisitionLine.findFirst({
      where: { purchaseRequisitionId: id },
    })
    expect(line).toBeTruthy()
    const rogue = await prisma.purchasePlanningRow.create({
      data: {
        tenantId,
        planningNumber: `PPS-ROGUE-${Date.now()}`,
        planningDate: new Date(),
        purchaseRequisitionId: id,
        purchaseRequisitionLineId: line!.id,
        purchaseRequisitionNumberSnapshot: 'PR-ROGUE',
        itemCodeSnapshot: 'X',
        itemNameSnapshot: 'X',
        requiredQuantity: 1,
        netPurchaseQuantity: 1,
        expectedRate: 10,
        estimatedAmount: 10,
        uomId,
        selectedVendorId: vendorA,
        requiredDate: new Date('2026-07-20'),
        status: 'APPROVED',
        purchaseType: 'DIRECT_PURCHASE',
      },
    })
    const denied = await request(app)
      .post(`${ppsBase()}/create-po`)
      .set(auth())
      .send({ rowIds: [rogue.id] })
    expect(denied.status).toBe(422)
    expect(denied.body.code).toBe('PPS_RFQ_REQUIRED')
  }, 60_000)

  it('16–17. Failed / concurrent create-po does not leave duplicate POs', async () => {
    const id = await createSubmitApprove(
      prBody({
        lines: [{ itemCode: 'C1', itemName: 'Concurrent', requiredQuantity: 2, estimatedRate: 5, uomId }],
      }),
    )
    const row = await prisma.purchasePlanningRow.findFirst({
      where: { tenantId, purchaseRequisitionId: id, deletedAt: null },
    })
    expect(row).toBeTruthy()
    await readyPlanningRowsForPo([row!.id], vendorA)

    const [a, b] = await Promise.all([
      request(app).post(`${ppsBase()}/create-po`).set(auth()).send({ rowIds: [row!.id] }),
      request(app).post(`${ppsBase()}/create-po`).set(auth()).send({ rowIds: [row!.id] }),
    ])
    const statuses = [a.status, b.status]
    expect(statuses).toContain(201)
    // Loser should be a business rejection (400/409/422), not an unhandled 500.
    const loser = statuses.find((s) => s !== 201)
    expect(loser).toBeDefined()
    expect([400, 409, 422]).toContain(loser)

    const poCount = await prisma.purchaseOrder.count({
      where: { tenantId, purchaseRequisitionId: id, deletedAt: null },
    })
    expect(poCount).toBe(1)

    const linked = await prisma.purchasePlanningRow.findUnique({ where: { id: row!.id } })
    expect(linked?.status).toBe('PO_CREATED')
    expect(linked?.purchaseOrderId).toBeTruthy()
  }, 90_000)
})
