/**
 * Fixed Assets Phase 1–3 — live tests.
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

interface FaFixture {
  tenantId: string
  otherTenantId: string
  slug: string
  otherSlug: string
  token: string
  otherToken: string
  noFaViewToken: string
  legalEntityId: string
  userId: string
  plantAccountId: string
  accumDepAccountId: string
  depExpenseAccountId: string
  cashAccountId: string
  postingDate: string
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

async function bootstrapFixture(): Promise<FaFixture> {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const stamp = Date.now()
  const slug = `fa-${stamp}`
  const otherSlug = `fa-o-${stamp}`
  const postingDate = new Date().toISOString().slice(0, 10)

  const tenant = await prisma.tenant.create({
    data: { name: 'FA Test Tenant', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const otherTenant = await prisma.tenant.create({
    data: {
      name: 'FA Other Tenant',
      slug: otherSlug,
      email: `${otherSlug}@test.com`,
      status: 'ACTIVE',
    },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'FA',
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

  const otherUser = await createUserWithPerms(otherTenant.id, otherSlug, [...FINANCE_PERMS] as PermissionName[], 'other-fa')
  const noFaView = await createUserWithPerms(
    tenant.id,
    slug,
    FINANCE_PERMS.filter((p) => p !== 'finance.fa.view') as PermissionName[],
    'no-fa-view',
  )

  const leRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      code: `LE${stamp}`.slice(-8),
      legalName: 'FA Test Co Pvt Ltd',
      displayName: 'FA Test Co',
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
        { mappingKey: 'GST_INPUT_CGST', accountId: gstInCgst!.id },
        { mappingKey: 'GST_INPUT_SGST', accountId: gstInSgst!.id },
        { mappingKey: 'GST_INPUT_IGST', accountId: gstInIgst!.id },
        { mappingKey: 'GST_OUTPUT_CGST', accountId: gstOutCgst!.id },
        { mappingKey: 'GST_OUTPUT_SGST', accountId: gstOutSgst!.id },
        { mappingKey: 'GST_OUTPUT_IGST', accountId: gstOutIgst!.id },
        { mappingKey: 'RETAINED_EARNINGS', accountId: retained!.id },
      ],
    })
  expect(mappingsRes.status).toBe(200)

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
    otherTenantId: otherTenant.id,
    slug,
    otherSlug,
    token,
    otherToken: otherUser.token,
    noFaViewToken: noFaView.token,
    legalEntityId,
    userId: user.id,
    plantAccountId: plant!.id,
    accumDepAccountId: accumDep!.id,
    depExpenseAccountId: depExpense.id,
    cashAccountId: cash!.id,
    postingDate,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.fixedAssetDepreciationLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetDepreciationRun.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetTransfer.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.fixedAssetDisposal.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance fixed assets (Phase 1–3)', () => {
  let fx: FaFixture
  let categoryId: string
  let assetId: string
  const acquisitionCost = '120000.0000'

  beforeAll(async () => {
    await ensurePermissions()
    fx = await bootstrapFixture()
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    if (fx?.otherTenantId) await cleanupTenant(fx.otherTenantId)
  })

  it('creates category and asset', async () => {
    const catRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/categories`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: 'PM',
        name: 'Plant & Machinery',
        usefulLifeYears: 10,
        residualPercent: '5.00',
        assetAccountId: fx.plantAccountId,
        accumDepAccountId: fx.accumDepAccountId,
        depExpenseAccountId: fx.depExpenseAccountId,
      })
    expect(catRes.status).toBe(201)
    categoryId = catRes.body.data.id

    const assetRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        categoryId,
        name: 'CNC Machine',
        acquisitionDate: fx.postingDate,
        acquisitionCost,
        status: 'PENDING_CAPITALIZATION',
      })
    expect(assetRes.status).toBe(201)
    assetId = assetRes.body.data.id
    expect(assetRes.body.data.status).toBe('Pending Capitalization')
    expect(assetRes.body.data.netBookValue).toBe(acquisitionCost)
  })

  it('capitalizes asset to ACTIVE with balanced GL', async () => {
    const capRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets/${assetId}/capitalize`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ postingDate: fx.postingDate, creditAccountId: fx.cashAccountId })

    expect(capRes.status).toBe(200)
    expect(capRes.body.data.asset.status).toBe('Active')
    expect(capRes.body.data.asset.capitalizationPostingEventId).toBeTruthy()
    expect(capRes.body.data.posting.totalDebit).toBe(acquisitionCost)
    expect(capRes.body.data.posting.totalCredit).toBe(acquisitionCost)
    expect(capRes.body.data.idempotentReplay).toBe(false)

    const voucherId = capRes.body.data.posting.voucherId as string
    const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId } })
    expect(lines).toHaveLength(2)
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debitAmount), 0)
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.creditAmount), 0)
    expect(totalDebit).toBeCloseTo(Number(acquisitionCost), 2)
    expect(totalCredit).toBeCloseTo(Number(acquisitionCost), 2)
  })

  it('replays idempotent capitalization', async () => {
    const capRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets/${assetId}/capitalize`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ postingDate: fx.postingDate, creditAccountId: fx.cashAccountId })

    expect(capRes.status).toBe(200)
    expect(capRes.body.data.idempotentReplay).toBe(true)
    expect(capRes.body.data.posting.idempotentReplay).toBe(true)
  })

  it('previews and posts depreciation updating asset accum and GL', async () => {
    const periodKey = fx.postingDate.slice(0, 7)

    const previewRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/depreciation-runs/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ legalEntityId: fx.legalEntityId, periodKey })

    expect(previewRes.status).toBe(200)
    expect(previewRes.body.data.assetCount).toBe(1)
    expect(Number(previewRes.body.data.totalDepreciation)).toBeGreaterThan(0)

    const postRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/depreciation-runs`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ legalEntityId: fx.legalEntityId, periodKey, postingDate: fx.postingDate })

    expect(postRes.status).toBe(201)
    expect(postRes.body.data.run.status).toBe('Posted')
    expect(postRes.body.data.posting.totalDebit).toBe(previewRes.body.data.totalDepreciation)

    const asset = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } })
    expect(Number(asset.accumulatedDepreciation)).toBeGreaterThan(0)
    expect(Number(asset.netBookValue)).toBeLessThan(Number(acquisitionCost))
  })

  it('returns 403 without finance.fa.view', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/fixed-assets/overview?legalEntityId=${fx.legalEntityId}`)
      .set('Authorization', `Bearer ${fx.noFaViewToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 for cross-tenant asset access', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.otherSlug}/accounting/fixed-assets/assets/${assetId}`)
      .set('Authorization', `Bearer ${fx.otherToken}`)
    expect(res.status).toBe(404)
  })

  it('creates and completes intra-LE transfer without GL', async () => {
    const assetBefore = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } })
    const voucherCountBefore = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId },
    })

    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/transfers`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        assetId,
        toLocation: 'Pune Plant B',
        toPlant: 'Pune Plant B',
        toDepartment: 'Assembly',
        toCustodian: 'Transfer Tester',
        reason: 'Phase 3 location move',
      })
    expect(createRes.status, JSON.stringify(createRes.body)).toBe(201)
    expect(createRes.body.data.status).toBe('Draft')
    expect(createRes.body.data.fromLocation).toBe(assetBefore.location)
    const transferId = createRes.body.data.id as string

    const completeRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/transfers/${transferId}/complete`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({})
    expect(completeRes.status, JSON.stringify(completeRes.body)).toBe(200)
    expect(completeRes.body.data.status).toBe('Completed')

    const assetAfter = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } })
    expect(assetAfter.location).toBe('Pune Plant B')
    expect(assetAfter.plant).toBe('Pune Plant B')
    expect(assetAfter.department).toBe('Assembly')
    expect(assetAfter.custodian).toBe('Transfer Tester')
    expect(assetAfter.status).toBe(assetBefore.status)
    expect(Number(assetAfter.acquisitionCost)).toBe(Number(assetBefore.acquisitionCost))
    expect(Number(assetAfter.netBookValue)).toBe(Number(assetBefore.netBookValue))

    const voucherCountAfter = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId },
    })
    expect(voucherCountAfter).toBe(voucherCountBefore)

    const listRes = await request(app)
      .get(
        `/api/v1/t/${fx.slug}/accounting/fixed-assets/transfers?legalEntityId=${fx.legalEntityId}&assetId=${assetId}`,
      )
      .set('Authorization', `Bearer ${fx.token}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.some((t: { id: string }) => t.id === transferId)).toBe(true)
  })

  async function ensureDisposalGainLossMappings() {
    const incomeGroup = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId, accountCode: '4000', isGroup: true },
    })
    const expenseGroup = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId, accountCode: '5000', isGroup: true },
    })
    expect(incomeGroup && expenseGroup).toBeTruthy()

    let gainAcct = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId, accountCode: '490100' },
    })
    if (!gainAcct) {
      gainAcct = await prisma.account.create({
        data: {
          tenantId: fx.tenantId,
          legalEntityId: fx.legalEntityId,
          parentAccountId: incomeGroup!.id,
          accountCode: '490100',
          accountName: 'Gain on Asset Disposal',
          category: 'INCOME',
          accountType: 'GENERAL',
          isGroup: false,
          isActive: true,
          normalBalance: 'CREDIT',
          level: 2,
        },
      })
    }
    let lossAcct = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId, accountCode: '590100' },
    })
    if (!lossAcct) {
      lossAcct = await prisma.account.create({
        data: {
          tenantId: fx.tenantId,
          legalEntityId: fx.legalEntityId,
          parentAccountId: expenseGroup!.id,
          accountCode: '590100',
          accountName: 'Loss on Asset Disposal',
          category: 'EXPENSE',
          accountType: 'GENERAL',
          isGroup: false,
          isActive: true,
          normalBalance: 'DEBIT',
          level: 2,
        },
      })
    }

    await prisma.defaultAccountMapping.upsert({
      where: {
        legalEntityId_mappingKey: {
          legalEntityId: fx.legalEntityId,
          mappingKey: 'ASSET_DISPOSAL_GAIN',
        },
      },
      create: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        mappingKey: 'ASSET_DISPOSAL_GAIN',
        accountId: gainAcct.id,
      },
      update: { accountId: gainAcct.id },
    })
    await prisma.defaultAccountMapping.upsert({
      where: {
        legalEntityId_mappingKey: {
          legalEntityId: fx.legalEntityId,
          mappingKey: 'ASSET_DISPOSAL_LOSS',
        },
      },
      create: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        mappingKey: 'ASSET_DISPOSAL_LOSS',
        accountId: lossAcct.id,
      },
      update: { accountId: lossAcct.id },
    })
  }

  it('previews and posts partial disposal keeping asset active', async () => {
    await ensureDisposalGainLossMappings()

    const assetBefore = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } })
    const halfCost = (Number(assetBefore.acquisitionCost) / 2).toFixed(4)
    const proceeds = (Number(assetBefore.netBookValue) * 0.4).toFixed(4)

    const previewRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets/${assetId}/dispose/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ disposalType: 'SALE', proceeds, disposeCostAmount: halfCost })
    expect(previewRes.status, JSON.stringify(previewRes.body)).toBe(200)
    expect(previewRes.body.data.isPartial).toBe(true)
    expect(Number(previewRes.body.data.disposeCostAmount)).toBeCloseTo(Number(halfCost), 2)
    expect(Number(previewRes.body.data.remainingCost)).toBeCloseTo(Number(halfCost), 2)

    const disposeRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets/${assetId}/dispose`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        disposalType: 'SALE',
        proceeds,
        disposeCostAmount: halfCost,
        proceedsAccountId: fx.cashAccountId,
        reason: 'Phase 3 partial dispose test sale',
        postingDate: fx.postingDate,
      })
    expect(disposeRes.status, JSON.stringify(disposeRes.body)).toBe(200)
    expect(disposeRes.body.data.isPartial).toBe(true)
    expect(disposeRes.body.data.asset.status).toBe('Active')
    expect(Number(disposeRes.body.data.asset.acquisitionCost)).toBeCloseTo(Number(halfCost), 2)
    expect(Number(disposeRes.body.data.asset.netBookValue)).toBeCloseTo(
      Number(previewRes.body.data.remainingNbv),
      2,
    )

    const voucherId = disposeRes.body.data.posting.voucherId as string
    const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId } })
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debitAmount), 0)
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.creditAmount), 0)
    expect(totalDebit).toBeCloseTo(totalCredit, 2)

    const disposalDoc = await prisma.fixedAssetDisposal.findFirst({
      where: { id: disposeRes.body.data.disposalId, tenantId: fx.tenantId },
    })
    expect(disposalDoc?.isPartial).toBe(true)
    expect(disposalDoc?.status).toBe('POSTED')
  })

  it('previews and posts simple disposal with gain/loss GL', async () => {
    await ensureDisposalGainLossMappings()

    const assetBefore = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } })
    const nbv = Number(assetBefore.netBookValue)
    const proceeds = (nbv * 0.8).toFixed(4)

    const previewRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets/${assetId}/dispose/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ disposalType: 'SALE', proceeds })
    expect(previewRes.status, JSON.stringify(previewRes.body)).toBe(200)
    expect(Number(previewRes.body.data.gainLoss)).toBeLessThan(0)

    const disposeRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets/${assetId}/dispose`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        disposalType: 'SALE',
        proceeds,
        proceedsAccountId: fx.cashAccountId,
        reason: 'Phase 2 simple dispose test sale',
        postingDate: fx.postingDate,
      })
    expect(disposeRes.status, JSON.stringify(disposeRes.body)).toBe(200)
    expect(disposeRes.body.data.asset.status).toBe('Disposed')
    expect(disposeRes.body.data.asset.netBookValue).toBe('0.0000')
    expect(disposeRes.body.data.idempotentReplay).toBe(false)

    const voucherId = disposeRes.body.data.posting.voucherId as string
    const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId } })
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debitAmount), 0)
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.creditAmount), 0)
    expect(totalDebit).toBeCloseTo(totalCredit, 2)

    const replay = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/fixed-assets/assets/${assetId}/dispose`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        disposalType: 'SALE',
        proceeds,
        proceedsAccountId: fx.cashAccountId,
        reason: 'Phase 2 simple dispose test sale',
        postingDate: fx.postingDate,
      })
    expect(replay.status).toBe(200)
    expect(replay.body.data.idempotentReplay).toBe(true)
  })
})
