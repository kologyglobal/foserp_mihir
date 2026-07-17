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
    await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    }).catch(() => {})
  }
}

interface JournalFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  legalEntityId: string
  financialYearId: string
  accountingPeriodId: string
  accountAId: string
  accountBId: string
  groupAccountId: string
  postingDate: string
  otherTenantId: string
  otherSlug: string
  otherToken: string
}

async function createFinanceAdminTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'Journal Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Journal',
      lastName: 'Tester',
      email: `user-${slug}@test.com`,
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
    userId: user.id,
    slug,
    token: loginRes.body.data?.accessToken ?? '',
  }
}

async function bootstrapJournalFixture(ctx: { tenantId: string; userId: string; slug: string; token: string }): Promise<Omit<JournalFixture, 'otherTenantId' | 'otherSlug' | 'otherToken'>> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `LE${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8),
      legalName: 'Journal Co Pvt Ltd',
      displayName: 'Journal Co',
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

  const cash = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CASH', isGroup: false },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  const group = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, isGroup: true },
  })
  expect(cash && purchase && group).toBeTruthy()

  const retained = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
  })
  const receivable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
  })
  const payable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const sales = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'SALES', isGroup: false },
  })

  const gstInCgst = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520101' },
  })
  const gstInSgst = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520102' },
  })
  const gstInIgst = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520103' },
  })
  const gstOutCgst = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220101' },
  })
  const gstOutSgst = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220102' },
  })
  const gstOutIgst = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220103' },
  })

  const mappingsRes = await request(app)
    .put(`/api/v1/t/${ctx.slug}/accounting/default-mappings`)
    .set('Authorization', `Bearer ${ctx.token}`)
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

  await request(app)
    .put(`/api/v1/t/${ctx.slug}/accounting/number-series`)
    .set('Authorization', `Bearer ${ctx.token}`)
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

  const activateRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId })
  expect(activateRes.status).toBe(200)

  const period = await prisma.accountingPeriod.findFirst({
    where: {
      tenantId: ctx.tenantId,
      legalEntityId,
      financialYearId,
      startDate: { lte: new Date(postingDate) },
      endDate: { gte: new Date(postingDate) },
    },
  })
  expect(period).toBeTruthy()

  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    slug: ctx.slug,
    token: ctx.token,
    legalEntityId,
    financialYearId,
    accountingPeriodId: period!.id,
    accountAId: cash!.id,
    accountBId: purchase!.id,
    groupAccountId: group!.id,
    postingDate,
  }
}

function balancedLines(accountAId: string, accountBId: string, amount = '1000.0000') {
  return [
    { accountId: accountAId, debitAmount: amount, creditAmount: '0' },
    { accountId: accountBId, debitAmount: '0', creditAmount: amount },
  ]
}

async function cleanupTenant(tenantId: string) {
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingRule.deleteMany({ where: { tenantId } }).catch(() => {})
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
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Finance manual journals (Phase 2C1)', () => {
  let fx: JournalFixture

  beforeAll(async () => {
    await ensurePermissions()
    const primary = await createFinanceAdminTenant('journal-test')
    const base = await bootstrapJournalFixture(primary)
    const other = await createFinanceAdminTenant('journal-other')
    fx = { ...base, otherTenantId: other.tenantId, otherSlug: other.slug, otherToken: other.token }
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    if (fx?.otherTenantId) await cleanupTenant(fx.otherTenantId)
  })

  it('creates balanced draft with lines, totals, no voucherNumber, no GL', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        narration: 'Test journal draft',
        lines: balancedLines(fx.accountAId, fx.accountBId),
      })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.voucherNumber).toBeNull()
    expect(res.body.data.lines).toHaveLength(2)
    expect(res.body.data.totalDebit).toBe('1000.0000')
    expect(res.body.data.referenceNumber).toMatch(/^JRN-D-/)

    const glCount = await prisma.generalLedgerEntry.count({ where: { voucherId: res.body.data.id } })
    expect(glCount).toBe(0)
  })

  it('updates draft lines', async () => {
    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId, '500.0000'),
      })
    const id = createRes.body.data.id as string

    const updateRes = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/journals/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        lines: balancedLines(fx.accountAId, fx.accountBId, '750.0000'),
        updatedAt: createRes.body.data.updatedAt,
      })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.data.totalDebit).toBe('750.0000')
    expect(updateRes.body.data.lines).toHaveLength(2)
  })

  it('rejects update when PENDING_APPROVAL', async () => {
    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId, '25000.0000'),
      })
    const id = createRes.body.data.id as string

    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/approval-rules`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentType: 'JOURNAL',
        ruleName: 'Large journals',
        amountFrom: 10000,
        amountTo: null,
        approvalLevel: 1,
        isActive: true,
      })

    const submitRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(submitRes.status).toBe(200)
    expect(submitRes.body.data.status).toBe('PENDING_APPROVAL')

    const updateRes = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/journals/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ lines: balancedLines(fx.accountAId, fx.accountBId, '25000.0000') })
    expect(updateRes.status).toBe(422)
  })

  it('validate unbalanced returns errors', async () => {
    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: [
          { accountId: fx.accountAId, debitAmount: '100.0000', creditAmount: '0' },
          { accountId: fx.accountBId, debitAmount: '0', creditAmount: '50.0000' },
        ],
      })
    expect(createRes.status).toBe(201)
    const id = createRes.body.data.id as string

    const validateRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/validate`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(validateRes.status).toBe(200)
    expect(validateRes.body.data.valid).toBe(false)
    expect(validateRes.body.data.errors.some((e: { code: string }) => e.code === 'UNBALANCED')).toBe(true)
  })

  it('submit without approval → APPROVED, no voucherNumber, no PostingEvent, no GL', async () => {
    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId, '100.0000'),
      })
    const id = createRes.body.data.id as string

    const submitRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(submitRes.status).toBe(200)
    expect(submitRes.body.data.status).toBe('APPROVED')
    expect(submitRes.body.data.voucherNumber).toBeNull()

    const [glCount, eventCount] = await Promise.all([
      prisma.generalLedgerEntry.count({ where: { voucherId: id } }),
      prisma.postingEvent.count({ where: { voucherId: id } }),
    ])
    expect(glCount).toBe(0)
    expect(eventCount).toBe(0)
  })

  it('submit with approval rule → PENDING_APPROVAL', async () => {
    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId, '15000.0000'),
      })
    const id = createRes.body.data.id as string

    const submitRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(submitRes.status).toBe(200)
    expect(submitRes.body.data.status).toBe('PENDING_APPROVAL')
    expect(submitRes.body.data.approvalRequired).toBe(true)
  })

  it('cancel with reason', async () => {
    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId),
      })
    const id = createRes.body.data.id as string

    const cancelRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ cancellationReason: 'Entered in error' })
    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.data.status).toBe('CANCELLED')
  })

  it('cancel without reason → 400', async () => {
    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId),
      })
    const id = createRes.body.data.id as string

    const cancelRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ cancellationReason: '' })
    expect(cancelRes.status).toBe(400)
  })

  it('tenant isolation on get', async () => {
    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId),
      })
    const id = createRes.body.data.id as string

    const crossRes = await request(app)
      .get(`/api/v1/t/${fx.otherSlug}/accounting/journals/${id}`)
      .set('Authorization', `Bearer ${fx.otherToken}`)
    expect(crossRes.status).toBe(404)
  })

  it('closed period blocks submit', async () => {
    const period = await prisma.accountingPeriod.findFirst({
      where: { id: fx.accountingPeriodId, tenantId: fx.tenantId },
    })
    expect(period).toBeTruthy()
    await prisma.accountingPeriod.update({
      where: { id: fx.accountingPeriodId },
      data: { status: 'CLOSED' },
    })

    const createRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId),
      })
    expect(createRes.status).toBe(201)
    const id = createRes.body.data.id as string

    const submitRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(submitRes.status).toBe(422)

    await prisma.accountingPeriod.update({
      where: { id: fx.accountingPeriodId },
      data: { status: 'OPEN' },
    })
  })

  it('group account rejected on create', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.groupAccountId, fx.accountBId),
      })
    expect(res.status).toBe(400)
    expect(res.body.message ?? res.body.errors?.[0]?.message ?? '').toMatch(/group/i)
  })
})
