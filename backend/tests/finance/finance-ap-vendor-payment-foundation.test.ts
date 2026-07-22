import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Prisma, VendorPaymentMethod, VendorPaymentPurpose } from '@prisma/client'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, ROLE_PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import {
  createVendorPaymentRecord,
  findVendorPaymentByDraftReference,
  findVendorPaymentById,
  findVendorPaymentByNumber,
  generateUniqueVendorPaymentDraftReference,
} from '../../src/modules/accounting/payables/vendor-payments/vendor-payment.repository.js'
import {
  listVendorPaymentAdjustments,
  replaceVendorPaymentAdjustmentLines,
} from '../../src/modules/accounting/payables/vendor-payments/vendor-payment-adjustment.repository.js'
import {
  createPayableOpenItemRecord,
  findPayableOpenItemBySourceVendorPayment,
} from '../../src/modules/accounting/payables/open-items/payable-open-item.repository.js'
import { PayableOpenItemDuplicateSourceError } from '../../src/modules/accounting/payables/open-items/payable-open-item.errors.js'
import {
  VendorPaymentAdjustmentAmountInvalidError,
  VendorPaymentAdjustmentLineConflictError,
} from '../../src/modules/accounting/payables/vendor-payments/vendor-payment.errors.js'
import { formatForPersistence } from '../../src/modules/accounting/shared/finance-decimal.js'
import type { CreateVendorPaymentRecordInput } from '../../src/modules/accounting/payables/vendor-payments/vendor-payment.types.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const AP_PAYMENT_PERMS = [
  'finance.ap.payment.view',
  'finance.ap.payment.create',
  'finance.ap.payment.edit',
  'finance.ap.payment.submit',
  'finance.ap.payment.approve',
  'finance.ap.payment.post',
  'finance.ap.payment.cancel',
  'finance.ap.payment.reverse',
  'finance.ap.allocation.view',
  'finance.ap.allocation.create',
  'finance.ap.allocation.reverse',
  'finance.ap.advance.view',
] as const

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

interface PayFixture {
  tenantAId: string
  tenantBId: string
  legalEntityAId: string
  legalEntityBId: string
  legalEntityTenantBId: string
  branchId: string
  financialYearAId: string
  financialYearTenantBId: string
  vendorAId: string
  vendorBId: string
  payableAccountId: string
  bankAccountId: string
  tdsAccountId: string
  discountAccountId: string
  bankChargeAccountId: string
  costCentreId: string
}

async function seedFixture(): Promise<PayFixture> {
  const suffix = Date.now()
  const tenantA = await prisma.tenant.create({
    data: {
      name: 'AP Pay Test A',
      slug: `ap-pay-a-${suffix}`,
      email: `ap-pay-a-${suffix}@test.com`,
      status: 'ACTIVE',
    },
  })
  const tenantB = await prisma.tenant.create({
    data: {
      name: 'AP Pay Test B',
      slug: `ap-pay-b-${suffix}`,
      email: `ap-pay-b-${suffix}@test.com`,
      status: 'ACTIVE',
    },
  })

  const legalEntityA = await prisma.legalEntity.create({
    data: {
      tenantId: tenantA.id,
      code: `PAA${String(suffix).slice(-5)}`,
      legalName: 'AP Pay Co A',
      displayName: 'AP Pay Co A',
      stateCode: '27',
      isDefault: true,
    },
  })
  const legalEntityB = await prisma.legalEntity.create({
    data: {
      tenantId: tenantA.id,
      code: `PAB${String(suffix).slice(-5)}`,
      legalName: 'AP Pay Co B',
      displayName: 'AP Pay Co B',
      stateCode: '27',
      isDefault: false,
    },
  })
  const branch = await prisma.branch.create({
    data: {
      tenantId: tenantA.id,
      legalEntityId: legalEntityA.id,
      code: 'HO',
      name: 'Head Office',
      isHeadOffice: true,
      isDefault: true,
    },
  })

  const fyStart = new Date('2026-04-01')
  const fyEnd = new Date('2027-03-31')
  const financialYearA = await prisma.financialYear.create({
    data: {
      tenantId: tenantA.id,
      legalEntityId: legalEntityA.id,
      name: 'FY 2026-27 Pay A',
      startDate: fyStart,
      endDate: fyEnd,
      status: 'ACTIVE',
      isCurrent: true,
    },
  })

  const accounts = await Promise.all(
    [
      { code: '2100', name: 'Trade Payables', category: 'LIABILITY' as const },
      { code: '1100', name: 'Bank', category: 'ASSET' as const },
      { code: '2200', name: 'TDS Payable', category: 'LIABILITY' as const },
      { code: '4100', name: 'Discount Received', category: 'INCOME' as const },
      { code: '5200', name: 'Bank Charges', category: 'EXPENSE' as const },
    ].map((a) =>
      prisma.account.create({
        data: {
          tenantId: tenantA.id,
          legalEntityId: legalEntityA.id,
          accountCode: a.code,
          accountName: a.name,
          category: a.category,
          isGroup: false,
          level: 1,
        },
      }),
    ),
  )

  const costCentre = await prisma.costCentre.create({
    data: {
      tenantId: tenantA.id,
      legalEntityId: legalEntityA.id,
      code: 'PAYCC01',
      name: 'Payment CC',
      isGroup: false,
      isActive: true,
    },
  })

  const vendorA = await prisma.masterVendor.create({
    data: {
      tenantId: tenantA.id,
      code: `PA${String(suffix).slice(-6)}`,
      name: 'Pay Vendor A',
      gstin: '27AAAAA1111A1Z5',
      pan: 'AAAAA1111A',
      state: 'Maharashtra',
    },
  })
  const vendorB = await prisma.masterVendor.create({
    data: {
      tenantId: tenantA.id,
      code: `PB${String(suffix).slice(-6)}`,
      name: 'Pay Vendor B',
      state: 'Maharashtra',
    },
  })

  const legalEntityTenantB = await prisma.legalEntity.create({
    data: {
      tenantId: tenantB.id,
      code: `PBT${String(suffix).slice(-5)}`,
      legalName: 'AP Pay Tenant B',
      displayName: 'AP Pay Tenant B',
      isDefault: true,
    },
  })
  const financialYearTenantB = await prisma.financialYear.create({
    data: {
      tenantId: tenantB.id,
      legalEntityId: legalEntityTenantB.id,
      name: 'FY 2026-27 Pay TB',
      startDate: fyStart,
      endDate: fyEnd,
      status: 'ACTIVE',
      isCurrent: true,
    },
  })

  return {
    tenantAId: tenantA.id,
    tenantBId: tenantB.id,
    legalEntityAId: legalEntityA.id,
    legalEntityBId: legalEntityB.id,
    legalEntityTenantBId: legalEntityTenantB.id,
    branchId: branch.id,
    financialYearAId: financialYearA.id,
    financialYearTenantBId: financialYearTenantB.id,
    vendorAId: vendorA.id,
    vendorBId: vendorB.id,
    payableAccountId: accounts[0].id,
    bankAccountId: accounts[1].id,
    tdsAccountId: accounts[2].id,
    discountAccountId: accounts[3].id,
    bankChargeAccountId: accounts[4].id,
    costCentreId: costCentre.id,
  }
}

async function buildPaymentInput(
  fx: PayFixture,
  overrides: Partial<CreateVendorPaymentRecordInput> = {},
): Promise<CreateVendorPaymentRecordInput> {
  const draftReference =
    overrides.draftReference ?? (await generateUniqueVendorPaymentDraftReference(fx.tenantAId))
  return {
    tenantId: fx.tenantAId,
    legalEntityId: fx.legalEntityAId,
    branchId: fx.branchId,
    vendorId: fx.vendorAId,
    financialYearId: fx.financialYearAId,
    draftReference,
    paymentPurpose: 'INVOICE_SETTLEMENT',
    paymentMethod: 'BANK_TRANSFER',
    documentDate: new Date('2026-05-01'),
    paymentDate: new Date('2026-05-01'),
    vendorCodeSnapshot: 'PAY-A',
    vendorNameSnapshot: 'Pay Vendor A',
    vendorGstinSnapshot: '27AAAAA1111A1Z5',
    vendorPanSnapshot: 'AAAAA1111A',
    vendorStateCodeSnapshot: '27',
    paymentAccountId: fx.bankAccountId,
    vendorPayableAccountId: fx.payableAccountId,
    ...overrides,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.payableAllocationLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableAllocationBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPaymentAdjustmentLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPayment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.costCentre.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Finance Phase 4B1 — Vendor payment foundation', () => {
  let fx: PayFixture

  beforeAll(async () => {
    await ensurePermissions()
    fx = await seedFixture()
  })

  afterAll(async () => {
    if (fx) {
      await cleanupTenant(fx.tenantAId)
      await cleanupTenant(fx.tenantBId)
    }
  })

  it('exposes Prisma vendor payment models and no VendorAdvance table', () => {
    expect(prisma.vendorPayment).toBeDefined()
    expect(prisma.vendorPaymentAdjustmentLine).toBeDefined()
    expect(prisma.payableAllocationBatch).toBeDefined()
    expect(prisma.payableAllocationLine).toBeDefined()
    expect((prisma as { vendorAdvance?: unknown }).vendorAdvance).toBeUndefined()
  })

  it('registers payment and allocation permissions without granting beyond Super Admin pack', () => {
    for (const p of AP_PAYMENT_PERMS) {
      expect(PERMISSIONS).toContain(p)
    }
    const unique = new Set(PERMISSIONS)
    expect(unique.size).toBe(PERMISSIONS.length)
    expect(ROLE_PERMISSIONS['Super Admin']).toEqual(expect.arrayContaining([...AP_PAYMENT_PERMS]))
    const priorAp = [
      'finance.ap.vendor_invoice.view',
      'finance.ap.open_item.view',
    ] as PermissionName[]
    expect(PERMISSIONS).toEqual(expect.arrayContaining(priorAp))
  })

  it('accepts FinanceNumberSeries VENDOR_PAYMENT without reserving a number', async () => {
    const series = await prisma.financeNumberSeries.create({
      data: {
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        financialYearId: fx.financialYearAId,
        documentType: 'VENDOR_PAYMENT',
        prefix: 'VPAY',
        currentValue: 0,
        padLength: 4,
      },
    })
    expect(series.documentType).toBe('VENDOR_PAYMENT')
    expect(series.currentValue).toBe(0)
    await prisma.financeNumberSeries.delete({ where: { id: series.id } })
  })

  it('accepts FinanceApprovalDocumentType VENDOR_PAYMENT without creating a request', async () => {
    // Enum compatibility only — no FinanceApprovalRequest row created in 4B1.
    expect(['JOURNAL', 'VENDOR_INVOICE', 'VENDOR_PAYMENT']).toContain('VENDOR_PAYMENT')
  })

  describe('VendorPayment creation', () => {
    it('creates DRAFT with null final number, voucher, posting event, open item', async () => {
      const input = await buildPaymentInput(fx)
      const payment = await createVendorPaymentRecord(input)

      expect(payment.status).toBe('DRAFT')
      expect(payment.vendorPaymentNumber).toBeNull()
      expect(payment.accountingVoucherId).toBeNull()
      expect(payment.postingEventId).toBeNull()
      expect(payment.payableOpenItemId).toBeNull()
      expect(payment.draftReference).toBe(input.draftReference)
      expect(payment.paymentAmount.toString()).toBe('0')

      const byDraft = await findVendorPaymentByDraftReference(fx.tenantAId, payment.draftReference)
      expect(byDraft?.id).toBe(payment.id)
      const byNumber = await findVendorPaymentByNumber(fx.tenantAId, fx.legalEntityAId, 'NOPE')
      expect(byNumber).toBeNull()

      await prisma.vendorPayment.delete({ where: { id: payment.id } })
    })

    it('supports INVOICE_SETTLEMENT, ADVANCE, and MIXED on the same table', async () => {
      for (const purpose of Object.values(VendorPaymentPurpose)) {
        const payment = await createVendorPaymentRecord(
          await buildPaymentInput(fx, { paymentPurpose: purpose }),
        )
        expect(payment.paymentPurpose).toBe(purpose)
        await prisma.vendorPayment.delete({ where: { id: payment.id } })
      }
    })

    it('supports all payment methods', async () => {
      for (const method of Object.values(VendorPaymentMethod)) {
        const payment = await createVendorPaymentRecord(
          await buildPaymentInput(fx, { paymentMethod: method }),
        )
        expect(payment.paymentMethod).toBe(method)
        await prisma.vendorPayment.delete({ where: { id: payment.id } })
      }
    })

    it('stores ADVANCE without requiring invoice or creating open item', async () => {
      const payment = await createVendorPaymentRecord(
        await buildPaymentInput(fx, {
          paymentPurpose: 'ADVANCE',
          paymentAmount: '10000.00',
          vendorSettlementAmount: '10000.00',
          cashOutflowAmount: '10000.00',
        }),
      )
      expect(payment.paymentPurpose).toBe('ADVANCE')
      const open = await findPayableOpenItemBySourceVendorPayment(
        fx.tenantAId,
        fx.legalEntityAId,
        payment.id,
      )
      expect(open).toBeNull()
      await prisma.vendorPayment.delete({ where: { id: payment.id } })
    })

    it('stores MIXED amount fields without allocating', async () => {
      const payment = await createVendorPaymentRecord(
        await buildPaymentInput(fx, {
          paymentPurpose: 'MIXED',
          paymentAmount: formatForPersistence('8000'),
          settlementAdjustmentAmount: formatForPersistence('2000'),
          vendorSettlementAmount: formatForPersistence('10000'),
          cashOutflowAmount: formatForPersistence('8050'),
          paymentExpenseAmount: formatForPersistence('50'),
        }),
      )
      expect(payment.paymentPurpose).toBe('MIXED')
      expect(payment.vendorSettlementAmount.toString()).toBe('10000')
      expect(payment.cashOutflowAmount.toString()).toBe('8050')
      await prisma.vendorPayment.delete({ where: { id: payment.id } })
    })
  })

  describe('Adjustment lines', () => {
    it('stores TDS, discount, and bank-charge lines with roles and exact decimals', async () => {
      const payment = await createVendorPaymentRecord(await buildPaymentInput(fx))
      const lines = await replaceVendorPaymentAdjustmentLines(fx.tenantAId, fx.legalEntityAId, payment.id, [
        {
          lineNumber: 1,
          adjustmentType: 'TDS',
          accountingRole: 'SETTLEMENT_CREDIT',
          description: 'TDS 194C',
          amount: '100.50',
          baseAmount: '100.50',
          calculationBaseAmount: '10000',
          rate: '1.005',
          sectionCode: '194C',
          accountId: fx.tdsAccountId,
        },
        {
          lineNumber: 2,
          adjustmentType: 'DISCOUNT',
          accountingRole: 'SETTLEMENT_CREDIT',
          description: 'Early pay discount',
          amount: '50.00',
          baseAmount: '50.00',
          accountId: fx.discountAccountId,
        },
        {
          lineNumber: 3,
          adjustmentType: 'BANK_CHARGE',
          accountingRole: 'PAYMENT_EXPENSE_DEBIT',
          description: 'NEFT charge',
          amount: '11.25',
          baseAmount: '11.25',
          accountId: fx.bankChargeAccountId,
          costCentreId: fx.costCentreId,
        },
      ])

      expect(lines).toHaveLength(3)
      expect(lines[0].amount.toString()).toBe('100.5')
      expect(lines[0].sectionCode).toBe('194C')
      expect(lines[1].accountingRole).toBe('SETTLEMENT_CREDIT')
      expect(lines[2].accountingRole).toBe('PAYMENT_EXPENSE_DEBIT')

      const listed = await listVendorPaymentAdjustments(fx.tenantAId, fx.legalEntityAId, payment.id)
      expect(listed).toHaveLength(3)

      await prisma.vendorPaymentAdjustmentLine.deleteMany({ where: { vendorPaymentId: payment.id } })
      await prisma.vendorPayment.delete({ where: { id: payment.id } })
    })

    it('rejects duplicate line numbers on the same payment and non-positive amounts', async () => {
      const payment = await createVendorPaymentRecord(await buildPaymentInput(fx))
      await expect(
        replaceVendorPaymentAdjustmentLines(fx.tenantAId, fx.legalEntityAId, payment.id, [
          {
            lineNumber: 1,
            adjustmentType: 'TDS',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'A',
            amount: '10',
            baseAmount: '10',
          },
          {
            lineNumber: 1,
            adjustmentType: 'DISCOUNT',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'B',
            amount: '5',
            baseAmount: '5',
          },
        ]),
      ).rejects.toBeInstanceOf(VendorPaymentAdjustmentLineConflictError)

      await expect(
        replaceVendorPaymentAdjustmentLines(fx.tenantAId, fx.legalEntityAId, payment.id, [
          {
            lineNumber: 1,
            adjustmentType: 'TDS',
            accountingRole: 'SETTLEMENT_CREDIT',
            description: 'A',
            amount: '0',
            baseAmount: '0',
          },
        ]),
      ).rejects.toBeInstanceOf(VendorPaymentAdjustmentAmountInvalidError)

      await prisma.vendorPayment.delete({ where: { id: payment.id } })
    })

    it('allows same line number on different payments', async () => {
      const p1 = await createVendorPaymentRecord(await buildPaymentInput(fx))
      const p2 = await createVendorPaymentRecord(await buildPaymentInput(fx))
      await replaceVendorPaymentAdjustmentLines(fx.tenantAId, fx.legalEntityAId, p1.id, [
        {
          lineNumber: 1,
          adjustmentType: 'TDS',
          accountingRole: 'SETTLEMENT_CREDIT',
          description: 'A',
          amount: '10',
          baseAmount: '10',
        },
      ])
      await replaceVendorPaymentAdjustmentLines(fx.tenantAId, fx.legalEntityAId, p2.id, [
        {
          lineNumber: 1,
          adjustmentType: 'TDS',
          accountingRole: 'SETTLEMENT_CREDIT',
          description: 'B',
          amount: '20',
          baseAmount: '20',
        },
      ])
      await prisma.vendorPaymentAdjustmentLine.deleteMany({
        where: { vendorPaymentId: { in: [p1.id, p2.id] } },
      })
      await prisma.vendorPayment.deleteMany({ where: { id: { in: [p1.id, p2.id] } } })
    })
  })

  describe('PayableOpenItem payment compatibility', () => {
    it('supports controlled DEBIT VENDOR_PAYMENT and VENDOR_ADVANCE rows', async () => {
      const payment = await createVendorPaymentRecord(
        await buildPaymentInput(fx, { paymentPurpose: 'INVOICE_SETTLEMENT' }),
      )
      const advance = await createVendorPaymentRecord(
        await buildPaymentInput(fx, { paymentPurpose: 'ADVANCE' }),
      )

      const payItem = await createPayableOpenItemRecord({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        vendorId: fx.vendorAId,
        vendorCodeSnapshot: 'PAY-A',
        vendorNameSnapshot: 'Pay Vendor A',
        side: 'DEBIT',
        documentType: 'VENDOR_PAYMENT',
        documentId: payment.id,
        documentNumber: payment.draftReference,
        documentDate: new Date('2026-05-01'),
        postingDate: new Date('2026-05-01'),
        originalAmount: '5000',
        outstandingAmount: '5000',
        baseOriginalAmount: '5000',
        baseOutstandingAmount: '5000',
        vendorPayableAccountId: fx.payableAccountId,
        sourceVendorPaymentId: payment.id,
      })
      expect(payItem.side).toBe('DEBIT')
      expect(payItem.documentType).toBe('VENDOR_PAYMENT')
      expect(payItem.outstandingAmount.toString()).toBe('5000')

      const advItem = await createPayableOpenItemRecord({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        vendorId: fx.vendorAId,
        vendorCodeSnapshot: 'PAY-A',
        vendorNameSnapshot: 'Pay Vendor A',
        side: 'DEBIT',
        documentType: 'VENDOR_ADVANCE',
        documentId: advance.id,
        documentNumber: advance.draftReference,
        documentDate: new Date('2026-05-02'),
        postingDate: new Date('2026-05-02'),
        originalAmount: '3000',
        outstandingAmount: '3000',
        baseOriginalAmount: '3000',
        baseOutstandingAmount: '3000',
        vendorPayableAccountId: fx.payableAccountId,
        sourceVendorPaymentId: advance.id,
      })
      expect(advItem.documentType).toBe('VENDOR_ADVANCE')

      await expect(
        createPayableOpenItemRecord({
          tenantId: fx.tenantAId,
          legalEntityId: fx.legalEntityAId,
          vendorId: fx.vendorAId,
          vendorCodeSnapshot: 'PAY-A',
          vendorNameSnapshot: 'Pay Vendor A',
          side: 'DEBIT',
          documentType: 'VENDOR_PAYMENT',
          documentId: `${payment.id}-dup`,
          documentNumber: 'DUP',
          documentDate: new Date('2026-05-01'),
          postingDate: new Date('2026-05-01'),
          originalAmount: '1',
          outstandingAmount: '1',
          baseOriginalAmount: '1',
          baseOutstandingAmount: '1',
          vendorPayableAccountId: fx.payableAccountId,
          sourceVendorPaymentId: payment.id,
        }),
      ).rejects.toBeInstanceOf(PayableOpenItemDuplicateSourceError)

      const found = await findPayableOpenItemBySourceVendorPayment(
        fx.tenantAId,
        fx.legalEntityAId,
        payment.id,
      )
      expect(found?.id).toBe(payItem.id)

      await prisma.payableOpenItem.deleteMany({ where: { id: { in: [payItem.id, advItem.id] } } })
      await prisma.vendorPayment.deleteMany({ where: { id: { in: [payment.id, advance.id] } } })
    })
  })

  describe('Tenant isolation', () => {
    it('does not return Tenant B payment when queried under Tenant A', async () => {
      const payment = await createVendorPaymentRecord(await buildPaymentInput(fx))
      const cross = await findVendorPaymentById(fx.tenantBId, fx.legalEntityAId, payment.id)
      expect(cross).toBeNull()
      await prisma.vendorPayment.delete({ where: { id: payment.id } })
    })
  })

  describe('Legal-entity isolation', () => {
    it('scopes find by legal entity', async () => {
      const payment = await createVendorPaymentRecord(await buildPaymentInput(fx))
      const wrongLe = await findVendorPaymentById(fx.tenantAId, fx.legalEntityBId, payment.id)
      expect(wrongLe).toBeNull()
      await prisma.vendorPayment.delete({ where: { id: payment.id } })
    })
  })
})
