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

interface ApprovalFixture {
  tenantId: string
  makerUserId: string
  approverUserId: string
  slug: string
  makerToken: string
  approverToken: string
  legalEntityId: string
  financialYearId: string
  accountingPeriodId: string
  accountAId: string
  accountBId: string
  postingDate: string
  approverRoleId: string
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
    roleId: role.id,
  }
}

async function bootstrapApprovalFixture(): Promise<ApprovalFixture> {
  const slug = `fin-appr-${Date.now()}`
  const tenant = await prisma.tenant.create({
    data: { name: 'Approval Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const makerPerms = [
    'finance.voucher.view',
    'finance.voucher.create',
    'finance.voucher.edit',
    'finance.voucher.submit',
    'finance.voucher.approve',
    'finance.settings.manage',
    'finance.approval_rule.manage',
    'finance.activate',
    'finance.coa.manage',
    'finance.default_mapping.manage',
    'finance.number_series.manage',
    'finance.financial_year.manage',
    'finance.period.manage',
    'finance.legal_entity.manage',
  ] as PermissionName[]

  const approverPerms = ['finance.voucher.view', 'finance.voucher.approve'] as PermissionName[]

  const maker = await createUserWithPerms(tenant.id, slug, makerPerms, 'maker')
  const approver = await createUserWithPerms(tenant.id, slug, approverPerms, 'approver')

  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${maker.token}`)
    .send({ code: `LE${Date.now()}`.slice(-8), legalName: 'Approval Co', displayName: 'Approval Co' })
  expect(leRes.status).toBe(201)
  const legalEntityId = leRes.body.data.id as string

  const fyRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/financial-years`)
    .set('Authorization', `Bearer ${maker.token}`)
    .send({
      legalEntityId,
      name: `FY ${fyStartYear}`,
      startDate: fyStart,
      endDate: fyEnd,
      isCurrent: true,
    })
  expect(fyRes.status).toBe(201)
  const financialYearId = fyRes.body.data.id as string

  await request(app)
    .post(`/api/v1/t/${slug}/accounting/financial-years/${financialYearId}/activate`)
    .set('Authorization', `Bearer ${maker.token}`)

  await request(app)
    .post(`/api/v1/t/${slug}/accounting/accounts/apply-template`)
    .set('Authorization', `Bearer ${maker.token}`)
    .send({ legalEntityId, templateId: 'TRADING' })

  const cash = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountType: 'CASH', isGroup: false },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  expect(cash && purchase).toBeTruthy()

  const retained = await prisma.account.findFirst({
    where: { tenantId: tenant.id, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
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

  const gstCodes = ['520101', '520102', '520103', '220101', '220102', '220103']
  const gstAccounts = await Promise.all(
    gstCodes.map((code) =>
      prisma.account.findFirst({ where: { tenantId: tenant.id, legalEntityId, accountCode: code } }),
    ),
  )

  const mappingsRes = await request(app)
    .put(`/api/v1/t/${slug}/accounting/default-mappings`)
    .set('Authorization', `Bearer ${maker.token}`)
    .send({
      legalEntityId,
      mappings: [
        { mappingKey: 'CUSTOMER_RECEIVABLE', accountId: receivable!.id },
        { mappingKey: 'VENDOR_PAYABLE', accountId: payable!.id },
        { mappingKey: 'SALES_REVENUE', accountId: sales!.id },
        { mappingKey: 'PURCHASE', accountId: purchase!.id },
        { mappingKey: 'GST_INPUT_CGST', accountId: gstAccounts[0]!.id },
        { mappingKey: 'GST_INPUT_SGST', accountId: gstAccounts[1]!.id },
        { mappingKey: 'GST_INPUT_IGST', accountId: gstAccounts[2]!.id },
        { mappingKey: 'GST_OUTPUT_CGST', accountId: gstAccounts[3]!.id },
        { mappingKey: 'GST_OUTPUT_SGST', accountId: gstAccounts[4]!.id },
        { mappingKey: 'GST_OUTPUT_IGST', accountId: gstAccounts[5]!.id },
        { mappingKey: 'RETAINED_EARNINGS', accountId: retained!.id },
      ],
    })
  expect(mappingsRes.status).toBe(200)

  const numberSeriesRes = await request(app)
    .put(`/api/v1/t/${slug}/accounting/number-series`)
    .set('Authorization', `Bearer ${maker.token}`)
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
  expect(numberSeriesRes.status).toBe(200)

  const activateRes = await request(app)
    .post(`/api/v1/t/${slug}/accounting/activate`)
    .set('Authorization', `Bearer ${maker.token}`)
    .send({ legalEntityId })
  expect(activateRes.status).toBe(200)

  const period = await prisma.accountingPeriod.findFirst({
    where: {
      tenantId: tenant.id,
      legalEntityId,
      financialYearId,
      startDate: { lte: new Date(postingDate) },
      endDate: { gte: new Date(postingDate) },
    },
  })
  expect(period).toBeTruthy()

  return {
    tenantId: tenant.id,
    makerUserId: maker.userId,
    approverUserId: approver.userId,
    slug,
    makerToken: maker.token,
    approverToken: approver.token,
    legalEntityId,
    financialYearId,
    accountingPeriodId: period!.id,
    accountAId: cash!.id,
    accountBId: purchase!.id,
    postingDate,
    approverRoleId: approver.roleId,
  }
}

function balancedLines(accountAId: string, accountBId: string, amount = '15000.0000') {
  return [
    { accountId: accountAId, debitAmount: amount, creditAmount: '0' },
    { accountId: accountBId, debitAmount: '0', creditAmount: amount },
  ]
}

async function createJournal(fx: ApprovalFixture, amount = '15000.0000') {
  const res = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/journals`)
    .set('Authorization', `Bearer ${fx.makerToken}`)
    .send({
      legalEntityId: fx.legalEntityId,
      documentDate: fx.postingDate,
      postingDate: fx.postingDate,
      lines: balancedLines(fx.accountAId, fx.accountBId, amount),
    })
  expect(res.status).toBe(201)
  return res.body.data.id as string
}

async function createApprovalRule(fx: ApprovalFixture, level: number, amountFrom: number, roleId?: string) {
  const res = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/approval-rules`)
    .set('Authorization', `Bearer ${fx.makerToken}`)
    .send({
      legalEntityId: fx.legalEntityId,
      documentType: 'JOURNAL',
      ruleName: `Level ${level} rule`,
      amountFrom,
      amountTo: null,
      approvalLevel: level,
      approverRoleId: roleId ?? fx.approverRoleId,
      isActive: true,
    })
  expect(res.status).toBe(201)
}

async function cleanupTenant(tenantId: string) {
  await prisma.financeApprovalStep.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalRequest.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalRule.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance journal approvals (Phase 2C2A)', () => {
  let fx: ApprovalFixture

  beforeAll(async () => {
    await ensurePermissions()
    fx = await bootstrapApprovalFixture()
    await createApprovalRule(fx, 1, 10000)
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('creates approval request on submit with steps', async () => {
    const journalId = await createJournal(fx)
    const submitRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)
    expect(submitRes.status).toBe(200)
    expect(submitRes.body.data.status).toBe('PENDING_APPROVAL')

    const requestRow = await prisma.financeApprovalRequest.findFirst({
      where: { tenantId: fx.tenantId, documentId: journalId, status: 'PENDING' },
      include: { steps: true },
    })
    expect(requestRow).toBeTruthy()
    expect(requestRow!.cycleNumber).toBe(1)
    expect(requestRow!.steps).toHaveLength(1)
    expect(requestRow!.steps[0]!.status).toBe('PENDING')
  })

  it('no-approval path still APPROVED without request', async () => {
    const journalId = await createJournal(fx, '100.0000')
    const submitRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)
    expect(submitRes.status).toBe(200)
    expect(submitRes.body.data.status).toBe('APPROVED')

    const requestCount = await prisma.financeApprovalRequest.count({
      where: { tenantId: fx.tenantId, documentId: journalId },
    })
    expect(requestCount).toBe(0)
  })

  it('blocks maker-checker self approval', async () => {
    const journalId = await createJournal(fx)
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)

    const approveRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/approve`)
      .set('Authorization', `Bearer ${fx.makerToken}`)
      .send({})
    expect(approveRes.status).toBe(403)
    expect(approveRes.body.code ?? approveRes.body.error?.code).toBe('SELF_APPROVAL_NOT_ALLOWED')
  })

  it('final approve sets APPROVED without GL, voucher number, or PostingEvent', async () => {
    const journalId = await createJournal(fx)
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)

    const approveRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/approve`)
      .set('Authorization', `Bearer ${fx.approverToken}`)
      .send({})
    expect(approveRes.status).toBe(200)
    expect(approveRes.body.data.status).toBe('APPROVED')
    expect(approveRes.body.data.voucherNumber).toBeNull()
    expect(approveRes.body.data.allowedActions.post).toBe(false)

    const [glCount, eventCount] = await Promise.all([
      prisma.generalLedgerEntry.count({ where: { voucherId: journalId } }),
      prisma.postingEvent.count({ where: { voucherId: journalId } }),
    ])
    expect(glCount).toBe(0)
    expect(eventCount).toBe(0)
  })

  it('multi-level advance keeps PENDING_APPROVAL until final level', async () => {
    await createApprovalRule(fx, 2, 20000)

    const journalId = await createJournal(fx, '25000.0000')
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)

    const requestBefore = await prisma.financeApprovalRequest.findFirst({
      where: { tenantId: fx.tenantId, documentId: journalId, status: 'PENDING' },
      include: { steps: { orderBy: { level: 'asc' } } },
    })
    expect(requestBefore!.totalLevels).toBe(2)
    expect(requestBefore!.currentLevel).toBe(1)

    const level1Approve = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/approve`)
      .set('Authorization', `Bearer ${fx.approverToken}`)
      .send({})
    expect(level1Approve.status).toBe(200)
    expect(level1Approve.body.data.status).toBe('PENDING_APPROVAL')

    const requestMid = await prisma.financeApprovalRequest.findFirst({
      where: { tenantId: fx.tenantId, documentId: journalId, status: 'PENDING' },
    })
    expect(requestMid!.currentLevel).toBe(2)

    const level2Approve = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/approve`)
      .set('Authorization', `Bearer ${fx.approverToken}`)
      .send({})
    expect(level2Approve.status).toBe(200)
    expect(level2Approve.body.data.status).toBe('APPROVED')
  })

  it('send back + resubmit creates cycle 2', async () => {
    const journalId = await createJournal(fx)
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)

    const sendBackRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/send-back`)
      .set('Authorization', `Bearer ${fx.approverToken}`)
      .send({ comments: 'Please fix narration' })
    expect(sendBackRes.status).toBe(200)
    expect(sendBackRes.body.data.status).toBe('SENT_BACK')

    const makerView = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}`)
      .set('Authorization', `Bearer ${fx.makerToken}`)
    expect(makerView.body.data.allowedActions.edit).toBe(true)

    const resubmitRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)
    expect(resubmitRes.status).toBe(200)
    expect(resubmitRes.body.data.status).toBe('PENDING_APPROVAL')

    const cycles = await prisma.financeApprovalRequest.findMany({
      where: { tenantId: fx.tenantId, documentId: journalId },
      orderBy: { cycleNumber: 'asc' },
    })
    expect(cycles).toHaveLength(2)
    expect(cycles[0]!.status).toBe('SENT_BACK')
    expect(cycles[1]!.status).toBe('PENDING')
    expect(cycles[1]!.cycleNumber).toBe(2)
  })

  it('reject makes journal read-only', async () => {
    const journalId = await createJournal(fx)
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)

    const rejectRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/reject`)
      .set('Authorization', `Bearer ${fx.approverToken}`)
      .send({ comments: 'Not supported' })
    expect(rejectRes.status).toBe(200)
    expect(rejectRes.body.data.status).toBe('REJECTED')
    expect(rejectRes.body.data.allowedActions.edit).toBe(false)

    const updateRes = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}`)
      .set('Authorization', `Bearer ${fx.makerToken}`)
      .send({ lines: balancedLines(fx.accountAId, fx.accountBId) })
    expect(updateRes.status).toBe(422)
  })

  it('lists my_pending approvals for eligible approver', async () => {
    const journalId = await createJournal(fx)
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)

    const listRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/approvals?legalEntityId=${fx.legalEntityId}&view=my_pending`)
      .set('Authorization', `Bearer ${fx.approverToken}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.some((row: { documentId: string }) => row.documentId === journalId)).toBe(true)
  })

  it('concurrent approve returns APPROVAL_CONCURRENT_ACTION', async () => {
    const journalId = await createJournal(fx)
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
      .set('Authorization', `Bearer ${fx.makerToken}`)

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/approve`)
        .set('Authorization', `Bearer ${fx.approverToken}`)
        .send({}),
      request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/approve`)
        .set('Authorization', `Bearer ${fx.approverToken}`)
        .send({}),
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([200, 409])
    const failed = first.status === 409 ? first : second
    expect(failed.body.code ?? failed.body.error?.code).toBe('APPROVAL_CONCURRENT_ACTION')
  })
})
