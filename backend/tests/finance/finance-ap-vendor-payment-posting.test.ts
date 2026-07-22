import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { buildVendorPaymentPostEventKey } from '../../src/modules/accounting/payables/vendor-payments/posting/vendor-payment-posting.types.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))
const NO_POST_PERMS = FINANCE_PERMS.filter((p) => p !== 'finance.ap.payment.post') as PermissionName[]

async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({ where: { name }, create: { name, module, description: name }, update: {} })
      .catch(() => {})
  }
}

interface VpPostFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  noPostToken: string
  legalEntityId: string
  vendorId: string
  payableAccountId: string
  bankAccountId: string
  cashAccountId: string
  tdsPayableAccountId: string
  bankChargeAccountId: string
  postingDate: string
  documentDate: string
  vendorPaymentSeriesId: string
  journalSeriesId: string
}

async function createUserWithPerms(tenantId: string, slug: string, permNames: PermissionName[], label: string) {
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
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'Test@123', tenantSlug: slug })
  return { userId: user.id, token: loginRes.body.data?.accessToken ?? '' }
}

async function createFinanceAdminTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`
  const tenant = await prisma.tenant.create({
    data: { name: 'AP Payment Post Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'AP',
      lastName: 'Payer',
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
  return { tenantId: tenant.id, userId: user.id, slug, token: loginRes.body.data?.accessToken ?? '' }
}

async function bootstrapVpPostFixture(ctx: {
  tenantId: string
  slug: string
  token: string
  userId: string
}): Promise<VpPostFixture> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)
  const documentDate = postingDate

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `LE${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8),
      legalName: 'AP Payment Co Pvt Ltd',
      displayName: 'AP Payment Co',
      stateCode: '27',
      gstin: '27AAAAA0000A1Z5',
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

  const payable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const bank = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'BANK', isGroup: false },
  })
  const cash = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CASH', isGroup: false },
  })
  const tdsPayable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'TDS_PAYABLE', isGroup: false },
  })
  const bankCharge = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'EXPENSE', isGroup: false },
  })
  expect(payable && bank && cash && tdsPayable && bankCharge).toBeTruthy()

  const receivable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
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
        { mappingKey: 'TDS_PAYABLE', accountId: tdsPayable!.id },
        { mappingKey: 'RETAINED_EARNINGS', accountId: retained!.id },
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

  const vendorPaymentSeries = await prisma.financeNumberSeries.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      documentType: 'VENDOR_PAYMENT',
      prefix: 'VPY-',
      currentValue: 0,
      padLength: 6,
      isActive: true,
    },
  })

  const journalSeries = await prisma.financeNumberSeries.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, documentType: 'JOURNAL' },
  })

  const vendor = await prisma.masterVendor.create({
    data: {
      tenantId: ctx.tenantId,
      code: `V${Date.now()}`.slice(-8),
      name: 'AP Payment Vendor Pvt Ltd',
      gstin: '27BBBBB0000B1Z5',
      pan: 'BBBBB0000B',
      state: '27',
      status: 'ACTIVE',
      isBlocked: false,
    },
  })

  const noPostUser = await createUserWithPerms(ctx.tenantId, ctx.slug, NO_POST_PERMS, 'no-ap-pay-post')

  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    slug: ctx.slug,
    token: ctx.token,
    noPostToken: noPostUser.token,
    legalEntityId,
    vendorId: vendor.id,
    payableAccountId: payable!.id,
    bankAccountId: bank!.id,
    cashAccountId: cash!.id,
    tdsPayableAccountId: tdsPayable!.id,
    bankChargeAccountId: bankCharge!.id,
    postingDate,
    documentDate,
    vendorPaymentSeriesId: vendorPaymentSeries.id,
    journalSeriesId: journalSeries!.id,
  }
}

let refSeq = 0
function nextBankRef(): string {
  refSeq += 1
  return `NEFT/${Date.now()}/${refSeq}`
}

function draftPayload(fx: VpPostFixture, overrides: Record<string, unknown> = {}) {
  return {
    legalEntityId: fx.legalEntityId,
    vendorId: fx.vendorId,
    paymentPurpose: 'INVOICE_SETTLEMENT',
    paymentMethod: 'BANK_TRANSFER',
    documentDate: fx.documentDate,
    paymentDate: fx.documentDate,
    proposedPostingDate: fx.postingDate,
    currencyCode: 'INR',
    exchangeRate: '1',
    paymentAmount: '10000',
    paymentAccountId: fx.bankAccountId,
    vendorPayableAccountId: fx.payableAccountId,
    bankReference: nextBankRef(),
    approvalRequiredOverride: false,
    adjustments: [],
    ...overrides,
  }
}

async function createReadyPayment(fx: VpPostFixture, overrides: Record<string, unknown> = {}) {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send(draftPayload(fx, overrides))
  expect(created.status).toBe(201)
  const id = created.body.data.id as string
  const updatedAt = created.body.data.updatedAt as string

  const ready = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: updatedAt })
  expect(ready.status).toBe(200)
  expect(ready.body.data.status).toBe('READY_TO_POST')
  return { id, updatedAt: ready.body.data.updatedAt as string, detail: ready.body.data }
}

async function postPayment(fx: VpPostFixture, id: string, expectedUpdatedAt: string, token = fx.token) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${id}/post`)
    .set('Authorization', `Bearer ${token}`)
    .send({ expectedUpdatedAt })
}

function glTotals(gl: Array<{ accountId: string; debitAmount: unknown; creditAmount: unknown }>) {
  const debit = new Map<string, number>()
  const credit = new Map<string, number>()
  for (const row of gl) {
    const d = Number(row.debitAmount)
    const c = Number(row.creditAmount)
    if (d > 0) debit.set(row.accountId, (debit.get(row.accountId) ?? 0) + d)
    if (c > 0) credit.set(row.accountId, (credit.get(row.accountId) ?? 0) + c)
  }
  return { debit, credit }
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPayment.updateMany({
    where: { tenantId },
    data: { accountingVoucherId: null, postingEventId: null, approvalRequestId: null, payableOpenItemId: null },
  }).catch(() => {})
  await prisma.vendorPaymentAdjustmentLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPayment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalStep.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalRequest.deleteMany({ where: { tenantId } }).catch(() => {})
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
  await prisma.masterVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Finance Phase 4B3 — AP vendor payment posting', () => {
  let fx: VpPostFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant('ap-pay-post')
    fx = await bootstrapVpPostFixture(ctx)
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('simple bank payment READY→POSTED creates FOS number, voucher, GL, DEBIT payable open item', async () => {
    const ready = await createReadyPayment(fx)
    expect(ready.detail.vendorSettlementAmount).toBe('10000.0000')
    expect(ready.detail.cashOutflowAmount).toBe('10000.0000')
    expect(ready.detail.allowedActions.post).toBe(true)

    const vpyBefore = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.vendorPaymentSeriesId } }))!.currentValue
    const journalBefore = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.journalSeriesId } }))!.currentValue

    const res = await postPayment(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('POSTED')
    expect(res.body.data.vendorPaymentNumber).toMatch(/^VPY-/)
    expect(res.body.data.accountingVoucherId).toBeTruthy()
    expect(res.body.data.payableOpenItemId).toBeTruthy()
    expect(res.body.data.payableOpenItemSide).toBe('DEBIT')
    expect(res.body.data.payableOpenItemDocumentType).toBe('VENDOR_PAYMENT')
    expect(res.body.data.posting.voucherNumber).toMatch(/^JO-/)
    expect(res.body.data.idempotentReplay).toBe(false)
    expect(res.body.data.payableOutstandingAmount).toBe('10000.0000')

    const vpyAfter = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.vendorPaymentSeriesId } }))!.currentValue
    const journalAfter = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.journalSeriesId } }))!.currentValue
    expect(vpyAfter).toBe(vpyBefore + 1)
    expect(journalAfter).toBe(journalBefore + 1)

    const event = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey: buildVendorPaymentPostEventKey(ready.id) },
    })
    expect(event?.status).toBe('POSTED')
    expect(event?.reservedSourceDocumentNumber).toBe(res.body.data.vendorPaymentNumber)

    const openItem = await prisma.payableOpenItem.findFirst({
      where: { tenantId: fx.tenantId, sourceVendorPaymentId: ready.id },
    })
    expect(openItem?.side).toBe('DEBIT')
    expect(openItem?.documentType).toBe('VENDOR_PAYMENT')
    expect(openItem?.originalAmount.toString()).toBe('10000')
    expect(openItem?.outstandingAmount.toString()).toBe('10000')
    expect(openItem?.allocatedAmount.toString()).toBe('0')
    expect(openItem?.status).toBe('OPEN')

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.accountingVoucherId },
    })
    const { debit, credit } = glTotals(gl)
    expect(debit.get(fx.payableAccountId)).toBe(10000)
    expect(credit.get(fx.bankAccountId)).toBe(10000)

    const audits = await prisma.auditLog.findMany({
      where: { tenantId: fx.tenantId, entityId: ready.id, action: 'VENDOR_PAYMENT_POSTED' },
    })
    expect(audits.length).toBe(1)
    expect(await prisma.payableOpenItem.count({ where: { tenantId: fx.tenantId, sourceVendorPaymentId: ready.id } })).toBe(1)
  })

  it('advance cash payment posts VENDOR_ADVANCE DEBIT open item', async () => {
    const ready = await createReadyPayment(fx, {
      paymentPurpose: 'ADVANCE',
      paymentMethod: 'CASH',
      paymentAccountId: fx.cashAccountId,
      bankReference: undefined,
      paymentReference: undefined,
    })
    const res = await postPayment(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    expect(res.body.data.payableOpenItemDocumentType).toBe('VENDOR_ADVANCE')
    expect(res.body.data.payableOpenItemSide).toBe('DEBIT')

    const openItem = await prisma.payableOpenItem.findFirst({
      where: { tenantId: fx.tenantId, sourceVendorPaymentId: ready.id },
    })
    expect(openItem?.documentType).toBe('VENDOR_ADVANCE')
    expect(openItem?.originalAmount.toString()).toBe('10000')

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.accountingVoucherId },
    })
    const { debit, credit } = glTotals(gl)
    expect(debit.get(fx.payableAccountId)).toBe(10000)
    expect(credit.get(fx.cashAccountId)).toBe(10000)
  })

  it('TDS + bank charge: open-item amount = vendorSettlement (not cash outflow); GL balanced', async () => {
    const ready = await createReadyPayment(fx, {
      adjustments: [
        {
          lineNumber: 1,
          adjustmentType: 'TDS',
          accountingRole: 'SETTLEMENT_CREDIT',
          description: 'TDS 194C',
          amount: '1000',
          sectionCode: '194C',
          accountId: fx.tdsPayableAccountId,
        },
        {
          lineNumber: 2,
          adjustmentType: 'BANK_CHARGE',
          accountingRole: 'PAYMENT_EXPENSE_DEBIT',
          description: 'Bank charge',
          amount: '200',
          accountId: fx.bankChargeAccountId,
        },
      ],
    })
    const settlement = Number(ready.detail.vendorSettlementAmount)
    const cashOut = Number(ready.detail.cashOutflowAmount)
    expect(Number(ready.detail.tdsAmount)).toBe(1000)
    // Settlement includes TDS credit; cash outflow includes bank charge — they differ.
    expect(settlement).not.toBe(cashOut)

    const res = await postPayment(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)

    const openItem = await prisma.payableOpenItem.findFirst({
      where: { tenantId: fx.tenantId, sourceVendorPaymentId: ready.id },
    })
    expect(Number(openItem?.originalAmount)).toBe(settlement)
    expect(Number(openItem?.originalAmount)).not.toBe(cashOut)

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.accountingVoucherId },
    })
    const { debit, credit } = glTotals(gl)
    expect(debit.get(fx.payableAccountId)).toBe(settlement)
    expect(credit.get(fx.tdsPayableAccountId)).toBe(1000)
    expect(debit.get(fx.bankChargeAccountId)).toBe(200)

    const totalDebit = [...debit.values()].reduce((s, v) => s + v, 0)
    const totalCredit = [...credit.values()].reduce((s, v) => s + v, 0)
    expect(totalDebit).toBe(totalCredit)
  })

  it('idempotent replay returns same numbers without duplicate audit or open item', async () => {
    const ready = await createReadyPayment(fx)
    const first = await postPayment(fx, ready.id, ready.updatedAt)
    expect(first.status).toBe(200)
    const second = await postPayment(fx, ready.id, ready.updatedAt)
    expect(second.status).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.vendorPaymentNumber).toBe(first.body.data.vendorPaymentNumber)
    expect(second.body.data.accountingVoucherId).toBe(first.body.data.accountingVoucherId)
    expect(second.body.data.payableOpenItemId).toBe(first.body.data.payableOpenItemId)
    const audits = await prisma.auditLog.findMany({
      where: { tenantId: fx.tenantId, entityId: ready.id, action: 'VENDOR_PAYMENT_POSTED' },
    })
    expect(audits.length).toBe(1)
    expect(await prisma.payableOpenItem.count({ where: { tenantId: fx.tenantId, sourceVendorPaymentId: ready.id } })).toBe(1)
  })

  it('posting creates no allocation records', async () => {
    const ready = await createReadyPayment(fx)
    const res = await postPayment(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    const allocationBatches = await prisma.payableAllocationBatch.count({ where: { tenantId: fx.tenantId } })
    const allocationLines = await prisma.payableAllocationLine.count({ where: { tenantId: fx.tenantId } })
    expect(allocationBatches).toBe(0)
    expect(allocationLines).toBe(0)
  })

  it('DRAFT cannot post; POSTED is immutable to cancel', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    expect(created.status).toBe(201)
    const draftPost = await postPayment(fx, created.body.data.id, created.body.data.updatedAt)
    expect(draftPost.status).toBe(422)
    expect(draftPost.body.error?.code ?? draftPost.body.code).toMatch(/NOT_READY_TO_POST/)

    const ready = await createReadyPayment(fx)
    const posted = await postPayment(fx, ready.id, ready.updatedAt)
    expect(posted.status).toBe(200)

    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${ready.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.allowedActions.post).toBe(false)
    expect(detail.body.data.allowedActions.edit).toBe(false)
    expect(detail.body.data.allowedActions.cancel).toBe(false)
    // Phase 4B4: a POSTED payment with an unallocated DEBIT open item is allocatable.
    expect(detail.body.data.allowedActions.allocate).toBe(true)
    expect(detail.body.data.allowedActions.reverse).toBe(false)

    const cancel = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${ready.id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'should fail', expectedUpdatedAt: detail.body.data.updatedAt })
    expect(cancel.status).toBe(422)
  })

  it('permission: missing finance.ap.payment.post is 403', async () => {
    const ready = await createReadyPayment(fx)
    const denied = await postPayment(fx, ready.id, ready.updatedAt, fx.noPostToken)
    expect(denied.status).toBe(403)
  })

  it('closed period blocks posting without creating accounting', async () => {
    const ready = await createReadyPayment(fx)
    const period = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        startDate: { lte: new Date(fx.postingDate) },
        endDate: { gte: new Date(fx.postingDate) },
      },
    })
    expect(period).toBeTruthy()
    await prisma.accountingPeriod.update({ where: { id: period!.id }, data: { status: 'CLOSED' } })

    const res = await postPayment(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(422)

    const payment = await prisma.vendorPayment.findFirst({ where: { id: ready.id } })
    expect(payment?.status).toBe('READY_TO_POST')
    expect(payment?.vendorPaymentNumber).toBeNull()
    expect(await prisma.payableOpenItem.count({ where: { sourceVendorPaymentId: ready.id } })).toBe(0)

    await prisma.accountingPeriod.update({ where: { id: period!.id }, data: { status: 'OPEN' } })
  })
})
