import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { buildManualJournalPostEventKey } from '../../src/modules/accounting/posting/posting-existing-voucher.service.js'
import { setTestOnlyFailBeforeGl } from '../../src/modules/accounting/posting/posting.service.js'

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

interface PostingFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  noPostUserId: string
  noPostToken: string
  legalEntityId: string
  financialYearId: string
  accountingPeriodId: string
  accountAId: string
  accountBId: string
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

async function bootstrapPostingFixture(ctx: { tenantId: string; userId: string; slug: string; token: string }) {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ code: `LE${Date.now()}`.slice(-8), legalName: 'Post Co', displayName: 'Post Co' })
  expect(leRes.status).toBe(201)
  const legalEntityId = leRes.body.data.id as string

  const fyRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
    .set('Authorization', `Bearer ${ctx.token}`)
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
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years/${financialYearId}/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/accounts/apply-template`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId, templateId: 'TRADING' })

  const cash = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CASH', isGroup: false },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  expect(cash && purchase).toBeTruthy()

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

  const gstCodes = ['520101', '520102', '520103', '220101', '220102', '220103'] as const
  const gstAccounts = await Promise.all(
    gstCodes.map((accountCode) =>
      prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode } }),
    ),
  )

  await request(app)
    .put(`/api/v1/t/${ctx.slug}/accounting/default-mappings`)
    .set('Authorization', `Bearer ${ctx.token}`)
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

  await request(app)
    .put(`/api/v1/t/${ctx.slug}/accounting/number-series`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      legalEntityId,
      series: ['JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE', 'REVERSAL'].map(
        (documentType) => ({
          documentType,
          prefix: `${documentType.slice(0, 2)}-`,
          padLength: 5,
          resetEachYear: true,
          isActive: true,
        }),
      ),
    })

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId })

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
    postingDate,
  }
}

function balancedLines(accountAId: string, accountBId: string, amount = '1000.0000') {
  return [
    { accountId: accountAId, debitAmount: amount, creditAmount: '0' },
    { accountId: accountBId, debitAmount: '0', creditAmount: amount },
  ]
}

async function createAndApproveJournal(fx: PostingFixture, amount = '50.0000'): Promise<string> {
  const createRes = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/journals`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      documentDate: fx.postingDate,
      postingDate: fx.postingDate,
      lines: balancedLines(fx.accountAId, fx.accountBId, amount),
    })
  expect(createRes.status).toBe(201)
  const id = createRes.body.data.id as string

  const submitRes = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/submit`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(submitRes.status).toBe(200)
  expect(submitRes.body.data.status).toBe('APPROVED')

  return id
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalStep.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalRequest.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance journal posting (Phase 2C2B)', () => {
  let fx: PostingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `jpost-main-${Date.now()}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Journal Post Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const primary = await createUserWithPerms(tenant.id, slug, [...FINANCE_PERMS] as PermissionName[], 'poster')
    const boot = await bootstrapPostingFixture({ tenantId: tenant.id, userId: primary.userId, slug, token: primary.token })
    const viewerPerms = FINANCE_PERMS.filter((p) => p !== 'finance.voucher.post') as PermissionName[]
    const viewer = await createUserWithPerms(tenant.id, slug, viewerPerms, 'viewer')
    fx = { ...boot, noPostUserId: viewer.userId, noPostToken: viewer.token }
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('posts approved journal — same voucher id, GL per line, balanced, audit POST', async () => {
    const journalId = await createAndApproveJournal(fx, '1000.0000')
    const linesBefore = await prisma.accountingVoucherLine.findMany({ where: { voucherId: journalId } })
    expect(linesBefore).toHaveLength(2)

    const postRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(postRes.status).toBe(200)
    expect(postRes.body.data.journal.status).toBe('POSTED')
    expect(postRes.body.data.journal.id).toBe(journalId)
    expect(postRes.body.data.journal.voucherNumber).toMatch(/^JO-/)
    expect(postRes.body.data.posting.idempotentReplay).toBe(false)

    const voucher = await prisma.accountingVoucher.findFirst({ where: { id: journalId, tenantId: fx.tenantId } })
    expect(voucher?.status).toBe('POSTED')
    expect(voucher?.voucherNumber).toBeTruthy()
    expect(voucher?.totalDebit.toString()).toBe(voucher?.totalCredit.toString())

    const glRows = await prisma.generalLedgerEntry.findMany({ where: { voucherId: journalId, tenantId: fx.tenantId } })
    expect(glRows).toHaveLength(2)
    for (const line of linesBefore) {
      expect(glRows.some((g) => g.voucherLineId === line.id)).toBe(true)
    }

    const event = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey: buildManualJournalPostEventKey(journalId) },
    })
    expect(event?.status).toBe('POSTED')
    expect(event?.voucherId).toBe(journalId)

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: fx.tenantId, entity: 'accounting_voucher', entityId: journalId, action: 'POST' },
    })
    expect(audit).toBeTruthy()
  })

  it('rejects post for DRAFT and PENDING_APPROVAL', async () => {
    const draftRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId, '200.0000'),
      })
    const draftId = draftRes.body.data.id as string

    const draftPost = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${draftId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(draftPost.status).toBe(422)

    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/approval-rules`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentType: 'JOURNAL',
        ruleName: 'Medium journals',
        amountFrom: 100,
        amountTo: null,
        approvalLevel: 1,
        isActive: true,
      })

    const pendingRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId, '5000.0000'),
      })
    const pendingId = pendingRes.body.data.id as string
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${pendingId}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)

    const pendingPost = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${pendingId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(pendingPost.status).toBe(422)

    await prisma.financeApprovalRule.deleteMany({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId },
    })
  })

  it('idempotent second post returns same number and GL count', async () => {
    const journalId = await createAndApproveJournal(fx)

    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(second.status).toBe(200)
    expect(second.body.data.posting.idempotentReplay).toBe(true)
    expect(second.body.data.posting.voucherNumber).toBe(first.body.data.posting.voucherNumber)

    const glCount = await prisma.generalLedgerEntry.count({ where: { voucherId: journalId } })
    expect(glCount).toBe(2)
  })

  it('failed post keeps journal APPROVED with null number; retry reuses reserved number', async () => {
    const journalId = await createAndApproveJournal(fx)
    const eventKey = buildManualJournalPostEventKey(journalId)

    setTestOnlyFailBeforeGl(true)
    const failRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(failRes.status).toBeGreaterThanOrEqual(400)
    setTestOnlyFailBeforeGl(false)

    const journalAfterFail = await prisma.accountingVoucher.findFirst({ where: { id: journalId } })
    expect(journalAfterFail?.status).toBe('APPROVED')
    expect(journalAfterFail?.voucherNumber).toBeNull()

    const glCount = await prisma.generalLedgerEntry.count({ where: { voucherId: journalId } })
    expect(glCount).toBe(0)

    const failedEvent = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey },
    })
    expect(failedEvent?.status).toBe('FAILED')
    expect(failedEvent?.reservedVoucherNumber).toBeTruthy()

    const retry = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(retry.status).toBe(200)
    expect(retry.body.data.posting.voucherNumber).toBe(failedEvent!.reservedVoucherNumber)
    expect(retry.body.data.journal.status).toBe('POSTED')
  })

  it('concurrent posts yield one accounting outcome', async () => {
    const journalId = await createAndApproveJournal(fx)

    const results = await Promise.allSettled([
      request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
        .set('Authorization', `Bearer ${fx.token}`),
      request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
        .set('Authorization', `Bearer ${fx.token}`),
    ])

    const voucher = await prisma.accountingVoucher.findFirst({ where: { id: journalId } })
    expect(voucher?.status).toBe('POSTED')
    expect(voucher?.voucherNumber).toBeTruthy()

    const glCount = await prisma.generalLedgerEntry.count({ where: { voucherId: journalId } })
    expect(glCount).toBe(2)

    const numbers = await prisma.generalLedgerEntry.findMany({
      where: { voucherId: journalId },
      select: { voucherNumber: true },
      distinct: ['voucherNumber'],
    })
    expect(numbers).toHaveLength(1)
  })

  it('returns 403 without finance.voucher.post permission', async () => {
    const journalId = await createAndApproveJournal(fx)

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
      .set('Authorization', `Bearer ${fx.noPostToken}`)
    expect(res.status).toBe(403)
  })

  it('does not create duplicate voucher records on post', async () => {
    const journalId = await createAndApproveJournal(fx)
    const beforeCount = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)

    const afterCount = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    expect(afterCount).toBe(beforeCount)
  })

  it('rejects post when period is closed after approval', async () => {
    const journalId = await createAndApproveJournal(fx)

    await prisma.accountingPeriod.update({
      where: { id: fx.accountingPeriodId },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: fx.userId },
    })

    try {
      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.body.code ?? res.body.error?.code).toMatch(/PERIOD|POSTING|JOURNAL/)

      const journal = await prisma.accountingVoucher.findFirst({ where: { id: journalId } })
      expect(journal?.status).toBe('APPROVED')
      expect(journal?.voucherNumber).toBeNull()

      const glCount = await prisma.generalLedgerEntry.count({ where: { voucherId: journalId } })
      expect(glCount).toBe(0)
    } finally {
      await prisma.accountingPeriod.update({
        where: { id: fx.accountingPeriodId },
        data: { status: 'OPEN', closedAt: null, closedBy: null },
      })
    }
  })
})
