/**
 * Period-close FX revaluation — live MySQL suite.
 * Skips when the database is unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))

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

async function createFinanceTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'FX Reval Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'FX',
      lastName: 'Reval',
      email: `user-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const wanted = [...FINANCE_PERMS] as PermissionName[]
  const perms = await prisma.permission.findMany({ where: { name: { in: wanted } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `FX Role ${Date.now()}`,
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
    token: loginRes.body.data?.accessToken ?? '',
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.fxRevaluationLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fxRevaluationRun.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fxExchangeRate.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeFeatureControl.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

interface FxFixture {
  tenantId: string
  slug: string
  token: string
  userId: string
  legalEntityId: string
  periods: Array<{ id: string; periodNumber: number; startDate: Date; endDate: Date }>
  receivableId: string
  payableId: string
  gainId: string
  lossId: string
  customerId: string
  vendorId: string
}

async function bootstrapFixture(ctx: {
  tenantId: string
  slug: string
  token: string
  userId: string
}): Promise<FxFixture> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `FX${Date.now()}`.slice(-8),
      legalName: 'FX Reval Co Pvt Ltd',
      displayName: 'FX Reval Co',
    })
  expect(leRes.status).toBe(201)
  const legalEntityId = leRes.body.data.id as string

  const fyRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      legalEntityId,
      name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
      startDate: fyStart,
      endDate: fyEnd,
      isCurrent: true,
    })
  expect(fyRes.status).toBe(201)
  const financialYearId = fyRes.body.data.id as string

  const activateFy = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years/${financialYearId}/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
  expect(activateFy.status).toBe(200)

  const templateRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/accounts/apply-template`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId, templateId: 'TRADING' })
  expect(templateRes.status).toBe(201)

  await prisma.financeSettings.upsert({
    where: { legalEntityId },
    create: {
      tenantId: ctx.tenantId,
      legalEntityId,
      financeActivated: true,
      allowBackdatedPosting: true,
      backdatedDaysLimit: 400,
      baseCurrency: 'INR',
    },
    update: {
      financeActivated: true,
      allowBackdatedPosting: true,
      backdatedDaysLimit: 400,
      baseCurrency: 'INR',
    },
  })

  await prisma.financeFeatureControl.upsert({
    where: { legalEntityId_featureKey: { legalEntityId, featureKey: 'MULTI_CURRENCY' } },
    create: {
      tenantId: ctx.tenantId,
      legalEntityId,
      featureKey: 'MULTI_CURRENCY',
      isEnabled: true,
    },
    update: { isEnabled: true },
  })

  const receivable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
  })
  const payable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  expect(receivable).toBeTruthy()
  expect(payable).toBeTruthy()

  const gain = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      accountCode: `FX-GAIN-${Date.now()}`.slice(0, 32),
      accountName: 'Unrealized FX Gain',
      category: 'INCOME',
      accountType: 'GENERAL',
      level: 1,
      isGroup: false,
      isActive: true,
      normalBalance: 'CREDIT',
      allowManualPosting: true,
    },
  })
  const loss = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      accountCode: `FX-LOSS-${Date.now()}`.slice(0, 32),
      accountName: 'Unrealized FX Loss',
      category: 'EXPENSE',
      accountType: 'GENERAL',
      level: 1,
      isGroup: false,
      isActive: true,
      normalBalance: 'DEBIT',
      allowManualPosting: true,
    },
  })

  await prisma.defaultAccountMapping.createMany({
    data: [
      {
        tenantId: ctx.tenantId,
        legalEntityId,
        mappingKey: 'CUSTOMER_RECEIVABLE',
        accountId: receivable!.id,
        isMandatory: true,
      },
      {
        tenantId: ctx.tenantId,
        legalEntityId,
        mappingKey: 'VENDOR_PAYABLE',
        accountId: payable!.id,
        isMandatory: true,
      },
      {
        tenantId: ctx.tenantId,
        legalEntityId,
        mappingKey: 'UNREALIZED_FX_GAIN',
        accountId: gain.id,
        isMandatory: false,
      },
      {
        tenantId: ctx.tenantId,
        legalEntityId,
        mappingKey: 'UNREALIZED_FX_LOSS',
        accountId: loss.id,
        isMandatory: false,
      },
    ],
    skipDuplicates: true,
  })

  const seriesRes = await request(app)
    .put(`/api/v1/t/${ctx.slug}/accounting/number-series`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      legalEntityId,
      series: ['JOURNAL', 'REVERSAL'].map((documentType) => ({
        documentType,
        prefix: `${documentType.slice(0, 2)}-`,
        padLength: 5,
        resetEachYear: true,
        isActive: true,
      })),
    })
  expect(seriesRes.status).toBe(200)

  const periods = await prisma.accountingPeriod.findMany({
    where: { tenantId: ctx.tenantId, financialYearId },
    orderBy: { periodNumber: 'asc' },
    select: { id: true, periodNumber: true, startDate: true, endDate: true },
  })
  expect(periods.length).toBeGreaterThanOrEqual(3)

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: ctx.tenantId,
      name: 'USD Customer',
      companyCode: `CUS-FX-${Date.now()}`.slice(0, 32),
      status: 'active',
      isActive: true,
    },
  })

  return {
    tenantId: ctx.tenantId,
    slug: ctx.slug,
    token: ctx.token,
    userId: ctx.userId,
    legalEntityId,
    periods,
    receivableId: receivable!.id,
    payableId: payable!.id,
    gainId: gain.id,
    lossId: loss.id,
    customerId: customer.id,
    vendorId: 'unused',
  }
}

function auth(fx: FxFixture) {
  return { Authorization: `Bearer ${fx.token}` }
}

function base(fx: FxFixture) {
  return `/api/v1/t/${fx.slug}/accounting/period-close/fx-revaluation`
}

describe.skipIf(!dbAvailable)('finance FX revaluation (period close)', () => {
  let fx: FxFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceTenant('fxr')
    fx = await bootstrapFixture(ctx)
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('upserts a closing FX rate', async () => {
    const period = fx.periods[0]!
    const asOf = period.endDate.toISOString().slice(0, 10)
    const res = await request(app)
      .put(`${base(fx)}/rates`)
      .set(auth(fx))
      .send({
        legalEntityId: fx.legalEntityId,
        currencyCode: 'USD',
        asOfDate: asOf,
        rate: '85.5000',
      })
    expect(res.status).toBe(201)
    expect(res.body.data.currencyCode).toBe('USD')
    expect(res.body.data.rate).toBe('85.5000')
  })

  it('previews AR open-item gain, posts journal, and reverses into next period', async () => {
    const period = fx.periods[0]!
    const asOf = period.endDate.toISOString().slice(0, 10)

    await request(app)
      .put(`${base(fx)}/rates`)
      .set(auth(fx))
      .send({
        legalEntityId: fx.legalEntityId,
        currencyCode: 'USD',
        asOfDate: asOf,
        rate: '85.0000',
      })

    const docId = `doc-${Date.now()}`
    // Booked at 80; closing 85 → gain of 500 INR on 100 USD open.
    await prisma.receivableOpenItem.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        side: 'DEBIT',
        documentType: 'SALES_INVOICE',
        documentId: docId,
        documentNumberSnapshot: 'SI-FX-1',
        customerId: fx.customerId,
        customerNameSnapshot: 'USD Customer',
        receivableAccountId: fx.receivableId,
        currencyCode: 'USD',
        exchangeRate: '80.0000',
        originalAmount: '100.0000',
        openAmount: '100.0000',
        baseOriginalAmount: '8000.0000',
        baseOpenAmount: '8000.0000',
        documentDate: period.startDate,
        status: 'OPEN',
      },
    })

    const previewRes = await request(app)
      .post(`${base(fx)}/periods/${period.id}/preview`)
      .set(auth(fx))
    expect(previewRes.status).toBe(200)
    const run = previewRes.body.data
    expect(run.status).toBe('PREVIEWED')
    expect(run.lines.length).toBe(1)
    expect(Number(run.totalGain)).toBe(500)
    expect(run.lines[0].gainLoss).toBe(500)

    const postRes = await request(app).post(`${base(fx)}/runs/${run.id}/post`).set(auth(fx))
    expect(postRes.status).toBe(200)
    expect(postRes.body.data.status).toBe('POSTED')
    expect(postRes.body.data.voucherNumber).toBeTruthy()

    const openItem = await prisma.receivableOpenItem.findFirst({
      where: { tenantId: fx.tenantId, documentId: docId },
    })
    expect(Number(openItem?.baseOpenAmount)).toBe(8500)
    expect(Number(openItem?.exchangeRate)).toBe(85)

    const reverseRes = await request(app)
      .post(`${base(fx)}/runs/${run.id}/reverse`)
      .set(auth(fx))
      .send({ reason: 'Test FX reversal' })
    expect(reverseRes.status).toBe(200)
    expect(reverseRes.body.data.status).toBe('REVERSED')
    expect(reverseRes.body.data.reversalVoucherNumber).toBeTruthy()
  })

  it('rejects preview when MULTI_CURRENCY is off', async () => {
    await prisma.financeFeatureControl.update({
      where: {
        legalEntityId_featureKey: { legalEntityId: fx.legalEntityId, featureKey: 'MULTI_CURRENCY' },
      },
      data: { isEnabled: false },
    })
    const period = fx.periods[1]!
    const res = await request(app).post(`${base(fx)}/periods/${period.id}/preview`).set(auth(fx))
    expect(res.status).toBe(422)
    expect(String(res.body.code ?? res.body.error?.code ?? '')).toMatch(/MULTI_CURRENCY|FX_REVAL/)
    await prisma.financeFeatureControl.update({
      where: {
        legalEntityId_featureKey: { legalEntityId: fx.legalEntityId, featureKey: 'MULTI_CURRENCY' },
      },
      data: { isEnabled: true },
    })
  })

  it('returns null run when period has not been previewed', async () => {
    const period = fx.periods[2]!
    const res = await request(app).get(`${base(fx)}/periods/${period.id}/run`).set(auth(fx))
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })
})
