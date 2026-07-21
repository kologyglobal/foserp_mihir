import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../src/config/database.js'
import { normalizeSupplierInvoiceNumber } from '../../src/modules/accounting/payables/vendor-invoices/vendor-invoice-number-normalization.js'
import {
  createVendorInvoiceRecord,
  generateUniqueDraftReference,
} from '../../src/modules/accounting/payables/vendor-invoices/vendor-invoice.repository.js'
import { assessVendorInvoiceDuplicates } from '../../src/modules/accounting/payables/vendor-invoices/calculation/vendor-invoice-duplicate-detector.service.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

interface DupFixture {
  tenantId: string
  legalEntityId: string
  financialYearId: string
  vendorAId: string
  vendorBId: string
}

async function seedDupFixture(): Promise<DupFixture> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const tenant = await prisma.tenant.create({
    data: {
      name: 'AP Dup Test',
      slug: `ap-dup-${suffix}`,
      email: `ap-dup-${suffix}@test.com`,
      status: 'ACTIVE',
    },
  })
  const legalEntity = await prisma.legalEntity.create({
    data: {
      tenantId: tenant.id,
      code: `APD${suffix.slice(-6)}`,
      legalName: 'AP Dup Co',
      displayName: 'AP Dup Co',
      stateCode: '27',
      isDefault: true,
    },
  })
  const financialYear = await prisma.financialYear.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: legalEntity.id,
      name: 'FY Dup 2026-27',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      status: 'ACTIVE',
      isCurrent: true,
    },
  })
  const vendorA = await prisma.masterVendor.create({
    data: { tenantId: tenant.id, code: `VDA${suffix.slice(-6)}`, name: 'Vendor Dup A' },
  })
  const vendorB = await prisma.masterVendor.create({
    data: { tenantId: tenant.id, code: `VDB${suffix.slice(-6)}`, name: 'Vendor Dup B' },
  })

  return {
    tenantId: tenant.id,
    legalEntityId: legalEntity.id,
    financialYearId: financialYear.id,
    vendorAId: vendorA.id,
    vendorBId: vendorB.id,
  }
}

async function cleanupDupTenant(tenantId: string): Promise<void> {
  await prisma.vendorInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

async function seedInvoice(
  fx: DupFixture,
  vendorId: string,
  supplierInvoiceNumber: string,
  invoiceDate = new Date('2026-05-01'),
) {
  const draftReference = await generateUniqueDraftReference(fx.tenantId)
  return createVendorInvoiceRecord({
    tenantId: fx.tenantId,
    legalEntityId: fx.legalEntityId,
    vendorId,
    financialYearId: fx.financialYearId,
    draftReference,
    supplierInvoiceNumber,
    supplierInvoiceNumberNormalized: normalizeSupplierInvoiceNumber(supplierInvoiceNumber),
    supplierInvoiceDate: invoiceDate,
    invoiceType: 'EXPENSE',
    documentDate: invoiceDate,
    vendorCodeSnapshot: 'V-DUP',
    vendorNameSnapshot: 'Vendor Dup',
  })
}

describe.skipIf(!dbAvailable)('Finance Phase 4A2 — AP vendor invoice duplicate detection (live)', () => {
  let fx: DupFixture

  beforeAll(async () => {
    fx = await seedDupFixture()
  })

  afterAll(async () => {
    if (fx) {
      await cleanupDupTenant(fx.tenantId)
    }
  })

  it('flags EXACT_BLOCKING for the same normalized supplier invoice number and vendor', async () => {
    const supplierNum = `DUP-${Date.now()}`
    const invoice = await seedInvoice(fx, fx.vendorAId, supplierNum)

    const assessment = await assessVendorInvoiceDuplicates({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      vendorId: fx.vendorAId,
      normalizedSupplierInvoiceNumber: normalizeSupplierInvoiceNumber(supplierNum),
      supplierInvoiceDate: '2026-05-01',
      invoiceGrandTotal: '0',
    })

    expect(assessment.riskLevel).toBe('EXACT_BLOCKING')
    expect(assessment.isBlocking).toBe(true)
    expect(assessment.matches.some((m) => m.vendorInvoiceId === invoice.id)).toBe(true)
    expect(assessment.matches.some((m) => m.matchingSignals.includes('SAME_SUPPLIER_INVOICE_NUMBER'))).toBe(true)
  })

  it('excludeVendorInvoiceId excludes the invoice being edited from its own duplicate scan', async () => {
    const supplierNum = `DUP-SELF-${Date.now()}`
    const invoice = await seedInvoice(fx, fx.vendorAId, supplierNum)

    const assessment = await assessVendorInvoiceDuplicates({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      vendorId: fx.vendorAId,
      normalizedSupplierInvoiceNumber: normalizeSupplierInvoiceNumber(supplierNum),
      excludeVendorInvoiceId: invoice.id,
    })

    expect(assessment.riskLevel).toBe('NONE')
    expect(assessment.isBlocking).toBe(false)
    expect(assessment.matches).toEqual([])
  })

  it('does not treat the same supplier invoice number as an exact match for a different vendor', async () => {
    const supplierNum = `DUP-XV-${Date.now()}`
    await seedInvoice(fx, fx.vendorAId, supplierNum)

    const assessment = await assessVendorInvoiceDuplicates({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      vendorId: fx.vendorBId,
      normalizedSupplierInvoiceNumber: normalizeSupplierInvoiceNumber(supplierNum),
    })

    expect(assessment.riskLevel).toBe('NONE')
    expect(assessment.isBlocking).toBe(false)
    expect(assessment.matches).toEqual([])
  })
})
