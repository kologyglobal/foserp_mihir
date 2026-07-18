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

interface ReceiptDraftFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
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
  numberSeriesId: string
}

async function createFinanceAdminTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'AR Receipt Draft Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'AR',
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

async function bootstrapReceiptFixture(ctx: {
  tenantId: string
  slug: string
  token: string
}): Promise<ReceiptDraftFixture> {
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
      legalName: 'AR Receipt Co Pvt Ltd',
      displayName: 'AR Receipt Co',
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

  const numberSeries = await prisma.financeNumberSeries.create({
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

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: ctx.tenantId,
      companyCode: `CUST-${Date.now()}`.slice(-8),
      name: 'Receipt Customer Pvt Ltd',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      state: '27',
      country: 'India',
      status: 'active',
      isActive: true,
    },
  })

  return {
    tenantId: ctx.tenantId,
    userId: '',
    slug: ctx.slug,
    token: ctx.token,
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
    numberSeriesId: numberSeries.id,
  }
}

function draftPayload(fx: ReceiptDraftFixture, overrides: Record<string, unknown> = {}) {
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

async function assertNoAccountingArtifacts(tenantId: string, numberSeriesId: string) {
  const [postingEvents, vouchers, gl, openItems, allocations, series] = await Promise.all([
    prisma.postingEvent.count({ where: { tenantId } }),
    prisma.accountingVoucher.count({ where: { tenantId } }),
    prisma.generalLedgerEntry.count({ where: { tenantId } }),
    prisma.receivableOpenItem.count({ where: { tenantId } }),
    prisma.customerReceiptAllocation.count({ where: { tenantId } }),
    prisma.financeNumberSeries.findUnique({ where: { id: numberSeriesId } }),
  ])
  expect(postingEvents).toBe(0)
  expect(vouchers).toBe(0)
  expect(gl).toBe(0)
  expect(openItems).toBe(0)
  expect(allocations).toBe(0)
  expect(series!.currentValue).toBe(0)
}

async function deleteReceipt(id: string) {
  await prisma.customerReceiptDeductionLine.deleteMany({ where: { receiptId: id } })
  await prisma.customerReceipt.delete({ where: { id } })
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptDeductionLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceipt.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance Phase 3B3 — AR customer receipt drafts', () => {
  let fx: ReceiptDraftFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant('ar-rcpt-draft')
    const base = await bootstrapReceiptFixture(ctx)
    fx = { ...base, userId: ctx.userId }
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('creates direct draft with server-calculated amounts and draft reference', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.receiptNumber).toBeNull()
    expect(res.body.data.draftReference).toMatch(/^RCPT-DRAFT-\d{8}-[0-9A-Z]{6}$/)
    expect(res.body.data.grossReceiptAmount).toBe('10000.0000')
    expect(res.body.data.allocatableAmount).toBe('10000.0000')
    expect(res.body.data.unallocatedAmount).toBe('10000.0000')
    expect(res.body.data.allocatedAmount).toBe('0.0000')
    expect(res.body.data.allowedActions.post).toBe(false)
    expect(res.body.data.allowedActions.allocate).toBe(false)
    expect(res.body.data.allowedActions.markReady).toBe(true)

    await assertNoAccountingArtifacts(fx.tenantId, fx.numberSeriesId)
    await deleteReceipt(res.body.data.id)
  })

  it('creates draft with TDS, bank charges, and other deductions calculated correctly', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(
        draftPayload(fx, {
          customerTds: {
            mode: 'PERCENTAGE',
            value: '10',
            calculationBase: '100000.0000',
            sectionCode: '194Q',
            accountId: fx.tdsReceivableAccountId,
          },
          bankCharges: [{ description: 'NEFT charges', amount: '50.0000', accountId: fx.bankChargeAccountId }],
          otherDeductions: [
            { code: 'ROUNDOFF', description: 'Round off adjustment', amount: '25.0000', accountId: fx.otherDeductionAccountId },
          ],
        }),
      )

    expect(res.status).toBe(201)
    expect(res.body.data.customerTdsAmount).toBe('10000.0000')
    expect(res.body.data.bankChargeAmount).toBe('50.0000')
    expect(res.body.data.otherDeductionAmount).toBe('25.0000')
    expect(res.body.data.grossReceiptAmount).toBe('20075.0000')
    expect(res.body.data.customerTds?.mode).toBe('PERCENTAGE')
    expect(res.body.data.customerTds?.accountId).toBe(fx.tdsReceivableAccountId)

    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${res.body.data.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.bankCharges).toHaveLength(1)
    expect(detail.body.data.otherDeductions).toHaveLength(1)
    expect(detail.body.data.bankCharges[0].accountId).toBe(fx.bankChargeAccountId)

    await assertNoAccountingArtifacts(fx.tenantId, fx.numberSeriesId)
    await deleteReceipt(res.body.data.id)
  })

  it('rejects sourceType BANK_IMPORT', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx, { sourceType: 'BANK_IMPORT' }))
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('CUSTOMER_RECEIPT_SOURCE_NOT_SUPPORTED')
  })

  it('rejects cheque payment method without instrument fields', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx, { paymentMethod: 'CHEQUE', transactionReference: undefined }))
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('CUSTOMER_RECEIPT_DRAFT_CALCULATION_FAILED')
  })

  it('updates draft and reopens READY_TO_POST to DRAFT on edit', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    expect(created.status).toBe(201)
    const id = created.body.data.id as string
    const draftRef = created.body.data.draftReference as string

    const ready = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(ready.status).toBe(200)
    expect(ready.body.data.status).toBe('READY_TO_POST')

    const updated = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        ...draftPayload(fx, { bankCashAmount: '15000.0000' }),
        updatedAt: ready.body.data.updatedAt,
      })
    expect(updated.status).toBe(200)
    expect(updated.body.data.status).toBe('DRAFT')
    expect(updated.body.data.draftReference).toBe(draftRef)
    expect(updated.body.data.receiptNumber).toBeNull()
    expect(updated.body.data.grossReceiptAmount).toBe('15000.0000')

    await assertNoAccountingArtifacts(fx.tenantId, fx.numberSeriesId)
    await deleteReceipt(id)
  })

  it('returns stale update conflict on optimistic concurrency mismatch', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    const id = created.body.data.id as string

    const stale = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        ...draftPayload(fx),
        updatedAt: new Date(Date.now() - 60_000).toISOString(),
      })
    expect(stale.status).toBe(409)
    expect(stale.body.code).toBe('CUSTOMER_RECEIPT_STALE_UPDATE')

    await deleteReceipt(id)
  })

  it('validate endpoint has no side effects on receipt amounts or status', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    const id = created.body.data.id as string
    const before = await prisma.customerReceipt.findUnique({ where: { id } })

    const validated = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}/validate`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({})
    expect(validated.status).toBe(200)
    expect(validated.body.data.valid).toBe(true)

    const after = await prisma.customerReceipt.findUnique({ where: { id } })
    expect(after!.status).toBe(before!.status)
    expect(after!.grossReceiptAmount.toFixed(4)).toBe(before!.grossReceiptAmount.toFixed(4))
    await assertNoAccountingArtifacts(fx.tenantId, fx.numberSeriesId)

    await deleteReceipt(id)
  })

  it('marks draft ready without issuing receipt number or consuming series', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    const id = created.body.data.id as string

    const ready = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(ready.status).toBe(200)
    expect(ready.body.data.status).toBe('READY_TO_POST')
    expect(ready.body.data.receiptNumber).toBeNull()
    expect(ready.body.data.allowedActions.markReady).toBe(false)
    expect(ready.body.data.allowedActions.post).toBe(false)
    expect(ready.body.data.allowedActions.allocate).toBe(false)

    await assertNoAccountingArtifacts(fx.tenantId, fx.numberSeriesId)
    await deleteReceipt(id)
  })

  it('cancels draft with reason', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    const id = created.body.data.id as string

    const cancelled = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ cancellationReason: 'Customer request' })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')
    expect(cancelled.body.data.allowedActions.edit).toBe(false)
    expect(cancelled.body.data.allowedActions.post).toBe(false)

    await assertNoAccountingArtifacts(fx.tenantId, fx.numberSeriesId)
    await deleteReceipt(id)
  })

  it('lists and fetches receipt detail with allowedActions and search filters', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx, { transactionReference: 'TXN-SEARCHABLE-001' }))
    const id = created.body.data.id as string

    const list = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .query({ legalEntityId: fx.legalEntityId, search: 'TXN-SEARCHABLE-001' })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(list.status).toBe(200)
    expect(list.body.data.some((row: { id: string }) => row.id === id)).toBe(true)
    expect(list.body.data[0].allowedActions).toBeDefined()

    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.allowedActions.validate).toBe(true)

    await deleteReceipt(id)
  })

  it('rejects edit of POSTED and CANCELLED receipts', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    const id = created.body.data.id as string

    await prisma.customerReceipt.update({ where: { id }, data: { status: 'POSTED' } })
    const postedEdit = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ ...draftPayload(fx), updatedAt: new Date().toISOString() })
    expect(postedEdit.status).toBe(422)
    expect(postedEdit.body.code).toBe('CUSTOMER_RECEIPT_NOT_EDITABLE')

    await prisma.customerReceipt.update({
      where: { id },
      data: { status: 'CANCELLED', cancellationReason: 'fixture', cancelledAt: new Date() },
    })
    const cancelledEdit = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ ...draftPayload(fx), updatedAt: new Date().toISOString() })
    expect(cancelledEdit.status).toBe(422)
    expect(['CUSTOMER_RECEIPT_ALREADY_CANCELLED', 'CUSTOMER_RECEIPT_NOT_EDITABLE']).toContain(cancelledEdit.body.code)

    await deleteReceipt(id)
  })

  it('enforces permissions on create', async () => {
    const { hashPassword } = await import('../../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const viewPerm = await prisma.permission.findFirst({ where: { name: 'finance.ar.receipt.view' } })
    expect(viewPerm).toBeTruthy()
    const viewer = await prisma.user.create({
      data: {
        tenantId: fx.tenantId,
        firstName: 'View',
        lastName: 'Only',
        email: `viewer-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const role = await prisma.role.create({
      data: {
        tenantId: fx.tenantId,
        name: `View Only ${Date.now()}`,
        rolePermissions: { create: [{ permissionId: viewPerm!.id }] },
      },
    })
    await prisma.userRole.create({ data: { userId: viewer.id, roleId: role.id, tenantId: fx.tenantId } })

    const login = await request(app).post('/api/v1/auth/login').send({
      email: viewer.email,
      password: 'Test@123',
      tenantSlug: fx.slug,
    })
    const viewToken = login.body.data.accessToken as string

    const denied = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
      .set('Authorization', `Bearer ${viewToken}`)
      .send(draftPayload(fx))
    expect(denied.status).toBe(403)

    await prisma.userRole.deleteMany({ where: { userId: viewer.id } })
    await prisma.role.delete({ where: { id: role.id } })
    await prisma.user.delete({ where: { id: viewer.id } })
  })
})
