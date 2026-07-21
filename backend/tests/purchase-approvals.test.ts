import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'

/**
 * Purchase Approvals queue — live DB integration.
 * PR + PO appear in GET /purchase/approvals; approve / reject / send-back;
 * tenant isolation + RBAC + empty queue.
 * Approver must be a different user than the requester (self-approval blocked).
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
  tenantId?: string
}) {
  const { hashPassword } = await import('../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  let tenantId = opts.tenantId
  let slug = ''
  if (!tenantId) {
    slug = `${opts.slugPrefix}-${suffix}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Approvals Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
  } else {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    slug = tenant.slug
  }
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: 'Appr',
      lastName: 'Tester',
      email: `user-${suffix}@test.com`,
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
      tenantId,
      name: `Role ${suffix}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })
  return {
    tenantId,
    userId: user.id,
    slug,
    token: loginRes.body.data?.accessToken as string,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.purchasePlanningRow.deleteMany({ where: { tenantId } })
  await prisma.purchaseOrderLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } })
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

/** All purchase permissions except the maker-checker bypass — self-approval stays blocked. */
const FULL_PURCHASE_PERMS = PERMISSIONS.filter(
  (p) => p.startsWith('purchase.') && p !== 'purchase.approvals.self_approve',
) as PermissionName[]

describe.skipIf(!dbAvailable)('Purchase approvals queue', () => {
  let tenantId = ''
  let slug = ''
  /** Creates / submits documents */
  let requesterToken = ''
  let requesterUserId = ''
  /** Approves / rejects / sends back */
  let approverToken = ''
  let viewerToken = ''
  let otherTenantId = ''
  let otherSlug = ''
  let otherToken = ''
  let vendorId = ''
  let uomId = ''

  const approvalsBase = (s = slug) => `/api/v1/t/${s}/purchase/approvals`
  const prBase = (s = slug) => `/api/v1/t/${s}/purchase/requisitions`
  const poBase = (s = slug) => `/api/v1/t/${s}/purchase/orders`
  const auth = (t = requesterToken) => ({ Authorization: `Bearer ${t}` })

  function prBody(overrides: Record<string, unknown> = {}) {
    return {
      requisitionDate: '2026-07-10',
      requiredDate: '2026-07-20',
      departmentId: 'dept-ops',
      requestedById: requesterUserId,
      rfqRequired: true,
      priority: 'NORMAL',
      purchasePurpose: 'Approvals queue test',
      lines: [
        {
          itemCode: 'RM-APR-1',
          itemName: 'Approval Material',
          requiredQuantity: 5,
          estimatedRate: 100,
          requiredDate: '2026-07-20',
          uomId,
        },
      ],
      ...overrides,
    }
  }

  function poBody(overrides: Record<string, unknown> = {}) {
    return {
      vendorId,
      orderDate: '2026-07-21',
      expectedDeliveryDate: '2026-07-30',
      paymentTerms: 'Net 30',
      remarks: 'Approvals queue PO',
      lines: [
        {
          itemCode: 'ITM-APR-1',
          itemName: 'Approval Item',
          quantity: 10,
          uomId,
          rate: 25,
        },
      ],
      ...overrides,
    }
  }

  async function createPendingPr(): Promise<string> {
    const createRes = await request(app).post(prBase()).set(auth()).send(prBody())
    expect(createRes.status).toBe(201)
    const id = createRes.body.data.id as string
    const submitRes = await request(app).post(`${prBase()}/${id}/submit`).set(auth()).send({})
    expect(submitRes.status).toBe(200)
    expect(String(submitRes.body.data.status).toLowerCase()).toBe('pending_approval')
    return id
  }

  async function createPendingPo(): Promise<string> {
    const createRes = await request(app).post(poBase()).set(auth()).send(poBody())
    expect(createRes.status).toBe(201)
    const id = createRes.body.data.id as string
    const submitRes = await request(app).post(`${poBase()}/${id}/submit`).set(auth()).send({})
    expect(submitRes.status).toBe(200)
    expect(String(submitRes.body.data.status).toUpperCase()).toBe('PENDING_APPROVAL')
    return id
  }

  beforeAll(async () => {
    await ensurePermissions()
    const requester = await createTenantUser({
      slugPrefix: 'appr-req',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = requester.tenantId
    slug = requester.slug
    requesterToken = requester.token
    requesterUserId = requester.userId
    expect(requesterToken).toBeTruthy()

    const approver = await createTenantUser({
      slugPrefix: 'appr-apv',
      permissionNames: FULL_PURCHASE_PERMS,
      tenantId,
    })
    approverToken = approver.token

    const viewer = await createTenantUser({
      slugPrefix: 'appr-view',
      permissionNames: ['purchase.pr.view'] as PermissionName[],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      slugPrefix: 'appr-other',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    otherTenantId = other.tenantId
    otherSlug = other.slug
    otherToken = other.token

    const uom = await prisma.masterUom.create({
      data: { tenantId, code: `U-${Date.now()}`, name: 'EA', status: 'ACTIVE' },
    })
    uomId = uom.id
    const vendor = await prisma.masterVendor.create({
      data: { tenantId, code: `V-${Date.now()}`, name: 'Approvals Vendor', status: 'ACTIVE' },
    })
    vendorId = vendor.id
  }, 120_000)

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId)
    if (otherTenantId) await cleanupTenant(otherTenantId)
  })

  it('lists pending PR and PO in the approvals queue', async () => {
    const prId = await createPendingPr()
    const poId = await createPendingPo()

    const res = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine&limit=100`)
      .set(auth(approverToken))
    expect(res.status).toBe(200)
    const rows = res.body.data as Array<{
      documentId: string
      documentType: string
      status: string
      approvalId: string
      canAct: boolean
    }>
    const prRow = rows.find((r) => r.documentId === prId && r.documentType === 'purchase_requisition')
    const poRow = rows.find((r) => r.documentId === poId && r.documentType === 'purchase_order')
    expect(prRow).toBeTruthy()
    expect(poRow).toBeTruthy()
    expect(prRow!.status).toBe('pending')
    expect(poRow!.status).toBe('pending')
    expect(prRow!.canAct).toBe(true)
    expect(poRow!.canAct).toBe(true)
  })

  it('returns review payload with status history (no fake chain)', async () => {
    const prId = await createPendingPr()
    const queue = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine&limit=100`)
      .set(auth(approverToken))
    const row = (queue.body.data as Array<{ documentId: string; approvalId: string }>).find(
      (r) => r.documentId === prId,
    )
    expect(row).toBeTruthy()

    const review = await request(app)
      .get(`${approvalsBase()}/${row!.approvalId}`)
      .set(auth(approverToken))
    expect(review.status).toBe(200)
    expect(review.body.data.row.documentId).toBe(prId)
    expect(review.body.data.lines.length).toBeGreaterThan(0)
    expect(Array.isArray(review.body.data.chainRoles)).toBe(true)
    expect(review.body.data.chainRoles).toHaveLength(0)
    expect(Array.isArray(review.body.data.previousApprovals)).toBe(true)
    expect(review.body.data.previousApprovals.length).toBeGreaterThan(0)
  })

  it('approves PR from queue and removes it from pending', async () => {
    const prId = await createPendingPr()
    const approveRes = await request(app)
      .post(`${prBase()}/${prId}/approve`)
      .set(auth(approverToken))
      .send({})
    expect(approveRes.status).toBe(200)

    const queue = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine&limit=100`)
      .set(auth(approverToken))
    const pending = (queue.body.data as Array<{ documentId: string }>).filter(
      (r) => r.documentId === prId,
    )
    expect(pending).toHaveLength(0)

    const approvedTab = await request(app)
      .get(`${approvalsBase()}?tab=approved_by_me&limit=100`)
      .set(auth(approverToken))
    expect(
      (approvedTab.body.data as Array<{ documentId: string }>).some((r) => r.documentId === prId),
    ).toBe(true)
  })

  it('rejects PO from queue', async () => {
    const poId = await createPendingPo()
    const rejectRes = await request(app)
      .post(`${poBase()}/${poId}/reject`)
      .set(auth(approverToken))
      .send({ reason: 'Price too high' })
    expect(rejectRes.status).toBe(200)

    const queue = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine&limit=100`)
      .set(auth(approverToken))
    expect(
      (queue.body.data as Array<{ documentId: string }>).some((r) => r.documentId === poId),
    ).toBe(false)
  })

  it('sends PR back to draft with reason and clears pending approval', async () => {
    const prId = await createPendingPr()
    const sendBack = await request(app)
      .post(`${prBase()}/${prId}/send-back`)
      .set(auth(approverToken))
      .send({ reason: 'Need more detail on line 1' })
    expect(sendBack.status).toBe(200)
    expect(String(sendBack.body.data.status).toLowerCase()).toBe('draft')

    const editRes = await request(app)
      .patch(`${prBase()}/${prId}`)
      .set(auth())
      .send({ remarks: 'Updated after send-back' })
    expect(editRes.status).toBe(200)

    const queue = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine&limit=100`)
      .set(auth(approverToken))
    expect(
      (queue.body.data as Array<{ documentId: string }>).some((r) => r.documentId === prId),
    ).toBe(false)

    const resubmit = await request(app).post(`${prBase()}/${prId}/submit`).set(auth()).send({})
    expect(resubmit.status).toBe(200)
    const again = await request(app)
      .post(`${prBase()}/${prId}/send-back`)
      .set(auth(approverToken))
      .send({})
    expect(again.status).toBe(400)
  })

  it('sends PO back and removes from pending queue', async () => {
    const poId = await createPendingPo()
    const sendBack = await request(app)
      .post(`${poBase()}/${poId}/send-back`)
      .set(auth(approverToken))
      .send({ reason: 'Revise vendor terms' })
    expect(sendBack.status).toBe(200)

    const queue = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine&limit=100`)
      .set(auth(approverToken))
    expect(
      (queue.body.data as Array<{ documentId: string }>).some((r) => r.documentId === poId),
    ).toBe(false)
  })

  it('blocks self-approval by the requester', async () => {
    const prId = await createPendingPr()
    const selfApprove = await request(app)
      .post(`${prBase()}/${prId}/approve`)
      .set(auth())
      .send({})
    expect(selfApprove.status).toBe(422)
    expect(selfApprove.body.code).toBe('APPROVAL_SELF_ACTION_NOT_ALLOWED')
  })

  it('enforces tenant isolation on approvals queue', async () => {
    const prId = await createPendingPr()
    const otherRes = await request(app)
      .get(`${approvalsBase(otherSlug)}?tab=pending_mine&limit=100`)
      .set(auth(otherToken))
    expect(otherRes.status).toBe(200)
    expect(
      (otherRes.body.data as Array<{ documentId: string }>).some((r) => r.documentId === prId),
    ).toBe(false)

    const queue = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine&limit=100`)
      .set(auth(approverToken))
    const row = (queue.body.data as Array<{ documentId: string; approvalId: string }>).find(
      (r) => r.documentId === prId,
    )
    expect(row).toBeTruthy()

    const cross = await request(app)
      .get(`${approvalsBase(otherSlug)}/${row!.approvalId}`)
      .set(auth(otherToken))
    expect(cross.status).toBe(404)
  })

  it('denies approvals queue without approve/view permissions', async () => {
    const noPerm = await createTenantUser({
      slugPrefix: 'appr-none',
      permissionNames: ['purchase.rfq.view'] as PermissionName[],
      tenantId,
    })
    const res = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine`)
      .set(auth(noPerm.token))
    expect(res.status).toBe(403)
  })

  it('does not put unassigned approvals in a view-only user pending-mine queue', async () => {
    const prId = await createPendingPr()
    const res = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine&limit=100`)
      .set(auth(viewerToken))
    expect(res.status).toBe(200)
    const row = (res.body.data as Array<{ documentId: string; canAct: boolean }>).find(
      (r) => r.documentId === prId,
    )
    expect(row).toBeUndefined()
  })

  it('returns empty pending queue when nothing is awaiting approval', async () => {
    const pending = await prisma.purchaseApproval.findMany({
      where: { tenantId, status: 'PENDING' },
    })
    for (const a of pending) {
      if (a.documentType === 'PURCHASE_REQUISITION' && a.purchaseRequisitionId) {
        const res = await request(app)
          .post(`${prBase()}/${a.purchaseRequisitionId}/approve`)
          .set(auth(approverToken))
          .send({})
        expect([200, 422]).toContain(res.status)
      } else if (a.documentType === 'PURCHASE_ORDER' && a.purchaseOrderId) {
        const res = await request(app)
          .post(`${poBase()}/${a.purchaseOrderId}/approve`)
          .set(auth(approverToken))
          .send({})
        expect([200, 422]).toContain(res.status)
      }
    }

    // Force-clear any leftovers so orphan heal cannot resurrect them
    await prisma.purchaseRequisition.updateMany({
      where: { tenantId, status: 'PENDING_APPROVAL' },
      data: { status: 'CANCELLED' },
    })
    await prisma.purchaseOrder.updateMany({
      where: { tenantId, status: 'PENDING_APPROVAL' },
      data: { status: 'CANCELLED' },
    })
    await prisma.purchaseApproval.updateMany({
      where: { tenantId, status: 'PENDING' },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    })

    const res = await request(app)
      .get(`${approvalsBase()}?tab=pending_mine&limit=100`)
      .set(auth(approverToken))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})
