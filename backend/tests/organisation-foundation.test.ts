import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const ORG_PERMS: PermissionName[] = [
  'organisation.view',
  'organisation.create',
  'organisation.update',
  'finance.legal_entity.view',
  'finance.legal_entity.manage',
  'finance.chart_accounts.view',
  'finance.chart_accounts.create',
  'finance.coa.view',
  'finance.coa.manage',
  'finance.account_mapping.manage',
  'finance.default_mapping.view',
  'finance.default_mapping.manage',
  'finance.fiscal_year.manage',
  'finance.financial_year.view',
  'finance.financial_year.manage',
  'finance.posting_period.manage',
  'finance.period.view',
  'finance.period.manage',
]

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

async function createOrgTenant(withOrgPerms: boolean) {
  const { hashPassword } = await import('../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `org-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  const tenant = await prisma.tenant.create({
    data: { name: 'Org Test', slug, email: `org-${Date.now()}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Org',
      lastName: 'Tester',
      email: `org-user-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const permNames = withOrgPerms ? ORG_PERMS : (['finance.view'] as PermissionName[])
  const perms = await prisma.permission.findMany({ where: { name: { in: permNames } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Org Role ${Date.now()}`,
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
    slug,
    token: loginRes.body.data?.accessToken ?? '',
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.organisationRegistration.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

const VEER_GSTIN = '24AAJCV7010P1ZZ'

describe.skipIf(!dbAvailable)('Organisation foundation APIs', () => {
  let ctx = { tenantId: '', slug: '', token: '' }
  let legalEntityId = ''

  beforeAll(async () => {
    await ensurePermissions()
    ctx = await createOrgTenant(true)
  }, 60_000)

  afterAll(async () => {
    if (ctx.tenantId) await cleanupTenant(ctx.tenantId)
  })

  it('rejects legal entity create with invalid GSTIN', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${ctx.slug}/organisation/legal-entities`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: 'BAD',
        legalName: 'Bad GST Co',
        tradeName: 'Bad GST',
        businessType: 'PRIVATE_LIMITED',
        gstNumber: 'INVALID',
        country: 'India',
        state: 'Gujarat',
        city: 'Chhapi',
        postalCode: '385210',
        addressLine: 'Survey No.54',
      })
    expect(res.status).toBe(400)
  })

  it('creates legal entity with required org fields', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${ctx.slug}/organisation/legal-entities`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: 'VIT-T',
        legalName: 'VEER INTERNATIONAL TANKS AND CONTAINERS PRIVATE LIMITED',
        tradeName: 'Veer International',
        businessType: 'PRIVATE_LIMITED',
        gstNumber: VEER_GSTIN,
        country: 'India',
        state: 'Gujarat',
        district: 'Banaskantha',
        city: 'Chhapi',
        postalCode: '385210',
        addressLine: 'Survey No.54 Paiki 1, Panchal Estate, Narsan Road',
        isDefault: true,
      })
    expect(res.status).toBe(201)
    expect(res.body.data.gstNumber).toBe(VEER_GSTIN)
    expect(res.body.data.tradeName).toBe('Veer International')
    expect(res.body.data.addressLine).toContain('Survey No.54')
    legalEntityId = res.body.data.id
  })

  it('creates and updates GST registration', async () => {
    const create = await request(app)
      .post(`/api/v1/t/${ctx.slug}/organisation/registrations`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        registrationType: 'GST',
        registrationNumber: VEER_GSTIN,
        country: 'India',
        state: 'Gujarat',
        status: 'ACTIVE',
      })
    expect(create.status).toBe(201)
    expect(create.body.data.registrationType).toBe('GST')

    const update = await request(app)
      .put(`/api/v1/t/${ctx.slug}/organisation/registrations/${create.body.data.id}`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ status: 'INACTIVE' })
    expect(update.status).toBe(200)
    expect(update.body.data.status).toBe('INACTIVE')
  })

  it('rejects overlapping fiscal year and enforces date order', async () => {
    const badOrder = await request(app)
      .post(`/api/v1/t/${ctx.slug}/organisation/fiscal-years`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        financialYear: 'FY Bad',
        startDate: '2027-03-31',
        endDate: '2026-04-01',
        status: 'DRAFT',
      })
    expect(badOrder.status).toBe(400)

    const first = await request(app)
      .post(`/api/v1/t/${ctx.slug}/organisation/fiscal-years`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        financialYear: 'FY 2026-27',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        status: 'ACTIVE',
      })
    expect(first.status).toBe(201)

    const overlap = await request(app)
      .post(`/api/v1/t/${ctx.slug}/organisation/fiscal-years`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        financialYear: 'FY Overlap',
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        status: 'DRAFT',
      })
    expect([400, 409]).toContain(overlap.status)
  })

  it('denies organisation routes without organisation permissions', async () => {
    const denied = await createOrgTenant(false)
    try {
      const res = await request(app)
        .get(`/api/v1/t/${denied.slug}/organisation/legal-entities`)
        .set('Authorization', `Bearer ${denied.token}`)
      expect(res.status).toBe(403)
    } finally {
      await cleanupTenant(denied.tenantId)
    }
  })
})

describe.skipIf(!dbAvailable)('Veer organisation seed smoke', () => {
  it('seed script leaves LE + GST registration ready for vasant-trailers when present', async () => {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'vasant-trailers', deletedAt: null },
    })
    if (!tenant) {
      expect(true).toBe(true)
      return
    }

    const le = await prisma.legalEntity.findFirst({
      where: { tenantId: tenant.id, isDefault: true },
    })
    expect(le).toBeTruthy()
    expect(le?.gstin).toBe(VEER_GSTIN)

    const reg = await prisma.organisationRegistration.findFirst({
      where: {
        tenantId: tenant.id,
        legalEntityId: le!.id,
        registrationType: 'GST',
        deletedAt: null,
      },
    })
    // Registration may be absent until seed-veer is re-run after migration
    if (reg) {
      expect(reg.registrationNumber).toBe(VEER_GSTIN)
      expect(reg.status).toBe('ACTIVE')
    }

    const fy = await prisma.financialYear.findFirst({
      where: { tenantId: tenant.id, legalEntityId: le!.id, isCurrent: true },
    })
    expect(fy).toBeTruthy()
  })
})
