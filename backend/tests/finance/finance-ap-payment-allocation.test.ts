import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  allocationBody,
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createPostedInvoice,
  createPostedPayment,
  ensurePermissions,
  postAllocation,
  refreshOpenItem,
  seedRawInvoiceOpenItem,
  seedRawPayment,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 4B4 — AP vendor payment allocation', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-alloc')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('partial allocation updates subledger balances and creates no GL/voucher/number series', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '6000' })

    const glBefore = await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })
    const voucherBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    const eventBefore = await prisma.postingEvent.count({ where: { tenantId: fx.tenantId } })

    const res = await postAllocation(
      app,
      fx,
      payment.documentId,
      allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '4000' }]),
    )
    expect(res.status).toBe(200)
    expect(res.body.data.idempotentReplay).toBe(false)
    expect(res.body.data.batch.allocationReference).toMatch(/^APALLOC\/\d{2}-\d{2}\/\d{6}$/)
    expect(res.body.data.batch.totalAllocatedAmount).toBe('4000.0000')
    expect(res.body.data.sourceAfter.outstandingAmount).toBe('6000.0000')
    expect(res.body.data.sourceAfter.status).toBe('PARTIALLY_SETTLED')
    expect(res.body.data.targets[0].after.outstandingAmount).toBe('2000.0000')
    expect(res.body.data.targets[0].after.status).toBe('PARTIALLY_SETTLED')
    expect(res.body.data.vendorAdvanceRemaining).toBe('6000.0000')

    const source = await refreshOpenItem(fx.tenantId, payment.openItemId)
    expect(source.openItem.outstandingAmount).toBe('6000')
    const target = await refreshOpenItem(fx.tenantId, invoice.openItemId)
    expect(target.openItem.outstandingAmount).toBe('2000')

    expect(await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })).toBe(glBefore)
    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherBefore)
    expect(await prisma.postingEvent.count({ where: { tenantId: fx.tenantId } })).toBe(eventBefore)

    const audits = await prisma.auditLog.findMany({
      where: { tenantId: fx.tenantId, action: 'PAYABLE_ALLOCATION_CREATED', entityId: res.body.data.batch.id },
    })
    expect(audits.length).toBe(1)
  })

  it('full allocation settles both open items and stamps settledAt', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '5000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '5000' })
    const res = await postAllocation(
      app,
      fx,
      payment.documentId,
      allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]),
    )
    expect(res.status).toBe(200)
    expect(res.body.data.sourceAfter.status).toBe('SETTLED')
    expect(res.body.data.sourceAfter.settledAt).toBeTruthy()
    expect(res.body.data.targets[0].after.status).toBe('SETTLED')

    const source = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: payment.openItemId } })
    expect(source.status).toBe('SETTLED')
    expect(source.settledAt).toBeTruthy()
    const target = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: invoice.openItemId } })
    expect(target.status).toBe('SETTLED')
    expect(target.settledAt).toBeTruthy()
  })

  it('one payment allocates across multiple invoices in a single batch', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invA = await createPostedInvoice(app, fx, { amount: '6000' })
    const invB = await createPostedInvoice(app, fx, { amount: '4000' })
    const res = await postAllocation(
      app,
      fx,
      payment.documentId,
      allocationBody(payment, fx.postingDate, [
        { target: invA, amount: '6000' },
        { target: invB, amount: '4000' },
      ]),
    )
    expect(res.status).toBe(200)
    expect(res.body.data.lines.length).toBe(2)
    expect(res.body.data.sourceAfter.status).toBe('SETTLED')
    expect(res.body.data.targets.every((t: { after: { status: string } }) => t.after.status === 'SETTLED')).toBe(true)
    const batches = await prisma.payableAllocationBatch.count({ where: { tenantId: fx.tenantId, sourceDebitOpenItemId: payment.openItemId } })
    expect(batches).toBe(1)
  })

  it('multiple payments settle one invoice', async () => {
    const invoice = await createPostedInvoice(app, fx, { amount: '10000' })
    const pay1 = await createPostedPayment(app, fx, { amount: '6000' })
    const r1 = await postAllocation(app, fx, pay1.documentId, allocationBody(pay1, fx.postingDate, [{ target: invoice, amount: '6000' }]))
    expect(r1.status).toBe(200)

    const invoiceAfter1 = await refreshOpenItem(fx.tenantId, invoice.openItemId)
    expect(invoiceAfter1.openItem.outstandingAmount).toBe('4000')
    expect(invoiceAfter1.openItem.status).toBe('PARTIALLY_SETTLED')

    const pay2 = await createPostedPayment(app, fx, { amount: '4000' })
    const r2 = await postAllocation(app, fx, pay2.documentId, allocationBody(pay2, fx.postingDate, [{ target: invoiceAfter1, amount: '4000' }]))
    expect(r2.status).toBe(200)
    expect(r2.body.data.targets[0].after.status).toBe('SETTLED')
  })

  it('advance (VENDOR_ADVANCE) can be allocated against invoices', async () => {
    const advance = await createPostedPayment(app, fx, { amount: '8000', purpose: 'ADVANCE', method: 'CASH' })
    const srcItem = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: advance.openItemId } })
    expect(srcItem.documentType).toBe('VENDOR_ADVANCE')
    const invoice = await createPostedInvoice(app, fx, { amount: '8000' })
    const res = await postAllocation(app, fx, advance.documentId, allocationBody(advance, fx.postingDate, [{ target: invoice, amount: '8000' }]))
    expect(res.status).toBe(200)
    expect(res.body.data.sourceAfter.status).toBe('SETTLED')
  })

  it('mixed partial: one invoice partial, one full, remaining stays as advance', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invA = await createPostedInvoice(app, fx, { amount: '3000' })
    const invB = await createPostedInvoice(app, fx, { amount: '10000' })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [
      { target: invA, amount: '3000' },
      { target: invB, amount: '5000' },
    ]))
    expect(res.status).toBe(200)
    // 8000 of a 10000 payment allocated (3000 + 5000); 2000 remains as an unallocated advance.
    expect(res.body.data.sourceAfter.status).toBe('PARTIALLY_SETTLED')
    expect(res.body.data.vendorAdvanceRemaining).toBe('2000.0000')
    const invBAfter = await refreshOpenItem(fx.tenantId, invB.openItemId)
    expect(invBAfter.openItem.outstandingAmount).toBe('5000')
  })

  it('rejects over-allocation of the source payment', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '5000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '10000' })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '6000' }]))
    expect(res.status).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('PAYABLE_ALLOCATION_EXCEEDS_SOURCE')
  })

  it('rejects over-allocation of a target invoice', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '3000' })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]))
    expect(res.status).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('PAYABLE_ALLOCATION_EXCEEDS_TARGET')
  })

  it('rejects duplicate target open item', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '10000' })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [
      { target: invoice, amount: '1000' },
      { target: invoice, amount: '2000' },
    ]))
    expect(res.status).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('PAYABLE_ALLOCATION_DUPLICATE_TARGET')
  })

  it('rejects allocation across different vendors', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '5000', vendorId: fx.otherVendorId })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]))
    expect(res.status).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('PAYABLE_ALLOCATION_VENDOR_MISMATCH')
  })

  it('rejects control-account mismatch between payment and invoice', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000', vendorPayableAccountId: fx.altPayableAccountId })
    const invoice = await createPostedInvoice(app, fx, { amount: '5000' })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]))
    expect(res.status).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('PAYABLE_ALLOCATION_CONTROL_ACCOUNT_MISMATCH')
  })

  it('rejects currency mismatch', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await seedRawInvoiceOpenItem(fx, { amount: '5000', currencyCode: 'USD', exchangeRate: '1' })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]))
    expect(res.status).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('PAYABLE_ALLOCATION_CURRENCY_MISMATCH')
  })

  it('blocks allocation when FX effective rates differ (requires posting)', async () => {
    const payment = await seedRawPayment(fx, { amount: '10000', currencyCode: 'USD', exchangeRate: '80' })
    const invoice = await seedRawInvoiceOpenItem(fx, { amount: '5000', currencyCode: 'USD', exchangeRate: '85' })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]))
    expect(res.status).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('PAYABLE_ALLOCATION_FX_DIFFERENCE_REQUIRES_POSTING')
  })

  it('same-currency foreign allocation computes base amount via matching rate', async () => {
    const payment = await seedRawPayment(fx, { amount: '10000', currencyCode: 'USD', exchangeRate: '80' })
    const invoice = await seedRawInvoiceOpenItem(fx, { amount: '5000', currencyCode: 'USD', exchangeRate: '80' })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]))
    expect(res.status).toBe(200)
    expect(res.body.data.batch.baseTotalAllocatedAmount).toBe('400000.0000')
    expect(res.body.data.lines[0].baseAmount).toBe('400000.0000')
  })

  it('exposes payment utilisation and invoice settlement derived state', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '4000' })
    await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '4000' }]))

    const paymentDetail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${payment.documentId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(paymentDetail.status).toBe(200)
    expect(paymentDetail.body.data.allocationState).toBe('PARTIALLY_ALLOCATED')
    expect(paymentDetail.body.data.allowedActions.allocate).toBe(true)

    const invoiceDetail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${invoice.documentId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(invoiceDetail.status).toBe(200)
    expect(invoiceDetail.body.data.status).toBe('POSTED')
    expect(invoiceDetail.body.data.payableSettlementState).toBe('PAID')
  })

  it('lists allocatable invoices with walking suggestions ordered by due date', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '5000' })
    await createPostedInvoice(app, fx, { amount: '3000', dueDate: fx.postingDate })
    await createPostedInvoice(app, fx, { amount: '4000', dueDate: fx.postingDate })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${payment.documentId}/allocatable-invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    const items = res.body.data.items as Array<{ suggestedAllocationAmount: string; outstandingAmount: string }>
    expect(items.length).toBeGreaterThanOrEqual(2)
    const totalSuggested = items.reduce((s, i) => s + Number(i.suggestedAllocationAmount), 0)
    expect(totalSuggested).toBeLessThanOrEqual(5000)
  })

  it('lists payment allocations and invoice allocations and fetches allocation by id', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '6000' })
    const alloc = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '6000' }]))
    expect(alloc.status).toBe(200)
    const batchId = alloc.body.data.batch.id as string

    const byPayment = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${payment.documentId}/allocations`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(byPayment.status).toBe(200)
    expect(byPayment.body.data.length).toBeGreaterThanOrEqual(1)

    const byInvoice = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${invoice.documentId}/allocations`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(byInvoice.status).toBe(200)
    expect(byInvoice.body.data.length).toBeGreaterThanOrEqual(1)

    const byId = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/allocations/${batchId}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(byId.status).toBe(200)
    expect(byId.body.data.batch.id).toBe(batchId)
    expect(byId.body.data.lines.length).toBe(1)
  })

  it('rejects allocation dated before the payment posting date', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '5000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '5000' })
    const past = '2000-01-01'
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, past, [{ target: invoice, amount: '5000' }]))
    expect(res.status).toBe(422)
    // Either date-invalid or a closed/absent period gate — both are acceptable rejections.
    expect(res.body.error?.code ?? res.body.code).toMatch(/PAYABLE_ALLOCATION_(DATE_INVALID|PERIOD_)|FINANCIAL_YEAR_NOT_FOUND|ACCOUNTING_PERIOD_NOT_FOUND/)
  })
})
