/**
 * Fixed Assets Phase 4 — revaluation, impairment, maintenance, reports.
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

interface Fa4Fixture {
  tenantId: string
  slug: string
  token: string
  legalEntityId: string
  plantAccountId: string
  accumDepAccountId: string
  depExpenseAccountId: string
  cashAccountId: string
  surplusAccountId: string
  impairmentLossAccountId: string
  postingDate: string
}

async function bootstrapFixture(): Promise<Fa4Fixture> {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const stamp = Date.now()
  const slug = `fa4-${stamp}`
  const postingDate = new Date().toISOString().slice(0, 10)

  const tenant = await prisma.tenant.create({
    data: { name: 'FA4 Test Tenant', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'FA4',
      lastName: 'Tester',
      email: `user-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({
    where: { name: { in: [...FINANCE_PERMS] as PermissionName[] } },
  })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Finance FA4 ${stamp}`,
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

  const leRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      code: `L4${stamp}`.slice(-8),
      legalName: 'FA4 Test Co Pvt Ltd',
      displayName: 'FA4 Test Co',
    })
  expect(leRes.status).toBe(201)
  const legalEntityId = leRes.body.data.id as string

  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`

  const fyRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/financial-years`)
    .set('Authorization', `Bearer ${token}`)
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
    .post(`/api/v1/t/${slug}/accounting/financial-years/${financialYearId}/activate`)
    .set('Authorization', `Bearer ${token}`)
  expect(activateFy.status).toBe(200)

  const templateRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/accounts/apply-template`)
    .set('Authorization', `Bearer ${token}`)
    .send({ legalEntityId, templateId: 'TRADING' })
  expect(templateRes.status).toBe(201)

  const plant = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '120100' },
  })
  const accumDep = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '120200' },
  })
  const cash = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountType: 'CASH', isGroup: false },
  })
  const retained = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  const receivable = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
  })
  const payable = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const sales = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountType: 'SALES', isGroup: false },
  })
  expect(plant && accumDep && cash && retained && purchase && receivable && payable && sales).toBeTruthy()

  let depExpense = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '530100' },
  })
  if (!depExpense) {
    const expenseGroup = await prisma.account.findFirst({
      where: { tenantId: tenant.id, legalEntityId, accountCode: '5000', isGroup: true },
    })
    expect(expenseGroup).toBeTruthy()
    depExpense = await prisma.account.create({
      data: {
        tenantId: tenant.id,
        legalEntityId,
        parentAccountId: expenseGroup!.id,
        accountCode: '530100',
        accountName: 'Depreciation Expense',
        category: 'EXPENSE',
        accountType: 'GENERAL',
        isGroup: false,
        isActive: true,
        normalBalance: 'DEBIT',
        level: 2,
      },
    })
  }

  const equityGroup = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '3000', isGroup: true },
  })
  const expenseGroup = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '5000', isGroup: true },
  })
  expect(equityGroup && expenseGroup).toBeTruthy()

  const surplusAcct = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      legalEntityId,
      parentAccountId: equityGroup!.id,
      accountCode: '330100',
      accountName: 'Asset Revaluation Surplus',
      category: 'EQUITY',
      accountType: 'GENERAL',
      isGroup: false,
      isActive: true,
      normalBalance: 'CREDIT',
      level: 2,
    },
  })
  const impairLossAcct = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      legalEntityId,
      parentAccountId: expenseGroup!.id,
      accountCode: '590200',
      accountName: 'Asset Impairment Loss',
      category: 'EXPENSE',
      accountType: 'GENERAL',
      isGroup: false,
      isActive: true,
      normalBalance: 'DEBIT',
      level: 2,
    },
  })

  const gstInCgst = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '520101' },
  })
  const gstInSgst = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '520102' },
  })
  const gstInIgst = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '520103' },
  })
  const gstOutCgst = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '220101' },
  })
  const gstOutSgst = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '220102' },
  })
  const gstOutIgst = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountCode: '220103' },
  })

  const mappingsRes = await request(app)
    .put(`/api/v1/t/${slug}/accounting/default-mappings`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      legalEntityId,
      mappings: [
        { mappingKey: 'CUSTOMER_RECEIVABLE', accountId: receivable!.id },
        { mappingKey: 'VENDOR_PAYABLE', accountId: payable!.id },
        { mappingKey: 'SALES_REVENUE', accountId: sales!.id },
        { mappingKey: 'PURCHASE', accountId: purchase!.id },
        { mappingKey: 'RETAINED_EARNINGS', accountId: retained!.id },
        { mappingKey: 'GST_INPUT_CGST', accountId: gstInCgst!.id },
        { mappingKey: 'GST_INPUT_SGST', accountId: gstInSgst!.id },
        { mappingKey: 'GST_INPUT_IGST', accountId: gstInIgst!.id },
        { mappingKey: 'GST_OUTPUT_CGST', accountId: gstOutCgst!.id },
        { mappingKey: 'GST_OUTPUT_SGST', accountId: gstOutSgst!.id },
        { mappingKey: 'GST_OUTPUT_IGST', accountId: gstOutIgst!.id },
        { mappingKey: 'ASSET_REVALUATION_SURPLUS', accountId: surplusAcct.id },
        { mappingKey: 'ASSET_IMPAIRMENT_LOSS', accountId: impairLossAcct.id },
      ],
    })
  expect(mappingsRes.status, JSON.stringify(mappingsRes.body)).toBe(200)

  const seriesRes = await request(app)
    .put(`/api/v1/t/${slug}/accounting/number-series`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      legalEntityId,
      series: [
        'JOURNAL',
        'RECEIPT',
        'PAYMENT',
        'CONTRA',
        'CREDIT_NOTE',
        'DEBIT_NOTE',
        'OPENING_BALANCE',
        'REVERSAL',
      ].map((documentType) => ({
        documentType,
        prefix: `${documentType.slice(0, 2)}-`,
        padLength: 5,
        resetEachYear: true,
        isActive: true,
      })),
    })
  expect(seriesRes.status).toBe(200)

  const activateRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/activate`)
    .set('Authorization', `Bearer ${token}`)
    .send({ legalEntityId })
  expect(activateRes.status).toBe(200)

  return {
    tenantId: tenant.id,
    slug,
    token,
    legalEntityId,
    plantAccountId: plant!.id,
    accumDepAccountId: accumDep!.id,
    depExpenseAccountId: depExpense.id,
    cashAccountId: cash!.id,
    surplusAccountId: surplusAcct.id,
    impairmentLossAccountId: impairLossAcct.id,
    postingDate,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.fixedAssetDepreciationLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetDepreciationRun.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetTransfer.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetDisposal.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetRevaluation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetImpairment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetMaintenance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAsset.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetCategory.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingRule.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance fixed assets Phase 4', () => {
  let fx: Fa4Fixture
  let assetId: string
  const acquisitionCost = '200000.0000'

  beforeAll(async () => {
    await ensurePermissions()
    fx = await bootstrapFixture()

    const catRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/categories`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: 'BLD',
        name: 'Buildings',
        usefulLifeYears: 20,
        residualPercent: '5.00',
        assetAccountId: fx.plantAccountId,
        accumDepAccountId: fx.accumDepAccountId,
        depExpenseAccountId: fx.depExpenseAccountId,
      })
    expect(catRes.status).toBe(201)

    const assetRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        categoryId: catRes.body.data.id,
        name: 'Factory Building',
        acquisitionDate: fx.postingDate,
        acquisitionCost,
        status: 'PENDING_CAPITALIZATION',
      })
    expect(assetRes.status).toBe(201)
    assetId = assetRes.body.data.id

    const capRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets/${assetId}/capitalize`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ postingDate: fx.postingDate, creditAccountId: fx.cashAccountId })
    expect(capRes.status).toBe(200)
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('posts upward revaluation to surplus with balanced GL', async () => {
    const assetBefore = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } })
    const previousNbv = Number(assetBefore.netBookValue)
    const revaluedAmount = (previousNbv + 25000).toFixed(4)

    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/revaluations`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        assetId,
        revaluationDate: fx.postingDate,
        revaluedAmount,
        reason: 'Independent valuation uplift',
      })
    expect(createRes.status, JSON.stringify(createRes.body)).toBe(201)
    expect(createRes.body.data.status).toBe('Draft')
    const revalId = createRes.body.data.id as string

    const postRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/revaluations/${revalId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(postRes.status, JSON.stringify(postRes.body)).toBe(200)
    expect(postRes.body.data.revaluation.status).toBe('Posted')
    expect(postRes.body.data.idempotentReplay).toBe(false)

    const voucherId = postRes.body.data.posting.voucherId as string
    const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId } })
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debitAmount), 0)
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.creditAmount), 0)
    expect(totalDebit).toBeCloseTo(totalCredit, 2)
    expect(totalDebit).toBeCloseTo(25000, 2)

    const assetAfter = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } })
    expect(Number(assetAfter.netBookValue)).toBeCloseTo(previousNbv + 25000, 2)
    expect(Number(assetAfter.revaluationSurplus)).toBeCloseTo(25000, 2)

    const replay = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/revaluations/${revalId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(replay.status).toBe(200)
    expect(replay.body.data.idempotentReplay).toBe(true)
  })

  it('recognizes impairment with P&L and reduces NBV', async () => {
    const assetBefore = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } })
    const carrying = Number(assetBefore.netBookValue)
    const recoverable = (carrying - 10000).toFixed(4)

    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/impairments`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        assetId,
        impairmentDate: fx.postingDate,
        recoverableAmount: recoverable,
        reason: 'Obsolescence test impairment',
      })
    expect(createRes.status, JSON.stringify(createRes.body)).toBe(201)
    expect(Number(createRes.body.data.impairmentLoss)).toBeCloseTo(10000, 2)
    const impairId = createRes.body.data.id as string

    const recognizeRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/impairments/${impairId}/recognize`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(recognizeRes.status, JSON.stringify(recognizeRes.body)).toBe(200)
    expect(recognizeRes.body.data.impairment.status).toBe('Recognized')

    const voucherId = recognizeRes.body.data.posting.voucherId as string
    const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId } })
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debitAmount), 0)
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.creditAmount), 0)
    expect(totalDebit).toBeCloseTo(totalCredit, 2)
    expect(totalDebit).toBeCloseTo(10000, 2)

    const assetAfter = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } })
    expect(Number(assetAfter.netBookValue)).toBeCloseTo(carrying - 10000, 2)
    expect(Number(assetAfter.accumulatedImpairment)).toBeGreaterThanOrEqual(10000)
  })

  it('creates and completes maintenance without GL', async () => {
    const voucherCountBefore = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId },
    })

    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/maintenance`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        assetId,
        maintenanceType: 'Preventive',
        scheduledDate: fx.postingDate,
        vendorName: 'AMC Vendor',
        cost: '1500.0000',
        notes: 'Annual service',
      })
    expect(createRes.status, JSON.stringify(createRes.body)).toBe(201)
    expect(createRes.body.data.status).toBe('Scheduled')
    const maintId = createRes.body.data.id as string

    const completeRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/maintenance/${maintId}/complete`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ completedDate: fx.postingDate })
    expect(completeRes.status, JSON.stringify(completeRes.body)).toBe(200)
    expect(completeRes.body.data.status).toBe('Completed')

    const voucherCountAfter = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId },
    })
    expect(voucherCountAfter).toBe(voucherCountBefore)
  })

  it('returns FA report summary / register / nbv-by-category / disposals', async () => {
    const summary = await request(app)
      .get(
        `/api/v1/t/${fx.slug}/accounting/fixed-assets/reports/summary?legalEntityId=${fx.legalEntityId}`,
      )
      .set('Authorization', `Bearer ${fx.token}`)
    expect(summary.status).toBe(200)
    expect(summary.body.data.assetCount).toBeGreaterThanOrEqual(1)
    expect(summary.body.data.activeCount).toBeGreaterThanOrEqual(1)
    expect(Number(summary.body.data.totalNbv)).toBeGreaterThan(0)

    const register = await request(app)
      .get(
        `/api/v1/t/${fx.slug}/accounting/fixed-assets/reports/register?legalEntityId=${fx.legalEntityId}`,
      )
      .set('Authorization', `Bearer ${fx.token}`)
    expect(register.status).toBe(200)
    expect(Array.isArray(register.body.data)).toBe(true)
    expect(register.body.data.length).toBeGreaterThanOrEqual(1)

    const byCat = await request(app)
      .get(
        `/api/v1/t/${fx.slug}/accounting/fixed-assets/reports/nbv-by-category?legalEntityId=${fx.legalEntityId}`,
      )
      .set('Authorization', `Bearer ${fx.token}`)
    expect(byCat.status).toBe(200)
    expect(byCat.body.data.length).toBeGreaterThanOrEqual(1)

    const disposals = await request(app)
      .get(
        `/api/v1/t/${fx.slug}/accounting/fixed-assets/reports/disposals?legalEntityId=${fx.legalEntityId}`,
      )
      .set('Authorization', `Bearer ${fx.token}`)
    expect(disposals.status).toBe(200)
    expect(Array.isArray(disposals.body.data)).toBe(true)
  })
})
