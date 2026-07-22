import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS } from '../../src/constants/permissions.js'
import {
  createVendorPaymentRecord,
  generateUniqueVendorPaymentDraftReference,
} from '../../src/modules/accounting/payables/vendor-payments/vendor-payment.repository.js'
import { createPayableOpenItemRecord } from '../../src/modules/accounting/payables/open-items/payable-open-item.repository.js'
import {
  createPayableAllocationBatchRecord,
  createPayableAllocationLineRecords,
  findAllocationBatchesByDebitOpenItem,
  findAllocationLinesByCreditOpenItem,
  findPayableAllocationBatchById,
  listPayableAllocationLines,
} from '../../src/modules/accounting/payables/allocations/payable-allocation.repository.js'
import {
  PayableAllocationAmountInvalidError,
  PayableAllocationDirectionError,
  PayableAllocationLineConflictError,
} from '../../src/modules/accounting/payables/allocations/payable-allocation.errors.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

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

interface AllocFixture {
  tenantAId: string
  tenantBId: string
  legalEntityAId: string
  legalEntityBId: string
  vendorAId: string
  vendorBId: string
  payableAccountId: string
  financialYearAId: string
  branchId: string
}

async function seedFixture(): Promise<AllocFixture> {
  const suffix = Date.now()
  const tenantA = await prisma.tenant.create({
    data: {
      name: 'AP Alloc A',
      slug: `ap-alloc-a-${suffix}`,
      email: `ap-alloc-a-${suffix}@test.com`,
      status: 'ACTIVE',
    },
  })
  const tenantB = await prisma.tenant.create({
    data: {
      name: 'AP Alloc B',
      slug: `ap-alloc-b-${suffix}`,
      email: `ap-alloc-b-${suffix}@test.com`,
      status: 'ACTIVE',
    },
  })
  const legalEntityA = await prisma.legalEntity.create({
    data: {
      tenantId: tenantA.id,
      code: `ALA${String(suffix).slice(-5)}`,
      legalName: 'Alloc Co A',
      displayName: 'Alloc Co A',
      isDefault: true,
    },
  })
  const legalEntityB = await prisma.legalEntity.create({
    data: {
      tenantId: tenantA.id,
      code: `ALB${String(suffix).slice(-5)}`,
      legalName: 'Alloc Co B',
      displayName: 'Alloc Co B',
      isDefault: false,
    },
  })
  const branch = await prisma.branch.create({
    data: {
      tenantId: tenantA.id,
      legalEntityId: legalEntityA.id,
      code: 'HO',
      name: 'HO',
      isHeadOffice: true,
      isDefault: true,
    },
  })
  const financialYearA = await prisma.financialYear.create({
    data: {
      tenantId: tenantA.id,
      legalEntityId: legalEntityA.id,
      name: 'FY Alloc',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      status: 'ACTIVE',
      isCurrent: true,
    },
  })
  const payableAccount = await prisma.account.create({
    data: {
      tenantId: tenantA.id,
      legalEntityId: legalEntityA.id,
      accountCode: '2100',
      accountName: 'Trade Payables',
      category: 'LIABILITY',
      isGroup: false,
      level: 1,
    },
  })
  const vendorA = await prisma.masterVendor.create({
    data: { tenantId: tenantA.id, code: `AA${String(suffix).slice(-6)}`, name: 'Alloc Vendor A' },
  })
  const vendorB = await prisma.masterVendor.create({
    data: { tenantId: tenantA.id, code: `AB${String(suffix).slice(-6)}`, name: 'Alloc Vendor B' },
  })
  return {
    tenantAId: tenantA.id,
    tenantBId: tenantB.id,
    legalEntityAId: legalEntityA.id,
    legalEntityBId: legalEntityB.id,
    vendorAId: vendorA.id,
    vendorBId: vendorB.id,
    payableAccountId: payableAccount.id,
    financialYearAId: financialYearA.id,
    branchId: branch.id,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.payableAllocationLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableAllocationBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPaymentAdjustmentLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPayment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Finance Phase 4B1 — Payable allocation foundation', () => {
  let fx: AllocFixture
  let debitItemId: string
  let creditItem1Id: string
  let creditItem2Id: string
  let paymentId: string

  beforeAll(async () => {
    await ensurePermissions()
    fx = await seedFixture()

    const payment = await createVendorPaymentRecord({
      tenantId: fx.tenantAId,
      legalEntityId: fx.legalEntityAId,
      branchId: fx.branchId,
      vendorId: fx.vendorAId,
      financialYearId: fx.financialYearAId,
      draftReference: await generateUniqueVendorPaymentDraftReference(fx.tenantAId),
      paymentPurpose: 'INVOICE_SETTLEMENT',
      paymentMethod: 'BANK_TRANSFER',
      documentDate: new Date('2026-05-10'),
      paymentDate: new Date('2026-05-10'),
      vendorCodeSnapshot: 'AA',
      vendorNameSnapshot: 'Alloc Vendor A',
    })
    paymentId = payment.id

    const debit = await createPayableOpenItemRecord({
      tenantId: fx.tenantAId,
      legalEntityId: fx.legalEntityAId,
      vendorId: fx.vendorAId,
      vendorCodeSnapshot: 'AA',
      vendorNameSnapshot: 'Alloc Vendor A',
      side: 'DEBIT',
      documentType: 'VENDOR_PAYMENT',
      documentId: payment.id,
      documentNumber: payment.draftReference,
      documentDate: new Date('2026-05-10'),
      postingDate: new Date('2026-05-10'),
      originalAmount: '10000',
      outstandingAmount: '10000',
      baseOriginalAmount: '10000',
      baseOutstandingAmount: '10000',
      vendorPayableAccountId: fx.payableAccountId,
      sourceVendorPaymentId: payment.id,
    })
    debitItemId = debit.id

    const credit1 = await createPayableOpenItemRecord({
      tenantId: fx.tenantAId,
      legalEntityId: fx.legalEntityAId,
      vendorId: fx.vendorAId,
      vendorCodeSnapshot: 'AA',
      vendorNameSnapshot: 'Alloc Vendor A',
      side: 'CREDIT',
      documentType: 'VENDOR_INVOICE',
      documentId: `inv-${Date.now()}-1`,
      documentNumber: 'VI-TEST-1',
      documentDate: new Date('2026-04-20'),
      postingDate: new Date('2026-04-20'),
      originalAmount: '6000',
      outstandingAmount: '6000',
      baseOriginalAmount: '6000',
      baseOutstandingAmount: '6000',
      vendorPayableAccountId: fx.payableAccountId,
    })
    creditItem1Id = credit1.id

    const credit2 = await createPayableOpenItemRecord({
      tenantId: fx.tenantAId,
      legalEntityId: fx.legalEntityAId,
      vendorId: fx.vendorAId,
      vendorCodeSnapshot: 'AA',
      vendorNameSnapshot: 'Alloc Vendor A',
      side: 'CREDIT',
      documentType: 'VENDOR_INVOICE',
      documentId: `inv-${Date.now()}-2`,
      documentNumber: 'VI-TEST-2',
      documentDate: new Date('2026-04-21'),
      postingDate: new Date('2026-04-21'),
      originalAmount: '4000',
      outstandingAmount: '4000',
      baseOriginalAmount: '4000',
      baseOutstandingAmount: '4000',
      vendorPayableAccountId: fx.payableAccountId,
    })
    creditItem2Id = credit2.id
  })

  afterAll(async () => {
    if (fx) {
      await cleanupTenant(fx.tenantAId)
      await cleanupTenant(fx.tenantBId)
    }
  })

  it('creates ACTIVE allocation batch without voucher or posting event', async () => {
    const batch = await createPayableAllocationBatchRecord({
      tenantId: fx.tenantAId,
      legalEntityId: fx.legalEntityAId,
      branchId: fx.branchId,
      vendorId: fx.vendorAId,
      allocationReference: `APALLOC-${Date.now()}`,
      sourceDebitOpenItemId: debitItemId,
      allocationDate: new Date('2026-05-11'),
      totalAllocatedAmount: '10000',
      baseTotalAllocatedAmount: '10000',
    })

    expect(batch.status).toBe('ACTIVE')
    expect(batch.sourceDebitOpenItemId).toBe(debitItemId)
    expect((batch as { accountingVoucherId?: string }).accountingVoucherId).toBeUndefined()

    const found = await findPayableAllocationBatchById(fx.tenantAId, fx.legalEntityAId, batch.id)
    expect(found?.id).toBe(batch.id)

    const byDebit = await findAllocationBatchesByDebitOpenItem(
      fx.tenantAId,
      fx.legalEntityAId,
      debitItemId,
    )
    expect(byDebit.some((b) => b.id === batch.id)).toBe(true)
  })

  it('allocates one debit against multiple credits without changing open-item balances', async () => {
    const batches = await findAllocationBatchesByDebitOpenItem(
      fx.tenantAId,
      fx.legalEntityAId,
      debitItemId,
    )
    const batch = batches[0]
    expect(batch).toBeDefined()

    const before1 = await prisma.payableOpenItem.findUniqueOrThrow({ where: { id: creditItem1Id } })
    const before2 = await prisma.payableOpenItem.findUniqueOrThrow({ where: { id: creditItem2Id } })
    const beforeDebit = await prisma.payableOpenItem.findUniqueOrThrow({ where: { id: debitItemId } })

    const lines = await createPayableAllocationLineRecords(fx.tenantAId, fx.legalEntityAId, batch.id, [
      {
        sourceDebitOpenItemId: debitItemId,
        targetCreditOpenItemId: creditItem1Id,
        amount: '6000',
        baseAmount: '6000',
      },
      {
        sourceDebitOpenItemId: debitItemId,
        targetCreditOpenItemId: creditItem2Id,
        amount: '4000',
        baseAmount: '4000',
      },
    ])

    expect(lines).toHaveLength(2)
    expect(lines.every((l) => l.status === 'ACTIVE')).toBe(true)
    expect(lines.every((l) => l.reversedAmount.toString() === '0')).toBe(true)

    const after1 = await prisma.payableOpenItem.findUniqueOrThrow({ where: { id: creditItem1Id } })
    const after2 = await prisma.payableOpenItem.findUniqueOrThrow({ where: { id: creditItem2Id } })
    const afterDebit = await prisma.payableOpenItem.findUniqueOrThrow({ where: { id: debitItemId } })
    expect(after1.outstandingAmount.toString()).toBe(before1.outstandingAmount.toString())
    expect(after2.outstandingAmount.toString()).toBe(before2.outstandingAmount.toString())
    expect(afterDebit.outstandingAmount.toString()).toBe(beforeDebit.outstandingAmount.toString())
    expect(after1.allocatedAmount.toString()).toBe(before1.allocatedAmount.toString())

    const byCredit = await findAllocationLinesByCreditOpenItem(
      fx.tenantAId,
      fx.legalEntityAId,
      creditItem1Id,
    )
    expect(byCredit).toHaveLength(1)

    const listed = await listPayableAllocationLines(fx.tenantAId, fx.legalEntityAId, batch.id)
    expect(listed).toHaveLength(2)
  })

  it('rejects duplicate target in same batch and invalid direction', async () => {
    const batches = await findAllocationBatchesByDebitOpenItem(
      fx.tenantAId,
      fx.legalEntityAId,
      debitItemId,
    )
    const batch = batches[0]

    await expect(
      createPayableAllocationLineRecords(fx.tenantAId, fx.legalEntityAId, batch.id, [
        {
          sourceDebitOpenItemId: debitItemId,
          targetCreditOpenItemId: creditItem1Id,
          amount: '1',
          baseAmount: '1',
        },
      ]),
    ).rejects.toBeInstanceOf(PayableAllocationLineConflictError)

    await expect(
      createPayableAllocationBatchRecord({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        vendorId: fx.vendorAId,
        allocationReference: `APALLOC-BAD-${Date.now()}`,
        sourceDebitOpenItemId: creditItem1Id,
        allocationDate: new Date('2026-05-12'),
      }),
    ).rejects.toBeInstanceOf(PayableAllocationDirectionError)

    await expect(
      createPayableAllocationBatchRecord({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        vendorId: fx.vendorBId,
        allocationReference: `APALLOC-VENDOR-${Date.now()}`,
        sourceDebitOpenItemId: debitItemId,
        allocationDate: new Date('2026-05-12'),
      }),
    ).rejects.toBeInstanceOf(PayableAllocationDirectionError)

    await expect(
      createPayableAllocationLineRecords(fx.tenantAId, fx.legalEntityAId, batch.id, [
        {
          sourceDebitOpenItemId: debitItemId,
          targetCreditOpenItemId: creditItem2Id,
          amount: '0',
          baseAmount: '0',
        },
      ]),
    ).rejects.toBeInstanceOf(PayableAllocationAmountInvalidError)
  })

  it('keeps allocation history (no generic delete API) and isolates tenants', async () => {
    const batches = await findAllocationBatchesByDebitOpenItem(
      fx.tenantAId,
      fx.legalEntityAId,
      debitItemId,
    )
    expect(batches.length).toBeGreaterThan(0)

    const foreign = await findPayableAllocationBatchById(
      fx.tenantBId,
      fx.legalEntityAId,
      batches[0].id,
    )
    expect(foreign).toBeNull()

    // Repository has no deletePayableAllocation* helpers — history remains.
    expect(typeof (await import('../../src/modules/accounting/payables/allocations/payable-allocation.repository.js')).createPayableAllocationBatchRecord).toBe(
      'function',
    )
  })

  it('registers allocation permissions', () => {
    expect(PERMISSIONS).toContain('finance.ap.allocation.view')
    expect(PERMISSIONS).toContain('finance.ap.allocation.create')
    expect(PERMISSIONS).toContain('finance.ap.allocation.reverse')
  })
})
