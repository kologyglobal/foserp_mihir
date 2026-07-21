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
    await prisma.permission
      .upsert({
        where: { name },
        create: { name, module, description: name },
        update: {},
      })
      .catch(() => {})
  }
}

interface InvoiceReversalFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  noInvoiceReverseToken: string
  legalEntityId: string
  customerId: string
  bankAccountId: string
  revenueAccountId: string
  receiptDate: string
  postingDate: string
  invoiceDate: string
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

async function bootstrap(): Promise<InvoiceReversalFixture> {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `ar-inv-rev-${Date.now()}`
  const tenant = await prisma.tenant.create({
    data: { name: 'AR Invoice Reversal Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'AR',
      lastName: 'InvReverser',
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
  const token = loginRes.body.data?.accessToken ?? ''
  const ctx = { tenantId: tenant.id, slug, token }

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
      legalName: 'AR Invoice Reversal Co Pvt Ltd',
      displayName: 'AR Inv Rev Co',
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
  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years/${fyRes.body.data.id}/activate`)
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
  const bankCharge = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '5300' },
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

  await prisma.financeNumberSeries.create({
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
  await prisma.financeNumberSeries.create({
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
      companyCode: `C1-${Date.now()}`.slice(-8),
      name: 'Invoice Reversal Customer Pvt Ltd',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      state: '27',
      country: 'India',
      status: 'active',
      isActive: true,
    },
  })

  const noInvoiceReverse = await createUserWithPerms(
    ctx.tenantId,
    ctx.slug,
    FINANCE_PERMS.filter((p) => p !== 'finance.ar.invoice.reverse') as PermissionName[],
    'no-inv-reverse',
  )

  return {
    tenantId: ctx.tenantId,
    userId: user.id,
    slug: ctx.slug,
    token: ctx.token,
    noInvoiceReverseToken: noInvoiceReverse.token,
    legalEntityId,
    customerId: customer.id,
    bankAccountId: bank!.id,
    revenueAccountId: sales!.id,
    receiptDate: postingDate,
    postingDate,
    invoiceDate: postingDate,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.customerReceiptAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptAllocationBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerCreditNoteAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerCreditNoteAllocationBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptDeductionLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceipt
    .updateMany({
      where: { tenantId },
      data: { reversalVoucherId: null, accountingVoucherId: null, postingEventId: null, creditOpenItemId: null },
    })
    .catch(() => {})
  await prisma.customerReceipt.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerCreditNote
    .updateMany({
      where: { tenantId },
      data: { reversalVoucherId: null, accountingVoucherId: null, postingEventId: null, creditOpenItemId: null },
    })
    .catch(() => {})
  await prisma.customerCreditNoteLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerCreditNote.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice
    .updateMany({
      where: { tenantId },
      data: { reversalVoucherId: null, accountingVoucherId: null, postingEventId: null },
    })
    .catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
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

async function postInvoice(fx: InvoiceReversalFixture, unitRate: string): Promise<{
  invoiceId: string
  openItemId: string
  outstanding: string
  voucherId: string
  invoiceNumber: string | null
}> {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      customerId: fx.customerId,
      sourceType: 'DIRECT',
      invoiceDate: fx.invoiceDate,
      postingDate: fx.postingDate,
      placeOfSupply: '27',
      taxTreatment: 'REGISTERED',
      currencyCode: 'INR',
      lines: [
        {
          lineNumber: 1,
          description: 'Invoice reversal item',
          hsnCode: '87089990',
          quantity: '1.000000',
          unitRate,
          gstRate: '18',
          revenueAccountId: fx.revenueAccountId,
        },
      ],
    })
  expect(created.status).toBe(201)
  const invoiceId = created.body.data.id as string
  await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .expect(200)
  const posted = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(posted.status).toBe(200)
  const invoice = await prisma.salesInvoice.findUniqueOrThrow({ where: { id: invoiceId } })
  const openItem = await prisma.receivableOpenItem.findFirstOrThrow({
    where: { tenantId: fx.tenantId, salesInvoiceId: invoiceId, side: 'DEBIT' },
  })
  return {
    invoiceId,
    openItemId: openItem.id,
    outstanding: openItem.openAmount.toFixed(4),
    voucherId: invoice.accountingVoucherId as string,
    invoiceNumber: invoice.invoiceNumber,
  }
}

async function postReceipt(fx: InvoiceReversalFixture, bankCashAmount: string): Promise<{
  receiptId: string
  creditOpenItemId: string
}> {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      customerId: fx.customerId,
      sourceType: 'DIRECT',
      receiptDate: fx.receiptDate,
      postingDate: fx.postingDate,
      paymentMethod: 'BANK_TRANSFER',
      currencyCode: 'INR',
      bankCashAmount,
      bankCashAccountId: fx.bankAccountId,
      transactionReference: `TXN-${Date.now()}`,
    })
  expect(created.status).toBe(201)
  const receiptId = created.body.data.id as string
  await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .expect(200)
  const posted = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(posted.status).toBe(200)
  return {
    receiptId,
    creditOpenItemId: posted.body.data.creditOpenItemId as string,
  }
}

function allocate(
  fx: InvoiceReversalFixture,
  receiptId: string,
  allocations: Array<{ invoiceId: string; invoiceOpenItemId: string; amount: string }>,
  key: string,
) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/allocations`)
    .set('Authorization', `Bearer ${fx.token}`)
    .set('Idempotency-Key', key)
    .send({ allocationDate: fx.postingDate, allocations })
}

function reverseAllocation(fx: InvoiceReversalFixture, receiptId: string, batchId: string, reason: string, key: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/receipts/${receiptId}/allocations/${batchId}/reverse`)
    .set('Authorization', `Bearer ${fx.token}`)
    .set('Idempotency-Key', key)
    .send({ reason })
}

function reverseInvoice(fx: InvoiceReversalFixture, invoiceId: string, reason: string, key: string, token = fx.token) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/reverse`)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({ reason })
}

async function glNetByAccount(tenantId: string, voucherIds: string[]): Promise<Map<string, number>> {
  const rows = await prisma.generalLedgerEntry.groupBy({
    by: ['accountId'],
    where: { tenantId, voucherId: { in: voucherIds } },
    _sum: { baseDebitAmount: true, baseCreditAmount: true },
  })
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(r.accountId, Number(r._sum.baseDebitAmount ?? 0) - Number(r._sum.baseCreditAmount ?? 0))
  }
  return map
}

describe.skipIf(!dbAvailable)('Finance AR — sales invoice document reverse', () => {
  let fx: InvoiceReversalFixture

  beforeAll(async () => {
    await ensurePermissions()
    fx = await bootstrap()
  }, 180000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('document reverse is blocked while POSTED receipt allocations remain', async () => {
    const inv = await postInvoice(fx, '4000.0000')
    const rcpt = await postReceipt(fx, inv.outstanding)
    await allocate(
      fx,
      rcpt.receiptId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: inv.outstanding }],
      `alloc-blk-${Date.now()}`,
    )
    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${inv.invoiceId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.allowedActions.reverse).toBe(false)

    const res = await reverseInvoice(fx, inv.invoiceId, 'blocked by allocation', `rev-blk-${Date.now()}`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('SALES_INVOICE_ALLOCATIONS_MUST_BE_REVERSED')
  })

  it('full flow: allocate → reverse alloc → reverse invoice; GL nets, number kept', async () => {
    const inv = await postInvoice(fx, '7000.0000')
    const rcpt = await postReceipt(fx, inv.outstanding)
    const alloc = await allocate(
      fx,
      rcpt.receiptId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: inv.outstanding }],
      `alloc-ok-${Date.now()}`,
    )
    const batchId = alloc.body.data.batch.id as string
    await reverseAllocation(fx, rcpt.receiptId, batchId, 'undo alloc', `rev-alloc-${Date.now()}`).expect(200)

    const clearDetail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${inv.invoiceId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(clearDetail.status).toBe(200)
    expect(clearDetail.body.data.allowedActions.reverse).toBe(true)

    const res = await reverseInvoice(fx, inv.invoiceId, 'posted in error', `rev-doc-${Date.now()}`)
    expect(res.status).toBe(200)
    expect(res.body.data.idempotentReplay).toBe(false)
    expect(res.body.data.invoice.status).toBe('REVERSED')
    const reversalVoucherId = res.body.data.reversalVoucherId as string
    expect(reversalVoucherId).toBeTruthy()

    const reversalVoucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: reversalVoucherId } })
    expect(reversalVoucher.voucherType).toBe('REVERSAL')
    expect(reversalVoucher.status).toBe('POSTED')
    expect(reversalVoucher.reversalOfVoucherId).toBe(inv.voucherId)

    const originalVoucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: inv.voucherId } })
    expect(originalVoucher.status).toBe('REVERSED')
    expect(originalVoucher.reversedByVoucherId).toBe(reversalVoucherId)

    const debit = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: inv.openItemId } })
    expect(debit.status).toBe('SETTLED')
    expect(debit.openAmount.toFixed(4)).toBe('0.0000')

    const invoice = await prisma.salesInvoice.findUniqueOrThrow({ where: { id: inv.invoiceId } })
    expect(invoice.status).toBe('REVERSED')
    expect(invoice.reversalVoucherId).toBe(reversalVoucherId)
    expect(invoice.invoiceNumber).toBe(inv.invoiceNumber)

    const net = await glNetByAccount(fx.tenantId, [inv.voucherId, reversalVoucherId])
    for (const [, value] of net) {
      expect(Math.abs(value)).toBeLessThan(0.0001)
    }

    const audit = await prisma.auditLog.count({
      where: { tenantId: fx.tenantId, action: 'SALES_INVOICE_REVERSED', entityId: inv.invoiceId },
    })
    expect(audit).toBe(1)
  })

  it('document reverse is idempotent on replay', async () => {
    const inv = await postInvoice(fx, '2500.0000')
    const first = await reverseInvoice(fx, inv.invoiceId, 'duplicate invoice', `rev-idem-a-${Date.now()}`)
    expect(first.status).toBe(200)
    expect(first.body.data.idempotentReplay).toBe(false)
    const firstVoucherId = first.body.data.reversalVoucherId as string

    const second = await reverseInvoice(fx, inv.invoiceId, 'duplicate invoice', `rev-idem-b-${Date.now()}`)
    expect(second.status).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.reversalVoucherId).toBe(firstVoucherId)

    const reversalVouchers = await prisma.accountingVoucher.count({
      where: { tenantId: fx.tenantId, reversalOfVoucherId: inv.voucherId },
    })
    expect(reversalVouchers).toBe(1)
  })

  it('document reverse requires finance.ar.invoice.reverse permission', async () => {
    const inv = await postInvoice(fx, '1500.0000')
    const res = await reverseInvoice(fx, inv.invoiceId, 'no perm', `rev-perm-${Date.now()}`, fx.noInvoiceReverseToken)
    expect(res.status).toBe(403)
  })
})
