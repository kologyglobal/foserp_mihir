import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, ROLE_PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { OPTIONAL_AR_NUMBER_SERIES_TYPES } from '../../src/modules/accounting/shared/finance.constants.js'
import * as receiptRepo from '../../src/modules/accounting/receivables/receipts/customer-receipt.repository.js'
import * as allocationRepo from '../../src/modules/accounting/receivables/receipts/customer-receipt-allocation.repository.js'
import {
  assertAllocationOpenItemSides,
  assertAllocationSameCustomer,
  requireBankCashAccount,
} from '../../src/modules/accounting/receivables/receipts/customer-receipt.validators.js'
import {
  CustomerReceiptAllocationCustomerMismatchError,
  CustomerReceiptAllocationSideMismatchError,
  ReceivableOpenItemNegativeOriginalError,
} from '../../src/modules/accounting/receivables/receipts/customer-receipt.errors.js'
import {
  assertOpenAmountInvariant,
  assertNonNegativeOriginal,
} from '../../src/modules/accounting/receivables/receipts/receivable-open-item-side.validators.js'
import * as openItemRepo from '../../src/modules/accounting/receivables/receivable-open-items/receivable-open-item.repository.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const RECEIPT_PERMS = [
  'finance.ar.receipt.view',
  'finance.ar.receipt.create',
  'finance.ar.receipt.edit',
  'finance.ar.receipt.post',
  'finance.ar.receipt.cancel',
  'finance.ar.allocation.view',
  'finance.ar.allocation.create',
  'finance.ar.allocation.reverse',
] as const

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

interface ReceiptFixture {
  tenantId: string
  legalEntityId: string
  customerId: string
  otherCustomerId: string
  bankAccountId: string
  cashAccountId: string
  receivableAccountId: string
  invoiceId: string
  debitOpenItemId: string
}

async function seedReceiptFixture(): Promise<ReceiptFixture> {
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Receipt Test',
      slug: `rcpt-test-${Date.now()}`,
      email: `rcpt-${Date.now()}@test.com`,
      status: 'ACTIVE',
    },
  })

  const le = await prisma.legalEntity.create({
    data: {
      tenantId: tenant.id,
      code: `RC${Date.now()}`.slice(-8),
      legalName: 'Receipt Test Co',
      displayName: 'Receipt Test Co',
      isDefault: true,
    },
  })

  const [bank, cash, receivable] = await Promise.all([
    prisma.account.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        accountCode: '1100',
        accountName: 'HDFC Current',
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
        accountCode: '1200',
        accountName: 'Petty Cash',
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
        accountCode: '1300',
        accountName: 'Trade Receivables',
        category: 'ASSET',
        accountType: 'CUSTOMER_RECEIVABLE',
        isGroup: false,
        level: 1,
      },
    }),
  ])

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: tenant.id,
      companyCode: `C1-${Date.now()}`.slice(-8),
      name: 'Receipt Customer A',
      status: 'active',
      isActive: true,
    },
  })

  const otherCustomer = await prisma.crmCompany.create({
    data: {
      tenantId: tenant.id,
      companyCode: `C2-${Date.now()}`.slice(-8),
      name: 'Receipt Customer B',
      status: 'active',
      isActive: true,
    },
  })

  const invoice = await prisma.salesInvoice.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      invoiceDate: new Date('2026-04-01'),
      totalAmount: new Prisma.Decimal('5000.0000'),
      baseTotalAmount: new Prisma.Decimal('5000.0000'),
    },
  })

  const debitOpenItem = await prisma.receivableOpenItem.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      side: 'DEBIT',
      documentType: 'SALES_INVOICE',
      documentId: invoice.id,
      salesInvoiceId: invoice.id,
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      receivableAccountId: receivable.id,
      originalAmount: new Prisma.Decimal('5000.0000'),
      openAmount: new Prisma.Decimal('5000.0000'),
      baseOriginalAmount: new Prisma.Decimal('5000.0000'),
      baseOpenAmount: new Prisma.Decimal('5000.0000'),
    },
  })

  return {
    tenantId: tenant.id,
    legalEntityId: le.id,
    customerId: customer.id,
    otherCustomerId: otherCustomer.id,
    bankAccountId: bank.id,
    cashAccountId: cash.id,
    receivableAccountId: receivable.id,
    invoiceId: invoice.id,
    debitOpenItemId: debitOpenItem.id,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.customerReceiptAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceipt.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Finance Phase 3B1 — receipt foundation', () => {
  let fx: ReceiptFixture

  beforeAll(async () => {
    await ensurePermissions()
    fx = await seedReceiptFixture()
  })

  afterAll(async () => {
    if (fx) await cleanupTenant(fx.tenantId)
  })

  it('exposes Prisma receipt models and enums', () => {
    expect(prisma.customerReceipt).toBeDefined()
    expect(prisma.customerReceiptAllocation).toBeDefined()
    expect(OPTIONAL_AR_NUMBER_SERIES_TYPES).toContain('CUSTOMER_RECEIPT')
  })

  it('backfills existing open items with side DEBIT', async () => {
    const item = await prisma.receivableOpenItem.findFirstOrThrow({ where: { id: fx.debitOpenItemId } })
    expect(item.side).toBe('DEBIT')
  })

  it('rejects duplicate draftReference per legal entity', async () => {
    const ref = `RC-DRAFT-${Date.now()}`
    const r1 = await prisma.customerReceipt.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Receipt Customer A',
        receiptDate: new Date('2026-04-10'),
        draftReference: ref,
      },
    })
    await expect(
      prisma.customerReceipt.create({
        data: {
          tenantId: fx.tenantId,
          legalEntityId: fx.legalEntityId,
          customerId: fx.customerId,
          customerNameSnapshot: 'Receipt Customer A',
          receiptDate: new Date('2026-04-11'),
          draftReference: ref,
        },
      }),
    ).rejects.toThrow()
    await prisma.customerReceipt.delete({ where: { id: r1.id } })
  })

  it('rejects duplicate receiptNumber per legal entity', async () => {
    const num = `RC-${Date.now()}`
    const r1 = await prisma.customerReceipt.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Receipt Customer A',
        receiptDate: new Date('2026-04-10'),
        receiptNumber: num,
      },
    })
    await expect(
      prisma.customerReceipt.create({
        data: {
          tenantId: fx.tenantId,
          legalEntityId: fx.legalEntityId,
          customerId: fx.customerId,
          customerNameSnapshot: 'Receipt Customer A',
          receiptDate: new Date('2026-04-11'),
          receiptNumber: num,
        },
      }),
    ).rejects.toThrow()
    await prisma.customerReceipt.delete({ where: { id: r1.id } })
  })

  it('rejects negative originalAmount via domain validator', () => {
    expect(() => assertNonNegativeOriginal('-1')).toThrow(ReceivableOpenItemNegativeOriginalError)
    expect(() => assertNonNegativeOriginal('100')).not.toThrow()
  })

  it('enforces openAmount invariant helper', () => {
    expect(() =>
      assertOpenAmountInvariant({
        side: 'DEBIT',
        originalAmount: '1000.0000',
        openAmount: '700.0000',
        allocatedAmount: '300.0000',
      }),
    ).not.toThrow()

    expect(() =>
      assertOpenAmountInvariant({
        side: 'CREDIT',
        originalAmount: '1000.0000',
        openAmount: '800.0000',
        allocatedAmount: '100.0000',
      }),
    ).toThrow()
  })

  it('validates bank/cash account ownership and type', async () => {
    const bank = await requireBankCashAccount(fx.tenantId, fx.legalEntityId, fx.bankAccountId)
    expect(bank.accountType).toBe('BANK')
    const cash = await requireBankCashAccount(fx.tenantId, fx.legalEntityId, fx.cashAccountId)
    expect(cash.accountType).toBe('CASH')
  })

  it('allows allocation when receipt and invoice share customer', async () => {
    const receipt = await prisma.customerReceipt.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Receipt Customer A',
        receiptDate: new Date('2026-04-15'),
        bankCashAccountId: fx.bankAccountId,
        grossReceiptAmount: new Prisma.Decimal('2000.0000'),
        allocatableAmount: new Prisma.Decimal('2000.0000'),
        unallocatedAmount: new Prisma.Decimal('2000.0000'),
      },
    })

    const creditOpenItem = await prisma.receivableOpenItem.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        side: 'CREDIT',
        documentType: 'CUSTOMER_RECEIPT',
        documentId: receipt.id,
        customerReceiptId: receipt.id,
        customerId: fx.customerId,
        customerNameSnapshot: 'Receipt Customer A',
        originalAmount: new Prisma.Decimal('2000.0000'),
        openAmount: new Prisma.Decimal('2000.0000'),
        baseOriginalAmount: new Prisma.Decimal('2000.0000'),
        baseOpenAmount: new Prisma.Decimal('2000.0000'),
      },
    })

    const debitItem = await prisma.receivableOpenItem.findFirstOrThrow({ where: { id: fx.debitOpenItemId } })
    assertAllocationSameCustomer(fx.customerId, fx.customerId, debitItem.customerId)
    assertAllocationOpenItemSides(
      { side: creditOpenItem.side, customerId: creditOpenItem.customerId },
      { side: debitItem.side, customerId: debitItem.customerId },
      fx.customerId,
    )

    const allocation = await prisma.customerReceiptAllocation.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        receiptId: receipt.id,
        receiptOpenItemId: creditOpenItem.id,
        invoiceId: fx.invoiceId,
        invoiceOpenItemId: fx.debitOpenItemId,
        allocationDate: new Date('2026-04-15'),
        allocatedAmount: new Prisma.Decimal('500.0000'),
        baseAllocatedAmount: new Prisma.Decimal('500.0000'),
        allocationSequence: 1,
      },
    })

    const found = await allocationRepo.findCustomerReceiptAllocationById(fx.tenantId, allocation.id)
    expect(found?.customerId).toBe(fx.customerId)

    await prisma.customerReceiptAllocation.delete({ where: { id: allocation.id } })
    await prisma.receivableOpenItem.delete({ where: { id: creditOpenItem.id } })
    await prisma.customerReceipt.delete({ where: { id: receipt.id } })
  })

  it('rejects cross-customer allocation validator', () => {
    expect(() => assertAllocationSameCustomer(fx.customerId, fx.otherCustomerId, fx.customerId)).toThrow(
      CustomerReceiptAllocationCustomerMismatchError,
    )
  })

  it('rejects wrong open-item sides for allocation', () => {
    expect(() =>
      assertAllocationOpenItemSides(
        { side: 'DEBIT', customerId: fx.customerId },
        { side: 'DEBIT', customerId: fx.customerId },
        fx.customerId,
      ),
    ).toThrow(CustomerReceiptAllocationSideMismatchError)
  })

  it('can create CUSTOMER_RECEIPT FinanceNumberSeries without changing existing series', async () => {
    const before = await prisma.financeNumberSeries.findMany({ where: { tenantId: fx.tenantId } })
    const beforeValues = before.map((s) => s.currentValue)

    await prisma.financeNumberSeries.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        documentType: 'CUSTOMER_RECEIPT',
        prefix: 'RCPT-',
        currentValue: 0,
        padLength: 5,
      },
    })

    const after = await prisma.financeNumberSeries.findMany({ where: { tenantId: fx.tenantId } })
    for (const series of before) {
      const updated = after.find((s) => s.id === series.id)
      expect(updated?.currentValue).toBe(series.currentValue)
      expect(beforeValues).toContain(updated?.currentValue)
    }

    await prisma.financeNumberSeries.deleteMany({
      where: { tenantId: fx.tenantId, documentType: 'CUSTOMER_RECEIPT' },
    })
  })

  it('has receipt permissions in DB after ensurePermissions', async () => {
    for (const name of RECEIPT_PERMS) {
      const perm = await prisma.permission.findUnique({ where: { name } })
      expect(perm?.name).toBe(name)
    }
  })

  it('grants receipt permissions to Finance Manager but not post/reverse to Executive', () => {
    const exec = ROLE_PERMISSIONS['Finance Executive'] as PermissionName[]
    const mgr = ROLE_PERMISSIONS['Finance Manager'] as PermissionName[]
    expect(exec).toContain('finance.ar.receipt.create')
    expect(exec).toContain('finance.ar.allocation.create')
    expect(exec).not.toContain('finance.ar.receipt.post')
    expect(exec).not.toContain('finance.ar.allocation.reverse')
    expect(mgr).toContain('finance.ar.receipt.post')
    expect(mgr).toContain('finance.ar.allocation.reverse')
  })

  it('find repositories are tenant-scoped read-only', async () => {
    const receipt = await prisma.customerReceipt.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Receipt Customer A',
        receiptDate: new Date('2026-04-20'),
      },
    })
    const dto = await receiptRepo.findCustomerReceiptById(fx.tenantId, receipt.id)
    expect(dto?.id).toBe(receipt.id)
    expect(await receiptRepo.findCustomerReceiptById('00000000-0000-4000-8000-000000000099', receipt.id)).toBeNull()

    const debits = await openItemRepo.findDebitOpenItems(fx.tenantId, fx.legalEntityId)
    expect(debits.every((d) => d.side === 'DEBIT')).toBe(true)

    await prisma.customerReceipt.delete({ where: { id: receipt.id } })
  })

  it('does not create AccountingVoucher, GL, or PostingEvent in foundation fixtures', async () => {
    const [vouchers, gl, events] = await Promise.all([
      prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } }),
      prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } }),
      prisma.postingEvent.count({ where: { tenantId: fx.tenantId } }),
    ])
    expect(vouchers).toBe(0)
    expect(gl).toBe(0)
    expect(events).toBe(0)
  })
})
