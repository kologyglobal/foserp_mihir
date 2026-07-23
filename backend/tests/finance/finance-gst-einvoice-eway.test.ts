/**
 * GST e-invoice / e-way Phase 2 — simulated NIC generate/cancel live tests.
 * Requires MySQL. Skips when DB unavailable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

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

interface Fixture {
  tenantId: string
  slug: string
  token: string
  viewOnlyToken: string
  legalEntityId: string
  salesInvoiceId: string
  postingDate: string
}

async function bootstrap(): Promise<Fixture> {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const stamp = Date.now()
  const slug = `gst-ewb-${stamp}`
  const postingDate = new Date().toISOString().slice(0, 10)

  const tenant = await prisma.tenant.create({
    data: { name: 'GST EWB Tenant', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const financePerms = PERMISSIONS.filter((p) => p.startsWith('finance.')) as PermissionName[]
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'GST',
      lastName: 'EWB',
      email: `user-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const perms = await prisma.permission.findMany({ where: { name: { in: financePerms } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Finance ${stamp}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id } })

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })
  const token = loginRes.body.data?.accessToken ?? ''

  const viewPerms = financePerms.filter(
    (p) => p === 'finance.tax.view' || p === 'finance.view' || p === 'finance.legal_entity.view',
  ) as PermissionName[]
  const viewUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'View',
      lastName: 'Only',
      email: `view-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const viewPermRows = await prisma.permission.findMany({ where: { name: { in: viewPerms } } })
  const viewRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `View ${stamp}`,
      rolePermissions: { create: viewPermRows.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: viewUser.id, roleId: viewRole.id, tenantId: tenant.id } })
  const viewLogin = await request(app).post('/api/v1/auth/login').send({
    email: viewUser.email,
    password: 'Test@123',
    tenantSlug: slug,
  })

  const le = await prisma.legalEntity.create({
    data: {
      tenantId: tenant.id,
      code: `LE${stamp}`.slice(-8),
      legalName: 'GST EWB Co Pvt Ltd',
      displayName: 'GST EWB Co',
      stateCode: '27',
      gstin: '27AAAAA0000A1Z5',
      isDefault: true,
      isActive: true,
    },
  })

  const fyStartYear = new Date().getUTCMonth() >= 3 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1
  const fy = await prisma.financialYear.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      name: `FY ${fyStartYear}`,
      startDate: new Date(`${fyStartYear}-04-01T00:00:00.000Z`),
      endDate: new Date(`${fyStartYear + 1}-03-31T00:00:00.000Z`),
      status: 'ACTIVE',
      isCurrent: true,
    },
  })

  const salesInvoice = await prisma.salesInvoice.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      financialYearId: fy.id,
      invoiceNumber: `SINV-EWB-${stamp}`,
      status: 'POSTED',
      customerId: '00000000-0000-4000-8000-000000000001',
      customerNameSnapshot: 'EWB Customer',
      customerGstinSnapshot: '27BBBBB0000B1Z5',
      customerStateCodeSnapshot: '27',
      invoiceDate: new Date(`${postingDate}T00:00:00.000Z`),
      postingDate: new Date(`${postingDate}T00:00:00.000Z`),
      placeOfSupply: '27',
      supplyType: 'INTRA_STATE',
      taxTreatment: 'REGISTERED',
      taxableAmount: '75000.0000',
      cgstAmount: '6750.0000',
      sgstAmount: '6750.0000',
      igstAmount: '0.0000',
      cessAmount: '0.0000',
      totalTaxAmount: '13500.0000',
      totalAmount: '88500.0000',
      postedAt: new Date(),
      postedBy: user.id,
    },
  })

  return {
    tenantId: tenant.id,
    slug,
    token,
    viewOnlyToken: viewLogin.body.data?.accessToken ?? '',
    legalEntityId: le.id,
    salesInvoiceId: salesInvoice.id,
    postingDate,
  }
}

describe.skipIf(!dbAvailable)('Finance GST e-invoice / e-way (simulated NIC)', () => {
  let fx: Fixture
  let eInvoiceId = ''
  let eWayId = ''

  beforeAll(async () => {
    await ensurePermissions()
    fx = await bootstrap()
  }, 120_000)

  afterAll(async () => {
    if (!fx) return
    await prisma.gstEWayBill.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.gstEInvoice.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.salesInvoice.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.financialYear.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.legalEntity.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.userRole.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId: fx.tenantId } } })
    await prisma.role.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.user.deleteMany({ where: { tenantId: fx.tenantId } })
    await prisma.tenant.deleteMany({ where: { id: fx.tenantId } })
  })

  it('generates a simulated IRN for a posted sales invoice', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/tax-compliance/e-invoices/generate`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ salesInvoiceId: fx.salesInvoiceId })

    expect(res.status).toBe(201)
    expect(res.body.data.item.status).toBe('GENERATED')
    expect(res.body.data.item.irn).toBeTruthy()
    expect(res.body.data.item.providerMode).toBe('SIMULATED')
    eInvoiceId = res.body.data.item.id
  })

  it('lists e-invoices and blocks view-only generate', async () => {
    const list = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/tax-compliance/e-invoices`)
      .query({
        legalEntityId: fx.legalEntityId,
        fromDate: fx.postingDate,
        toDate: fx.postingDate,
      })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(list.status).toBe(200)
    expect(list.body.data.items.some((r: { id: string }) => r.id === eInvoiceId)).toBe(true)

    const denied = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/tax-compliance/e-invoices/generate`)
      .set('Authorization', `Bearer ${fx.viewOnlyToken}`)
      .send({ salesInvoiceId: fx.salesInvoiceId })
    expect(denied.status).toBe(403)
  })

  it('cancels the simulated IRN', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/tax-compliance/e-invoices/${eInvoiceId}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Test cancel IRN' })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('CANCELLED')
  })

  it('generates and cancels a simulated e-way bill', async () => {
    const gen = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/tax-compliance/e-way-bills/generate`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        sourceType: 'SALES_INVOICE',
        salesInvoiceId: fx.salesInvoiceId,
        fromPlace: 'Pune',
        toPlace: 'Mumbai',
        distanceKm: 150,
        vehicleNumber: 'MH12AB1234',
        force: true,
      })

    expect(gen.status).toBe(201)
    expect(gen.body.data.item.status).toBe('GENERATED')
    expect(gen.body.data.item.ewbNumber).toMatch(/^EWB/)
    expect(gen.body.data.item.providerMode).toBe('SIMULATED')
    eWayId = gen.body.data.item.id

    const cancel = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/tax-compliance/e-way-bills/${eWayId}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Test cancel EWB' })

    expect(cancel.status).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')
  })
})
