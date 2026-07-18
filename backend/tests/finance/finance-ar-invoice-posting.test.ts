import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { buildSalesInvoicePostEventKey } from '../../src/modules/accounting/receivables/posting/sales-invoice-posting.types.js'
import { setTestOnlyFailBeforeGl } from '../../src/modules/accounting/posting/posting.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))
const EXEC_PERMS = FINANCE_PERMS.filter((p) => p !== 'finance.ar.invoice.post') as PermissionName[]

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
  customerId: string
  revenueAccountId: string
  receivableAccountId: string
  postingDate: string
  invoiceDate: string
  salesInvoiceSeriesId: string
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
    data: { name: 'AR Invoice Post Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
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
  const invoiceDate = postingDate

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `LE${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8),
      legalName: 'AR Post Co Pvt Ltd',
      displayName: 'AR Post Co',
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
  expect(sales && receivable && payable && purchase && retained).toBeTruthy()

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

  const salesInvoiceSeries = await prisma.financeNumberSeries.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      documentType: 'SALES_INVOICE',
      prefix: 'SINV-',
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
      name: 'Post Customer Pvt Ltd',
      gstin: '27AAAAA0000A1Z5',
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
    revenueAccountId: sales!.id,
    receivableAccountId: receivable!.id,
    postingDate,
    invoiceDate,
    salesInvoiceSeriesId: salesInvoiceSeries.id,
    journalSeriesId: journalSeries!.id,
  }
}

function linePayload(revenueAccountId: string, overrides: Record<string, unknown> = {}) {
  return {
    lineNumber: 1,
    description: 'Test item',
    hsnCode: '87089990',
    quantity: '1.000000',
    unitRate: '1000.0000',
    gstRate: '18',
    revenueAccountId,
    ...overrides,
  }
}

function draftPayload(fx: PostingFixture, overrides: Record<string, unknown> = {}) {
  return {
    legalEntityId: fx.legalEntityId,
    customerId: fx.customerId,
    sourceType: 'DIRECT',
    invoiceDate: fx.invoiceDate,
    postingDate: fx.postingDate,
    placeOfSupply: '27',
    taxTreatment: 'REGISTERED',
    currencyCode: 'INR',
    lines: [linePayload(fx.revenueAccountId)],
    ...overrides,
  }
}

async function createReadyInvoice(fx: PostingFixture): Promise<string> {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send(draftPayload(fx))
  expect(created.status).toBe(201)
  const id = created.body.data.id as string

  const ready = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(ready.status).toBe(200)
  expect(ready.body.data.status).toBe('READY_TO_POST')
  return id
}

async function assertNoPartialAccounting(tenantId: string, invoiceId: string, salesSeriesId: string, journalSeriesId: string) {
  const invoice = await prisma.salesInvoice.findFirst({ where: { id: invoiceId, tenantId } })
  expect(invoice?.status).toBe('READY_TO_POST')
  expect(invoice?.invoiceNumber).toBeNull()
  expect(invoice?.accountingVoucherId).toBeNull()

  const [vouchers, gl, openItems, salesSeries, journalSeries, events] = await Promise.all([
    prisma.accountingVoucher.count({ where: { tenantId, sourceDocumentId: invoiceId } }),
    prisma.generalLedgerEntry.count({ where: { tenantId, sourceDocumentId: invoiceId } }),
    prisma.receivableOpenItem.count({ where: { tenantId, salesInvoiceId: invoiceId } }),
    prisma.financeNumberSeries.findUnique({ where: { id: salesSeriesId } }),
    prisma.financeNumberSeries.findUnique({ where: { id: journalSeriesId } }),
    prisma.postingEvent.findMany({ where: { tenantId, eventKey: buildSalesInvoicePostEventKey(invoiceId) } }),
  ])

  expect(vouchers).toBe(0)
  expect(gl).toBe(0)
  expect(openItems).toBe(0)
  expect(events.some((e) => e.status === 'FAILED')).toBe(true)
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.updateMany({
    where: { tenantId },
    data: { accountingVoucherId: null, postingEventId: null },
  }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance Phase 3A4 — AR sales invoice posting', () => {
  let fx: PostingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant('ar-inv-post')
    fx = await bootstrapPostingFixture(ctx)
    fx.userId = ctx.userId
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('happy path READY→POSTED creates invoice number, voucher, GL, open item, POSTED event', async () => {
    const invoiceId = await createReadyInvoice(fx)
    const salesBefore = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.salesInvoiceSeriesId } }))!.currentValue
    const journalBefore = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.journalSeriesId } }))!.currentValue

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.invoice.status).toBe('POSTED')
    expect(res.body.data.invoice.invoiceNumber).toMatch(/^SINV-/)
    expect(res.body.data.invoice.accountingVoucherId).toBeTruthy()
    expect(res.body.data.invoice.receivableOpenItemId).toBeTruthy()
    expect(res.body.data.posting.voucherNumber).toMatch(/^JO-/)
    expect(res.body.data.idempotentReplay).toBe(false)

    const salesAfter = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.salesInvoiceSeriesId } }))!.currentValue
    const journalAfter = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.journalSeriesId } }))!.currentValue
    expect(salesAfter).toBe(salesBefore + 1)
    expect(journalAfter).toBe(journalBefore + 1)

    const event = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey: buildSalesInvoicePostEventKey(invoiceId) },
    })
    expect(event?.status).toBe('POSTED')
    expect(event?.reservedSourceDocumentNumber).toBe(res.body.data.invoice.invoiceNumber)

    const glCount = await prisma.generalLedgerEntry.count({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.posting.voucherId },
    })
    expect(glCount).toBeGreaterThanOrEqual(4)
  })

  it('intra-state GST GL shape: Dr receivable, Cr revenue, Cr CGST, Cr SGST', async () => {
    const invoiceId = await createReadyInvoice(fx)
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.posting.voucherId },
      include: { account: { select: { accountType: true, accountCode: true } } },
    })

    const debits = gl.filter((e) => e.debitAmount.gt(0))
    const credits = gl.filter((e) => e.creditAmount.gt(0))
    expect(debits).toHaveLength(1)
    expect(debits[0]!.account.accountType).toBe('CUSTOMER_RECEIVABLE')
    expect(debits[0]!.debitAmount.toFixed(4)).toBe('1180.0000')

    const revenueCredit = credits.find((c) => c.account.accountType === 'SALES')
    expect(revenueCredit?.creditAmount.toFixed(4)).toBe('1000.0000')

    const cgstCredit = credits.find((c) => c.account.accountCode === '220101')
    const sgstCredit = credits.find((c) => c.account.accountCode === '220102')
    expect(cgstCredit?.creditAmount.toFixed(4)).toBe('90.0000')
    expect(sgstCredit?.creditAmount.toFixed(4)).toBe('90.0000')
  })

  it('idempotent double post returns replay without duplicate artifacts', async () => {
    const invoiceId = await createReadyInvoice(fx)

    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(second.status).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.posting.voucherNumber).toBe(first.body.data.posting.voucherNumber)

    const openItems = await prisma.receivableOpenItem.count({ where: { tenantId: fx.tenantId, salesInvoiceId: invoiceId } })
    expect(openItems).toBe(1)
  })

  it('DRAFT cannot post (422)', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    expect(created.status).toBe(201)

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${created.body.data.id}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('SALES_INVOICE_NOT_READY')
  })

  it('returns 403 without finance.ar.invoice.post permission', async () => {
    const invoiceId = await createReadyInvoice(fx)
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${fx.noPostToken}`)
    expect(res.status).toBe(403)
  })

  it('posted invoice cannot edit or cancel', async () => {
    const invoiceId = await createReadyInvoice(fx)
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
      .expect(200)

    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.body.data.allowedActions.edit).toBe(false)
    expect(detail.body.data.allowedActions.cancel).toBe(false)
    expect(detail.body.data.allowedActions.viewAccounting).toBe(true)

    const edit = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ ...draftPayload(fx), updatedAt: detail.body.data.updatedAt })
    expect(edit.status).toBe(422)

    const cancel = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ cancellationReason: 'Should fail' })
    expect(cancel.status).toBe(422)
  })

  it('subledger openAmount equals receivable GL debit', async () => {
    const invoiceId = await createReadyInvoice(fx)
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)

    const openItem = await prisma.receivableOpenItem.findFirst({ where: { salesInvoiceId: invoiceId } })
    const receivableGl = await prisma.generalLedgerEntry.findFirst({
      where: {
        tenantId: fx.tenantId,
        voucherId: res.body.data.posting.voucherId,
        accountId: fx.receivableAccountId,
      },
    })
    expect(openItem?.openAmount.toString()).toBe(receivableGl?.debitAmount.toString())
  })

  it('concurrent posts yield single voucher and open item', async () => {
    const invoiceId = await createReadyInvoice(fx)

    const results = await Promise.allSettled([
      request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
        .set('Authorization', `Bearer ${fx.token}`),
      request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
        .set('Authorization', `Bearer ${fx.token}`),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof request>>>[]
    expect(fulfilled.length).toBe(2)
    const statuses = fulfilled.map((r) => r.value.status)
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1)

    const invoice = await prisma.salesInvoice.findFirst({ where: { id: invoiceId } })
    expect(invoice?.status).toBe('POSTED')

    const openItems = await prisma.receivableOpenItem.count({ where: { salesInvoiceId: invoiceId } })
    expect(openItems).toBe(1)

    const vouchers = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, sourceDocumentId: invoiceId },
    })
    expect(vouchers).toBe(1)
  })

  it('assertNoPartialAccounting on forced fail — retry reuses numbers', async () => {
    const invoiceId = await createReadyInvoice(fx)
    const eventKey = buildSalesInvoicePostEventKey(invoiceId)

    setTestOnlyFailBeforeGl(true)
    const failRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(failRes.status).toBeGreaterThanOrEqual(400)
    setTestOnlyFailBeforeGl(false)

    await assertNoPartialAccounting(fx.tenantId, invoiceId, fx.salesInvoiceSeriesId, fx.journalSeriesId)

    const failedEvent = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey, status: 'FAILED' },
    })
    expect(failedEvent?.reservedVoucherNumber).toBeTruthy()
    expect(failedEvent?.reservedSourceDocumentNumber).toBeTruthy()

    const retry = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(retry.status).toBe(200)
    expect(retry.body.data.invoice.invoiceNumber).toBe(failedEvent!.reservedSourceDocumentNumber)
    expect(retry.body.data.posting.voucherNumber).toBe(failedEvent!.reservedVoucherNumber)
  })
})
