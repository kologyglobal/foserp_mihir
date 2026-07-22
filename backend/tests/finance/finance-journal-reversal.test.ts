import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { buildManualJournalReverseEventKey } from '../../src/modules/accounting/journals/journal-reverse.service.js'

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

interface ReversalFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  noReverseToken: string
  legalEntityId: string
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
  return { userId: user.id, token: loginRes.body.data?.accessToken ?? '' }
}

async function bootstrap(ctx: { tenantId: string; userId: string; slug: string; token: string }) {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ code: `LE${Date.now()}`.slice(-8), legalName: 'Rev Co', displayName: 'Rev Co' })
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

  return {
    legalEntityId,
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

async function createPostAndApproveJournal(fx: ReversalFixture, amount = '75.0000'): Promise<string> {
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

  const postRes = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(postRes.status).toBe(200)
  expect(postRes.body.data.journal.status).toBe('POSTED')
  return id
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalStep.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalRequest.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher
    .updateMany({
      where: { tenantId },
      data: { reversedByVoucherId: null, reversalOfVoucherId: null },
    })
    .catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance journal reversal (Phase 2C3)', () => {
  let fx: ReversalFixture

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `jrev-${Date.now()}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Journal Reverse Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const primary = await createUserWithPerms(tenant.id, slug, [...FINANCE_PERMS] as PermissionName[], 'reverser')
    const boot = await bootstrap({ tenantId: tenant.id, userId: primary.userId, slug, token: primary.token })
    const noReversePerms = FINANCE_PERMS.filter((p) => p !== 'finance.voucher.reverse') as PermissionName[]
    const viewer = await createUserWithPerms(tenant.id, slug, noReversePerms, 'norev')
    fx = {
      tenantId: tenant.id,
      userId: primary.userId,
      slug,
      token: primary.token,
      noReverseToken: viewer.token,
      ...boot,
    }
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('reverses posted journal — REVERSAL voucher, original REVERSED, number kept, GL nets', async () => {
    const journalId = await createPostAndApproveJournal(fx, '500.0000')
    const original = await prisma.accountingVoucher.findFirstOrThrow({
      where: { id: journalId, tenantId: fx.tenantId },
    })
    const originalNumber = original.voucherNumber!
    const originalLines = await prisma.accountingVoucherLine.findMany({
      where: { voucherId: journalId, tenantId: fx.tenantId },
      orderBy: { lineNumber: 'asc' },
    })

    const reverseRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Correction — wrong period allocation' })
    expect(reverseRes.status).toBe(200)
    expect(reverseRes.body.data.journal.status).toBe('REVERSED')
    expect(reverseRes.body.data.journal.voucherNumber).toBe(originalNumber)
    expect(reverseRes.body.data.idempotentReplay).toBe(false)
    expect(reverseRes.body.data.reversalVoucherId).toBeTruthy()
    expect(reverseRes.body.data.journal.allowedActions.reverse).toBe(false)

    const reversalId = reverseRes.body.data.reversalVoucherId as string
    const reversal = await prisma.accountingVoucher.findFirstOrThrow({
      where: { id: reversalId, tenantId: fx.tenantId },
    })
    expect(reversal.voucherType).toBe('REVERSAL')
    expect(reversal.status).toBe('POSTED')
    expect(reversal.reversalOfVoucherId).toBe(journalId)
    expect(reversal.voucherNumber).toMatch(/^RE-/)

    const updatedOriginal = await prisma.accountingVoucher.findFirstOrThrow({
      where: { id: journalId, tenantId: fx.tenantId },
    })
    expect(updatedOriginal.status).toBe('REVERSED')
    expect(updatedOriginal.reversedByVoucherId).toBe(reversalId)
    expect(updatedOriginal.voucherNumber).toBe(originalNumber)
    expect(updatedOriginal.reversalReason).toBe('Correction — wrong period allocation')

    const reversalLines = await prisma.accountingVoucherLine.findMany({
      where: { voucherId: reversalId, tenantId: fx.tenantId },
      orderBy: { lineNumber: 'asc' },
    })
    expect(reversalLines).toHaveLength(originalLines.length)
    for (let i = 0; i < originalLines.length; i++) {
      expect(reversalLines[i]!.accountId).toBe(originalLines[i]!.accountId)
      expect(reversalLines[i]!.debitAmount.toString()).toBe(originalLines[i]!.creditAmount.toString())
      expect(reversalLines[i]!.creditAmount.toString()).toBe(originalLines[i]!.debitAmount.toString())
    }

    const allGl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: { in: [journalId, reversalId] } },
    })
    const netByAccount = new Map<string, { debit: number; credit: number }>()
    for (const row of allGl) {
      const cur = netByAccount.get(row.accountId) ?? { debit: 0, credit: 0 }
      cur.debit += Number(row.debitAmount)
      cur.credit += Number(row.creditAmount)
      netByAccount.set(row.accountId, cur)
    }
    for (const [, net] of netByAccount) {
      expect(net.debit).toBeCloseTo(net.credit, 4)
    }

    const event = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey: buildManualJournalReverseEventKey(journalId) },
    })
    expect(event?.status).toBe('POSTED')
    expect(event?.voucherId).toBe(reversalId)

    const audit = await prisma.auditLog.findFirst({
      where: {
        tenantId: fx.tenantId,
        entity: 'accounting_voucher',
        entityId: journalId,
        action: 'MANUAL_JOURNAL_REVERSED',
      },
    })
    expect(audit).toBeTruthy()
  })

  it('idempotent replay when already REVERSED', async () => {
    const journalId = await createPostAndApproveJournal(fx, '120.0000')
    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'First reverse' })
    expect(first.status).toBe(200)
    const reversalId = first.body.data.reversalVoucherId as string

    const second = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Replay reverse' })
    expect(second.status).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.reversalVoucherId).toBe(reversalId)
    expect(second.body.data.journal.status).toBe('REVERSED')

    const reversalCount = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, reversalOfVoucherId: journalId },
    })
    expect(reversalCount).toBe(1)
  })

  it('rejects reverse for DRAFT and APPROVED (not posted)', async () => {
    const draftRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        documentDate: fx.postingDate,
        postingDate: fx.postingDate,
        lines: balancedLines(fx.accountAId, fx.accountBId, '40.0000'),
      })
    const draftId = draftRes.body.data.id as string

    const draftReverse = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${draftId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'too early' })
    expect(draftReverse.status).toBe(422)

    const submitRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${draftId}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(submitRes.body.data.status).toBe('APPROVED')

    const approvedReverse = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${draftId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'still too early' })
    expect(approvedReverse.status).toBe(422)
  })

  it('403 without finance.voucher.reverse', async () => {
    const journalId = await createPostAndApproveJournal(fx, '33.0000')
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/reverse`)
      .set('Authorization', `Bearer ${fx.noReverseToken}`)
      .send({ reason: 'no permission' })
    expect(res.status).toBe(403)
  })

  it('detail allowedActions.reverse true only when POSTED and permitted', async () => {
    const journalId = await createPostAndApproveJournal(fx, '55.0000')
    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.status).toBe('POSTED')
    expect(detail.body.data.allowedActions.reverse).toBe(true)

    const noPermDetail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}`)
      .set('Authorization', `Bearer ${fx.noReverseToken}`)
    expect(noPermDetail.body.data.allowedActions.reverse).toBe(false)
  })
})
