import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '../../src/config/database.js'
import { validateReceiptInput } from '../../src/modules/accounting/receivables/receipts/calculation/customer-receipt-validation-preview.service.js'
import { validateReceiptPaymentMethod } from '../../src/modules/accounting/receivables/receipts/validation/receipt-payment-method.validator.js'
import type { CustomerReceiptCalculationInput } from '../../src/modules/accounting/receivables/receipts/calculation/customer-receipt-calculation.types.js'
import { RECEIPT_ERROR_CODES, RECEIPT_WARNING_CODES } from '../../src/modules/accounting/receivables/receipts/calculation/customer-receipt-calculation.errors.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

interface ValFixture {
  tenantId: string
  legalEntityId: string
  otherLegalEntityId: string
  customerId: string
  otherCustomerId: string
  bankAccountId: string
  cashAccountId: string
  receivableAccountId: string
  tdsAccountId: string
  bankChargeAccountId: string
  otherDeductionAccountId: string
  foreignBankAccountId: string
  invoiceId: string
  debitOpenItemId: string
  invoice2Id: string
  debitOpenItem2Id: string
  closedPeriodId: string
  openPeriodId: string
  financialYearId: string
}

async function seedFixture(): Promise<ValFixture> {
  const stamp = Date.now()
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Receipt Val',
      slug: `rcpt-val-${stamp}`,
      email: `rcpt-val-${stamp}@test.com`,
      status: 'ACTIVE',
    },
  })

  const le = await prisma.legalEntity.create({
    data: {
      tenantId: tenant.id,
      code: `RVA${String(stamp).slice(-5)}`,
      legalName: 'Receipt Val Co',
      displayName: 'Receipt Val Co',
      stateCode: '27',
      isDefault: true,
    },
  })

  const otherLe = await prisma.legalEntity.create({
    data: {
      tenantId: tenant.id,
      code: `RVB${String(stamp).slice(-5)}`,
      legalName: 'Other LE',
      displayName: 'Other LE',
      stateCode: '29',
      isDefault: false,
    },
  })

  await prisma.financeSettings.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      baseCurrency: 'INR',
      financeActivated: true,
    },
  })

  const [bank, cash, receivable, tds, bankCharge, otherDed, foreignBank] = await Promise.all([
    prisma.account.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        accountCode: '1100',
        accountName: 'Bank',
        category: 'ASSET',
        accountType: 'BANK',
        isGroup: false,
        level: 1,
      },
    }),
    prisma.account.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        accountCode: '1110',
        accountName: 'Cash',
        category: 'ASSET',
        accountType: 'CASH',
        isGroup: false,
        level: 1,
      },
    }),
    prisma.account.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        accountCode: '1200',
        accountName: 'AR',
        category: 'ASSET',
        accountType: 'CUSTOMER_RECEIVABLE',
        isGroup: false,
        level: 1,
      },
    }),
    prisma.account.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        accountCode: '1250',
        accountName: 'TDS Receivable',
        category: 'ASSET',
        accountType: 'TDS_RECEIVABLE',
        isGroup: false,
        level: 1,
      },
    }),
    prisma.account.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        accountCode: '5300',
        accountName: 'Bank Charges',
        category: 'EXPENSE',
        accountType: 'EXPENSE',
        isGroup: false,
        level: 1,
      },
    }),
    prisma.account.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        accountCode: '5400',
        accountName: 'Other Deduction',
        category: 'EXPENSE',
        accountType: 'EXPENSE',
        isGroup: false,
        level: 1,
      },
    }),
    prisma.account.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: otherLe.id,
        accountCode: '1100',
        accountName: 'Other LE Bank',
        category: 'ASSET',
        accountType: 'BANK',
        isGroup: false,
        level: 1,
      },
    }),
  ])

  for (const m of [
    { mappingKey: 'CUSTOMER_RECEIVABLE' as const, accountId: receivable.id },
    { mappingKey: 'TDS_RECEIVABLE' as const, accountId: tds.id },
    { mappingKey: 'BANK_CHARGES' as const, accountId: bankCharge.id },
  ]) {
    await prisma.defaultAccountMapping.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        mappingKey: m.mappingKey,
        accountId: m.accountId,
        isMandatory: m.mappingKey === 'CUSTOMER_RECEIVABLE',
      },
    })
  }

  const fy = await prisma.financialYear.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      name: 'FY 2026-27',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      status: 'ACTIVE',
      isCurrent: true,
    },
  })

  const openPeriod = await prisma.accountingPeriod.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      financialYearId: fy.id,
      periodNumber: 3,
      name: 'Jun 2026',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      status: 'OPEN',
    },
  })

  const closedPeriod = await prisma.accountingPeriod.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      financialYearId: fy.id,
      periodNumber: 1,
      name: 'Apr 2026',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-30'),
      status: 'CLOSED',
    },
  })

  await prisma.accountingPeriod.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      financialYearId: fy.id,
      periodNumber: 2,
      name: 'May 2026',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      status: 'UNDER_REVIEW',
    },
  })

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: tenant.id,
      companyCode: `CA${String(stamp).slice(-6)}`,
      name: 'Val Customer A',
      status: 'active',
      isActive: true,
    },
  })

  const otherCustomer = await prisma.crmCompany.create({
    data: {
      tenantId: tenant.id,
      companyCode: `CB${String(stamp).slice(-6)}`,
      name: 'Val Customer B',
      status: 'active',
      isActive: true,
    },
  })

  async function createPostedInvoice(customerId: string, amount: string, number: string) {
    const invoice = await prisma.salesInvoice.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        customerId,
        customerNameSnapshot: customerId === customer.id ? customer.name : otherCustomer.name,
        invoiceNumber: number,
        status: 'POSTED',
        invoiceDate: new Date('2026-06-01'),
        postingDate: new Date('2026-06-01'),
        currencyCode: 'INR',
        totalAmount: new Prisma.Decimal(amount),
        baseTotalAmount: new Prisma.Decimal(amount),
      },
    })
    const openItem = await prisma.receivableOpenItem.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        side: 'DEBIT',
        documentType: 'SALES_INVOICE',
        documentId: invoice.id,
        documentNumberSnapshot: number,
        salesInvoiceId: invoice.id,
        customerId,
        customerNameSnapshot: invoice.customerNameSnapshot,
        receivableAccountId: receivable.id,
        currencyCode: 'INR',
        originalAmount: new Prisma.Decimal(amount),
        openAmount: new Prisma.Decimal(amount),
        baseOriginalAmount: new Prisma.Decimal(amount),
        baseOpenAmount: new Prisma.Decimal(amount),
        documentDate: new Date('2026-06-01'),
        status: 'OPEN',
      },
    })
    return { invoice, openItem }
  }

  const inv1 = await createPostedInvoice(customer.id, '100000.0000', `INV-A-${stamp}`)
  const inv2 = await createPostedInvoice(customer.id, '50000.0000', `INV-B-${stamp}`)

  return {
    tenantId: tenant.id,
    legalEntityId: le.id,
    otherLegalEntityId: otherLe.id,
    customerId: customer.id,
    otherCustomerId: otherCustomer.id,
    bankAccountId: bank.id,
    cashAccountId: cash.id,
    receivableAccountId: receivable.id,
    tdsAccountId: tds.id,
    bankChargeAccountId: bankCharge.id,
    otherDeductionAccountId: otherDed.id,
    foreignBankAccountId: foreignBank.id,
    invoiceId: inv1.invoice.id,
    debitOpenItemId: inv1.openItem.id,
    invoice2Id: inv2.invoice.id,
    debitOpenItem2Id: inv2.openItem.id,
    closedPeriodId: closedPeriod.id,
    openPeriodId: openPeriod.id,
    financialYearId: fy.id,
  }
}

async function cleanupTenant(tenantId: string) {
  const counts = {
    receipts: await prisma.customerReceipt.count({ where: { tenantId } }),
    allocations: await prisma.customerReceiptAllocation.count({ where: { tenantId } }),
    vouchers: await prisma.accountingVoucher.count({ where: { tenantId } }),
    gl: await prisma.generalLedgerEntry.count({ where: { tenantId } }),
    pe: await prisma.postingEvent.count({ where: { tenantId } }),
  }

  await prisma.customerReceiptAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceipt.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeFeatureControl.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})

  return counts
}

function baseInput(fx: ValFixture, overrides: Partial<CustomerReceiptCalculationInput> = {}): CustomerReceiptCalculationInput {
  return {
    tenantId: fx.tenantId,
    legalEntityId: fx.legalEntityId,
    customerId: fx.customerId,
    receiptDate: '2026-06-15',
    postingDate: '2026-06-15',
    paymentMethod: 'BANK_TRANSFER',
    currencyCode: 'INR',
    exchangeRate: '1',
    bankCashAmount: '100000',
    bankCashAccountId: fx.bankAccountId,
    customerReceivableAccountId: fx.receivableAccountId,
    bankReference: 'NEFT-TEST-1',
    ...overrides,
  }
}

describe('Payment method validator (unit)', () => {
  it('requires cheque instrument fields', () => {
    const bad = validateReceiptPaymentMethod({
      paymentMethod: 'CHEQUE',
      instrumentNumber: null,
      instrumentDate: null,
    })
    expect(bad.valid).toBe(false)
    expect(bad.issues.some((i) => i.code === RECEIPT_ERROR_CODES.RECEIPT_INSTRUMENT_NUMBER_REQUIRED)).toBe(true)
    expect(bad.issues.some((i) => i.code === RECEIPT_ERROR_CODES.RECEIPT_INSTRUMENT_DATE_REQUIRED)).toBe(true)
  })

  it('accepts cheque with number and date and warns clearing not tracked', () => {
    const ok = validateReceiptPaymentMethod({
      paymentMethod: 'CHEQUE',
      instrumentNumber: 'CHQ-99',
      instrumentDate: '2026-06-10',
    })
    expect(ok.valid).toBe(true)
    expect(ok.issues.some((i) => i.code === RECEIPT_WARNING_CODES.CHEQUE_CLEARING_NOT_TRACKED)).toBe(true)
  })

  it('warns on missing bank transfer reference', () => {
    const r = validateReceiptPaymentMethod({ paymentMethod: 'BANK_TRANSFER' })
    expect(r.valid).toBe(true)
    expect(r.issues.some((i) => i.code === RECEIPT_WARNING_CODES.RECEIPT_REFERENCE_MISSING)).toBe(true)
  })

  it('warns on UPI/CARD missing transaction reference', () => {
    expect(
      validateReceiptPaymentMethod({ paymentMethod: 'UPI' }).issues.some(
        (i) => i.code === RECEIPT_WARNING_CODES.RECEIPT_REFERENCE_MISSING,
      ),
    ).toBe(true)
    expect(
      validateReceiptPaymentMethod({ paymentMethod: 'CARD' }).issues.some(
        (i) => i.code === RECEIPT_WARNING_CODES.RECEIPT_REFERENCE_MISSING,
      ),
    ).toBe(true)
  })
})

describe.skipIf(!dbAvailable)('Finance Phase 3B2 — receipt validation preview', () => {
  let fx: ValFixture
  let sideEffectBaseline: {
    receipts: number
    allocations: number
    openItems: number
    invoices: number
    vouchers: number
    gl: number
    pe: number
    series: number
  }

  beforeAll(async () => {
    fx = await seedFixture()
    sideEffectBaseline = {
      receipts: await prisma.customerReceipt.count({ where: { tenantId: fx.tenantId } }),
      allocations: await prisma.customerReceiptAllocation.count({ where: { tenantId: fx.tenantId } }),
      openItems: await prisma.receivableOpenItem.count({ where: { tenantId: fx.tenantId } }),
      invoices: await prisma.salesInvoice.count({ where: { tenantId: fx.tenantId } }),
      vouchers: await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } }),
      gl: await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } }),
      pe: await prisma.postingEvent.count({ where: { tenantId: fx.tenantId } }),
      series: await prisma.financeNumberSeries.count({ where: { tenantId: fx.tenantId } }),
    }
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  }, 120_000)

  async function assertNoSideEffects() {
    expect(await prisma.customerReceipt.count({ where: { tenantId: fx.tenantId } })).toBe(sideEffectBaseline.receipts)
    expect(await prisma.customerReceiptAllocation.count({ where: { tenantId: fx.tenantId } })).toBe(
      sideEffectBaseline.allocations,
    )
    expect(await prisma.receivableOpenItem.count({ where: { tenantId: fx.tenantId } })).toBe(
      sideEffectBaseline.openItems,
    )
    const openAmounts = await prisma.receivableOpenItem.findMany({
      where: { tenantId: fx.tenantId },
      select: { openAmount: true },
    })
    for (const row of openAmounts) {
      // fixture open items stay at original seeded amounts
      expect(toDecimalString(row.openAmount)).not.toBe('0.0000')
    }
    expect(await prisma.salesInvoice.count({ where: { tenantId: fx.tenantId } })).toBe(sideEffectBaseline.invoices)
    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(sideEffectBaseline.vouchers)
    expect(await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })).toBe(sideEffectBaseline.gl)
    expect(await prisma.postingEvent.count({ where: { tenantId: fx.tenantId } })).toBe(sideEffectBaseline.pe)
    expect(await prisma.financeNumberSeries.count({ where: { tenantId: fx.tenantId } })).toBe(sideEffectBaseline.series)
  }

  function toDecimalString(v: Prisma.Decimal | string): string {
    return new Prisma.Decimal(v).toFixed(4)
  }

  it('validates simple receipt with open period and balanced posting preview', async () => {
    const preview = await validateReceiptInput(baseInput(fx), { tenantId: fx.tenantId })
    expect(preview.valid).toBe(true)
    expect(preview.calculation?.grossReceiptAmount).toBe('100000.0000')
    expect(preview.postingPreview?.balanced).toBe(true)
    expect(preview.postingPreview?.creditLines[0]?.partyType).toBe('CUSTOMER')
    expect(preview.periodReadiness.periodStatus).toBe('OPEN')
    expect(preview.accountReadiness.bankCash.valid).toBe(true)
    expect(preview.accountReadiness.customerReceivable.valid).toBe(true)
    await assertNoSideEffects()
  })

  it('rejects cross-legal-entity bank account', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, { bankCashAccountId: fx.foreignBankAccountId }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(false)
    expect(
      preview.errors.some(
        (e) =>
          e.code === RECEIPT_ERROR_CODES.RECEIPT_BANK_CASH_ACCOUNT_INVALID ||
          e.code === RECEIPT_ERROR_CODES.RECEIPT_BANK_CASH_ACCOUNT_MISSING,
      ),
    ).toBe(true)
    await assertNoSideEffects()
  })

  it('requires bank/cash account', async () => {
    const preview = await validateReceiptInput(baseInput(fx, { bankCashAccountId: null }), {
      tenantId: fx.tenantId,
    })
    expect(preview.valid).toBe(false)
    expect(preview.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_BANK_CASH_ACCOUNT_MISSING)).toBe(true)
    await assertNoSideEffects()
  })

  it('resolves TDS and bank-charge mappings when amounts > 0', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, {
        bankCashAmount: '97500',
        customerTds: { mode: 'AMOUNT', value: '2000', sectionCode: '194C' },
        bankCharges: [{ description: 'Fee', amount: '500' }],
      }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(true)
    expect(preview.accountReadiness.customerTds.valid).toBe(true)
    expect(preview.accountReadiness.customerTds.accountId).toBe(fx.tdsAccountId)
    expect(preview.accountReadiness.bankCharges.some((b) => b.valid)).toBe(true)
    expect(preview.calculation?.grossReceiptAmount).toBe('100000.0000')
    expect(preview.postingPreview?.balanced).toBe(true)
    await assertNoSideEffects()
  })

  it('blocks closed posting period', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, { receiptDate: '2026-04-15', postingDate: '2026-04-15' }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(false)
    expect(preview.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_POSTING_PERIOD_CLOSED)).toBe(true)
    await assertNoSideEffects()
  })

  it('blocks under-review posting period', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, { receiptDate: '2026-05-15', postingDate: '2026-05-15' }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(false)
    expect(preview.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_POSTING_PERIOD_UNDER_REVIEW)).toBe(true)
    await assertNoSideEffects()
  })

  it('validates allocation preview against invoice outstanding', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, {
        proposedAllocations: [
          {
            invoiceId: fx.invoiceId,
            invoiceOpenItemId: fx.debitOpenItemId,
            allocationAmount: '60000',
          },
          {
            invoiceId: fx.invoice2Id,
            invoiceOpenItemId: fx.debitOpenItem2Id,
            allocationAmount: '40000',
          },
        ],
      }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(true)
    expect(preview.allocationReadiness.validAllocationCount).toBe(2)
    expect(preview.calculation?.allocationPreview[0]?.invoiceOutstandingAfter).toBe('40000.0000')
    expect(preview.calculation?.unallocatedAmount).toBe('0.0000')
    await assertNoSideEffects()
  })

  it('rejects allocation exceeding invoice outstanding', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, {
        proposedAllocations: [
          {
            invoiceId: fx.invoiceId,
            invoiceOpenItemId: fx.debitOpenItemId,
            allocationAmount: '150000',
          },
        ],
      }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(false)
    expect(
      preview.errors.some(
        (e) =>
          e.code === RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_EXCEEDS_INVOICE ||
          e.code === RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_EXCEEDS_RECEIPT,
      ),
    ).toBe(true)
    await assertNoSideEffects()
  })

  it('rejects cross-customer allocation', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, {
        customerId: fx.otherCustomerId,
        proposedAllocations: [
          {
            invoiceId: fx.invoiceId,
            invoiceOpenItemId: fx.debitOpenItemId,
            allocationAmount: '1000',
          },
        ],
      }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(false)
    expect(preview.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_CUSTOMER_MISMATCH)).toBe(true)
    await assertNoSideEffects()
  })

  it('rejects inactive customer', async () => {
    await prisma.crmCompany.update({
      where: { id: fx.customerId },
      data: { isActive: false, status: 'inactive' },
    })
    const preview = await validateReceiptInput(baseInput(fx), { tenantId: fx.tenantId })
    expect(preview.valid).toBe(false)
    expect(preview.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_CUSTOMER_INACTIVE)).toBe(true)
    await prisma.crmCompany.update({
      where: { id: fx.customerId },
      data: { isActive: true, status: 'active' },
    })
    await assertNoSideEffects()
  })

  it('rejects multi-currency when feature disabled', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, { currencyCode: 'USD', exchangeRate: '83.5' }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(false)
    expect(preview.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_MULTI_CURRENCY_DISABLED)).toBe(true)
    expect(preview.currencyReadiness.multiCurrencyEnabled).toBe(false)
    await assertNoSideEffects()
  })

  it('returns multiple errors together and keeps warnings separate', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, {
        bankCashAmount: '0',
        bankCashAccountId: null,
        paymentMethod: 'CHEQUE',
        instrumentNumber: null,
        instrumentDate: null,
      }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(false)
    expect(preview.errors.length).toBeGreaterThanOrEqual(3)
    expect(preview.errors.every((e) => e.severity === 'ERROR')).toBe(true)
    expect(preview.warnings.every((w) => w.severity === 'WARNING')).toBe(true)
    await assertNoSideEffects()
  })

  it('valid with warnings only remains valid=true', async () => {
    const preview = await validateReceiptInput(
      baseInput(fx, {
        valueDate: '2026-06-20',
        paymentMethod: 'BANK_TRANSFER',
        bankReference: null,
        transactionReference: null,
      }),
      { tenantId: fx.tenantId },
    )
    expect(preview.valid).toBe(true)
    expect(preview.warnings.length).toBeGreaterThan(0)
    expect(preview.errors.length).toBe(0)
    await assertNoSideEffects()
  })

  it('cash payment requires cash account', async () => {
    const bad = await validateReceiptInput(
      baseInput(fx, { paymentMethod: 'CASH', bankCashAccountId: fx.bankAccountId }),
      { tenantId: fx.tenantId },
    )
    expect(bad.valid).toBe(false)
    expect(bad.errors.some((e) => e.code === RECEIPT_ERROR_CODES.RECEIPT_BANK_CASH_ACCOUNT_INVALID)).toBe(true)

    const ok = await validateReceiptInput(
      baseInput(fx, { paymentMethod: 'CASH', bankCashAccountId: fx.cashAccountId }),
      { tenantId: fx.tenantId },
    )
    expect(ok.valid).toBe(true)
    await assertNoSideEffects()
  })

  it('does not mutate open-item balances after allocation preview', async () => {
    const before = await prisma.receivableOpenItem.findUniqueOrThrow({
      where: { id: fx.debitOpenItemId },
    })
    await validateReceiptInput(
      baseInput(fx, {
        proposedAllocations: [
          {
            invoiceId: fx.invoiceId,
            invoiceOpenItemId: fx.debitOpenItemId,
            allocationAmount: '25000',
          },
        ],
      }),
      { tenantId: fx.tenantId },
    )
    const after = await prisma.receivableOpenItem.findUniqueOrThrow({
      where: { id: fx.debitOpenItemId },
    })
    expect(after.openAmount.toFixed(4)).toBe(before.openAmount.toFixed(4))
    expect(after.allocatedAmount.toFixed(4)).toBe(before.allocatedAmount.toFixed(4))
    await assertNoSideEffects()
  })
})
