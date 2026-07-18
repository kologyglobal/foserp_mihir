import { Prisma } from '@prisma/client'
import type { Request } from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../src/config/database.js'
import { buildCustomerCreditNotePostingRequest } from '../../src/modules/accounting/receivables/credit-notes/posting/customer-credit-note-accounting-builder.service.js'
import { buildCustomerCreditNotePostEventKey } from '../../src/modules/accounting/receivables/credit-notes/posting/customer-credit-note-posting.types.js'
import { postCustomerCreditNote, postCustomerCreditNoteFromRequest } from '../../src/modules/accounting/receivables/credit-notes/posting/customer-credit-note-posting.service.js'
import type { CustomerCreditNoteWithLines } from '../../src/modules/accounting/receivables/credit-notes/customer-credit-note.types.js'

const d = (value: string) => new Prisma.Decimal(value)

function creditNote(): CustomerCreditNoteWithLines {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant',
    legalEntityId: 'legal-entity',
    branchId: null,
    financialYearId: null,
    creditNoteNumber: null,
    draftReference: 'CN-DRAFT-1',
    status: 'READY_TO_POST',
    purpose: 'SALES_RETURN',
    reasonId: null,
    reasonCodeSnapshot: null,
    reasonNameSnapshot: null,
    sourceType: 'SALES_INVOICE',
    originalInvoiceId: 'invoice',
    originalInvoiceNumberSnapshot: 'INV-1',
    customerId: 'customer',
    customerCodeSnapshot: 'C1',
    customerNameSnapshot: 'Customer',
    customerGstinSnapshot: null,
    customerPanSnapshot: null,
    customerStateCodeSnapshot: '27',
    customerBillingAddressSnapshot: null,
    creditNoteDate: new Date('2026-07-18'),
    postingDate: new Date('2026-07-18'),
    supplyType: 'INTRA_STATE',
    taxTreatment: 'REGISTERED',
    currencyCode: 'INR',
    exchangeRate: d('1'),
    calculationContext: null,
    taxableAmount: d('100'),
    cgstAmount: d('9'),
    sgstAmount: d('9'),
    igstAmount: d('0'),
    cessAmount: d('0'),
    totalTaxAmount: d('18'),
    discountAmount: d('0'),
    freightAmount: d('0'),
    otherChargesAmount: d('0'),
    roundOffAmount: d('0'),
    grandTotal: d('118'),
    baseTaxableAmount: d('100'),
    baseCgstAmount: d('9'),
    baseSgstAmount: d('9'),
    baseIgstAmount: d('0'),
    baseCessAmount: d('0'),
    baseTotalTaxAmount: d('18'),
    baseDiscountAmount: d('0'),
    baseFreightAmount: d('0'),
    baseOtherChargesAmount: d('0'),
    baseRoundOffAmount: d('0'),
    baseGrandTotal: d('118'),
    inventoryReturnRequired: false,
    inventoryReturnMetadata: null,
    approvalRequired: false,
    approvalRequestId: null,
    accountingVoucherId: null,
    postingEventId: null,
    creditOpenItemId: null,
    postedAt: null,
    postedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [{
      id: 'line', tenantId: 'tenant', legalEntityId: 'legal-entity',
      customerCreditNoteId: '11111111-1111-4111-8111-111111111111', lineNumber: 1,
      originalInvoiceLineId: 'invoice-line', itemId: null, itemCodeSnapshot: null,
      itemNameSnapshot: 'Item', hsnCodeSnapshot: null, uomSnapshot: null, description: 'Return',
      adjustmentMode: 'FULL_LINE', quantity: d('1'), unitRate: d('100'), revisedUnitRate: null,
      grossAmount: d('100'), discountAmount: d('0'), taxableAmount: d('100'),
      cgstRate: d('9'), cgstAmount: d('9'), sgstRate: d('9'), sgstAmount: d('9'),
      igstRate: d('0'), igstAmount: d('0'), cessRate: d('0'), cessAmount: d('0'),
      lineTotal: d('118'), revenueReversalAccountId: 'revenue', costCentreId: null,
      createdAt: new Date(), updatedAt: new Date(),
    }],
  }
}

describe('Finance Phase 3C4 — customer credit note posting', () => {
  it('builds the inverse invoice entry and balances the voucher', () => {
    const request = buildCustomerCreditNotePostingRequest(creditNote(), 'receivable')
    expect(request.voucherType).toBe('CREDIT_NOTE')
    expect(request.eventKey).toBe(buildCustomerCreditNotePostEventKey(creditNote().id))
    expect(request.lines.find((line) => line.accountId === 'revenue')?.debitAmount).toBe('100.0000')
    expect(request.lines.find((line) => line.accountId === 'receivable')?.creditAmount).toBe('118.0000')
    const debit = request.lines.reduce((sum, line) => sum.add(line.debitAmount), d('0'))
    const credit = request.lines.reduce((sum, line) => sum.add(line.creditAmount), d('0'))
    expect(debit.equals(credit)).toBe(true)
  })
})

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 3C4 — atomic customer credit note posting', () => {
  let tenantId = ''
  let legalEntityId = ''
  let invoiceId = ''
  let invoiceLineId = ''
  let invoiceOpenItemId = ''
  let noteId = ''
  let customerId = ''
  let revenueAccountId = ''
  let financialYearId = ''
  const userId = 'credit-note-test-user'
  const req = {
    context: { userId, permissions: ['finance.ar.credit_note.post', 'finance.voucher.view'] },
  } as unknown as Request

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Credit Note Posting Test', slug: `cn-post-${suffix}`, email: `cn-${suffix}@test.local`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
    const legalEntity = await prisma.legalEntity.create({
      data: {
        tenantId, code: `CN${suffix}`.slice(-20), legalName: 'Credit Note Test Pvt Ltd',
        displayName: 'Credit Note Test', stateCode: '27', isActive: true,
      },
    })
    legalEntityId = legalEntity.id
    const year = await prisma.financialYear.create({
      data: {
        tenantId, legalEntityId, name: `CN FY ${suffix}`, startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'), status: 'ACTIVE', isCurrent: true,
      },
    })
    financialYearId = year.id
    await prisma.accountingPeriod.create({
      data: {
        tenantId, legalEntityId, financialYearId: year.id, periodNumber: 4, name: 'July 2026',
        startDate: new Date('2026-07-01'), endDate: new Date('2026-07-31'), status: 'OPEN',
      },
    })
    await prisma.financeSettings.create({
      data: { tenantId, legalEntityId, financeActivated: true, activatedAt: new Date(), activatedBy: userId },
    })
    const receivable = await prisma.account.create({
      data: {
        tenantId, legalEntityId, accountCode: '110000', accountName: 'Customer Receivable',
        category: 'ASSET', accountType: 'CUSTOMER_RECEIVABLE', normalBalance: 'DEBIT',
        isControlAccount: true, requiresParty: true,
      },
    })
    const revenue = await prisma.account.create({
      data: {
        tenantId, legalEntityId, accountCode: '410000', accountName: 'Sales Revenue',
        category: 'INCOME', accountType: 'SALES', normalBalance: 'CREDIT',
      },
    })
    revenueAccountId = revenue.id
    await prisma.defaultAccountMapping.create({
      data: { tenantId, legalEntityId, mappingKey: 'CUSTOMER_RECEIVABLE', accountId: receivable.id },
    })
    await prisma.financeNumberSeries.createMany({
      data: [
        { tenantId, legalEntityId, financialYearId: year.id, documentType: 'CREDIT_NOTE', prefix: 'CNV-', padLength: 5 },
        { tenantId, legalEntityId, financialYearId: year.id, documentType: 'CUSTOMER_CREDIT_NOTE', prefix: 'CN-', padLength: 5 },
      ],
    })
    const customer = await prisma.crmCompany.create({
      data: { tenantId, companyCode: 'CUST-CN', name: 'Credit Note Customer', status: 'active', isActive: true },
    })
    customerId = customer.id
    const invoice = await prisma.salesInvoice.create({
      data: {
        tenantId, legalEntityId, financialYearId: year.id, invoiceNumber: `INV-${suffix}`, status: 'POSTED',
        customerId: customer.id, customerNameSnapshot: customer.name, invoiceDate: new Date('2026-07-18'),
        postingDate: new Date('2026-07-18'), supplyType: 'INTRA_STATE', taxTreatment: 'REGISTERED',
        taxableAmount: d('100'), totalAmount: d('100'), baseTaxableAmount: d('100'), baseTotalAmount: d('100'),
        postedAt: new Date(), postedBy: userId,
      },
    })
    invoiceId = invoice.id
    const invoiceLine = await prisma.salesInvoiceLine.create({
      data: {
        tenantId, legalEntityId, salesInvoiceId: invoice.id, lineNumber: 1, itemNameSnapshot: 'Test Item',
        description: 'Test Item', quantity: d('10'), unitRate: d('10'), grossAmount: d('100'),
        taxableAmount: d('100'), lineTotal: d('100'), revenueAccountId: revenue.id,
      },
    })
    invoiceLineId = invoiceLine.id
    const debitOpenItem = await prisma.receivableOpenItem.create({
      data: {
        tenantId, legalEntityId, side: 'DEBIT', documentType: 'SALES_INVOICE', documentId: invoice.id,
        documentNumberSnapshot: invoice.invoiceNumber, salesInvoiceId: invoice.id, customerId: customer.id,
        customerNameSnapshot: customer.name, receivableAccountId: receivable.id,
        originalAmount: d('100'), openAmount: d('100'), baseOriginalAmount: d('100'), baseOpenAmount: d('100'),
        documentDate: invoice.invoiceDate, status: 'OPEN',
      },
    })
    invoiceOpenItemId = debitOpenItem.id
    const context = {
      legalEntityId, purpose: 'SALES_RETURN', sourceType: 'SALES_INVOICE',
      originalInvoiceId: invoice.id, customerId: customer.id, creditNoteDate: '2026-07-18',
      postingDate: '2026-07-18', currencyCode: 'INR', exchangeRate: '1',
      freightAmount: '0', otherChargesAmount: '0', roundOffAmount: '0',
      inventoryReturnRequired: false, approvalRequired: false,
      lines: [{ lineNumber: 1, originalInvoiceLineId: invoiceLine.id, adjustmentMode: 'QUANTITY', quantity: '2' }],
    }
    const note = await prisma.customerCreditNote.create({
      data: {
        tenantId, legalEntityId, financialYearId: year.id, draftReference: `CN-DRAFT-${suffix}`,
        status: 'READY_TO_POST', purpose: 'SALES_RETURN', sourceType: 'SALES_INVOICE',
        originalInvoiceId: invoice.id, originalInvoiceNumberSnapshot: invoice.invoiceNumber,
        customerId: customer.id, customerNameSnapshot: customer.name, creditNoteDate: new Date('2026-07-18'),
        postingDate: new Date('2026-07-18'), supplyType: 'INTRA_STATE', taxTreatment: 'REGISTERED',
        calculationContext: context, taxableAmount: d('20'), grandTotal: d('20'),
        baseTaxableAmount: d('20'), baseGrandTotal: d('20'),
      },
    })
    noteId = note.id
    await prisma.customerCreditNoteLine.create({
      data: {
        tenantId, legalEntityId, customerCreditNoteId: note.id, lineNumber: 1,
        originalInvoiceLineId: invoiceLine.id, itemNameSnapshot: 'Test Item', description: 'Test Item',
        adjustmentMode: 'QUANTITY', quantity: d('2'), unitRate: d('10'), grossAmount: d('20'),
        taxableAmount: d('20'), lineTotal: d('20'), revenueReversalAccountId: revenue.id,
      },
    })
  })

  async function createReadyNote(quantity: string, status: 'DRAFT' | 'READY_TO_POST' = 'READY_TO_POST') {
    const amount = d(quantity).mul(10)
    const suffix = crypto.randomUUID().slice(0, 8)
    const context = {
      legalEntityId, purpose: 'SALES_RETURN', sourceType: 'SALES_INVOICE',
      originalInvoiceId: invoiceId, customerId, creditNoteDate: '2026-07-18',
      postingDate: '2026-07-18', currencyCode: 'INR', exchangeRate: '1',
      freightAmount: '0', otherChargesAmount: '0', roundOffAmount: '0',
      inventoryReturnRequired: false, approvalRequired: false,
      lines: [{ lineNumber: 1, originalInvoiceLineId: invoiceLineId, adjustmentMode: 'QUANTITY', quantity }],
    }
    const note = await prisma.customerCreditNote.create({
      data: {
        tenantId, legalEntityId, financialYearId, draftReference: `CN-DRAFT-${suffix}`,
        status, purpose: 'SALES_RETURN', sourceType: 'SALES_INVOICE',
        originalInvoiceId: invoiceId, originalInvoiceNumberSnapshot: 'INV',
        customerId, customerNameSnapshot: 'Credit Note Customer', creditNoteDate: new Date('2026-07-18'),
        postingDate: new Date('2026-07-18'), supplyType: 'INTRA_STATE', taxTreatment: 'REGISTERED',
        calculationContext: context, taxableAmount: amount, grandTotal: amount,
        baseTaxableAmount: amount, baseGrandTotal: amount,
      },
    })
    await prisma.customerCreditNoteLine.create({
      data: {
        tenantId, legalEntityId, customerCreditNoteId: note.id, lineNumber: 1,
        originalInvoiceLineId: invoiceLineId, itemNameSnapshot: 'Test Item', description: 'Test Item',
        adjustmentMode: 'QUANTITY', quantity: d(quantity), unitRate: d('10'), grossAmount: amount,
        taxableAmount: amount, lineTotal: amount, revenueReversalAccountId: revenueAccountId,
      },
    })
    return note.id
  }

  afterAll(async () => {
    if (!tenantId) return
    await prisma.auditLog.deleteMany({ where: { tenantId } })
    await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } })
    await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } })
    await prisma.receivableOpenItem.deleteMany({ where: { tenantId } })
    await prisma.customerCreditNoteLine.deleteMany({ where: { tenantId } })
    await prisma.customerCreditNote.deleteMany({ where: { tenantId } })
    await prisma.postingEvent.deleteMany({ where: { tenantId } })
    await prisma.accountingVoucher.deleteMany({ where: { tenantId } })
    await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } })
    await prisma.salesInvoice.deleteMany({ where: { tenantId } })
    await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } })
    await prisma.financeNumberSeries.deleteMany({ where: { tenantId } })
    await prisma.account.deleteMany({ where: { tenantId } })
    await prisma.accountingPeriod.deleteMany({ where: { tenantId } })
    await prisma.financialYear.deleteMany({ where: { tenantId } })
    await prisma.financeSettings.deleteMany({ where: { tenantId } })
    await prisma.crmCompany.deleteMany({ where: { tenantId } })
    await prisma.legalEntity.deleteMany({ where: { tenantId } })
    await prisma.tenant.delete({ where: { id: tenantId } })
  })

  it('posts once, replays idempotently, and leaves invoice outstanding unchanged', async () => {
    const first = await postCustomerCreditNote({ tenantId, creditNoteId: noteId, userId }, req)
    const replay = await postCustomerCreditNote({ tenantId, creditNoteId: noteId, userId }, req)
    expect(first.idempotentReplay).toBe(false)
    expect(replay.idempotentReplay).toBe(true)
    expect(first.posting.voucherStatus).toBe('POSTED')
    const note = await prisma.customerCreditNote.findUniqueOrThrow({ where: { id: noteId } })
    expect(note.status).toBe('POSTED')
    expect(note.creditNoteNumber).toMatch(/^CN-/)
    const creditItems = await prisma.receivableOpenItem.findMany({ where: { tenantId, customerCreditNoteId: noteId } })
    expect(creditItems).toHaveLength(1)
    expect(creditItems[0]?.side).toBe('CREDIT')
    expect(creditItems[0]?.openAmount.toString()).toBe('20')
    const debitItem = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: invoiceOpenItemId } })
    expect(debitItem.openAmount.toString()).toBe('100')
    expect(await prisma.customerReceiptAllocation.count({ where: { tenantId, invoiceId } })).toBe(0)
    const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: note.accountingVoucherId! } })
    expect(voucher.totalDebit.equals(voucher.totalCredit)).toBe(true)
  })

  it('rejects a draft note and over-crediting after an earlier posted note', async () => {
    const draftId = await createReadyNote('1', 'DRAFT')
    await expect(postCustomerCreditNote({ tenantId, creditNoteId: draftId, userId }, req))
      .rejects.toMatchObject({ code: 'CUSTOMER_CREDIT_NOTE_NOT_READY' })
    const excessiveId = await createReadyNote('9')
    await expect(postCustomerCreditNote({ tenantId, creditNoteId: excessiveId, userId }, req))
      .rejects.toMatchObject({ code: 'CUSTOMER_CREDIT_NOTE_VALIDATION_FAILED' })
  })

  it('handles concurrent post attempts without duplicate voucher or open item', async () => {
    const concurrentId = await createReadyNote('1')
    const results = await Promise.allSettled([
      postCustomerCreditNote({ tenantId, creditNoteId: concurrentId, userId }, req),
      postCustomerCreditNote({ tenantId, creditNoteId: concurrentId, userId }, req),
    ])
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true)
    const note = await prisma.customerCreditNote.findUniqueOrThrow({ where: { id: concurrentId } })
    expect(await prisma.accountingVoucher.count({ where: { tenantId, sourceDocumentId: concurrentId } })).toBe(1)
    expect(await prisma.receivableOpenItem.count({ where: { tenantId, customerCreditNoteId: concurrentId } })).toBe(1)
    expect(note.status).toBe('POSTED')
  })

  it('requires finance.ar.credit_note.post permission at the request boundary', async () => {
    const denied = { context: { userId, permissions: [] } } as unknown as Request
    await expect(postCustomerCreditNoteFromRequest(denied, tenantId, noteId))
      .rejects.toMatchObject({ statusCode: 403, code: 'CUSTOMER_CREDIT_NOTE_POSTING_NOT_ALLOWED' })
  })
})
