import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const NEEDED_PERMS = PERMISSIONS.filter(
  (p) =>
    p.startsWith('purchase.pr.') ||
    p.startsWith('purchase.planning.') ||
    p === 'purchase.po.create' ||
    p === 'purchase.po.view',
)

async function ensurePermissions(): Promise<void> {
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

async function createTenant(slugPrefix: string) {
  const { hashPassword } = await import('../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'Planning Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const perms = await prisma.permission.findMany({
    where: { name: { in: [...NEEDED_PERMS] as PermissionName[] } },
  })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Purchase Planner ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })

  async function createUser(label: string) {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        firstName: label,
        lastName: 'Tester',
        email: `${label.toLowerCase()}-${slug}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id, tenantId: tenant.id },
    })
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: user.email,
      password: 'Test@123',
      tenantSlug: slug,
    })
    return {
      userId: user.id,
      token: loginRes.body.data?.accessToken as string,
    }
  }

  const requester = await createUser('Requester')
  const approver = await createUser('Approver')

  return {
    tenantId: tenant.id,
    userId: requester.userId,
    slug,
    token: requester.token,
    approverToken: approver.token,
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

async function createApprovedDirectPr(
  requesterToken: string,
  approverToken: string,
  slug: string,
  purpose: string,
  uomId: string,
  preferredVendorId?: string,
) {
  const base = `/api/v1/t/${slug}/purchase/requisitions`
  const createRes = await request(app)
    .post(base)
    .set({ Authorization: `Bearer ${requesterToken}` })
    .send({
      requisitionDate: '2026-07-01',
      requiredDate: '2026-07-05',
      departmentId: 'dept-ops',
      rfqRequired: false,
      priority: 'URGENT',
      purchasePurpose: purpose,
      lines: [
        {
          itemCode: 'PLN-001',
          itemName: 'Planning Item',
          requiredQuantity: 10,
          estimatedRate: 25,
          requiredDate: '2026-07-05',
          uomId,
          preferredVendorId,
        },
      ],
    })
  expect(createRes.status).toBe(201)
  const id = createRes.body.data.id as string
  const submit = await request(app)
    .post(`${base}/${id}/submit`)
    .set({ Authorization: `Bearer ${requesterToken}` })
    .send({})
  expect(submit.status).toBe(200)
  const approve = await request(app)
    .post(`${base}/${id}/approve`)
    .set({ Authorization: `Bearer ${approverToken}` })
    .send({})
  expect(approve.status).toBe(200)
  return id
}

describe.skipIf(!dbAvailable)('Purchase planning sheet APIs (integration)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let approverToken = ''
  let uomId = ''
  const base = () => `/api/v1/t/${slug}/purchase/planning-sheet`

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createTenant('pps-api')
    tenantId = ctx.tenantId
    slug = ctx.slug
    token = ctx.token
    approverToken = ctx.approverToken
    expect(token).toBeTruthy()
    expect(approverToken).toBeTruthy()
    const uom = await prisma.masterUom.create({
      data: {
        tenantId,
        code: `PCS-${Date.now()}`,
        name: 'Pieces',
        status: 'ACTIVE',
      },
    })
    uomId = uom.id
  }, 60_000)

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId)
  })

  function auth(value = token) {
    return { Authorization: `Bearer ${value}` }
  }

  it('lists rows after PR approve, supports summary and get-by-id', async () => {
    await createApprovedDirectPr(token, approverToken, slug, 'PPS seed A', uomId)

    const listRes = await request(app).get(base()).set(auth()).query({ page: 1, pageSize: 20 })
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1)
    const rowId = listRes.body.data[0].id as string
    expect(listRes.body.data[0].planningNumber).toMatch(/^PPS-/)

    const summary = await request(app).get(`${base()}/summary`).set(auth())
    expect(summary.status).toBe(200)
    expect(summary.body.data).toHaveProperty('totalPendingPlanning')
    expect(summary.body.data).toHaveProperty('totalEstimatedPurchaseValue')
    expect(summary.body.data).toHaveProperty('criticalItems')
    expect(summary.body.data).toHaveProperty('overdueItems')
    expect(summary.body.data).toHaveProperty('vendorSelectionPending')
    expect(summary.body.data).toHaveProperty('poPending')
    expect(summary.body.data).toHaveProperty('poCreated')

    const detail = await request(app).get(`${base()}/${rowId}`).set(auth())
    expect(detail.status).toBe(200)
    expect(detail.body.data.id).toBe(rowId)
    expect(detail.body.data.requiredQuantity).toBe(10)
  }, 90_000)

  it('patches editable fields and rejects invalid transition', async () => {
    const listRes = await request(app).get(base()).set(auth())
    const rowId = listRes.body.data[0].id as string

    const vendor = await prisma.masterVendor.create({
      data: {
        tenantId,
        code: `V-${Date.now()}`,
        name: 'Plan Vendor',
        status: 'ACTIVE',
      },
    })

    const patchRes = await request(app)
      .patch(`${base()}/${rowId}`)
      .set(auth())
      .send({
        selectedVendorId: vendor.id,
        expectedRate: 30,
        negotiatedRate: 28,
        buyerId: 'buyer-1',
        actionMessage: true,
        remarks: 'Ready',
      })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.selectedVendorId).toBe(vendor.id)
    expect(patchRes.body.data.expectedRate).toBe(30)
    expect(patchRes.body.data.status).toBe('vendor_selected')

    const bad = await request(app)
      .patch(`${base()}/${rowId}`)
      .set(auth())
      .send({ status: 'PO_CREATED' })
    expect(bad.status).toBe(422)
    expect(bad.body.code).toBe('PPS_INVALID_TRANSITION')
  }, 60_000)

  it('bulk assign buyer, select vendor, status, and recalculate', async () => {
    await createApprovedDirectPr(token, approverToken, slug, 'PPS seed B', uomId)
    const listRes = await request(app).get(base()).set(auth()).query({ pageSize: 50 })
    const rowIds = (listRes.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(rowIds.length).toBeGreaterThanOrEqual(1)

    const assign = await request(app)
      .post(`${base()}/bulk-assign-buyer`)
      .set(auth())
      .send({ rowIds: [rowIds[0]], buyerId: 'buyer-bulk' })
    expect(assign.status).toBe(200)
    expect(assign.body.data[0].buyerId).toBe('buyer-bulk')

    const vendor = await prisma.masterVendor.create({
      data: {
        tenantId,
        code: `VB-${Date.now()}`,
        name: 'Bulk Vendor',
        status: 'ACTIVE',
      },
    })

    const select = await request(app)
      .post(`${base()}/bulk-select-vendor`)
      .set(auth())
      .send({ rowIds: [rowIds[0]], vendorId: vendor.id, expectedRate: 40, negotiatedRate: 38 })
    expect(select.status).toBe(200)
    expect(select.body.data[0].selectedVendorId).toBe(vendor.id)

    const holdNoReason = await request(app)
      .post(`${base()}/bulk-status`)
      .set(auth())
      .send({ rowIds: [rowIds[0]], status: 'ON_HOLD' })
    expect(holdNoReason.status).toBe(400)
    expect(holdNoReason.body.code).toBe('PPS_STATUS_REASON_REQUIRED')

    const hold = await request(app)
      .post(`${base()}/bulk-status`)
      .set(auth())
      .send({ rowIds: [rowIds[0]], status: 'ON_HOLD', reason: 'Awaiting budget' })
    expect(hold.status).toBe(200)
    expect(hold.body.data[0].status).toBe('on_hold')

    const recalc = await request(app)
      .post(`${base()}/recalculate`)
      .set(auth())
      .send({ rowIds: [rowIds[0]] })
    expect(recalc.status).toBe(200)
    expect(recalc.body.data[0]).toHaveProperty('netPurchaseQuantity')
    expect(recalc.body.data[0]).toHaveProperty('estimatedAmount')
  }, 90_000)

  it('creates draft PO from ready Action Message rows and blocks RFQ-required demand', async () => {
    const vendor = await prisma.masterVendor.create({
      data: {
        tenantId,
        code: `POV-${Date.now()}`,
        name: 'Create PO Vendor',
        status: 'ACTIVE',
      },
    })
    await createApprovedDirectPr(token, approverToken, slug, 'PPS create PO', uomId, vendor.id)

    const listRes = await request(app).get(base()).set(auth()).query({ pageSize: 100 })
    const row = (
      listRes.body.data as Array<{
        id: string
        purchaseRequisitionNumber: string
        status: string
        selectedVendorId: string | null
        actionMessage: boolean
      }>
    ).find((r) => r.selectedVendorId === vendor.id)
    expect(row).toBeTruthy()
    expect(row!.status).toBe('vendor_selected')

    const blockedWithoutAction = await request(app)
      .post(`${base()}/create-po`)
      .set(auth())
      .send({ rowIds: [row!.id] })
    expect(blockedWithoutAction.status).toBe(400)
    expect(blockedWithoutAction.body.code).toBe('PPS_NOT_SELECTED')

    await request(app)
      .patch(`${base()}/${row!.id}`)
      .set(auth())
      .send({ actionMessage: true })

    const created = await request(app)
      .post(`${base()}/create-po`)
      .set(auth())
      .send({ rowIds: [row!.id] })
    expect(created.status).toBe(201)
    expect(created.body.data.orderCount).toBe(1)
    expect(created.body.data.orders[0].status).toBe('DRAFT')
    expect(created.body.data.orders[0].origin).toBe('PLANNING_SHEET')

    const after = await request(app).get(`${base()}/${row!.id}`).set(auth())
    expect(after.body.data.status).toBe('po_created')
    expect(after.body.data.purchaseOrderId).toBe(created.body.data.orders[0].id)

    // RFQ-required PR must never land on Planning Sheet
    const rfqCreate = await request(app)
      .post(`/api/v1/t/${slug}/purchase/requisitions`)
      .set(auth())
      .send({
        requisitionDate: '2026-07-01',
        requiredDate: '2026-07-05',
        departmentId: 'dept-ops',
        rfqRequired: true,
        priority: 'NORMAL',
        purchasePurpose: 'Must stay off planning',
        lines: [
          {
            itemCode: 'RFQ-001',
            itemName: 'RFQ Item',
            requiredQuantity: 3,
            estimatedRate: 10,
            requiredDate: '2026-07-05',
            uomId,
          },
        ],
      })
    expect(rfqCreate.status).toBe(201)
    await request(app)
      .post(`/api/v1/t/${slug}/purchase/requisitions/${rfqCreate.body.data.id}/submit`)
      .set(auth())
      .send({})
    await request(app)
      .post(`/api/v1/t/${slug}/purchase/requisitions/${rfqCreate.body.data.id}/approve`)
      .set(auth(approverToken))
      .send({})
    const planningCount = await prisma.purchasePlanningRow.count({
      where: { tenantId, purchaseRequisitionId: rfqCreate.body.data.id, deletedAt: null },
    })
    expect(planningCount).toBe(0)
  }, 120_000)

  it('filters by overdue and poPending', async () => {
    const overdue = await request(app).get(base()).set(auth()).query({ overdue: true })
    expect(overdue.status).toBe(200)

    const poPending = await request(app).get(base()).set(auth()).query({ poPending: true })
    expect(poPending.status).toBe(200)
    expect(Array.isArray(poPending.body.data)).toBe(true)
  }, 30_000)
})
