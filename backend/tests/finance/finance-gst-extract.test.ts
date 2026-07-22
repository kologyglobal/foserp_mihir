/**
 * GST / Tax Compliance Phase 1 — read-only extract live tests.
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

async function createUserWithPerms(
  tenantId: string,
  slug: string,
  permNames: PermissionName[],
  label: string,
) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const email = `${label}-${Date.now()}@${slug}.test`

  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: label,
      lastName: 'User',
      email,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { in: permNames } } })
  const role = await prisma.role.create({
    data: {
      tenantId,
      name: `${label} Role ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email,
    password: 'Test@123',
    tenantSlug: slug,
  })

  return {
    userId: user.id,
    token: loginRes.body.data?.accessToken ?? '',
  }
}

interface GstExtractFixture {
  tenantId: string
  otherTenantId: string
  slug: string
  otherSlug: string
  token: string
  otherToken: string
  noTaxToken: string
  legalEntityId: string
  otherLegalEntityId: string
  salesInvoiceId: string
  vendorInvoiceId: string
  postingDate: string
}

async function bootstrapFixture(): Promise<GstExtractFixture> {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const stamp = Date.now()
  const slug = `gst-ext-${stamp}`
  const otherSlug = `gst-ext-o-${stamp}`
  const postingDate = new Date().toISOString().slice(0, 10)

  const tenant = await prisma.tenant.create({
    data: { name: 'GST Extract Tenant', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const otherTenant = await prisma.tenant.create({
    data: {
      name: 'GST Extract Other',
      slug: otherSlug,
      email: `${otherSlug}@test.com`,
      status: 'ACTIVE',
    },
  })

  const financePerms = PERMISSIONS.filter((p) => p.startsWith('finance.')) as PermissionName[]
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'GST',
      lastName: 'Extract',
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

  const otherUser = await createUserWithPerms(otherTenant.id, otherSlug, financePerms, 'other-gst')
  const noTax = await createUserWithPerms(
    tenant.id,
    slug,
    financePerms.filter((p) => !p.startsWith('finance.tax.')),
    'no-tax',
  )

  const le = await prisma.legalEntity.create({
    data: {
      tenantId: tenant.id,
      code: `LE${stamp}`.slice(-8),
      legalName: 'GST Extract Co Pvt Ltd',
      displayName: 'GST Extract Co',
      stateCode: '27',
      gstin: '27AAAAA0000A1Z5',
      isDefault: true,
      isActive: true,
    },
  })

  const otherLe = await prisma.legalEntity.create({
    data: {
      tenantId: otherTenant.id,
      code: `OL${stamp}`.slice(-8),
      legalName: 'Other GST Co',
      displayName: 'Other GST',
      stateCode: '27',
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
      invoiceNumber: `SINV-GST-${stamp}`,
      status: 'POSTED',
      customerId: '00000000-0000-4000-8000-000000000001',
      customerNameSnapshot: 'GST Outward Customer',
      customerGstinSnapshot: '27BBBBB0000B1Z5',
      customerStateCodeSnapshot: '27',
      invoiceDate: new Date(`${postingDate}T00:00:00.000Z`),
      postingDate: new Date(`${postingDate}T00:00:00.000Z`),
      placeOfSupply: '27',
      supplyType: 'INTRA_STATE',
      taxTreatment: 'REGISTERED',
      taxableAmount: '1000.0000',
      cgstAmount: '90.0000',
      sgstAmount: '90.0000',
      igstAmount: '0.0000',
      cessAmount: '0.0000',
      totalTaxAmount: '180.0000',
      totalAmount: '1180.0000',
      postedAt: new Date(),
      postedBy: user.id,
    },
  })

  const vendorInvoice = await prisma.vendorInvoice.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      financialYearId: fy.id,
      vendorId: '00000000-0000-4000-8000-000000000002',
      draftReference: `VDRAFT-${stamp}`,
      vendorInvoiceNumber: `VINV-GST-${stamp}`,
      supplierInvoiceNumber: `SUP-${stamp}`,
      supplierInvoiceNumberNormalized: `SUP-${stamp}`,
      supplierInvoiceDate: new Date(`${postingDate}T00:00:00.000Z`),
      invoiceType: 'GOODS',
      status: 'POSTED',
      taxTreatment: 'REGULAR',
      documentDate: new Date(`${postingDate}T00:00:00.000Z`),
      postingDate: new Date(`${postingDate}T00:00:00.000Z`),
      vendorCodeSnapshot: 'V001',
      vendorNameSnapshot: 'GST Inward Vendor',
      vendorGstinSnapshot: '27CCCCC0000C1Z5',
      vendorStateCodeSnapshot: '27',
      placeOfSupplyStateCode: '27',
      taxableAmount: '500.0000',
      inputCgstAmount: '45.0000',
      inputSgstAmount: '45.0000',
      inputIgstAmount: '0.0000',
      inputCessAmount: '0.0000',
      invoiceGrandTotal: '590.0000',
      vendorPayableAmount: '590.0000',
      postedAt: new Date(),
      postedBy: user.id,
    },
  })

  // Draft invoice must not appear in extract
  await prisma.salesInvoice.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      financialYearId: fy.id,
      draftReference: `DRAFT-${stamp}`,
      status: 'DRAFT',
      customerId: '00000000-0000-4000-8000-000000000001',
      customerNameSnapshot: 'Draft Customer',
      invoiceDate: new Date(`${postingDate}T00:00:00.000Z`),
      placeOfSupply: '27',
      taxableAmount: '999.0000',
      totalAmount: '999.0000',
    },
  })

  return {
    tenantId: tenant.id,
    otherTenantId: otherTenant.id,
    slug,
    otherSlug,
    token,
    otherToken: otherUser.token,
    noTaxToken: noTax.token,
    legalEntityId: le.id,
    otherLegalEntityId: otherLe.id,
    salesInvoiceId: salesInvoice.id,
    vendorInvoiceId: vendorInvoice.id,
    postingDate,
  }
}

describe.skipIf(!dbAvailable)('Finance GST extract Phase 1', () => {
  let fx: GstExtractFixture

  beforeAll(async () => {
    await ensurePermissions()
    fx = await bootstrapFixture()
  }, 120_000)

  afterAll(async () => {
    if (!fx) return
    await prisma.salesInvoice.deleteMany({ where: { tenantId: { in: [fx.tenantId, fx.otherTenantId] } } })
    await prisma.vendorInvoice.deleteMany({ where: { tenantId: { in: [fx.tenantId, fx.otherTenantId] } } })
    await prisma.financialYear.deleteMany({ where: { tenantId: { in: [fx.tenantId, fx.otherTenantId] } } })
    await prisma.legalEntity.deleteMany({ where: { tenantId: { in: [fx.tenantId, fx.otherTenantId] } } })
    await prisma.userRole.deleteMany({ where: { tenantId: { in: [fx.tenantId, fx.otherTenantId] } } })
    await prisma.rolePermission.deleteMany({
      where: { role: { tenantId: { in: [fx.tenantId, fx.otherTenantId] } } },
    })
    await prisma.role.deleteMany({ where: { tenantId: { in: [fx.tenantId, fx.otherTenantId] } } })
    await prisma.user.deleteMany({ where: { tenantId: { in: [fx.tenantId, fx.otherTenantId] } } })
    await prisma.tenant.deleteMany({ where: { id: { in: [fx.tenantId, fx.otherTenantId] } } })
  })

  it('returns posted outward supplies in date range', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/tax-compliance/outward-supplies`)
      .query({
        legalEntityId: fx.legalEntityId,
        fromDate: fx.postingDate,
        toDate: fx.postingDate,
        page: 1,
        pageSize: 50,
      })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0].id).toBe(fx.salesInvoiceId)
    expect(res.body.data.items[0].partyName).toBe('GST Outward Customer')
    expect(res.body.data.items[0].partyGstin).toBe('27BBBBB0000B1Z5')
    expect(res.body.data.items[0].taxableAmount).toBe('1000.0000')
    expect(res.body.data.items[0].cgstAmount).toBe('90.0000')
    expect(res.body.data.items[0].sgstAmount).toBe('90.0000')
    expect(res.body.data.summary.documentCount).toBe(1)
    expect(res.body.meta.total).toBe(1)
  })

  it('returns posted inward supplies in date range', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/tax-compliance/inward-supplies`)
      .query({
        legalEntityId: fx.legalEntityId,
        fromDate: fx.postingDate,
        toDate: fx.postingDate,
      })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0].id).toBe(fx.vendorInvoiceId)
    expect(res.body.data.items[0].partyName).toBe('GST Inward Vendor')
    expect(res.body.data.summary.taxableAmount).toBe('500.0000')
  })

  it('returns summary KPIs for outward + inward', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/tax-compliance/summary`)
      .query({
        legalEntityId: fx.legalEntityId,
        fromDate: fx.postingDate,
        toDate: fx.postingDate,
      })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.outward.documentCount).toBe(1)
    expect(res.body.data.inward.documentCount).toBe(1)
    expect(res.body.data.outward.taxableAmount).toBe('1000.0000')
    expect(res.body.data.inward.taxableAmount).toBe('500.0000')
  })

  it('returns 403 without finance.tax.view', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/tax-compliance/outward-supplies`)
      .query({
        legalEntityId: fx.legalEntityId,
        fromDate: fx.postingDate,
        toDate: fx.postingDate,
      })
      .set('Authorization', `Bearer ${fx.noTaxToken}`)

    expect(res.status).toBe(403)
  })

  it('isolates tenants — other tenant legal entity not found / empty', async () => {
    const crossLe = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/tax-compliance/outward-supplies`)
      .query({
        legalEntityId: fx.otherLegalEntityId,
        fromDate: fx.postingDate,
        toDate: fx.postingDate,
      })
      .set('Authorization', `Bearer ${fx.token}`)

    expect(crossLe.status).toBe(404)

    const otherTenantList = await request(app)
      .get(`/api/v1/t/${fx.otherSlug}/accounting/tax-compliance/outward-supplies`)
      .query({
        legalEntityId: fx.otherLegalEntityId,
        fromDate: fx.postingDate,
        toDate: fx.postingDate,
      })
      .set('Authorization', `Bearer ${fx.otherToken}`)

    expect(otherTenantList.status).toBe(200)
    expect(otherTenantList.body.data.items).toHaveLength(0)
  })
})
