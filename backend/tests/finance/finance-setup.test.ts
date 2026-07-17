import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'

const app = createApp()

/** Probe at module load — Vitest evaluates skipIf at collection time, before beforeAll. */
const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))

async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    }).catch(() => {})
  }
}

async function createFinanceTenant() {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `finance-test-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'Finance Test', slug, email: `finance-${Date.now()}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Finance',
      lastName: 'Tester',
      email: `finance-user-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { in: [...FINANCE_PERMS] as PermissionName[] } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Finance Admin ${Date.now()}`,
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
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalRule.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeFeatureControl.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.costCentre.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance setup APIs', () => {
  let ctx = { tenantId: '', slug: '', token: '' }
  let legalEntityId = ''
  let financialYearId = ''
  let groupAccountId = ''
  let ledgerAccountId = ''

  beforeAll(async () => {
    await ensurePermissions()
    ctx = await createFinanceTenant()
  })

  afterAll(async () => {
    if (ctx.tenantId) await cleanupTenant(ctx.tenantId)
  })

  it('creates legal entity and rejects duplicate code', async () => {
    const code = `LE${Date.now()}`.slice(-8)
    const createRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code,
        legalName: 'Test Manufacturing Pvt Ltd',
        displayName: 'Test Mfg',
        gstin: '27AABCU9603R1ZM',
      })
    expect(createRes.status).toBe(201)
    legalEntityId = createRes.body.data.id
    expect(createRes.body.data.isDefault).toBe(true)

    const dupRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code,
        legalName: 'Duplicate Entity',
        displayName: 'Dup',
      })
    expect(dupRes.status).toBe(409)
  })

  it('allows only one head-office branch per legal entity', async () => {
    const hoRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities/${legalEntityId}/branches`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: 'HO2', name: 'Second HO', isHeadOffice: true })
    expect(hoRes.status).toBe(409)
  })

  it('rejects overlapping financial years', async () => {
    const fyRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        name: 'FY 2025-26',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isCurrent: true,
      })
    expect(fyRes.status).toBe(201)
    financialYearId = fyRes.body.data.id

    const overlapRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        name: 'FY overlap',
        startDate: '2025-10-01',
        endDate: '2026-09-30',
      })
    expect(overlapRes.status).toBe(409)
  })

  it('generates 12 accounting periods on FY activate', async () => {
    const activateRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/financial-years/${financialYearId}/activate`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(activateRes.status).toBe(200)

    const periodsRes = await request(app)
      .get(`/api/v1/t/${ctx.slug}/accounting/periods?legalEntityId=${legalEntityId}&financialYearId=${financialYearId}&limit=100`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(periodsRes.status).toBe(200)
    expect(periodsRes.body.data.length).toBe(12)
  })

  it('rejects circular account parent', async () => {
    const templateRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/accounts/apply-template`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ legalEntityId, templateId: 'TRADING' })
    expect(templateRes.status).toBe(201)

    const groupRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/accounts`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        accountCode: '9999',
        accountName: 'Test Group',
        category: 'ASSET',
        isGroup: true,
        normalBalance: 'DEBIT',
      })
    expect(groupRes.status).toBe(201)
    groupAccountId = groupRes.body.data.id

    const childRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/accounts`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        accountCode: '999901',
        accountName: 'Test Ledger',
        parentAccountId: groupAccountId,
        category: 'ASSET',
        isGroup: false,
        normalBalance: 'DEBIT',
      })
    expect(childRes.status).toBe(201)
    ledgerAccountId = childRes.body.data.id

    const circularRes = await request(app)
      .put(`/api/v1/t/${ctx.slug}/accounting/accounts/${groupAccountId}`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ parentAccountId: ledgerAccountId })
    expect(circularRes.status).toBe(400)
  })

  it('rejects mapping to group account', async () => {
    const mapRes = await request(app)
      .put(`/api/v1/t/${ctx.slug}/accounting/default-mappings`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        mappings: [{ mappingKey: 'CUSTOMER_RECEIVABLE', accountId: groupAccountId }],
      })
    expect(mapRes.status).toBe(400)
  })

  it('rejects finance activation when setup incomplete', async () => {
    const activateRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/activate`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ legalEntityId })
    expect(activateRes.status).toBe(422)
    expect(activateRes.body.data.ready).toBe(false)
    expect(Array.isArray(activateRes.body.data.missing)).toBe(true)
  })

  it('enforces finance permission on legal-entities list', async () => {
    const { hashPassword } = await import('../../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const email = `no-finance-${Date.now()}@test.com`
    const user = await prisma.user.create({
      data: {
        tenantId: ctx.tenantId,
        firstName: 'No',
        lastName: 'Finance',
        email,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const role = await prisma.role.create({
      data: { tenantId: ctx.tenantId, name: `Sales Only ${Date.now()}` },
    })
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: ctx.tenantId } })

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'Test@123',
      tenantSlug: ctx.slug,
    })
    const token = loginRes.body.data?.accessToken as string

    const res = await request(app)
      .get(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)

    await prisma.userRole.deleteMany({ where: { userId: user.id } })
    await prisma.role.delete({ where: { id: role.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  })
})
