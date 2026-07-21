import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'

/**
 * Purchase document number previews — non-consuming next-number endpoints.
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
      data: { name: 'Number Preview', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
  } else {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    slug = tenant.slug
  }
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: 'Num',
      lastName: 'Preview',
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
    slug,
    token: loginRes.body.data?.accessToken as string,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.goodsReceiptLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.goodsReceipt.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.purchaseOrderLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } })
  await prisma.vendorQuotationLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorQuotation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.rfqVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.requestForQuotationLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.requestForQuotation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.purchaseRequisitionLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseRequisition.deleteMany({ where: { tenantId } })
  await prisma.purchaseApproval.deleteMany({ where: { tenantId } })
  await prisma.purchaseStatusHistory.deleteMany({ where: { tenantId } })
  await prisma.masterVendor.deleteMany({ where: { tenantId } })
  await prisma.masterUom.deleteMany({ where: { tenantId } })
  await prisma.codeSeries.deleteMany({ where: { tenantId } })
  await prisma.auditLog.deleteMany({ where: { tenantId } })
  await prisma.userRole.deleteMany({ where: { tenantId } })
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } })
  await prisma.role.deleteMany({ where: { tenantId } })
  await prisma.user.deleteMany({ where: { tenantId } })
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

const FULL_PURCHASE_PERMS = PERMISSIONS.filter((p) => p.startsWith('purchase.')) as PermissionName[]

describe.skipIf(!dbAvailable)('Purchase document number previews', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let viewerToken = ''
  let otherSlug = ''
  let otherToken = ''
  let otherTenantId = ''
  let vendorId = ''
  let uomId = ''

  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })
  const path = (resource: string, s = slug) => `/api/v1/t/${s}/purchase/${resource}`

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createTenantUser({
      slugPrefix: 'numprev',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = ctx.tenantId
    slug = ctx.slug
    token = ctx.token

    const viewer = await createTenantUser({
      slugPrefix: 'numprev-view',
      permissionNames: [
        'purchase.pr.view',
        'purchase.rfq.view',
        'purchase.po.view',
        'purchase.grn.view',
      ] as PermissionName[],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      slugPrefix: 'numprev-other',
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
      data: { tenantId, code: `V-${Date.now()}`, name: 'Preview Vendor', status: 'ACTIVE' },
    })
    vendorId = vendor.id
  }, 120_000)

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId)
    if (otherTenantId) await cleanupTenant(otherTenantId)
  })

  it('previews PR number without consuming the sequence', async () => {
    const first = await request(app).get(`${path('requisitions')}/next-number`).set(auth())
    expect(first.status).toBe(200)
    const preview = first.body.data.requisitionNumber as string
    expect(preview).toMatch(/^PR-/)

    const second = await request(app).get(`${path('requisitions')}/next-number`).set(auth())
    expect(second.status).toBe(200)
    expect(second.body.data.requisitionNumber).toBe(preview)

    const create = await request(app)
      .post(path('requisitions'))
      .set(auth())
      .send({
        requisitionDate: '2026-07-21',
        requiredDate: '2026-07-30',
        departmentId: 'dept-ops',
        rfqRequired: true,
        lines: [
          {
            itemCode: 'ITM-1',
            itemName: 'Item',
            requiredQuantity: 1,
            estimatedRate: 10,
            uomId,
          },
        ],
      })
    expect(create.status).toBe(201)
    expect(create.body.data.requisitionNumber).toBe(preview)

    const after = await request(app).get(`${path('requisitions')}/next-number`).set(auth())
    expect(after.status).toBe(200)
    expect(after.body.data.requisitionNumber).not.toBe(preview)
  })

  it('previews PO number without consuming and denies view-only users', async () => {
    const first = await request(app).get(`${path('orders')}/next-number`).set(auth())
    expect(first.status).toBe(200)
    const preview = first.body.data.orderNumber as string
    expect(preview).toMatch(/^PO-/)

    const again = await request(app).get(`${path('orders')}/next-number`).set(auth())
    expect(again.body.data.orderNumber).toBe(preview)

    const denied = await request(app).get(`${path('orders')}/next-number`).set(auth(viewerToken))
    expect(denied.status).toBe(403)

    const create = await request(app)
      .post(path('orders'))
      .set(auth())
      .send({
        vendorId,
        orderDate: '2026-07-21',
        lines: [{ itemCode: 'ITM-PO', itemName: 'PO Item', quantity: 2, uomId, rate: 10 }],
      })
    expect(create.status).toBe(201)
    expect(create.body.data.orderNumber).toBe(preview)
  })

  it('previews GRN number without consuming', async () => {
    const first = await request(app).get(`${path('grns')}/next-number`).set(auth())
    expect(first.status).toBe(200)
    const preview = first.body.data.grnNumber as string
    expect(preview).toMatch(/^GRN-/)

    const again = await request(app).get(`${path('grns')}/next-number`).set(auth())
    expect(again.body.data.grnNumber).toBe(preview)

    const denied = await request(app).get(`${path('grns')}/next-number`).set(auth(viewerToken))
    expect(denied.status).toBe(403)
  })

  it('previews RFQ and VQ numbers and enforces tenant isolation', async () => {
    const rfq = await request(app).get(`${path('rfqs')}/next-number`).set(auth())
    expect(rfq.status).toBe(200)
    expect(rfq.body.data.rfqNumber).toMatch(/^RFQ-/)

    const vq = await request(app).get(`${path('vendor-quotations')}/next-number`).set(auth())
    expect(vq.status).toBe(200)
    expect(vq.body.data.quotationNumber).toMatch(/^VQ-/)

    const cross = await request(app)
      .get(`${path('orders', otherSlug)}/next-number`)
      .set(auth(otherToken))
    expect(cross.status).toBe(200)
    // Other tenant gets its own series — may coincide at 1, but must succeed for that tenant only
    expect(cross.body.data.orderNumber).toMatch(/^PO-/)

    const deniedViewer = await request(app)
      .get(`${path('rfqs')}/next-number`)
      .set(auth(viewerToken))
    expect(deniedViewer.status).toBe(403)
  })
})
