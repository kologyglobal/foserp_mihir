import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { buildVendorInvoicePostEventKey } from '../../src/modules/accounting/payables/vendor-invoices/posting/vendor-invoice-posting.types.js'
import { setTestOnlyFailBeforeGl } from '../../src/modules/accounting/posting/posting.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))
const NO_POST_PERMS = FINANCE_PERMS.filter((p) => p !== 'finance.ap.vendor_invoice.post') as PermissionName[]
const VOUCHER_POST_ONLY = FINANCE_PERMS.filter(
  (p) => p === 'finance.voucher.post' || p.startsWith('finance.ap.vendor_invoice.view') || p === 'finance.ap.view',
) as PermissionName[]

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

interface ApPostFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  noPostToken: string
  voucherPostToken: string
  legalEntityId: string
  vendorId: string
  purchaseAccountId: string
  payableAccountId: string
  inputCgstAccountId: string
  inputSgstAccountId: string
  inputIgstAccountId: string
  tdsPayableAccountId: string
  postingDate: string
  documentDate: string
  vendorInvoiceSeriesId: string
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
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email,
    password: 'Test@123',
    tenantSlug: slug,
  })
  return { userId: user.id, token: loginRes.body.data?.accessToken ?? '' }
}

async function createFinanceAdminTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`
  const tenant = await prisma.tenant.create({
    data: { name: 'AP Invoice Post Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'AP',
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

async function bootstrapApPostFixture(ctx: {
  tenantId: string
  slug: string
  token: string
  userId: string
}): Promise<ApPostFixture> {
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
      legalName: 'AP Post Co Pvt Ltd',
      displayName: 'AP Post Co',
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

  const purchase = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  const payable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const sales = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'SALES', isGroup: false },
  })
  const receivable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
  })
  const retained = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
  })
  const tdsPayable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'TDS_PAYABLE', isGroup: false },
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
  expect(purchase && payable && sales && receivable && retained && tdsPayable && gstInCgst && gstInSgst && gstInIgst).toBeTruthy()

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

  const vendorInvoiceSeries = await prisma.financeNumberSeries.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      documentType: 'VENDOR_INVOICE',
      prefix: 'VIN-',
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
      name: 'AP Post Vendor Pvt Ltd',
      gstin: '27BBBBB0000B1Z5',
      pan: 'BBBBB0000B',
      state: '27',
      status: 'ACTIVE',
      isBlocked: false,
    },
  })

  const noPostUser = await createUserWithPerms(ctx.tenantId, ctx.slug, NO_POST_PERMS, 'no-ap-post')
  const voucherPostUser = await createUserWithPerms(
    ctx.tenantId,
    ctx.slug,
    [...VOUCHER_POST_ONLY, 'finance.voucher.post' as PermissionName].filter(Boolean),
    'voucher-post-only',
  )

  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    slug: ctx.slug,
    token: ctx.token,
    noPostToken: noPostUser.token,
    voucherPostToken: voucherPostUser.token,
    legalEntityId,
    vendorId: vendor.id,
    purchaseAccountId: purchase!.id,
    payableAccountId: payable!.id,
    inputCgstAccountId: gstInCgst!.id,
    inputSgstAccountId: gstInSgst!.id,
    inputIgstAccountId: gstInIgst!.id,
    tdsPayableAccountId: tdsPayable!.id,
    postingDate,
    documentDate,
    vendorInvoiceSeriesId: vendorInvoiceSeries.id,
    journalSeriesId: journalSeries!.id,
  }
}

let supplierSeq = 0
function nextSupplierNumber(): string {
  supplierSeq += 1
  return `SUP/AP4A4/${Date.now()}/${supplierSeq}`
}

function draftPayload(fx: ApPostFixture, overrides: Record<string, unknown> = {}) {
  return {
    legalEntityId: fx.legalEntityId,
    vendorId: fx.vendorId,
    invoiceType: 'EXPENSE',
    supplierInvoiceNumber: nextSupplierNumber(),
    supplierInvoiceDate: fx.documentDate,
    documentDate: fx.documentDate,
    postingDate: fx.postingDate,
    currencyCode: 'INR',
    exchangeRate: '1',
    taxTreatment: 'REGULAR',
    itcEligibility: 'ELIGIBLE',
    tdsRecognitionMode: 'NOT_APPLICABLE',
    supplyType: 'INTRA_STATE',
    companyStateCode: '27',
    vendorStateCode: '27',
    placeOfSupply: '27',
    configuration: { roundingMode: 'NONE' },
    approvalRequiredOverride: false,
    lines: [
      {
        lineNumber: 1,
        lineType: 'EXPENSE',
        description: 'Consulting expense',
        quantity: '1',
        unitPrice: '100000.0000',
        gstRate: '18',
        debitAccountId: fx.purchaseAccountId,
      },
    ],
    ...overrides,
  }
}

async function createReadyInvoice(fx: ApPostFixture, overrides: Record<string, unknown> = {}) {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send(draftPayload(fx, overrides))
  expect(created.status).toBe(201)
  const id = created.body.data.id as string
  const updatedAt = created.body.data.updatedAt as string

  const ready = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: updatedAt })
  expect(ready.status).toBe(200)
  expect(ready.body.data.status).toBe('READY_TO_POST')
  return {
    id,
    updatedAt: ready.body.data.updatedAt as string,
    detail: ready.body.data,
  }
}

async function postInvoice(fx: ApPostFixture, id: string, expectedUpdatedAt: string, token = fx.token) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${id}/post`)
    .set('Authorization', `Bearer ${token}`)
    .send({ expectedUpdatedAt })
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorInvoice.updateMany({
    where: { tenantId },
    data: { accountingVoucherId: null, postingEventId: null, approvalRequestId: null },
  }).catch(() => {})
  await prisma.vendorInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorInvoiceSourceLink.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance Phase 4A4 — AP vendor invoice posting', () => {
  let fx: ApPostFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant('ap-inv-post')
    fx = await bootstrapApPostFixture(ctx)
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('expense invoice READY→POSTED creates FOS number, voucher, GL, payable open item', async () => {
    const ready = await createReadyInvoice(fx)
    expect(ready.detail.invoiceGrandTotal).toBe('118000.0000')
    expect(ready.detail.vendorPayableAmount).toBe('118000.0000')
    expect(ready.detail.allowedActions.post).toBe(true)

    const vinBefore = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.vendorInvoiceSeriesId } }))!.currentValue
    const journalBefore = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.journalSeriesId } }))!.currentValue

    const res = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('POSTED')
    expect(res.body.data.vendorInvoiceNumber).toMatch(/^VIN-/)
    expect(res.body.data.accountingVoucherId).toBeTruthy()
    expect(res.body.data.payableOpenItemId).toBeTruthy()
    expect(res.body.data.posting.voucherNumber).toMatch(/^JO-/)
    expect(res.body.data.idempotentReplay).toBe(false)
    expect(res.body.data.vendorPayableAmount).toBe('118000.0000')
    expect(res.body.data.payableOutstandingAmount).toBe('118000.0000')

    const vinAfter = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.vendorInvoiceSeriesId } }))!.currentValue
    const journalAfter = (await prisma.financeNumberSeries.findUnique({ where: { id: fx.journalSeriesId } }))!.currentValue
    expect(vinAfter).toBe(vinBefore + 1)
    expect(journalAfter).toBe(journalBefore + 1)

    const event = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey: buildVendorInvoicePostEventKey(ready.id) },
    })
    expect(event?.status).toBe('POSTED')
    expect(event?.reservedSourceDocumentNumber).toBe(res.body.data.vendorInvoiceNumber)
    expect(event?.reservedVoucherNumber).toBe(res.body.data.accountingVoucherNumber)

    const openItem = await prisma.payableOpenItem.findFirst({
      where: { tenantId: fx.tenantId, sourceVendorInvoiceId: ready.id },
    })
    expect(openItem?.side).toBe('CREDIT')
    expect(openItem?.documentType).toBe('VENDOR_INVOICE')
    expect(openItem?.originalAmount.toString()).toBe('118000')
    expect(openItem?.outstandingAmount.toString()).toBe('118000')
    expect(openItem?.allocatedAmount.toString()).toBe('0')
    expect(openItem?.status).toBe('OPEN')

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.accountingVoucherId },
    })
    const debitByAccount = new Map<string, number>()
    const creditByAccount = new Map<string, number>()
    for (const row of gl) {
      const d = Number(row.debitAmount)
      const c = Number(row.creditAmount)
      if (d > 0) debitByAccount.set(row.accountId, (debitByAccount.get(row.accountId) ?? 0) + d)
      if (c > 0) creditByAccount.set(row.accountId, (creditByAccount.get(row.accountId) ?? 0) + c)
    }
    expect(debitByAccount.get(fx.purchaseAccountId)).toBe(100000)
    expect(debitByAccount.get(fx.inputCgstAccountId)).toBe(9000)
    expect(debitByAccount.get(fx.inputSgstAccountId)).toBe(9000)
    expect(creditByAccount.get(fx.payableAccountId)).toBe(118000)
    expect(debitByAccount.has(fx.inputIgstAccountId)).toBe(false)

    const audits = await prisma.auditLog.findMany({
      where: { tenantId: fx.tenantId, entityId: ready.id, action: 'VENDOR_INVOICE_POSTED' },
    })
    expect(audits.length).toBe(1)

    // No payment / purchase / inventory side effects
    expect(await prisma.payableOpenItem.count({ where: { tenantId: fx.tenantId, sourceVendorInvoiceId: ready.id } })).toBe(1)
  })

  it('IGST inter-state posts Input IGST only', async () => {
    const ready = await createReadyInvoice(fx, {
      supplyType: 'INTER_STATE',
      placeOfSupply: '29',
      vendorStateCode: '29',
    })
    const res = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.accountingVoucherId },
    })
    const hasCgst = gl.some((r) => r.accountId === fx.inputCgstAccountId && Number(r.debitAmount) > 0)
    const hasSgst = gl.some((r) => r.accountId === fx.inputSgstAccountId && Number(r.debitAmount) > 0)
    const igst = gl.find((r) => r.accountId === fx.inputIgstAccountId)
    expect(hasCgst).toBe(false)
    expect(hasSgst).toBe(false)
    expect(Number(igst?.debitAmount ?? 0)).toBe(18000)
  })

  it('ineligible ITC capitalises tax into expense debit', async () => {
    const ready = await createReadyInvoice(fx, { itcEligibility: 'INELIGIBLE' })
    const res = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.accountingVoucherId },
    })
    const expenseDebit = gl
      .filter((r) => r.accountId === fx.purchaseAccountId)
      .reduce((s, r) => s + Number(r.debitAmount), 0)
    const inputTaxDebit = gl
      .filter((r) => [fx.inputCgstAccountId, fx.inputSgstAccountId, fx.inputIgstAccountId].includes(r.accountId))
      .reduce((s, r) => s + Number(r.debitAmount), 0)
    expect(expenseDebit).toBe(118000)
    expect(inputTaxDebit).toBe(0)
    expect(res.body.data.vendorPayableAmount).toBe('118000.0000')
  })

  it('partial ITC splits recoverable and non-recoverable', async () => {
    const ready = await createReadyInvoice(fx, {
      itcEligibility: 'PARTIALLY_ELIGIBLE',
      itcEligiblePercent: '50',
    })
    const res = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.accountingVoucherId },
    })
    const expenseDebit = gl
      .filter((r) => r.accountId === fx.purchaseAccountId)
      .reduce((s, r) => s + Number(r.debitAmount), 0)
    const inputTaxDebit = gl
      .filter((r) => [fx.inputCgstAccountId, fx.inputSgstAccountId].includes(r.accountId))
      .reduce((s, r) => s + Number(r.debitAmount), 0)
    expect(expenseDebit).toBe(109000)
    expect(inputTaxDebit).toBe(9000)
  })

  it('TDS at invoice credits TDS payable and reduces vendor payable open item', async () => {
    const ready = await createReadyInvoice(fx, {
      tdsRecognitionMode: 'AT_INVOICE',
      tdsSectionCode: '194C',
      tdsRate: '2',
    })
    expect(Number(ready.detail.tdsAmount)).toBeGreaterThan(0)
    expect(Number(ready.detail.vendorPayableAmount)).toBe(118000 - Number(ready.detail.tdsAmount))

    const res = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.accountingVoucherId },
    })
    const tdsCredit = gl
      .filter((r) => r.accountId === fx.tdsPayableAccountId)
      .reduce((s, r) => s + Number(r.creditAmount), 0)
    const payableCredit = gl
      .filter((r) => r.accountId === fx.payableAccountId)
      .reduce((s, r) => s + Number(r.creditAmount), 0)
    expect(tdsCredit).toBe(Number(ready.detail.tdsAmount))
    expect(payableCredit).toBe(Number(ready.detail.vendorPayableAmount))
    expect(res.body.data.payableOutstandingAmount).toBe(ready.detail.vendorPayableAmount)
  })

  it('TDS at payment does not create TDS GL line', async () => {
    const ready = await createReadyInvoice(fx, {
      tdsRecognitionMode: 'AT_PAYMENT',
      tdsSectionCode: '194C',
      tdsRate: '2',
    })
    const res = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: res.body.data.accountingVoucherId },
    })
    const tdsCredit = gl
      .filter((r) => r.accountId === fx.tdsPayableAccountId)
      .reduce((s, r) => s + Number(r.creditAmount), 0)
    expect(tdsCredit).toBe(0)
    expect(res.body.data.vendorPayableAmount).toBe('118000.0000')
  })

  it('idempotent replay returns same numbers without duplicate audit', async () => {
    const ready = await createReadyInvoice(fx)
    const first = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(first.status).toBe(200)
    const second = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(second.status).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.vendorInvoiceNumber).toBe(first.body.data.vendorInvoiceNumber)
    expect(second.body.data.accountingVoucherId).toBe(first.body.data.accountingVoucherId)
    expect(second.body.data.payableOpenItemId).toBe(first.body.data.payableOpenItemId)
    const audits = await prisma.auditLog.findMany({
      where: { tenantId: fx.tenantId, entityId: ready.id, action: 'VENDOR_INVOICE_POSTED' },
    })
    expect(audits.length).toBe(1)
  })

  it('failed post after reservation leaves READY_TO_POST and retry reuses numbers', async () => {
    const ready = await createReadyInvoice(fx)
    setTestOnlyFailBeforeGl(true)
    const fail = await postInvoice(fx, ready.id, ready.updatedAt)
    setTestOnlyFailBeforeGl(false)
    expect(fail.status).toBeGreaterThanOrEqual(400)

    const invoice = await prisma.vendorInvoice.findFirst({ where: { id: ready.id, tenantId: fx.tenantId } })
    expect(invoice?.status).toBe('READY_TO_POST')
    expect(invoice?.vendorInvoiceNumber).toBeNull()
    expect(invoice?.accountingVoucherId).toBeNull()
    expect(await prisma.payableOpenItem.count({ where: { sourceVendorInvoiceId: ready.id } })).toBe(0)
    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId, sourceDocumentId: ready.id } })).toBe(0)

    const event = await prisma.postingEvent.findFirst({
      where: { tenantId: fx.tenantId, eventKey: buildVendorInvoicePostEventKey(ready.id) },
    })
    expect(event?.status).toBe('FAILED')
    expect(event?.reservedSourceDocumentNumber).toBeTruthy()
    expect(event?.reservedVoucherNumber).toBeTruthy()

    const fresh = await prisma.vendorInvoice.findFirstOrThrow({ where: { id: ready.id } })
    const retry = await postInvoice(fx, ready.id, fresh.updatedAt.toISOString())
    expect(retry.status).toBe(200)
    expect(retry.body.data.vendorInvoiceNumber).toBe(event?.reservedSourceDocumentNumber)
    expect(retry.body.data.accountingVoucherNumber).toBe(event?.reservedVoucherNumber)
  })

  it('same-document concurrency yields one posted set', async () => {
    const ready = await createReadyInvoice(fx)
    const [a, b] = await Promise.all([
      postInvoice(fx, ready.id, ready.updatedAt),
      postInvoice(fx, ready.id, ready.updatedAt),
    ])
    const statuses = [a.status, b.status]
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1)
    const success = a.status === 200 ? a : b
    expect(success.body.data.status).toBe('POSTED')
    expect(await prisma.payableOpenItem.count({ where: { sourceVendorInvoiceId: ready.id } })).toBe(1)
    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId, sourceDocumentId: ready.id } })).toBe(1)
    expect(
      await prisma.postingEvent.count({
        where: { tenantId: fx.tenantId, eventKey: buildVendorInvoicePostEventKey(ready.id), status: 'POSTED' },
      }),
    ).toBe(1)
  })

  it('DRAFT cannot post; POSTED detail exposes accounting links; posted is immutable', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    expect(created.status).toBe(201)
    const draftPost = await postInvoice(fx, created.body.data.id, created.body.data.updatedAt)
    expect(draftPost.status).toBe(422)
    expect(draftPost.body.error?.code ?? draftPost.body.code).toMatch(/NOT_READY_TO_POST/)

    const ready = await createReadyInvoice(fx)
    const posted = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(posted.status).toBe(200)

    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${ready.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.allowedActions.post).toBe(false)
    expect(detail.body.data.allowedActions.edit).toBe(false)
    expect(detail.body.data.allowedActions.cancel).toBe(false)
    expect(detail.body.data.allowedActions.viewAccounting).toBe(true)
    expect(detail.body.data.allowedActions.viewPayableOpenItem).toBe(true)
    expect(detail.body.data.payableOpenItemId).toBeTruthy()
    expect(detail.body.data.accountingVoucherNumber).toBeTruthy()

    const cancel = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${ready.id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'should fail', expectedUpdatedAt: detail.body.data.updatedAt })
    expect(cancel.status).toBe(422)
  })

  it('permission: missing post permission is 403; finance.voucher.post alone is insufficient', async () => {
    const ready = await createReadyInvoice(fx)
    const denied = await postInvoice(fx, ready.id, ready.updatedAt, fx.noPostToken)
    expect(denied.status).toBe(403)

    const ready2 = await createReadyInvoice(fx)
    const voucherOnly = await postInvoice(fx, ready2.id, ready2.updatedAt, fx.voucherPostToken)
    expect(voucherOnly.status).toBe(403)
  })

  it('supplier number preserved and distinct from FOS + voucher numbers', async () => {
    const supplierInvoiceNumber = nextSupplierNumber()
    const ready = await createReadyInvoice(fx, { supplierInvoiceNumber })
    const res = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(200)
    expect(res.body.data.supplierInvoiceNumber).toBe(supplierInvoiceNumber)
    expect(res.body.data.vendorInvoiceNumber).not.toBe(supplierInvoiceNumber)
    expect(res.body.data.accountingVoucherNumber).not.toBe(supplierInvoiceNumber)
    expect(res.body.data.accountingVoucherNumber).not.toBe(res.body.data.vendorInvoiceNumber)
  })

  it('closed period blocks posting without creating accounting', async () => {
    const ready = await createReadyInvoice(fx)
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

    const res = await postInvoice(fx, ready.id, ready.updatedAt)
    expect(res.status).toBe(422)

    const invoice = await prisma.vendorInvoice.findFirst({ where: { id: ready.id } })
    expect(invoice?.status).toBe('READY_TO_POST')
    expect(invoice?.vendorInvoiceNumber).toBeNull()
    expect(await prisma.payableOpenItem.count({ where: { sourceVendorInvoiceId: ready.id } })).toBe(0)

    await prisma.accountingPeriod.update({ where: { id: period!.id }, data: { status: 'OPEN' } })
  })

  it('approval-required pending invoice cannot post; approved can post', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx, { approvalRequiredOverride: true }))
    expect(created.status).toBe(201)

    const submitted = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${created.body.data.id}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: created.body.data.updatedAt })
    expect(submitted.status).toBe(200)
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL')

    const pendingPost = await postInvoice(fx, created.body.data.id, submitted.body.data.updatedAt)
    expect(pendingPost.status).toBe(422)

    const approved = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${created.body.data.id}/approve`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: submitted.body.data.updatedAt })
    expect(approved.status).toBe(200)
    expect(approved.body.data.status).toBe('READY_TO_POST')

    const posted = await postInvoice(fx, created.body.data.id, approved.body.data.updatedAt)
    expect(posted.status).toBe(200)
    expect(posted.body.data.status).toBe('POSTED')
  })
})
