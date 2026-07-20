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

const PURCHASE_PERMS = PERMISSIONS.filter((p) => p.startsWith('purchase.pr.'))

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

async function createPurchaseTenant(slugPrefix: string) {
  const { hashPassword } = await import('../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'Purchase PR Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Purchase',
      lastName: 'Tester',
      email: `user-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({
    where: { name: { in: [...PURCHASE_PERMS] as PermissionName[] } },
  })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Purchase Admin ${Date.now()}`,
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
  await prisma.purchasePlanningRow.deleteMany({ where: { tenantId } })
  await prisma.purchaseApproval.deleteMany({ where: { tenantId } })
  await prisma.purchaseStatusHistory.deleteMany({ where: { tenantId } })
  await prisma.purchaseRequisitionLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseRequisition.deleteMany({ where: { tenantId } })
  await prisma.masterUom.deleteMany({ where: { tenantId } })
  await prisma.auditLog.deleteMany({ where: { tenantId } })
  await prisma.codeSeries.deleteMany({ where: { tenantId } })
  await prisma.userRole.deleteMany({ where: { tenantId } })
  await prisma.rolePermission.deleteMany({
    where: { role: { tenantId } },
  })
  await prisma.role.deleteMany({ where: { tenantId } })
  await prisma.user.deleteMany({ where: { tenantId } })
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Purchase requisition lifecycle (integration)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let uomId = ''
  const base = () => `/api/v1/t/${slug}/purchase/requisitions`

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createPurchaseTenant('pr-lifecycle')
    tenantId = ctx.tenantId
    slug = ctx.slug
    token = ctx.token
    expect(token).toBeTruthy()

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

  function auth() {
    return { Authorization: `Bearer ${token}` }
  }

  function validPrBody(overrides: Record<string, unknown> = {}) {
    return {
      requisitionDate: '2026-07-10',
      requiredDate: '2026-07-20',
      departmentId: 'dept-ops',
      rfqRequired: false,
      priority: 'NORMAL',
      purchasePurpose: 'Stock refill',
      lines: [
        {
          itemCode: 'RM-001',
          itemName: 'Raw Material',
          requiredQuantity: 5,
          estimatedRate: 100,
          requiredDate: '2026-07-20',
          uomId,
        },
      ],
      ...overrides,
    }
  }

  it('runs draft → submit → approve (rfqRequired=false) and syncs planning rows', async () => {
    const createRes = await request(app)
      .post(base())
      .set(auth())
      .send(validPrBody({ rfqRequired: false }))

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.status).toBe('draft')
    expect(createRes.body.data.requisitionNumber).toMatch(/^PR-/)
    const id = createRes.body.data.id as string

    const patchRes = await request(app)
      .patch(`${base()}/${id}`)
      .set(auth())
      .send({ remarks: 'Updated draft' })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.remarks).toBe('Updated draft')

    const submitRes = await request(app).post(`${base()}/${id}/submit`).set(auth()).send({})
    expect(submitRes.status).toBe(200)
    expect(submitRes.body.data.status).toBe('pending_approval')

    const editBlocked = await request(app)
      .patch(`${base()}/${id}`)
      .set(auth())
      .send({ remarks: 'should fail' })
    expect(editBlocked.status).toBe(422)
    expect(editBlocked.body.code).toBe('PR_NOT_EDITABLE')

    const approveRes = await request(app).post(`${base()}/${id}/approve`).set(auth()).send({})
    expect(approveRes.status).toBe(200)
    expect(approveRes.body.data.status).toBe('approved')

    const planning = await prisma.purchasePlanningRow.findMany({
      where: { tenantId, purchaseRequisitionId: id, deletedAt: null },
    })
    expect(planning).toHaveLength(1)
    expect(planning[0].planningNumber).toMatch(/^PPS-/)
    expect(Number(planning[0].requiredQuantity)).toBe(5)
  }, 60_000)

  it('approve with rfqRequired=true does not create planning rows', async () => {
    const createRes = await request(app)
      .post(base())
      .set(auth())
      .send(
        validPrBody({
          requisitionDate: '2026-07-11',
          rfqRequired: true,
          lines: [
            {
              itemCode: 'SVC-1',
              itemName: 'Service',
              requiredQuantity: 1,
              estimatedRate: 50,
              uomId,
            },
          ],
        }),
      )
    expect(createRes.status).toBe(201)
    const id = createRes.body.data.id as string

    await request(app).post(`${base()}/${id}/submit`).set(auth()).send({})
    const approveRes = await request(app).post(`${base()}/${id}/approve`).set(auth()).send({})
    expect(approveRes.status).toBe(200)

    const planning = await prisma.purchasePlanningRow.count({
      where: { tenantId, purchaseRequisitionId: id, deletedAt: null },
    })
    expect(planning).toBe(0)
  }, 60_000)

  it('reject requires reason and reopen returns to draft', async () => {
    const createRes = await request(app)
      .post(base())
      .set(auth())
      .send(
        validPrBody({
          requisitionDate: '2026-07-12',
          lines: [{ itemCode: 'X', itemName: 'Y', requiredQuantity: 2, estimatedRate: 1, uomId }],
        }),
      )
    const id = createRes.body.data.id as string
    await request(app).post(`${base()}/${id}/submit`).set(auth()).send({})

    const noReason = await request(app).post(`${base()}/${id}/reject`).set(auth()).send({})
    expect(noReason.status).toBe(400)
    expect(noReason.body.code).toBe('PR_REJECTION_REASON_REQUIRED')

    const rejectRes = await request(app)
      .post(`${base()}/${id}/reject`)
      .set(auth())
      .send({ reason: 'Incomplete specs' })
    expect(rejectRes.status).toBe(200)
    expect(rejectRes.body.data.status).toBe('rejected')
    expect(rejectRes.body.data.rejectionReason).toBe('Incomplete specs')

    const reopenRes = await request(app).post(`${base()}/${id}/reopen`).set(auth()).send({})
    expect(reopenRes.status).toBe(200)
    expect(reopenRes.body.data.status).toBe('draft')
  }, 60_000)

  it('blocks submit without valid lines and invalid quantity', async () => {
    const empty = await request(app)
      .post(base())
      .set(auth())
      .send(validPrBody({ requisitionDate: '2026-07-13', lines: [] }))
    expect(empty.status).toBe(201)
    const submitEmpty = await request(app)
      .post(`${base()}/${empty.body.data.id}/submit`)
      .set(auth())
      .send({})
    expect(submitEmpty.status).toBe(400)
    expect(submitEmpty.body.code).toBe('PR_NO_LINES')

    const badQty = await request(app)
      .post(base())
      .set(auth())
      .send(
        validPrBody({
          requisitionDate: '2026-07-13',
          lines: [{ itemCode: 'Z', itemName: 'Z', requiredQuantity: 0, uomId }],
        }),
      )
    expect(badQty.status).toBe(201)
    const submitBad = await request(app)
      .post(`${base()}/${badQty.body.data.id}/submit`)
      .set(auth())
      .send({})
    expect(submitBad.status).toBe(400)
    expect(submitBad.body.code).toBe('PR_QTY_INVALID')
  }, 60_000)

  it('cancel draft and list filters by tenant', async () => {
    const createRes = await request(app)
      .post(base())
      .set(auth())
      .send(
        validPrBody({
          requisitionDate: '2026-07-14',
          lines: [{ itemCode: 'C', itemName: 'Cancel me', requiredQuantity: 1, estimatedRate: 1, uomId }],
        }),
      )
    const id = createRes.body.data.id as string
    const cancelRes = await request(app).post(`${base()}/${id}/cancel`).set(auth()).send({})
    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.data.status).toBe('cancelled')

    const listRes = await request(app).get(base()).set(auth()).query({ status: 'CANCELLED' })
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.some((r: { id: string }) => r.id === id)).toBe(true)
  }, 60_000)
})
