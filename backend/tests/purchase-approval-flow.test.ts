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

type TestUser = { id: string; token: string }

async function ensurePermissions() {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    })
  }
}

describe.skipIf(!dbAvailable)('Purchase approval inbox and maker-checker flow', () => {
  let tenantId = ''
  let slug = ''
  let requester: TestUser
  let approverA: TestUser
  let approverB: TestUser
  let selfApprover: TestUser
  let uomId = ''
  let vendorId = ''

  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` })
  const purchaseBase = () => `/api/v1/t/${slug}/purchase`

  async function createUser(label: string, permissionNames: PermissionName[]): Promise<TestUser> {
    const { hashPassword } = await import('../src/utils/password.js')
    const passwordHash = await hashPassword('Test@123')
    const suffix = `${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const user = await prisma.user.create({
      data: {
        tenantId,
        firstName: label,
        lastName: 'Approval Test',
        email: `${suffix}@test.com`,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const permissions = await prisma.permission.findMany({
      where: { name: { in: permissionNames } },
    })
    const role = await prisma.role.create({
      data: {
        tenantId,
        name: `Approval ${suffix}`,
        rolePermissions: {
          create: permissions.map((permission) => ({ permissionId: permission.id })),
        },
      },
    })
    await prisma.userRole.create({
      data: { tenantId, userId: user.id, roleId: role.id },
    })
    const login = await request(app).post('/api/v1/auth/login').send({
      tenantSlug: slug,
      email: user.email,
      password: 'Test@123',
    })
    expect(login.status).toBe(200)
    return { id: user.id, token: login.body.data.accessToken as string }
  }

  async function createAndSubmitPr(user: TestUser, purpose: string) {
    const create = await request(app)
      .post(`${purchaseBase()}/requisitions`)
      .set(auth(user))
      .send({
        requisitionDate: '2026-07-21',
        requiredDate: '2026-07-30',
        departmentId: 'dept-ops',
        requestedById: user.id,
        rfqRequired: true,
        priority: 'NORMAL',
        purchasePurpose: purpose,
        lines: [
          {
            itemCode: 'APP-ITEM',
            itemName: 'Approval test item',
            requiredQuantity: 2,
            estimatedRate: 125,
            requiredDate: '2026-07-30',
            uomId,
          },
        ],
      })
    expect(create.status).toBe(201)
    const submit = await request(app)
      .post(`${purchaseBase()}/requisitions/${create.body.data.id}/submit`)
      .set(auth(user))
      .send({})
    expect(submit.status).toBe(200)
    return create.body.data.id as string
  }

  async function createAndSubmitPo(user: TestUser) {
    const create = await request(app)
      .post(`${purchaseBase()}/orders`)
      .set(auth(user))
      .send({
        orderDate: '2026-07-21',
        vendorId,
        lines: [
          {
            itemCode: 'APP-ITEM',
            itemName: 'Approval test item',
            quantity: 2,
            rate: 125,
            uomId,
          },
        ],
      })
    expect(create.status).toBe(201)
    const submit = await request(app)
      .post(`${purchaseBase()}/orders/${create.body.data.id}/submit`)
      .set(auth(user))
      .send({})
    expect(submit.status).toBe(200)
    return create.body.data.id as string
  }

  beforeAll(async () => {
    await ensurePermissions()
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    slug = `approval-flow-${suffix}`
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Purchase Approval Flow Test',
        slug,
        email: `${slug}@test.com`,
        status: 'ACTIVE',
      },
    })
    tenantId = tenant.id

    requester = await createUser('Requester', [
      'purchase.pr.view',
      'purchase.pr.create',
      'purchase.pr.edit',
      'purchase.pr.submit',
      'purchase.po.view',
      'purchase.po.create',
      'purchase.po.edit',
      'master.lookup.view',
    ])
    const approverPermissions: PermissionName[] = [
      'purchase.pr.view',
      'purchase.pr.create',
      'purchase.pr.edit',
      'purchase.pr.submit',
      'purchase.pr.approve',
      'purchase.pr.reject',
      'purchase.po.view',
      'purchase.po.approve',
    ]
    approverA = await createUser('ApproverA', approverPermissions)
    approverB = await createUser('ApproverB', approverPermissions)
    selfApprover = await createUser('SelfApprover', [
      ...approverPermissions,
      'purchase.approvals.self_approve',
    ])

    const uom = await prisma.masterUom.create({
      data: { tenantId, code: `PCS-${suffix}`, name: 'Pieces', status: 'ACTIVE' },
    })
    uomId = uom.id
    const vendor = await prisma.masterVendor.create({
      data: {
        tenantId,
        code: `V-${suffix}`,
        name: 'Approval Test Vendor',
        status: 'ACTIVE',
      },
    })
    vendorId = vendor.id
  }, 120_000)

  afterAll(async () => {
    if (!tenantId) return
    await prisma.purchaseSettings.deleteMany({ where: { tenantId } })
    await prisma.purchasePlanningRow.deleteMany({ where: { tenantId } })
    await prisma.purchaseApproval.deleteMany({ where: { tenantId } })
    await prisma.purchaseStatusHistory.deleteMany({ where: { tenantId } })
    await prisma.purchaseOrderLine.deleteMany({ where: { tenantId } })
    await prisma.purchaseOrder.deleteMany({ where: { tenantId } })
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
    await prisma.tenant.delete({ where: { id: tenantId } })
  })

  it('combines pending PR and PO rows and excludes them from the requester inbox', async () => {
    const prId = await createAndSubmitPr(requester, 'Combined queue')
    const poId = await createAndSubmitPo(requester)

    const queue = await request(app)
      .get(`${purchaseBase()}/approvals?tab=pending_mine`)
      .set(auth(approverA))
    expect(queue.status).toBe(200)
    expect(queue.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: prId, documentType: 'purchase_requisition' }),
        expect.objectContaining({ documentId: poId, documentType: 'purchase_order' }),
      ]),
    )

    const requesterQueue = await request(app)
      .get(`${purchaseBase()}/approvals?tab=pending_mine`)
      .set(auth(requester))
    expect(requesterQueue.status).toBe(200)
    expect(requesterQueue.body.data).toHaveLength(0)
  })

  it('blocks self approval even when the maker has approval permission', async () => {
    const id = await createAndSubmitPr(approverA, 'Maker-checker')
    const mine = await request(app)
      .get(`${purchaseBase()}/approvals?tab=pending_mine`)
      .set(auth(approverA))
    expect(mine.body.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ documentId: id })]),
    )
    const response = await request(app)
      .post(`${purchaseBase()}/requisitions/${id}/approve`)
      .set(auth(approverA))
      .send({})
    expect(response.status).toBe(422)
    expect(response.body.code).toBe('APPROVAL_SELF_ACTION_NOT_ALLOWED')
  })

  it('allows self approval for a user holding purchase.approvals.self_approve (default policy)', async () => {
    // Tenant has no purchase settings row → server default policy PERMISSION_ONLY.
    const id = await createAndSubmitPr(selfApprover, 'Self approval with permission')

    const mine = await request(app)
      .get(`${purchaseBase()}/approvals?tab=pending_mine`)
      .set(auth(selfApprover))
    expect(mine.status).toBe(200)
    expect(mine.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ documentId: id, canAct: true })]),
    )

    const response = await request(app)
      .post(`${purchaseBase()}/requisitions/${id}/approve`)
      .set(auth(selfApprover))
      .send({ remarks: 'Self-approved (authorized)' })
    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('approved')

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId, entityId: id, action: 'PR_APPROVED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).toBeTruthy()
    expect(audit?.newValues).toMatchObject({ selfApproved: true })
  })

  it('blocks self approval for everyone when policy is NEVER', async () => {
    await prisma.purchaseSettings.upsert({
      where: { tenantId },
      create: { tenantId, selfApprovalPolicy: 'NEVER', version: 1 },
      update: { selfApprovalPolicy: 'NEVER' },
    })
    const id = await createAndSubmitPr(selfApprover, 'Self approval blocked by NEVER')
    const response = await request(app)
      .post(`${purchaseBase()}/requisitions/${id}/approve`)
      .set(auth(selfApprover))
      .send({})
    expect(response.status).toBe(422)
    expect(response.body.code).toBe('APPROVAL_SELF_ACTION_NOT_ALLOWED')
  })

  it('allows self approval without the permission when policy is EVERYONE', async () => {
    await prisma.purchaseSettings.upsert({
      where: { tenantId },
      create: { tenantId, selfApprovalPolicy: 'EVERYONE', version: 1 },
      update: { selfApprovalPolicy: 'EVERYONE' },
    })
    const id = await createAndSubmitPr(approverA, 'Self approval allowed by EVERYONE')
    const response = await request(app)
      .post(`${purchaseBase()}/requisitions/${id}/approve`)
      .set(auth(approverA))
      .send({})
    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('approved')

    // Restore strict default for the remaining specs.
    await prisma.purchaseSettings.update({
      where: { tenantId },
      data: { selfApprovalPolicy: 'PERMISSION_ONLY' },
    })
  })

  it('delegates to a real eligible user and enforces the assignment', async () => {
    const id = await createAndSubmitPr(requester, 'Delegation')
    const queue = await request(app)
      .get(`${purchaseBase()}/approvals?tab=pending_mine`)
      .set(auth(approverA))
    const row = queue.body.data.find((item: { documentId: string }) => item.documentId === id)
    expect(row).toBeTruthy()

    const review = await request(app)
      .get(`${purchaseBase()}/approvals/${row.approvalId}`)
      .set(auth(approverA))
    expect(review.status).toBe(200)
    expect(review.body.data.eligibleApprovers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: approverB.id })]),
    )

    const delegated = await request(app)
      .post(`${purchaseBase()}/approvals/${row.approvalId}/delegate`)
      .set(auth(approverA))
      .send({ toUserId: approverB.id, remarks: 'Please review' })
    expect(delegated.status).toBe(200)
    expect(delegated.body.data.delegatedTo.id).toBe(approverB.id)

    const wrongActor = await request(app)
      .post(`${purchaseBase()}/requisitions/${id}/approve`)
      .set(auth(approverA))
      .send({})
    expect(wrongActor.status).toBe(422)
    expect(wrongActor.body.code).toBe('APPROVAL_ASSIGNED_TO_ANOTHER_USER')

    const approved = await request(app)
      .post(`${purchaseBase()}/requisitions/${id}/approve`)
      .set(auth(approverB))
      .send({ remarks: 'Approved after delegation' })
    expect(approved.status).toBe(200)

    const mine = await request(app)
      .get(`${purchaseBase()}/approvals?tab=approved_by_me`)
      .set(auth(approverB))
    expect(mine.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ documentId: id, status: 'approved' })]),
    )
  })

  it('supports PR send-back through the approver permission', async () => {
    const id = await createAndSubmitPr(requester, 'Send back')
    const sentBack = await request(app)
      .post(`${purchaseBase()}/requisitions/${id}/send-back`)
      .set(auth(approverA))
      .send({ reason: 'Correct the required date' })
    expect(sentBack.status).toBe(200)
    expect(sentBack.body.data.status).toBe('draft')

    const approval = await prisma.purchaseApproval.findFirstOrThrow({
      where: { tenantId, purchaseRequisitionId: id },
      orderBy: { requestedAt: 'desc' },
    })
    expect(approval.status).toBe('RETURNED')
    expect(approval.approverId).toBe(approverA.id)
  })
})
