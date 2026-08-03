/**
 * Period-close accruals + prepaid amortisation — live MySQL suite.
 * Skips when the database is unreachable (same convention as year-end close).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { buildScheduleAmounts } from '../../src/modules/accounting/period-adjustments/period-adjustment.service.js'

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
    data: { name: 'Period Adj Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Period',
      lastName: 'Adj',
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
      name: `PA Role ${Date.now()}`,
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
  await prisma.periodEndAdjustmentSchedule.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.periodEndAdjustment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

interface PaFixture {
  tenantId: string
  slug: string
  token: string
  legalEntityId: string
  periods: Array<{ id: string; periodNumber: number; startDate: Date; endDate: Date }>
  expenseId: string
  liabilityId: string
  prepaidAssetId: string
}

async function bootstrapFixture(ctx: {
  tenantId: string
  slug: string
  token: string
}): Promise<PaFixture> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `PA${Date.now()}`.slice(-8),
      legalName: 'Period Adj Co Pvt Ltd',
      displayName: 'Period Adj Co',
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
    },
    update: {
      financeActivated: true,
      allowBackdatedPosting: true,
      backdatedDaysLimit: 400,
    },
  })

  const expense = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, category: 'EXPENSE', isGroup: false, isActive: true },
  })
  expect(expense).toBeTruthy()

  // Explicit BS accounts for accrual liability + prepaid asset (template may not have dedicated ones).
  const liability = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      accountCode: `ACC-LIAB-${Date.now()}`.slice(0, 32),
      accountName: 'Accrued Expenses',
      category: 'LIABILITY',
      accountType: 'GENERAL',
      level: 1,
      isGroup: false,
      isActive: true,
      normalBalance: 'CREDIT',
      allowManualPosting: true,
    },
  })
  const prepaidAsset = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      accountCode: `PREP-AST-${Date.now()}`.slice(0, 32),
      accountName: 'Prepaid Expenses',
      category: 'ASSET',
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
        mappingKey: 'ACCRUED_EXPENSE_LIABILITY',
        accountId: liability.id,
        isMandatory: false,
      },
      {
        tenantId: ctx.tenantId,
        legalEntityId,
        mappingKey: 'PREPAID_EXPENSE_ASSET',
        accountId: prepaidAsset.id,
        isMandatory: false,
      },
    ],
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

  return {
    tenantId: ctx.tenantId,
    slug: ctx.slug,
    token: ctx.token,
    legalEntityId,
    periods,
    expenseId: expense!.id,
    liabilityId: liability.id,
    prepaidAssetId: prepaidAsset.id,
  }
}

function auth(fx: PaFixture) {
  return { Authorization: `Bearer ${fx.token}` }
}

function base(fx: PaFixture) {
  return `/api/v1/t/${fx.slug}/accounting/period-adjustments`
}

describe.skipIf(!dbAvailable)('finance period-end adjustments (accruals + prepaid)', () => {
  let fx: PaFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceTenant('pa')
    fx = await bootstrapFixture(ctx)
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('buildScheduleAmounts places rounding remainder on the last period', () => {
    expect(buildScheduleAmounts('100.0000', 3)).toEqual(['33.3333', '33.3333', '33.3334'])
    expect(buildScheduleAmounts('10.0000', 4)).toEqual(['2.5000', '2.5000', '2.5000', '2.5000'])
  })

  it('creates, posts and reverses an ACCRUAL into the next period', async () => {
    const period = fx.periods[0]!
    const createRes = await request(app)
      .post(base(fx))
      .set(auth(fx))
      .send({
        kind: 'ACCRUAL',
        legalEntityId: fx.legalEntityId,
        periodId: period.id,
        description: 'Unbilled electricity',
        narration: 'Accrue power for period end',
        totalAmount: '2500.0000',
        expenseAccountId: fx.expenseId,
        autoReverse: true,
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.data.kind).toBe('ACCRUAL')
    expect(createRes.body.data.status).toBe('DRAFT')
    expect(createRes.body.data.adjustmentNumber).toMatch(/^ACR-/)
    expect(createRes.body.data.balanceSheetAccount.id).toBe(fx.liabilityId)
    const id = createRes.body.data.id as string

    const readyRes = await request(app).post(`${base(fx)}/${id}/mark-ready`).set(auth(fx))
    expect(readyRes.status).toBe(200)
    expect(readyRes.body.data.status).toBe('READY_TO_POST')

    const postRes = await request(app).post(`${base(fx)}/${id}/post`).set(auth(fx))
    expect(postRes.status).toBe(200)
    expect(postRes.body.data.status).toBe('POSTED')
    expect(postRes.body.data.voucherNumber).toBeTruthy()

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: postRes.body.data.voucherId },
      orderBy: { lineNumber: 'asc' },
    })
    expect(gl).toHaveLength(2)
    expect(gl[0]!.accountId).toBe(fx.expenseId)
    expect(gl[0]!.debitAmount.toString()).toBe('2500')
    expect(gl[1]!.accountId).toBe(fx.liabilityId)
    expect(gl[1]!.creditAmount.toString()).toBe('2500')

    const reverseRes = await request(app)
      .post(`${base(fx)}/${id}/reverse`)
      .set(auth(fx))
      .send({ reason: 'Period-close auto-reversal' })
    expect(reverseRes.status).toBe(200)
    expect(reverseRes.body.data.status).toBe('REVERSED')
    expect(reverseRes.body.data.reversalVoucherNumber).toBeTruthy()
    expect(reverseRes.body.data.reversalPeriod.id).toBe(fx.periods[1]!.id)

    // Idempotent reverse
    const reverseAgain = await request(app)
      .post(`${base(fx)}/${id}/reverse`)
      .set(auth(fx))
      .send({ reason: 'Period-close auto-reversal' })
    expect(reverseAgain.status).toBe(200)
    expect(reverseAgain.body.data.reversalVoucherId).toBe(reverseRes.body.data.reversalVoucherId)
  }, 60_000)

  it('creates a PREPAID schedule and recognises the first period', async () => {
    const period = fx.periods[1]!
    const createRes = await request(app)
      .post(base(fx))
      .set(auth(fx))
      .send({
        kind: 'PREPAID',
        legalEntityId: fx.legalEntityId,
        periodId: period.id,
        description: 'Annual insurance',
        totalAmount: '12000.0000',
        expenseAccountId: fx.expenseId,
        numberOfPeriods: 3,
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.data.kind).toBe('PREPAID')
    expect(createRes.body.data.schedules).toHaveLength(3)
    expect(createRes.body.data.schedules.map((s: { amount: string }) => s.amount)).toEqual([
      '4000.0000',
      '4000.0000',
      '4000.0000',
    ])
    const id = createRes.body.data.id as string
    const firstScheduleId = createRes.body.data.schedules[0].id as string

    await request(app).post(`${base(fx)}/${id}/mark-ready`).set(auth(fx)).expect(200)
    const activate = await request(app).post(`${base(fx)}/${id}/post`).set(auth(fx))
    expect(activate.status).toBe(200)
    expect(activate.body.data.status).toBe('POSTED')
    expect(activate.body.data.voucherId).toBeNull()

    const recognise = await request(app)
      .post(`${base(fx)}/${id}/schedules/${firstScheduleId}/recognise`)
      .set(auth(fx))
    expect(recognise.status).toBe(200)
    expect(recognise.body.data.status).toBe('PARTIALLY_RECOGNISED')
    expect(recognise.body.data.recognisedAmount).toBe('4000.0000')
    expect(recognise.body.data.remainingAmount).toBe('8000.0000')
    expect(recognise.body.data.schedules[0].status).toBe('POSTED')
    expect(recognise.body.data.schedules[0].voucherNumber).toBeTruthy()

    const summary = await request(app)
      .get(`${base(fx)}/periods/${period.id}/summary`)
      .set(auth(fx))
    expect(summary.status).toBe(200)
    expect(summary.body.data.pendingPrepaidScheduleCount).toBeGreaterThanOrEqual(0)
  }, 60_000)

  it('rejects posting a DRAFT adjustment', async () => {
    const createRes = await request(app)
      .post(base(fx))
      .set(auth(fx))
      .send({
        kind: 'ACCRUAL',
        legalEntityId: fx.legalEntityId,
        periodId: fx.periods[2]!.id,
        description: 'Draft-only',
        totalAmount: '100.0000',
        expenseAccountId: fx.expenseId,
      })
    expect(createRes.status).toBe(201)
    const postRes = await request(app)
      .post(`${base(fx)}/${createRes.body.data.id}/post`)
      .set(auth(fx))
    expect(postRes.status).toBe(422)
    expect(postRes.body.code ?? postRes.body.error?.code).toBeTruthy()
  })
})
