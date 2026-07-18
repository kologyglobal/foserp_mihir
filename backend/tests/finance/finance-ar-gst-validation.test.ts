import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '../../src/config/database.js'
import { validateGstin } from '../../src/modules/accounting/receivables/validation/gstin.validator.js'
import { validatePan } from '../../src/modules/accounting/receivables/validation/pan.validator.js'
import { validateStateCode } from '../../src/modules/accounting/receivables/validation/state-code.validator.js'
import { validateHsnSac } from '../../src/modules/accounting/receivables/validation/hsn-sac.validator.js'
import { validateSalesInvoiceDraft } from '../../src/modules/accounting/receivables/calculation/sales-invoice-validation-preview.service.js'
import { calculateSalesInvoice } from '../../src/modules/accounting/receivables/calculation/sales-invoice-calculation.service.js'
import type { SalesInvoiceCalculationInput } from '../../src/modules/accounting/receivables/calculation/sales-invoice-calculation.types.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

interface ValidationFixture {
  tenantId: string
  legalEntityId: string
  customerId: string
  financialYearId: string
  periodId: string
  revenueAccountId: string
  receivableAccountId: string
  cgstAccountId: string
  sgstAccountId: string
  costCentreId: string
}

async function seedValidationFixture(): Promise<ValidationFixture> {
  const tenant = await prisma.tenant.create({
    data: { name: 'AR Calc Val', slug: `ar-calc-${Date.now()}`, email: `ar-calc-${Date.now()}@test.com`, status: 'ACTIVE' },
  })

  const le = await prisma.legalEntity.create({
    data: {
      tenantId: tenant.id,
      code: `AC${Date.now()}`.slice(-8),
      legalName: 'Calc Test Co',
      displayName: 'Calc Test Co',
      stateCode: '27',
      isDefault: true,
    },
  })

  const receivable = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      accountCode: '1200',
      accountName: 'Customer Receivable',
      accountType: 'CUSTOMER_RECEIVABLE',
      category: 'ASSET',
      isGroup: false,
      level: 1,
    },
  })

  const revenue = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      accountCode: '4100',
      accountName: 'Sales Revenue',
      accountType: 'SALES',
      category: 'INCOME',
      isGroup: false,
      level: 1,
    },
  })

  const cgst = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      accountCode: '2301',
      accountName: 'Output CGST',
      accountType: 'GST_OUTPUT',
      category: 'LIABILITY',
      isGroup: false,
      level: 1,
    },
  })

  const sgst = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      accountCode: '2302',
      accountName: 'Output SGST',
      accountType: 'GST_OUTPUT',
      category: 'LIABILITY',
      isGroup: false,
      level: 1,
    },
  })

  const mappingKeys = [
    { mappingKey: 'CUSTOMER_RECEIVABLE' as const, accountId: receivable.id },
    { mappingKey: 'SALES_REVENUE' as const, accountId: revenue.id },
    { mappingKey: 'GST_OUTPUT_CGST' as const, accountId: cgst.id },
    { mappingKey: 'GST_OUTPUT_SGST' as const, accountId: sgst.id },
  ]

  for (const m of mappingKeys) {
    await prisma.defaultAccountMapping.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        mappingKey: m.mappingKey,
        accountId: m.accountId,
        isMandatory: true,
      },
    })
  }

  const fyStart = new Date('2026-04-01')
  const fyEnd = new Date('2027-03-31')
  const fy = await prisma.financialYear.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      name: 'FY 2026-27',
      startDate: fyStart,
      endDate: fyEnd,
      status: 'ACTIVE',
      isCurrent: true,
    },
  })

  const period = await prisma.accountingPeriod.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      financialYearId: fy.id,
      periodNumber: 1,
      name: 'Apr 2026',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-30'),
      status: 'OPEN',
    },
  })

  const costCentre = await prisma.costCentre.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      code: 'CC01',
      name: 'Sales CC',
      isGroup: false,
      isActive: true,
    },
  })

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: tenant.id,
      companyCode: `CV-${Date.now()}`.slice(-8),
      name: 'Calc Customer',
      gstin: '27AABCU9603R1ZM',
      pan: 'AABCU9603R',
      state: 'Maharashtra',
      country: 'India',
      status: 'active',
      isActive: true,
    },
  })

  return {
    tenantId: tenant.id,
    legalEntityId: le.id,
    customerId: customer.id,
    financialYearId: fy.id,
    periodId: period.id,
    revenueAccountId: revenue.id,
    receivableAccountId: receivable.id,
    cgstAccountId: cgst.id,
    sgstAccountId: sgst.id,
    costCentreId: costCentre.id,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.costCentre.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe('GST / PAN / state validators (unit)', () => {
  it('validates PAN format', () => {
    expect(validatePan('AABCU9603R').valid).toBe(true)
    expect(validatePan('INVALID').valid).toBe(false)
    expect(validatePan(null).valid).toBe(true)
  })

  it('validates Indian GST state codes', () => {
    expect(validateStateCode('27').valid).toBe(true)
    expect(validateStateCode('99').valid).toBe(false)
    expect(validateStateCode('').valid).toBe(false)
  })

  it('validates GSTIN format and checksum', () => {
    const valid = validateGstin('27AABCU9603R1ZM')
    expect(valid.valid).toBe(true)
    expect(valid.normalized).toBe('27AABCU9603R1ZM')
    const checksumWarn = validateGstin('27AABCU9603R1ZX')
    expect(checksumWarn.valid).toBe(true)
    expect(checksumWarn.code).toBe('GSTIN_CHECKSUM_WARNING')
    expect(validateGstin('TOOSHORT').valid).toBe(false)
  })

  it('warns on unusual HSN/SAC length', () => {
    const r = validateHsnSac('12345')
    expect(r.valid).toBe(true)
    expect(r.severity).toBe('warning')
    expect(r.code).toBe('HSN_SAC_LENGTH_WARNING')
  })

  it('rejects non-digit HSN/SAC', () => {
    const r = validateHsnSac('12AB')
    expect(r.valid).toBe(false)
  })
})

describe.skipIf(!dbAvailable)('Finance Phase 3A2 — validation preview', () => {
  let fx: ValidationFixture

  beforeAll(async () => {
    fx = await seedValidationFixture()
  })

  afterAll(async () => {
    if (fx) await cleanupTenant(fx.tenantId)
  })

  function draftInput(overrides: Partial<SalesInvoiceCalculationInput> = {}): SalesInvoiceCalculationInput {
    return {
      legalEntityId: fx.legalEntityId,
      customerId: fx.customerId,
      placeOfSupply: '27',
      taxTreatment: 'REGISTERED',
      supplyType: 'INTRA_STATE',
      invoiceDate: '2026-04-15',
      postingDate: '2026-04-15',
      lines: [
        {
          lineNumber: 1,
          quantity: '1',
          unitPrice: '1000',
          gstRate: '18',
          hsnCode: '87089900',
          revenueAccountId: fx.revenueAccountId,
          costCentreId: fx.costCentreId,
        },
      ],
      ...overrides,
    }
  }

  it('validateSalesInvoiceDraft resolves LE state and period readiness', async () => {
    const preview = await validateSalesInvoiceDraft(draftInput(), { tenantId: fx.tenantId })
    expect(preview.calculation.valid).toBe(true)
    expect(preview.customerReadiness.active).toBe(true)
    expect(preview.periodReadiness?.resolved).toBe(true)
    expect(preview.periodReadiness?.periodId).toBe(fx.periodId)
    expect(preview.accountReadiness.some((a) => a.mappingKey === 'CUSTOMER_RECEIVABLE' && a.valid)).toBe(true)
  })

  it('flags missing account mappings', async () => {
    await prisma.defaultAccountMapping.deleteMany({
      where: { tenantId: fx.tenantId, mappingKey: 'GST_OUTPUT_CGST' },
    })
    const preview = await validateSalesInvoiceDraft(draftInput(), { tenantId: fx.tenantId })
    expect(preview.valid).toBe(false)
    expect(preview.errors.some((e) => e.code === 'GST_OUTPUT_CGST_ACCOUNT_MISSING')).toBe(true)
    await prisma.defaultAccountMapping.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        mappingKey: 'GST_OUTPUT_CGST',
        accountId: fx.cgstAccountId,
        isMandatory: true,
      },
    })
  })

  it('calculateSalesInvoice does not persist SalesInvoice rows', async () => {
    const before = await prisma.salesInvoice.count({ where: { tenantId: fx.tenantId } })
    calculateSalesInvoice({
      legalEntityId: fx.legalEntityId,
      legalEntityStateCode: '27',
      placeOfSupply: '27',
      taxTreatment: 'REGISTERED',
      lines: [{ lineNumber: 1, quantity: '1', unitPrice: '100', gstRate: '18' }],
    })
    const after = await prisma.salesInvoice.count({ where: { tenantId: fx.tenantId } })
    expect(after).toBe(before)
  })
})
