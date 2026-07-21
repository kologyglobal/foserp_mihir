import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Prisma } from '@prisma/client'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { buildCustomerReceiptPostEventKey } from '../../src/modules/accounting/receivables/receipts/posting/customer-receipt-posting.types.js'
import { setTestOnlyFailBeforeGl } from '../../src/modules/accounting/posting/posting.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))
const EXEC_PERMS = FINANCE_PERMS.filter((p) => p !== 'finance.ar.receipt.post') as PermissionName[]

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

interface PostingFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  noPostUserId: string
  noPostToken: string
  legalEntityId: string
  customerId: string
  bankAccountId: string
  cashAccountId: string
  receivableAccountId: string
  tdsReceivableAccountId: string
  bankChargeAccountId: string
  otherDeductionAccountId: string
  receiptDate: string
  postingDate: string
  customerReceiptSeriesId: string
  journalSeriesId: string
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

async function createFinanceAdminTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'AR Receipt Post Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'AR',
      lastName: 'Poster',
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

async function bootstrapPostingFixture(ctx: { tenantId: string; slug: string; token: string }): Promise<PostingFixture> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)
  const receiptDate = postingDate

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `LE${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8),
      legalName: 'AR Receipt Post Co Pvt Ltd',
      displayName: 'AR Receipt Post Co',
      stateCode: '27',
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

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years/${financialYearId}/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .expect(200)

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/accounts/apply-template`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId, templateId: 'TRADING' })
    .expect(201)

  const sales = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'SALES', isGroup: false },
  })
  const receivable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
  })
  const payable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  const retained = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
  })
  const bank = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'BANK', isGroup: false },
  })
  const cash = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CASH', isGroup: false },
  })
  const bankCharge = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '5300' },
  })
  expect(sales && receivable && payable && purchase && retained && bank && cash && bankCharge).toBeTruthy()

  const tdsReceivable = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      accountCode: '110900',
      accountName: 'TDS Receivable',
      category: 'ASSET',
      accountType: 'TDS_RECEIVABLE',
      isGroup: false,
      level: 2,
    },
  })

  const gstInCgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520101' } })
  const gstInSgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520102' } })
  const gstInIgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520103' } })
  const gstOutCgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220101' } })
  const gstOutSgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220102' } })
  const gstOutIgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220103' } })

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
        { mappingKey: 'GST_INPUT_CGST', accountId: gstInCgst!.id },
        { mappingKey: 'GST_INPUT_SGST', accountId: gstInSgst!.id },
        { mappingKey: 'GST_INPUT_IGST', accountId: gstInIgst!.id },
        { mappingKey: 'GST_OUTPUT_CGST', accountId: gstOutCgst!.id },
        { mappingKey: 'GST_OUTPUT_SGST', accountId: gstOutSgst!.id },
        { mappingKey: 'GST_OUTPUT_IGST', accountId: gstOutIgst!.id },
        { mappingKey: 'RETAINED_EARNINGS', accountId: retained!.id },
        { mappingKey: 'BANK_CHARGES', accountId: bankCharge!.id },
        { mappingKey: 'TDS_RECEIVABLE', accountId: tdsReceivable.id },
      ],
    })
    .expect(200)

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
    .expect(200)

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId })
    .expect(200)

  const customerReceiptSeries = await prisma.financeNumberSeries.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      documentType: 'CUSTOMER_RECEIPT',
      prefix: 'RCPT-',
      currentValue: 0,
      padLength: 6,
      isActive: true,
    },
  })

  const journalSeries = await prisma.financeNumberSeries.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, documentType: 'JOURNAL' },
  })

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: ctx.tenantId,
      companyCode: `CUST-${Date.now()}`.slice(-8),
      name: 'Receipt Post Customer Pvt Ltd',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      state: '27',
      country: 'India',
      status: 'active',
      isActive: true,
    },
  })

  const noPostUser = await createUserWithPerms(ctx.tenantId, ctx.slug, EXEC_PERMS, 'no-post')

  return {
    tenantId: ctx.tenantId,
    userId: '',
    slug: ctx.slug,
    token: ctx.token,
    noPostUserId: noPostUser.userId,
    noPostToken: noPostUser.token,
    legalEntityId,
    customerId: customer.id,
    bankAccountId: bank!.id,
    cashAccountId: cash!.id,
    receivableAccountId: receivable!.id,
    tdsReceivableAccountId: tdsReceivable.id,
    bankChargeAccountId: bankCharge!.id,
    otherDeductionAccountId: bankCharge!.id,
    receiptDate,
    postingDate,
    customerReceiptSeriesId: customerReceiptSeries.id,
    journalSeriesId: journalSeries!.id,
  }
}

function draftPayload(fx: PostingFixture, overrides: Record<string, unknown> = {}) {
  return {
    legalEntityId: fx.legalEntityId,
    customerId: fx.customerId,
    sourceType: 'DIRECT',
    receiptDate: fx.receiptDate,
    postingDate: fx.postingDate,
    paymentMethod: 'BANK_TRANSFER',
    currencyCode: 'INR',
    bankCashAmount: '10000.0000',
    bankCashAccountId: fx.bankAccountId,
    transactionReference: 'TXN-REF-001',
    ...overrides,
  }
}

async function createReadyReceipt(fx: PostingFixture, overrides: Record<string, unknown> = {}): Promise<string> {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send(draftPayload(fx, overrides))
  expect(created.status).toBe(201)
  const id = created.body.data.id as string

  const ready = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(ready.status).toBe(200)
  expect(ready.body.data.status).toBe('READY_TO_POST')
  return id
}

async function assertNoPartialAccounting(
  tenantId: string,
  receiptId: string,
  receiptSeriesId: string,
  journalSeriesId: string,
) {
  const receipt = await prisma.customerReceipt.findFirst({ where: { id: receiptId, tenantId } })
  expect(receipt?.status).toBe('READY_TO_POST')
  expect(receipt?.receiptNumber).toBeNull()
  expect(receipt?.accountingVoucherId).toBeNull()
  expect(receipt?.creditOpenItemId).toBeNull()

  const [vouchers, gl, openItems, events] = await Promise.all([
    prisma.accountingVoucher.count({ where: { tenantId, sourceDocumentId: receiptId } }),
    prisma.generalLedgerEntry.count({ where: { tenantId, sourceDocumentId: receiptId } }),
    prisma.receivableOpenItem.count({ where: { tenantId, customerReceiptId: receiptId } }),
    prisma.postingEvent.findMany({ where: { tenantId, eventKey: buildCustomerReceiptPostEventKey(receiptId) } }),
  ])

  expect(vouchers).toBe(0)
  expect(gl).toBe(0)
  expect(openItems).toBe(0)
  expect(events.some((e) => e.status === 'FAILED')).toBe(true)
  void receiptSeriesId
  void journalSeriesId
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceipt.updateMany({
    where: { tenantId },
    data: { accountingVoucherId: null, postingEventId: null, creditOpenItemId: null },
  }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptDeductionLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceipt.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Finance Phase 3B4 — AR customer receipt posting', () => {
  let fx: PostingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant('ar-rcpt-post')
    fx = await bootstrapPostingFixture(ctx)
    fx.userId = ctx.userId
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('happy path READY→POSTED: Dr bank Cr AR, receipt number, voucher, GL, credit open item', async () => {
    const receiptId = await createReadyReceipt(fx)
    const receiptSeriesBefore = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.customerReceiptSeriesId } }))!
      .currentValue
    const journalBefore = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.journalSeriesId } }))!.currentValue

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.receipt.status).toBe('POSTED')
    expect(res.body.data.receipt.receiptNumber).toMatch(/^RCPT-/)
    expect(res.body.data.receipt.accountingVoucherId).toBeTruthy()
    expect(res.body.data.receipt.creditOpenItemId).toBeTruthy()
    expect(res.body.data.posting.voucherNumber).toMatch(/^JO-/)
    expect(res.body.data.idempotentReplay).toBe(false)
    expect(res.body.data.creditOpenItemId).toBeTruthy()

    const receiptSeriesAfter = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.customerReceiptSeriesId } }))!
      .currentValue
    const journalAfter = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.journalSeriesId } }))!.currentValue
    expect(receiptSeriesAfter).toBe(receiptSeriesBefore + 1)
    expect(journalAfter).toBe(journalBefore + 1)

    const event = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey: buildCustomerReceiptPostEventKey(receiptId) },
    })
    expect(event?.status).toBe('POSTED')
    expect(event?.reservedSourceDocumentNumber).toBe(res.body.data.receipt.receiptNumber)

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.posting.voucherId },
      include: { account: { select: { accountType: true } } },
    })
    expect(gl.length).toBe(2)
    const debit = gl.find((e) => e.debitAmount.gt(0))
    const credit = gl.find((e) => e.creditAmount.gt(0))
    expect(debit?.account.accountType).toBe('BANK')
    expect(debit?.debitAmount.toFixed(4)).toBe('10000.0000')
    expect(credit?.account.accountType).toBe('CUSTOMER_RECEIVABLE')
    expect(credit?.creditAmount.toFixed(4)).toBe('10000.0000')

    const openItem = await prisma.receivableOpenItem.findFirst({ where: { tenantId: fx.tenantId, customerReceiptId: receiptId } })
    expect(openItem?.side).toBe('CREDIT')
    expect(openItem?.documentType).toBe('CUSTOMER_RECEIPT')
    expect(openItem?.status).toBe('OPEN')
    expect(openItem?.openAmount.toFixed(4)).toBe('10000.0000')
    expect(openItem?.allocatedAmount.toFixed(4)).toBe('0.0000')

    const allocations = await prisma.customerReceiptAllocation.count({ where: { tenantId: fx.tenantId, receiptId } })
    expect(allocations).toBe(0)
  })

  it('TDS post: bank 98000 + TDS 2000 = gross 100000', async () => {
    const receiptId = await createReadyReceipt(fx, {
      bankCashAmount: '98000.0000',
      customerTds: {
        mode: 'AMOUNT',
        value: '2000.0000',
        sectionCode: '194Q',
        accountId: fx.tdsReceivableAccountId,
      },
    })

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.receipt.grossReceiptAmount).toBe('100000.0000')

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.posting.voucherId },
      include: { account: { select: { accountType: true } } },
    })
    const bankDebit = gl.find((e) => e.account.accountType === 'BANK')
    const tdsDebit = gl.find((e) => e.account.accountType === 'TDS_RECEIVABLE')
    const receivableCredit = gl.find((e) => e.account.accountType === 'CUSTOMER_RECEIVABLE')
    expect(bankDebit?.debitAmount.toFixed(4)).toBe('98000.0000')
    expect(tdsDebit?.debitAmount.toFixed(4)).toBe('2000.0000')
    expect(receivableCredit?.creditAmount.toFixed(4)).toBe('100000.0000')
  })

  it('bank charge post: bank 9950 + charge 50 = gross 10000', async () => {
    const receiptId = await createReadyReceipt(fx, {
      bankCashAmount: '9950.0000',
      bankCharges: [{ description: 'NEFT charges', amount: '50.0000', accountId: fx.bankChargeAccountId }],
    })

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.receipt.grossReceiptAmount).toBe('10000.0000')

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.posting.voucherId },
      include: { account: { select: { accountType: true, accountCode: true } } },
    })
    const bankDebit = gl.find((e) => e.account.accountType === 'BANK')
    const chargeDebit = gl.find((e) => e.account.accountCode === '5300')
    const receivableCredit = gl.find((e) => e.account.accountType === 'CUSTOMER_RECEIVABLE')
    expect(bankDebit?.debitAmount.toFixed(4)).toBe('9950.0000')
    expect(chargeDebit?.debitAmount.toFixed(4)).toBe('50.0000')
    expect(receivableCredit?.creditAmount.toFixed(4)).toBe('10000.0000')
  })

  it('combined deductions: bank 17925 + TDS 2000 + charge 50 + other deduction 25 = gross 20000', async () => {
    const receiptId = await createReadyReceipt(fx, {
      bankCashAmount: '17925.0000',
      customerTds: {
        mode: 'AMOUNT',
        value: '2000.0000',
        sectionCode: '194Q',
        accountId: fx.tdsReceivableAccountId,
      },
      bankCharges: [{ description: 'NEFT charges', amount: '50.0000', accountId: fx.bankChargeAccountId }],
      otherDeductions: [
        { code: 'ROUNDOFF', description: 'Round off adjustment', amount: '25.0000', accountId: fx.otherDeductionAccountId },
      ],
    })

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.receipt.grossReceiptAmount).toBe('20000.0000')

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.posting.voucherId },
    })
    const totalDebit = gl.reduce((sum, e) => sum.add(e.debitAmount), new Prisma.Decimal(0))
    const totalCredit = gl.reduce((sum, e) => sum.add(e.creditAmount), new Prisma.Decimal(0))
    expect(totalDebit.toFixed(4)).toBe('20000.0000')
    expect(totalCredit.toFixed(4)).toBe('20000.0000')
    expect(gl.length).toBe(5)

    const openItem = await prisma.receivableOpenItem.findFirst({ where: { tenantId: fx.tenantId, customerReceiptId: receiptId } })
    expect(openItem?.openAmount.toFixed(4)).toBe('20000.0000')
    expect(openItem?.allocatedAmount.toFixed(4)).toBe('0.0000')
    expect(openItem?.side).toBe('CREDIT')
  })

  it('idempotent double post returns replay without duplicate artifacts', async () => {
    const receiptId = await createReadyReceipt(fx)

    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(second.status).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.posting.voucherNumber).toBe(first.body.data.posting.voucherNumber)

    const openItems = await prisma.receivableOpenItem.count({ where: { tenantId: fx.tenantId, customerReceiptId: receiptId } })
    expect(openItems).toBe(1)
  })

  it('DRAFT cannot post (422)', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    expect(created.status).toBe(201)

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${created.body.data.id}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('CUSTOMER_RECEIPT_NOT_READY')
  })

  it('POSTED receipt returns replay on repeated post', async () => {
    const receiptId = await createReadyReceipt(fx)
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
      .expect(200)

    const replay = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(replay.status).toBe(200)
    expect(replay.body.data.idempotentReplay).toBe(true)
  })

  it('returns 403 without finance.ar.receipt.post permission', async () => {
    const receiptId = await createReadyReceipt(fx)
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.noPostToken}`)
    expect(res.status).toBe(403)
  })

  it('posted receipt cannot edit or cancel; allowedActions reflect posted state', async () => {
    const receiptId = await createReadyReceipt(fx)
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
      .expect(200)

    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.body.data.allowedActions.edit).toBe(false)
    expect(detail.body.data.allowedActions.cancel).toBe(false)
    expect(detail.body.data.allowedActions.post).toBe(false)
    // Phase 3B5: posted receipt with unallocated credit is allocatable
    expect(detail.body.data.allowedActions.allocate).toBe(true)
    // Phase 3D: reverse allowed when POSTED and no posted allocation batches
    expect(detail.body.data.allowedActions.reverse).toBe(true)
    expect(detail.body.data.allowedActions.viewAccounting).toBe(true)
    expect(detail.body.data.allowedActions.viewCreditOpenItem).toBe(true)
    expect(detail.body.data.creditOpenItem).toBeTruthy()
    expect(detail.body.data.creditOpenItem.outstandingAmount).toBe('10000.0000')
    expect(detail.body.data.ledgerEntryCount).toBe(2)

    const edit = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ ...draftPayload(fx), updatedAt: detail.body.data.updatedAt })
    expect(edit.status).toBe(422)

    const cancel = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ cancellationReason: 'Should fail' })
    expect(cancel.status).toBe(422)
  })

  it('no allocations created and no invoice open items mutated by posting', async () => {
    const receiptId = await createReadyReceipt(fx)

    const invoiceOpenItemsBefore = await prisma.receivableOpenItem.count({
      where: { tenantId: fx.tenantId, side: 'DEBIT' },
    })

    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
      .expect(200)

    const allocations = await prisma.customerReceiptAllocation.count({ where: { tenantId: fx.tenantId, receiptId } })
    expect(allocations).toBe(0)

    const invoiceOpenItemsAfter = await prisma.receivableOpenItem.count({
      where: { tenantId: fx.tenantId, side: 'DEBIT' },
    })
    expect(invoiceOpenItemsAfter).toBe(invoiceOpenItemsBefore)
  })

  it('concurrent posts yield single voucher and credit open item', async () => {
    const receiptId = await createReadyReceipt(fx)

    const results = await Promise.allSettled([
      request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${fx.token}`),
      request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${fx.token}`),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof request>>>[]
    expect(fulfilled.length).toBe(2)
    const statuses = fulfilled.map((r) => r.value.status)
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1)

    const receipt = await prisma.customerReceipt.findFirst({ where: { id: receiptId } })
    expect(receipt?.status).toBe('POSTED')

    const openItems = await prisma.receivableOpenItem.count({ where: { customerReceiptId: receiptId } })
    expect(openItems).toBe(1)

    const vouchers = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, sourceDocumentId: receiptId },
    })
    expect(vouchers).toBe(1)
  })

  it('forced fail before GL leaves no partial accounting — retry reuses reserved numbers', async () => {
    const receiptId = await createReadyReceipt(fx)
    const eventKey = buildCustomerReceiptPostEventKey(receiptId)

    setTestOnlyFailBeforeGl(true)
    const failRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(failRes.status).toBeGreaterThanOrEqual(400)
    setTestOnlyFailBeforeGl(false)

    await assertNoPartialAccounting(fx.tenantId, receiptId, fx.customerReceiptSeriesId, fx.journalSeriesId)

    const failedEvent = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey, status: 'FAILED' },
    })
    expect(failedEvent?.reservedVoucherNumber).toBeTruthy()
    expect(failedEvent?.reservedSourceDocumentNumber).toBeTruthy()

    const retry = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(retry.status).toBe(200)
    expect(retry.body.data.receipt.receiptNumber).toBe(failedEvent!.reservedSourceDocumentNumber)
    expect(retry.body.data.posting.voucherNumber).toBe(failedEvent!.reservedVoucherNumber)
  })
})
