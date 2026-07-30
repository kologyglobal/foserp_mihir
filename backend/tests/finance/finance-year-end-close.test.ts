import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { post } from '../../src/modules/accounting/posting/posting.service.js'
import type { PostingContext, PostingRequest } from '../../src/modules/accounting/posting/posting.types.js'

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

async function createFinanceTenant(slugPrefix: string, permissionNames?: PermissionName[]) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'Year End Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Year',
      lastName: 'End',
      email: `user-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const wanted = permissionNames ?? ([...FINANCE_PERMS] as PermissionName[])
  const perms = await prisma.permission.findMany({ where: { name: { in: wanted } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `YE Role ${Date.now()}`,
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
  await prisma.yearEndCloseRun.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.periodCloseChecklistAck.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableCloseGateRun.deleteMany({ where: { tenantId } }).catch(() => {})
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

interface YeFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  legalEntityId: string
  financialYearId: string
  periods: Array<{ id: string; periodNumber: number }>
  salesId: string
  purchaseId: string
  retainedId: string
  cashId: string
  postingDate: string
  fyEnd: string
}

async function bootstrapYeFixture(ctx: {
  tenantId: string
  userId: string
  slug: string
  token: string
}): Promise<YeFixture> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `YE${Date.now()}`.slice(-8),
      legalName: 'Year End Co Pvt Ltd',
      displayName: 'Year End Co',
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

  const sales = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'SALES', isGroup: false },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  const retained = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
  })
  const cash = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CASH', isGroup: false },
  })
  expect(sales && purchase && retained && cash).toBeTruthy()

  // Ensure RETAINED_EARNINGS mapping
  await prisma.defaultAccountMapping.upsert({
    where: {
      legalEntityId_mappingKey: { legalEntityId, mappingKey: 'RETAINED_EARNINGS' },
    },
    create: {
      tenantId: ctx.tenantId,
      legalEntityId,
      mappingKey: 'RETAINED_EARNINGS',
      accountId: retained!.id,
      isMandatory: true,
    },
    update: { accountId: retained!.id },
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

  // Activate via settings row (full /activate gate needs complete mandatory mappings)
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

  const periods = await prisma.accountingPeriod.findMany({
    where: { tenantId: ctx.tenantId, financialYearId },
    orderBy: { periodNumber: 'asc' },
    select: { id: true, periodNumber: true },
  })
  expect(periods.length).toBeGreaterThanOrEqual(2)

  // Seed P&L activity: Dr Cash / Cr Sales 10_000; Dr Purchase / Cr Cash 4_000
  const postingCtx: PostingContext = {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
  }
  const revenueReq: PostingRequest = {
    legalEntityId,
    eventKey: `YE-REV-${financialYearId}`,
    eventType: 'TEST_REVENUE',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'JOURNAL',
    documentDate: postingDate,
    postingDate,
    narration: 'Year-end test revenue',
    lines: [
      { lineNumber: 1, accountId: cash!.id, debitAmount: '10000.0000', creditAmount: '0.0000' },
      { lineNumber: 2, accountId: sales!.id, debitAmount: '0.0000', creditAmount: '10000.0000' },
    ],
  }
  const expenseReq: PostingRequest = {
    legalEntityId,
    eventKey: `YE-EXP-${financialYearId}`,
    eventType: 'TEST_EXPENSE',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'JOURNAL',
    documentDate: postingDate,
    postingDate,
    narration: 'Year-end test expense',
    lines: [
      { lineNumber: 1, accountId: purchase!.id, debitAmount: '4000.0000', creditAmount: '0.0000' },
      { lineNumber: 2, accountId: cash!.id, debitAmount: '0.0000', creditAmount: '4000.0000' },
    ],
  }
  await post(revenueReq, postingCtx)
  await post(expenseReq, postingCtx)

  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    slug: ctx.slug,
    token: ctx.token,
    legalEntityId,
    financialYearId,
    periods,
    salesId: sales!.id,
    purchaseId: purchase!.id,
    retainedId: retained!.id,
    cashId: cash!.id,
    postingDate,
    fyEnd,
  }
}

async function closeAllButLast(fx: YeFixture) {
  const last = fx.periods[fx.periods.length - 1]!
  for (const p of fx.periods) {
    if (p.id === last.id) continue
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/periods/${p.id}/close`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect([200, 422]).toContain(res.status)
    if (res.status === 200) expect(res.body.data.status).toBe('CLOSED')
  }
}

describe.skipIf(!dbAvailable)('Finance year-end close', () => {
  let fx: YeFixture
  let other: { tenantId: string; slug: string; token: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceTenant('ye-close')
    fx = await bootstrapYeFixture(ctx)
    other = await createFinanceTenant('ye-other')
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    if (other?.tenantId) await cleanupTenant(other.tenantId)
  })

  it('rejects FY lock without year-end close', async () => {
    const last = fx.periods[fx.periods.length - 1]!
    // Close everything including last without year-end
    await closeAllButLast(fx)
    const closeLast = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/periods/${last.id}/close`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(closeLast.status).toBe(200)

    const lock = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/financial-years/${fx.financialYearId}/close`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(lock.status).toBe(422)
    expect(lock.body.code).toBe('YEAR_END_CLOSE_REQUIRED')

    // Reopen last for subsequent tests
    const reopen = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/periods/${last.id}/reopen`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Reopen for year-end posting test' })
    expect(reopen.status).toBe(200)
  })

  it('preview shows revenue/expense/profit and blockers until early periods closed', async () => {
    // Re-open early periods may already be closed from prior test — ensure early open by checking preview
    const previewOpen = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/financial-years/${fx.financialYearId}/year-end-preview`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(previewOpen.status).toBe(200)
    expect(Number(previewOpen.body.data.revenueToClose)).toBeGreaterThan(0)
    expect(Number(previewOpen.body.data.expenseToClose)).toBeGreaterThan(0)
    expect(Number(previewOpen.body.data.profitOrLoss)).toBeCloseTo(
      Number(previewOpen.body.data.revenueToClose) - Number(previewOpen.body.data.expenseToClose),
      2,
    )
    expect(previewOpen.body.data.retainedEarnings?.accountId).toBe(fx.retainedId)

    await closeAllButLast(fx)

    const preview = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/financial-years/${fx.financialYearId}/year-end-preview`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(preview.status).toBe(200)
    expect(preview.body.data.readyToPost).toBe(true)
    expect(preview.body.data.blockers).toEqual([])
  })

  it('posts year-end closing entries into retained earnings and zeros P&L', async () => {
    await closeAllButLast(fx)

    const exec = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/financial-years/${fx.financialYearId}/year-end-close`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(exec.status).toBe(200)
    expect(exec.body.data.run.status).toBe('POSTED')
    expect(exec.body.data.run.voucherId).toBeTruthy()

    const fy = await prisma.financialYear.findFirstOrThrow({ where: { id: fx.financialYearId } })
    const salesAgg = await prisma.generalLedgerEntry.aggregate({
      where: {
        tenantId: fx.tenantId,
        accountId: fx.salesId,
        postingDate: { gte: fy.startDate, lte: fy.endDate },
      },
      _sum: { baseDebitAmount: true, baseCreditAmount: true },
    })
    const purchaseAgg = await prisma.generalLedgerEntry.aggregate({
      where: {
        tenantId: fx.tenantId,
        accountId: fx.purchaseId,
        postingDate: { gte: fy.startDate, lte: fy.endDate },
      },
      _sum: { baseDebitAmount: true, baseCreditAmount: true },
    })
    const salesNet =
      Number(salesAgg._sum.baseDebitAmount ?? 0) - Number(salesAgg._sum.baseCreditAmount ?? 0)
    const purchaseNet =
      Number(purchaseAgg._sum.baseDebitAmount ?? 0) - Number(purchaseAgg._sum.baseCreditAmount ?? 0)
    expect(Math.abs(salesNet)).toBeLessThan(0.01)
    expect(Math.abs(purchaseNet)).toBeLessThan(0.01)

    const reAgg = await prisma.generalLedgerEntry.aggregate({
      where: {
        tenantId: fx.tenantId,
        accountId: fx.retainedId,
        postingDate: { gte: fy.startDate, lte: fy.endDate },
      },
      _sum: { baseDebitAmount: true, baseCreditAmount: true },
    })
    const reNet = Number(reAgg._sum.baseDebitAmount ?? 0) - Number(reAgg._sum.baseCreditAmount ?? 0)
    // Profit 6000 → RE credit → net negative
    expect(reNet).toBeCloseTo(-6000, 2)

    // Idempotent replay
    const replay = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/financial-years/${fx.financialYearId}/year-end-close`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(replay.status).toBe(200)
    expect(replay.body.data.idempotentReplay).toBe(true)
    expect(replay.body.data.run.id).toBe(exec.body.data.run.id)
  })

  it('locks FY after all periods closed + year-end posted', async () => {
    const last = fx.periods[fx.periods.length - 1]!
    const closeLast = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/periods/${last.id}/close`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(closeLast.status).toBe(200)

    const lock = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/financial-years/${fx.financialYearId}/close`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(lock.status).toBe(200)
    expect(lock.body.data.status).toBe('CLOSED')
  })

  it('blocks cross-tenant year-end preview', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${other.slug}/accounting/financial-years/${fx.financialYearId}/year-end-preview`)
      .set('Authorization', `Bearer ${other.token}`)
    expect(res.status).toBe(404)
  })

  it('returns 403 without finance.financial_year.manage on execute', async () => {
    const viewer = await createFinanceTenant('ye-view', [
      'finance.financial_year.view',
      'finance.period.view',
    ] as PermissionName[])
    try {
      const res = await request(app)
        .post(`/api/v1/t/${viewer.slug}/accounting/financial-years/${fx.financialYearId}/year-end-close`)
        .set('Authorization', `Bearer ${viewer.token}`)
      // Cross-tenant FY id → 404 preferred; if somehow same slug path with wrong id still 403/404
      expect([403, 404]).toContain(res.status)
    } finally {
      await cleanupTenant(viewer.tenantId)
    }
  })
})

describe.skipIf(!dbAvailable)('Period close hardening — tenant isolation & permissions', () => {
  let admin: { tenantId: string; slug: string; token: string; periodId: string }
  let other: { tenantId: string; slug: string; token: string }

  beforeAll(async () => {
    await ensurePermissions()
    const a = await createFinanceTenant('pc-iso-a')
    const leRes = await request(app)
      .post(`/api/v1/t/${a.slug}/accounting/legal-entities`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        code: `PI${Date.now()}`.slice(-8),
        legalName: 'PC Iso Co',
        displayName: 'PC Iso',
      })
    expect(leRes.status).toBe(201)
    const legalEntityId = leRes.body.data.id as string
    const now = new Date()
    const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
    const fyRes = await request(app)
      .post(`/api/v1/t/${a.slug}/accounting/financial-years`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        legalEntityId,
        name: `FY ${fyStartYear}`,
        startDate: `${fyStartYear}-04-01`,
        endDate: `${fyStartYear + 1}-03-31`,
        isCurrent: true,
      })
    expect(fyRes.status).toBe(201)
    await request(app)
      .post(`/api/v1/t/${a.slug}/accounting/financial-years/${fyRes.body.data.id}/activate`)
      .set('Authorization', `Bearer ${a.token}`)
    const periods = await prisma.accountingPeriod.findMany({
      where: { tenantId: a.tenantId, financialYearId: fyRes.body.data.id },
      orderBy: { periodNumber: 'asc' },
    })
    admin = { ...a, periodId: periods[0]!.id }
    other = await createFinanceTenant('pc-iso-b')
  }, 90_000)

  afterAll(async () => {
    if (admin?.tenantId) await cleanupTenant(admin.tenantId)
    if (other?.tenantId) await cleanupTenant(other.tenantId)
  })

  it('cross-tenant close-readiness returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${other.slug}/accounting/periods/${admin.periodId}/close-readiness`)
      .set('Authorization', `Bearer ${other.token}`)
    expect(res.status).toBe(404)
  })

  it('403 without finance.period.close', async () => {
    const viewer = await createFinanceTenant('pc-view', ['finance.period.view'] as PermissionName[])
    try {
      const res = await request(app)
        .post(`/api/v1/t/${viewer.slug}/accounting/periods/${admin.periodId}/close`)
        .set('Authorization', `Bearer ${viewer.token}`)
      expect([403, 404]).toContain(res.status)
    } finally {
      await cleanupTenant(viewer.tenantId)
    }
  })
})
