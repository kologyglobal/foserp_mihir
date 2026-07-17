import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import * as glRepo from '../../src/modules/accounting/ledger/general-ledger.repository.js'
import * as postingEventRepo from '../../src/modules/accounting/ledger/posting-event.repository.js'
import { PostingError } from '../../src/modules/accounting/posting/posting.errors.js'
import { post, setTestOnlyFailBeforeGl } from '../../src/modules/accounting/posting/posting.service.js'
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
  legalEntityId: string
  financialYearId: string
  accountingPeriodId: string
  accountAId: string
  accountBId: string
  groupAccountId: string
  postingDate: string
  otherTenantId: string
}

async function createFinanceAdminTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'Posting Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Posting',
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

async function bootstrapPostingFixture(ctx: { tenantId: string; userId: string; slug: string; token: string }): Promise<Omit<PostingFixture, 'otherTenantId'> & { postingDate: string }> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `LE${Date.now()}`.slice(-8),
      legalName: 'Posting Co Pvt Ltd',
      displayName: 'Posting Co',
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
  const receivable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
  })
  const payable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const sales = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'SALES', isGroup: false },
  })
  const retained = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
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

  expect(cash && purchase && receivable && payable && sales && retained).toBeTruthy()

  const group = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, isGroup: true },
  })
  expect(group).toBeTruthy()

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

  const seriesRes = await request(app)
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
  expect(seriesRes.status).toBe(200)

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

function postingContext(fx: PostingFixture): PostingContext {
  return {
    tenantId: fx.tenantId,
    userId: fx.userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
  }
}

function journalRequest(
  fx: PostingFixture,
  eventKey: string,
  debitAccountId: string,
  creditAccountId: string,
  debitAmount: string,
  creditAmount: string,
  postingDate?: string,
): PostingRequest {
  const date = postingDate ?? fx.postingDate
  return {
    legalEntityId: fx.legalEntityId,
    eventKey,
    eventType: 'MANUAL_JOURNAL',
    postingPurpose: 'MANUAL_JOURNAL',
    voucherType: 'JOURNAL',
    documentDate: date,
    postingDate: date,
    lines: [
      { lineNumber: 1, accountId: debitAccountId, debitAmount, creditAmount: '0' },
      { lineNumber: 2, accountId: creditAccountId, debitAmount: '0', creditAmount },
    ],
  }
}

async function cleanupTenant(tenantId: string) {
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

describe.skipIf(!dbAvailable)('Finance posting engine (Phase 2B)', () => {
  let fx: PostingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant('posting-test')
    const boot = await bootstrapPostingFixture(ctx)
    const other = await createFinanceAdminTenant('posting-other')
    fx = { ...boot, otherTenantId: other.tenantId }
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    if (fx?.otherTenantId) await cleanupTenant(fx.otherTenantId)
  })

  it('returns posting-engine-status via HTTP', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/ledger/posting-engine-status`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.phase).toBe('2B')
    expect(res.body.data.postingEngine).toBe(true)
    expect(res.body.data.publicPostingWorkflow).toBe(false)
  })

  it('posts balanced two-line JOURNAL with voucher, GL, event, and audit', async () => {
    const eventKey = `journal-${Date.now()}`
    const result = await post(
      journalRequest(fx, eventKey, fx.accountAId, fx.accountBId, '1000', '1000'),
      postingContext(fx),
    )

    expect(result.success).toBe(true)
    expect(result.idempotentReplay).toBe(false)
    expect(result.voucherId).toBeTruthy()
    expect(result.voucherNumber).toMatch(/^JO-/)

    const voucher = await prisma.accountingVoucher.findFirst({ where: { id: result.voucherId!, tenantId: fx.tenantId } })
    expect(voucher?.status).toBe('POSTED')
    expect(voucher?.voucherNumber).toBe(result.voucherNumber)

    const lines = await prisma.accountingVoucherLine.count({ where: { voucherId: result.voucherId!, tenantId: fx.tenantId } })
    expect(lines).toBe(2)

    const glCount = await prisma.generalLedgerEntry.count({ where: { voucherId: result.voucherId!, tenantId: fx.tenantId } })
    expect(glCount).toBe(2)

    const event = await postingEventRepo.findById(fx.tenantId, result.postingEventId)
    expect(event?.status).toBe('POSTED')

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: fx.tenantId, entity: 'accounting_voucher', entityId: result.voucherId!, action: 'POST' },
    })
    expect(audit).toBeTruthy()
  })

  it('replays idempotent post with same key and payload', async () => {
    const eventKey = `idempotent-${Date.now()}`
    const req = journalRequest(fx, eventKey, fx.accountAId, fx.accountBId, '500', '500')
    const first = await post(req, postingContext(fx))
    const second = await post(req, postingContext(fx))

    expect(second.idempotentReplay).toBe(true)
    expect(second.voucherId).toBe(first.voucherId)

    const glCount = await prisma.generalLedgerEntry.count({ where: { voucherId: first.voucherId!, tenantId: fx.tenantId } })
    expect(glCount).toBe(2)
  })

  it('rejects payload mismatch for duplicate event key', async () => {
    const eventKey = `mismatch-${Date.now()}`
    await post(journalRequest(fx, eventKey, fx.accountAId, fx.accountBId, '100', '100'), postingContext(fx))

    await expect(
      post(journalRequest(fx, eventKey, fx.accountAId, fx.accountBId, '200', '200'), postingContext(fx)),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' })

    const voucherCount = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, sourceModule: null },
    })
    expect(voucherCount).toBeGreaterThan(0)
  })

  it('rejects group account posting', async () => {
    await expect(
      post(
        journalRequest(fx, `group-${Date.now()}`, fx.groupAccountId, fx.accountBId, '100', '100'),
        postingContext(fx),
      ),
    ).rejects.toMatchObject({ code: 'ACCOUNT_IS_GROUP' })

    const orphanVouchers = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, narration: 'group-test-should-not-exist' },
    })
    expect(orphanVouchers).toBe(0)
  })

  it('blocks posting into a closed period', async () => {
    const currentPeriod = await prisma.accountingPeriod.findFirst({
      where: { id: fx.accountingPeriodId, tenantId: fx.tenantId },
    })
    expect(currentPeriod).toBeTruthy()
    await prisma.accountingPeriod.update({
      where: { id: currentPeriod!.id },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: fx.userId },
    })

    await expect(
      post(journalRequest(fx, `closed-${Date.now()}`, fx.accountAId, fx.accountBId, '50', '50'), postingContext(fx)),
    ).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_CLOSED' })

    await prisma.accountingPeriod.update({
      where: { id: currentPeriod!.id },
      data: { status: 'OPEN', closedAt: null, closedBy: null },
    })
  })

  it('leaves no voucher when validation fails before transaction', async () => {
    const before = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    await expect(
      post(
        {
          ...journalRequest(fx, `invalid-${Date.now()}`, fx.accountAId, fx.accountBId, '100', '90'),
          lines: [
            { lineNumber: 1, accountId: fx.accountAId, debitAmount: '100', creditAmount: '0' },
            { lineNumber: 2, accountId: fx.accountBId, debitAmount: '0', creditAmount: '90' },
          ],
        },
        postingContext(fx),
      ),
    ).rejects.toBeInstanceOf(PostingError)
    const after = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    expect(after).toBe(before)
  })

  it('rolls back voucher on mid-transaction failure and retries with same number', async () => {
    const eventKey = `atomic-${Date.now()}`
    const req = journalRequest(fx, eventKey, fx.accountAId, fx.accountBId, '250', '250')

    setTestOnlyFailBeforeGl(true)
    await expect(post(req, postingContext(fx))).rejects.toMatchObject({ code: 'POSTING_TRANSACTION_FAILED' })
    setTestOnlyFailBeforeGl(false)

    const failedEvent = await postingEventRepo.findByEventKey(fx.tenantId, fx.legalEntityId, eventKey)
    expect(failedEvent?.status).toBe('FAILED')
    expect(failedEvent?.reservedVoucherNumber).toBeTruthy()

    const voucherAfterFail = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, voucherNumber: failedEvent!.reservedVoucherNumber! },
    })
    expect(voucherAfterFail).toBe(0)

    const retry = await post(req, postingContext(fx))
    expect(retry.success).toBe(true)
    expect(retry.voucherNumber).toBe(failedEvent!.reservedVoucherNumber)
  })

  it('issues unique voucher numbers under concurrent posts', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        post(
          journalRequest(fx, `concurrent-${Date.now()}-${i}`, fx.accountAId, fx.accountBId, '10', '10'),
          postingContext(fx),
        ),
      ),
    )
    const numbers = results.map((r) => r.voucherNumber).filter(Boolean)
    expect(new Set(numbers).size).toBe(5)
  })

  it('balances decimal amounts 0.1 + 0.2 = 0.3 exactly', async () => {
    const result = await post(
      {
        ...journalRequest(fx, `decimal-${Date.now()}`, fx.accountAId, fx.accountBId, '0.1', '0.3'),
        lines: [
          { lineNumber: 1, accountId: fx.accountAId, debitAmount: '0.1', creditAmount: '0' },
          { lineNumber: 2, accountId: fx.accountAId, debitAmount: '0.2', creditAmount: '0' },
          { lineNumber: 3, accountId: fx.accountBId, debitAmount: '0', creditAmount: '0.3' },
        ],
      },
      postingContext(fx),
    )
    expect(result.success).toBe(true)
    const voucher = await prisma.accountingVoucher.findFirst({ where: { id: result.voucherId!, tenantId: fx.tenantId } })
    expect(voucher?.totalDebit.toString()).toBe('0.3')
    expect(voucher?.totalCredit.toString()).toBe('0.3')
  })

  it('isolates posting event findById by tenant', async () => {
    const posted = await post(
      journalRequest(fx, `tenant-${Date.now()}`, fx.accountAId, fx.accountBId, '15', '15'),
      postingContext(fx),
    )
    const own = await postingEventRepo.findById(fx.tenantId, posted.postingEventId)
    const cross = await postingEventRepo.findById(fx.otherTenantId, posted.postingEventId)
    expect(own?.id).toBe(posted.postingEventId)
    expect(cross).toBeNull()
  })

  it('GL repository exposes no update/delete methods', () => {
    const keys = Object.keys(glRepo)
    expect(keys).not.toContain('update')
    expect(keys).not.toContain('delete')
    expect(glRepo.GL_REPOSITORY_IMMUTABLE).toBe(true)
  })

  it('exposes read-only voucher and posting-event HTTP routes', async () => {
    const posted = await post(
      journalRequest(fx, `read-${Date.now()}`, fx.accountAId, fx.accountBId, '20', '20'),
      postingContext(fx),
    )

    const voucherRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/vouchers/${posted.voucherId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(voucherRes.status).toBe(200)
    expect(voucherRes.body.data.lines).toHaveLength(2)

    const glRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/vouchers/${posted.voucherId}/ledger`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(glRes.status).toBe(200)
    expect(glRes.body.data).toHaveLength(2)

    const eventRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/posting-events/${posted.postingEventId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(eventRes.status).toBe(200)
    expect(eventRes.body.data.status).toBe('POSTED')
  })
})
