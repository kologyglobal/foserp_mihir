import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Prisma, VendorInvoiceLineType, VendorInvoiceType } from '@prisma/client'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, ROLE_PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import {
  normalizeSupplierInvoiceNumber,
  buildSupplierInvoiceUniquenessKey,
} from '../../src/modules/accounting/payables/vendor-invoices/vendor-invoice-number-normalization.js'
import {
  createVendorInvoiceRecord,
  findVendorInvoiceById,
  findVendorInvoiceByDraftReference,
  findVendorInvoiceByInternalNumber,
  findVendorInvoiceBySupplierInvoice,
  generateUniqueDraftReference,
} from '../../src/modules/accounting/payables/vendor-invoices/vendor-invoice.repository.js'
import {
  replaceVendorInvoiceLines,
  listVendorInvoiceLines,
} from '../../src/modules/accounting/payables/vendor-invoices/vendor-invoice-line.repository.js'
import {
  createVendorInvoiceSourceLinks,
  listVendorInvoiceSourceLinks,
} from '../../src/modules/accounting/payables/vendor-invoices/vendor-invoice-source-link.repository.js'
import {
  createPayableOpenItemRecord,
  findPayableOpenItemBySourceVendorInvoice,
} from '../../src/modules/accounting/payables/open-items/payable-open-item.repository.js'
import { VendorInvoiceLineConflictError } from '../../src/modules/accounting/payables/vendor-invoices/vendor-invoice.errors.js'
import { VendorInvoiceSourceLinkConflictError } from '../../src/modules/accounting/payables/vendor-invoices/vendor-invoice.errors.js'
import { PayableOpenItemDuplicateSourceError } from '../../src/modules/accounting/payables/open-items/payable-open-item.errors.js'
import { formatForPersistence } from '../../src/modules/accounting/shared/finance-decimal.js'
import type { CreateVendorInvoiceRecordInput } from '../../src/modules/accounting/payables/vendor-invoices/vendor-invoice.types.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const AP_PERMS = [
  'finance.ap.view',
  'finance.ap.vendor_invoice.view',
  'finance.ap.vendor_invoice.create',
  'finance.ap.vendor_invoice.edit',
  'finance.ap.vendor_invoice.submit',
  'finance.ap.vendor_invoice.approve',
  'finance.ap.vendor_invoice.post',
  'finance.ap.vendor_invoice.cancel',
  'finance.ap.vendor_invoice.reverse',
  'finance.ap.open_item.view',
] as const

const AR_SAMPLE = [
  'finance.ar.view',
  'finance.ar.invoice.view',
  'finance.ar.invoice.post',
] as const

const VENDOR_INVOICE_TYPES = Object.values(VendorInvoiceType)
const VENDOR_INVOICE_LINE_TYPES = Object.values(VendorInvoiceLineType)

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

interface ApFixture {
  tenantAId: string
  tenantBId: string
  legalEntityAId: string
  legalEntityBId: string
  legalEntityTenantBId: string
  branchId: string
  financialYearAId: string
  financialYearBId: string
  financialYearTenantBId: string
  vendorAId: string
  vendorBId: string
  vendorTenantBId: string
  payableAccountId: string
  expenseAccountId: string
  costCentreId: string
}

async function seedApFixture(): Promise<ApFixture> {
  const suffix = Date.now()
  const tenantA = await prisma.tenant.create({
    data: {
      name: 'AP Test A',
      slug: `ap-test-a-${suffix}`,
      email: `ap-a-${suffix}@test.com`,
      status: 'ACTIVE',
    },
  })
  const tenantB = await prisma.tenant.create({
    data: {
      name: 'AP Test B',
      slug: `ap-test-b-${suffix}`,
      email: `ap-b-${suffix}@test.com`,
      status: 'ACTIVE',
    },
  })

  const legalEntityA = await prisma.legalEntity.create({
    data: {
      tenantId: tenantA.id,
      code: `APA${String(suffix).slice(-5)}`,
      legalName: 'AP Test Co A',
      displayName: 'AP Test Co A',
      stateCode: '27',
      isDefault: true,
    },
  })
  const legalEntityB = await prisma.legalEntity.create({
    data: {
      tenantId: tenantA.id,
      code: `APB${String(suffix).slice(-5)}`,
      legalName: 'AP Test Co B',
      displayName: 'AP Test Co B',
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
      name: 'FY 2026-27 A',
      startDate: fyStart,
      endDate: fyEnd,
      status: 'ACTIVE',
      isCurrent: true,
    },
  })
  const financialYearB = await prisma.financialYear.create({
    data: {
      tenantId: tenantA.id,
      legalEntityId: legalEntityB.id,
      name: 'FY 2026-27 B',
      startDate: fyStart,
      endDate: fyEnd,
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
  const expenseAccount = await prisma.account.create({
    data: {
      tenantId: tenantA.id,
      legalEntityId: legalEntityA.id,
      accountCode: '5100',
      accountName: 'Operating Expense',
      category: 'EXPENSE',
      isGroup: false,
      level: 1,
    },
  })

  const costCentre = await prisma.costCentre.create({
    data: {
      tenantId: tenantA.id,
      legalEntityId: legalEntityA.id,
      code: 'APCC01',
      name: 'AP Cost Centre',
      isGroup: false,
      isActive: true,
    },
  })

  const vendorA = await prisma.masterVendor.create({
    data: {
      tenantId: tenantA.id,
      code: `VA${String(suffix).slice(-6)}`,
      name: 'Vendor A Pvt Ltd',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      state: 'Maharashtra',
    },
  })
  const vendorB = await prisma.masterVendor.create({
    data: {
      tenantId: tenantA.id,
      code: `VB${String(suffix).slice(-6)}`,
      name: 'Vendor B Ltd',
      gstin: '27BBBBB0000B1Z5',
      state: 'Maharashtra',
    },
  })
  const vendorTenantB = await prisma.masterVendor.create({
    data: {
      tenantId: tenantB.id,
      code: `VT${String(suffix).slice(-6)}`,
      name: 'Tenant B Vendor',
      state: 'Karnataka',
    },
  })

  const legalEntityTenantB = await prisma.legalEntity.create({
    data: {
      tenantId: tenantB.id,
      code: `TB${String(suffix).slice(-6)}`,
      legalName: 'AP Tenant B Co',
      displayName: 'AP Tenant B Co',
      isDefault: true,
    },
  })
  const financialYearTenantB = await prisma.financialYear.create({
    data: {
      tenantId: tenantB.id,
      legalEntityId: legalEntityTenantB.id,
      name: 'FY 2026-27 TB',
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
    financialYearBId: financialYearB.id,
    financialYearTenantBId: financialYearTenantB.id,
    vendorAId: vendorA.id,
    vendorBId: vendorB.id,
    vendorTenantBId: vendorTenantB.id,
    payableAccountId: payableAccount.id,
    expenseAccountId: expenseAccount.id,
    costCentreId: costCentre.id,
  }
}

async function buildInvoiceInput(
  fx: ApFixture,
  overrides: Partial<CreateVendorInvoiceRecordInput> = {},
): Promise<CreateVendorInvoiceRecordInput> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const supplierInvoiceNumber = overrides.supplierInvoiceNumber ?? `SUP-${stamp}`
  const draftReference =
    overrides.draftReference ?? (await generateUniqueDraftReference(fx.tenantAId))
  return {
    tenantId: fx.tenantAId,
    legalEntityId: fx.legalEntityAId,
    branchId: fx.branchId,
    vendorId: fx.vendorAId,
    financialYearId: fx.financialYearAId,
    draftReference,
    supplierInvoiceNumber,
    supplierInvoiceNumberNormalized: normalizeSupplierInvoiceNumber(supplierInvoiceNumber),
    supplierInvoiceDate: new Date('2026-04-15'),
    invoiceType: 'GOODS',
    documentDate: new Date('2026-04-15'),
    vendorCodeSnapshot: 'VEND-A',
    vendorNameSnapshot: 'Vendor A Pvt Ltd',
    vendorGstinSnapshot: '27AAAAA0000A1Z5',
    vendorPanSnapshot: 'AAAAA0000A',
    vendorStateCodeSnapshot: '27',
    ...overrides,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.payableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorInvoiceSourceLink.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.costCentre.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Finance Phase 4A1 — AP foundation', () => {
  let fx: ApFixture

  beforeAll(async () => {
    await ensurePermissions()
    fx = await seedApFixture()
  })

  afterAll(async () => {
    if (fx) {
      await cleanupTenant(fx.tenantAId)
      await cleanupTenant(fx.tenantBId)
    }
  })

  it('exposes Prisma AP models', () => {
    expect(prisma.vendorInvoice).toBeDefined()
    expect(prisma.vendorInvoiceLine).toBeDefined()
    expect(prisma.vendorInvoiceSourceLink).toBeDefined()
    expect(prisma.payableOpenItem).toBeDefined()
  })

  describe('VendorInvoice creation', () => {
    it('creates draft with null vendorInvoiceNumber, accountingVoucherId, postingEventId', async () => {
      const input = await buildInvoiceInput(fx)
      const invoice = await createVendorInvoiceRecord(input)

      expect(invoice.status).toBe('DRAFT')
      expect(invoice.vendorInvoiceNumber).toBeNull()
      expect(invoice.accountingVoucherId).toBeNull()
      expect(invoice.postingEventId).toBeNull()
      expect(invoice.draftReference).toBe(input.draftReference)

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('persists zero totals on new draft', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))

      expect(invoice.grossAmount.toString()).toBe('0')
      expect(invoice.taxableAmount.toString()).toBe('0')
      expect(invoice.invoiceGrandTotal.toString()).toBe('0')
      expect(invoice.vendorPayableAmount.toString()).toBe('0')
      expect(invoice.baseInvoiceGrandTotal.toString()).toBe('0')

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('persists vendor snapshots on header', async () => {
      const invoice = await createVendorInvoiceRecord(
        await buildInvoiceInput(fx, {
          vendorCodeSnapshot: 'VEND-A',
          vendorNameSnapshot: 'Vendor A Pvt Ltd',
          vendorGstinSnapshot: '27AAAAA0000A1Z5',
          vendorPanSnapshot: 'AAAAA0000A',
          vendorStateCodeSnapshot: '27',
          vendorAddressSnapshot: { line1: '123 Industrial Area' },
        }),
      )

      expect(invoice.vendorCodeSnapshot).toBe('VEND-A')
      expect(invoice.vendorNameSnapshot).toBe('Vendor A Pvt Ltd')
      expect(invoice.vendorGstinSnapshot).toBe('27AAAAA0000A1Z5')
      expect(invoice.vendorPanSnapshot).toBe('AAAAA0000A')
      expect(invoice.vendorStateCodeSnapshot).toBe('27')
      expect(invoice.vendorAddressSnapshot).toEqual({ line1: '123 Industrial Area' })

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('finds invoice by draft reference and supplier invoice', async () => {
      const input = await buildInvoiceInput(fx, { supplierInvoiceNumber: 'FIND-ME-001' })
      const created = await createVendorInvoiceRecord(input)

      const byDraft = await findVendorInvoiceByDraftReference(fx.tenantAId, input.draftReference)
      expect(byDraft?.id).toBe(created.id)

      const bySupplier = await findVendorInvoiceBySupplierInvoice(
        fx.tenantAId,
        fx.legalEntityAId,
        fx.vendorAId,
        normalizeSupplierInvoiceNumber('FIND-ME-001'),
      )
      expect(bySupplier.some((i) => i.id === created.id)).toBe(true)

      expect(
        await findVendorInvoiceByInternalNumber(fx.tenantAId, fx.legalEntityAId, 'NOT-ASSIGNED'),
      ).toBeNull()

      await prisma.vendorInvoice.delete({ where: { id: created.id } })
    })
  })

  describe('VendorInvoiceLine', () => {
    it('replaces multiple lines with unique line numbers per invoice', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const lines = await replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        { lineNumber: 1, lineType: 'ITEM', description: 'Steel rods', quantity: '10', unitPrice: '100' },
        { lineNumber: 2, lineType: 'FREIGHT', description: 'Freight charge', lineTotal: '500' },
      ])

      expect(lines).toHaveLength(2)
      expect(lines[0].lineNumber).toBe(1)
      expect(lines[1].lineNumber).toBe(2)

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('allows same line number on a different invoice', async () => {
      const inv1 = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const inv2 = await createVendorInvoiceRecord(await buildInvoiceInput(fx))

      await replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, inv1.id, [
        { lineNumber: 1, lineType: 'ITEM', description: 'Line on inv1' },
      ])
      await replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, inv2.id, [
        { lineNumber: 1, lineType: 'ITEM', description: 'Line on inv2' },
      ])

      const lines1 = await listVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, inv1.id)
      const lines2 = await listVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, inv2.id)
      expect(lines1[0].lineNumber).toBe(1)
      expect(lines2[0].lineNumber).toBe(1)

      await prisma.vendorInvoice.deleteMany({ where: { id: { in: [inv1.id, inv2.id] } } })
    })

    it('rejects duplicate line numbers in replace payload', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      await expect(
        replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id, [
          { lineNumber: 1, lineType: 'ITEM', description: 'A' },
          { lineNumber: 1, lineType: 'SERVICE', description: 'B' },
        ]),
      ).rejects.toBeInstanceOf(VendorInvoiceLineConflictError)

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('allows optional itemId for SERVICE and EXPENSE lines', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const lines = await replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        { lineNumber: 1, lineType: 'SERVICE', description: 'Consulting', itemId: null },
        { lineNumber: 2, lineType: 'EXPENSE', description: 'Travel', itemId: null },
      ])

      expect(lines.every((l) => l.itemId === null)).toBe(true)

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('allows null debitAccountId on lines', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const lines = await replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        { lineNumber: 1, lineType: 'EXPENSE', description: 'Unallocated', debitAccountId: null },
      ])

      expect(lines[0].debitAccountId).toBeNull()

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('persists decimal precision and hsnSac on lines', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      await replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        {
          lineNumber: 1,
          lineType: 'ITEM',
          description: 'Precision line',
          hsnSacCode: '7308',
          quantity: '10.123456',
          unitPrice: '99.9999',
          cgstRate: '9.0000',
          lineTotal: '1234.5678',
        },
      ])

      const lines = await listVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id)
      expect(lines[0].hsnSacCode).toBe('7308')
      expect(lines[0].quantity.toString()).toBe('10.123456')
      expect(lines[0].unitPrice.toString()).toBe(formatForPersistence('99.9999'))
      expect(formatForPersistence(lines[0].cgstRate)).toBe(formatForPersistence('9.0000'))
      expect(lines[0].lineTotal.toString()).toBe(formatForPersistence('1234.5678'))

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('persists cost centre and tenant/legal-entity scope on lines', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      await replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        {
          lineNumber: 1,
          lineType: 'EXPENSE',
          description: 'CC line',
          debitAccountId: fx.expenseAccountId,
          costCentreId: fx.costCentreId,
        },
      ])

      const lines = await listVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id)
      expect(lines[0].costCentreId).toBe(fx.costCentreId)
      expect(lines[0].debitAccountId).toBe(fx.expenseAccountId)
      expect(lines[0].tenantId).toBe(fx.tenantAId)
      expect(lines[0].legalEntityId).toBe(fx.legalEntityAId)

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })
  })

  describe('Invoice/line types', () => {
    it('accepts all VendorInvoiceType enum values', async () => {
      for (const invoiceType of VENDOR_INVOICE_TYPES) {
        const invoice = await createVendorInvoiceRecord(
          await buildInvoiceInput(fx, { invoiceType }),
        )
        expect(invoice.invoiceType).toBe(invoiceType)
        await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
      }
    })

    it('accepts all VendorInvoiceLineType enum values', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const lineInputs = VENDOR_INVOICE_LINE_TYPES.map((lineType, idx) => ({
        lineNumber: idx + 1,
        lineType,
        description: `${lineType} line`,
      }))
      const lines = await replaceVendorInvoiceLines(
        fx.tenantAId,
        fx.legalEntityAId,
        invoice.id,
        lineInputs,
      )
      expect(lines.map((l) => l.lineType).sort()).toEqual([...VENDOR_INVOICE_LINE_TYPES].sort())

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })
  })

  describe('Normalisation', () => {
    it('trims, uppercases, and collapses internal whitespace', () => {
      expect(normalizeSupplierInvoiceNumber('  inv  123  ')).toBe('INV 123')
      expect(normalizeSupplierInvoiceNumber('abc/def')).toBe('ABC/DEF')
    })

    it('preserves slash and dash — does not equate ABC-001 with ABC/001', () => {
      expect(normalizeSupplierInvoiceNumber('ABC-001')).not.toBe(normalizeSupplierInvoiceNumber('ABC/001'))
      expect(normalizeSupplierInvoiceNumber('ABC-001')).toBe('ABC-001')
      expect(normalizeSupplierInvoiceNumber('ABC/001')).toBe('ABC/001')
    })

    it('builds deterministic supplier invoice uniqueness key', () => {
      const key = buildSupplierInvoiceUniquenessKey({
        tenantId: 'tenant-1',
        legalEntityId: 'le-1',
        vendorId: 'vendor-1',
        financialYearId: 'fy-1',
        supplierInvoiceNumberNormalized: 'INV-001',
      })
      expect(key).toBe('tenant-1|le-1|vendor-1|fy-1|INV-001')
    })
  })

  describe('Duplicate key', () => {
    it('allows multiple drafts with null supplierInvoiceUniquenessKey', async () => {
      const inv1 = await createVendorInvoiceRecord(
        await buildInvoiceInput(fx, { supplierInvoiceUniquenessKey: null }),
      )
      const inv2 = await createVendorInvoiceRecord(
        await buildInvoiceInput(fx, { supplierInvoiceUniquenessKey: null }),
      )
      expect(inv1.supplierInvoiceUniquenessKey).toBeNull()
      expect(inv2.supplierInvoiceUniquenessKey).toBeNull()

      await prisma.vendorInvoice.deleteMany({ where: { id: { in: [inv1.id, inv2.id] } } })
    })

    it('rejects duplicate supplierInvoiceUniquenessKey', async () => {
      const supplierNum = `DUP-${Date.now()}`
      const normalized = normalizeSupplierInvoiceNumber(supplierNum)
      const key = buildSupplierInvoiceUniquenessKey({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        vendorId: fx.vendorAId,
        financialYearId: fx.financialYearAId,
        supplierInvoiceNumberNormalized: normalized,
      })

      const inv1 = await createVendorInvoiceRecord(
        await buildInvoiceInput(fx, {
          supplierInvoiceNumber: supplierNum,
          supplierInvoiceNumberNormalized: normalized,
          supplierInvoiceUniquenessKey: key,
        }),
      )

      await expect(
        createVendorInvoiceRecord(
          await buildInvoiceInput(fx, {
            supplierInvoiceNumber: supplierNum,
            supplierInvoiceNumberNormalized: normalized,
            supplierInvoiceUniquenessKey: key,
          }),
        ),
      ).rejects.toMatchObject({ code: 'VENDOR_INVOICE_DUPLICATE_UNIQUENESS_KEY' })

      await prisma.vendorInvoice.delete({ where: { id: inv1.id } })
    })

    it('allows same supplier number for different vendors when keys differ', async () => {
      const supplierNum = `SHARED-${Date.now()}`
      const normalized = normalizeSupplierInvoiceNumber(supplierNum)

      const invA = await createVendorInvoiceRecord(
        await buildInvoiceInput(fx, {
          vendorId: fx.vendorAId,
          supplierInvoiceNumber: supplierNum,
          supplierInvoiceNumberNormalized: normalized,
          supplierInvoiceUniquenessKey: buildSupplierInvoiceUniquenessKey({
            tenantId: fx.tenantAId,
            legalEntityId: fx.legalEntityAId,
            vendorId: fx.vendorAId,
            financialYearId: fx.financialYearAId,
            supplierInvoiceNumberNormalized: normalized,
          }),
        }),
      )
      const invB = await createVendorInvoiceRecord(
        await buildInvoiceInput(fx, {
          vendorId: fx.vendorBId,
          supplierInvoiceNumber: supplierNum,
          supplierInvoiceNumberNormalized: normalized,
          supplierInvoiceUniquenessKey: buildSupplierInvoiceUniquenessKey({
            tenantId: fx.tenantAId,
            legalEntityId: fx.legalEntityAId,
            vendorId: fx.vendorBId,
            financialYearId: fx.financialYearAId,
            supplierInvoiceNumberNormalized: normalized,
          }),
        }),
      )

      expect(invA.vendorId).toBe(fx.vendorAId)
      expect(invB.vendorId).toBe(fx.vendorBId)

      await prisma.vendorInvoice.deleteMany({ where: { id: { in: [invA.id, invB.id] } } })
    })

    it('allows same supplier number across different financial years when keys differ', async () => {
      const supplierNum = `FY-DUP-${Date.now()}`
      const normalized = normalizeSupplierInvoiceNumber(supplierNum)

      const fy2 = await prisma.financialYear.create({
        data: {
          tenantId: fx.tenantAId,
          legalEntityId: fx.legalEntityAId,
          name: `FY Alt ${Date.now()}`,
          startDate: new Date('2027-04-01'),
          endDate: new Date('2028-03-31'),
          status: 'ACTIVE',
        },
      })

      const inv1 = await createVendorInvoiceRecord(
        await buildInvoiceInput(fx, {
          financialYearId: fx.financialYearAId,
          supplierInvoiceNumber: supplierNum,
          supplierInvoiceNumberNormalized: normalized,
          supplierInvoiceUniquenessKey: buildSupplierInvoiceUniquenessKey({
            tenantId: fx.tenantAId,
            legalEntityId: fx.legalEntityAId,
            vendorId: fx.vendorAId,
            financialYearId: fx.financialYearAId,
            supplierInvoiceNumberNormalized: normalized,
          }),
        }),
      )
      const inv2 = await createVendorInvoiceRecord(
        await buildInvoiceInput(fx, {
          financialYearId: fy2.id,
          supplierInvoiceNumber: supplierNum,
          supplierInvoiceNumberNormalized: normalized,
          supplierInvoiceUniquenessKey: buildSupplierInvoiceUniquenessKey({
            tenantId: fx.tenantAId,
            legalEntityId: fx.legalEntityAId,
            vendorId: fx.vendorAId,
            financialYearId: fy2.id,
            supplierInvoiceNumberNormalized: normalized,
          }),
        }),
      )

      expect(inv1.financialYearId).toBe(fx.financialYearAId)
      expect(inv2.financialYearId).toBe(fy2.id)

      await prisma.vendorInvoice.deleteMany({ where: { id: { in: [inv1.id, inv2.id] } } })
      await prisma.financialYear.delete({ where: { id: fy2.id } })
    })
  })

  describe('Source links', () => {
    it('creates direct invoice with no source links', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const links = await createVendorInvoiceSourceLinks(
        fx.tenantAId,
        fx.legalEntityAId,
        invoice.id,
        [],
      )
      expect(links).toEqual([])
      expect(await listVendorInvoiceSourceLinks(fx.tenantAId, fx.legalEntityAId, invoice.id)).toEqual(
        [],
      )

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('creates multiple purchase-order links on one invoice', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const po1 = '00000000-0000-4000-8000-000000000001'
      const po2 = '00000000-0000-4000-8000-000000000002'

      const links = await createVendorInvoiceSourceLinks(
        fx.tenantAId,
        fx.legalEntityAId,
        invoice.id,
        [
          { sourceType: 'PURCHASE_ORDER', sourceDocumentId: po1, sourceDocumentNumberSnapshot: 'PO-001' },
          { sourceType: 'PURCHASE_ORDER', sourceDocumentId: po2, sourceDocumentNumberSnapshot: 'PO-002' },
        ],
      )

      expect(links).toHaveLength(2)
      expect(links.map((l) => l.sourceDocumentId).sort()).toEqual([po1, po2].sort())

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('blocks duplicate sourceType + sourceDocumentId on same invoice', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const poId = '00000000-0000-4000-8000-000000000099'

      await createVendorInvoiceSourceLinks(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        { sourceType: 'PURCHASE_ORDER', sourceDocumentId: poId },
      ])

      await expect(
        createVendorInvoiceSourceLinks(fx.tenantAId, fx.legalEntityAId, invoice.id, [
          { sourceType: 'PURCHASE_ORDER', sourceDocumentId: poId },
        ]),
      ).rejects.toBeInstanceOf(VendorInvoiceSourceLinkConflictError)

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('allows same sourceDocumentId with different sourceType', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const docId = '00000000-0000-4000-8000-000000000088'

      const links = await createVendorInvoiceSourceLinks(
        fx.tenantAId,
        fx.legalEntityAId,
        invoice.id,
        [
          { sourceType: 'PURCHASE_ORDER', sourceDocumentId: docId },
          { sourceType: 'CONTRACT', sourceDocumentId: docId },
        ],
      )

      expect(links).toHaveLength(2)
      expect(new Set(links.map((l) => l.sourceType)).size).toBe(2)

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('persists snapshots and metadata on source links', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const docDate = new Date('2026-03-15')

      const links = await createVendorInvoiceSourceLinks(
        fx.tenantAId,
        fx.legalEntityAId,
        invoice.id,
        [
          {
            sourceType: 'PROJECT',
            sourceDocumentId: '00000000-0000-4000-8000-000000000077',
            sourceDocumentNumberSnapshot: 'PRJ-77',
            sourceDocumentDateSnapshot: docDate,
            metadata: { phase: 'foundation' },
          },
        ],
      )

      expect(links[0].sourceDocumentNumberSnapshot).toBe('PRJ-77')
      expect(links[0].sourceDocumentDateSnapshot?.toISOString().slice(0, 10)).toBe('2026-03-15')
      expect(links[0].metadata).toEqual({ phase: 'foundation' })

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('does not require deferred purchase/stock tables', async () => {
      expect('purchaseOrder' in prisma).toBe(false)
      expect('goodsReceipt' in prisma).toBe(false)

      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const links = await createVendorInvoiceSourceLinks(
        fx.tenantAId,
        fx.legalEntityAId,
        invoice.id,
        [
          {
            sourceType: 'PURCHASE_ORDER',
            sourceDocumentId: '00000000-0000-4000-8000-000000000055',
            sourceDocumentNumberSnapshot: 'PO-SOFT-REF',
          },
        ],
      )
      expect(links).toHaveLength(1)

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })
  })

  describe('PayableOpenItem schema', () => {
    it('creates CREDIT open item for vendor invoice with positive amounts', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const item = await createPayableOpenItemRecord({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        branchId: fx.branchId,
        vendorId: fx.vendorAId,
        vendorCodeSnapshot: 'VEND-A',
        vendorNameSnapshot: 'Vendor A Pvt Ltd',
        side: 'CREDIT',
        documentType: 'VENDOR_INVOICE',
        documentId: invoice.id,
        documentNumber: invoice.draftReference,
        documentDate: new Date('2026-04-15'),
        postingDate: new Date('2026-04-15'),
        originalAmount: '1180.0000',
        outstandingAmount: '1180.0000',
        baseOriginalAmount: '1180.0000',
        baseOutstandingAmount: '1180.0000',
        vendorPayableAccountId: fx.payableAccountId,
        sourceVendorInvoiceId: invoice.id,
      })

      expect(item.side).toBe('CREDIT')
      expect(item.documentType).toBe('VENDOR_INVOICE')
      expect(item.sourceVendorInvoiceId).toBe(invoice.id)
      expect(formatForPersistence(item.originalAmount)).toBe(formatForPersistence('1180.0000'))
      expect(item.outstandingAmount.gt(0)).toBe(true)

      const found = await findPayableOpenItemBySourceVendorInvoice(
        fx.tenantAId,
        fx.legalEntityAId,
        invoice.id,
      )
      expect(found?.id).toBe(item.id)

      await prisma.payableOpenItem.delete({ where: { id: item.id } })
      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('creates DEBIT open item compatible with future payment documents', async () => {
      const paymentDocId = '00000000-0000-4000-8000-000000000066'
      const item = await createPayableOpenItemRecord({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        vendorId: fx.vendorAId,
        vendorCodeSnapshot: 'VEND-A',
        vendorNameSnapshot: 'Vendor A Pvt Ltd',
        side: 'DEBIT',
        documentType: 'VENDOR_PAYMENT',
        documentId: paymentDocId,
        documentNumber: 'PAY-001',
        documentDate: new Date('2026-04-20'),
        postingDate: new Date('2026-04-20'),
        originalAmount: '500.0000',
        outstandingAmount: '500.0000',
        baseOriginalAmount: '500.0000',
        baseOutstandingAmount: '500.0000',
        vendorPayableAccountId: fx.payableAccountId,
        sourceVendorInvoiceId: null,
      })

      expect(item.side).toBe('DEBIT')
      expect(item.documentType).toBe('VENDOR_PAYMENT')
      expect(item.sourceVendorInvoiceId).toBeNull()
      expect(item.outstandingAmount.gt(0)).toBe(true)

      await prisma.payableOpenItem.delete({ where: { id: item.id } })
    })
  })

  describe('Payable uniqueness', () => {
    it('rejects second open item with same sourceVendorInvoiceId', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const base = {
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        vendorId: fx.vendorAId,
        vendorCodeSnapshot: 'VEND-A',
        vendorNameSnapshot: 'Vendor A Pvt Ltd',
        side: 'CREDIT' as const,
        documentType: 'VENDOR_INVOICE' as const,
        documentId: invoice.id,
        documentNumber: invoice.draftReference,
        documentDate: new Date('2026-04-15'),
        postingDate: new Date('2026-04-15'),
        originalAmount: '100.0000',
        outstandingAmount: '100.0000',
        baseOriginalAmount: '100.0000',
        baseOutstandingAmount: '100.0000',
        vendorPayableAccountId: fx.payableAccountId,
        sourceVendorInvoiceId: invoice.id,
      }

      await createPayableOpenItemRecord(base)
      await expect(createPayableOpenItemRecord(base)).rejects.toBeInstanceOf(
        PayableOpenItemDuplicateSourceError,
      )

      await prisma.payableOpenItem.deleteMany({ where: { sourceVendorInvoiceId: invoice.id } })
      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })
  })

  describe('Tenant isolation', () => {
    it('does not return Tenant A invoice to Tenant B via findVendorInvoiceById', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      const cross = await findVendorInvoiceById(fx.tenantBId, fx.legalEntityAId, invoice.id)
      expect(cross).toBeNull()

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('does not return Tenant A lines to Tenant B', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      await replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        { lineNumber: 1, lineType: 'ITEM', description: 'Isolated line' },
      ])

      const lines = await listVendorInvoiceLines(fx.tenantBId, fx.legalEntityAId, invoice.id)
      expect(lines).toEqual([])

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('does not return Tenant A source links to Tenant B', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      await createVendorInvoiceSourceLinks(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        {
          sourceType: 'OTHER',
          sourceDocumentId: '00000000-0000-4000-8000-000000000033',
        },
      ])

      const links = await listVendorInvoiceSourceLinks(fx.tenantBId, fx.legalEntityAId, invoice.id)
      expect(links).toEqual([])

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('does not return Tenant A payable open item to Tenant B', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      await createPayableOpenItemRecord({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        vendorId: fx.vendorAId,
        vendorCodeSnapshot: 'VEND-A',
        vendorNameSnapshot: 'Vendor A Pvt Ltd',
        side: 'CREDIT',
        documentType: 'VENDOR_INVOICE',
        documentId: invoice.id,
        documentNumber: invoice.draftReference,
        documentDate: new Date('2026-04-15'),
        postingDate: new Date('2026-04-15'),
        originalAmount: '200.0000',
        outstandingAmount: '200.0000',
        baseOriginalAmount: '200.0000',
        baseOutstandingAmount: '200.0000',
        vendorPayableAccountId: fx.payableAccountId,
        sourceVendorInvoiceId: invoice.id,
      })

      const cross = await findPayableOpenItemBySourceVendorInvoice(
        fx.tenantBId,
        fx.legalEntityAId,
        invoice.id,
      )
      expect(cross).toBeNull()

      await prisma.payableOpenItem.deleteMany({ where: { sourceVendorInvoiceId: invoice.id } })
      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('seeds Tenant B vendor invoice invisible to Tenant A repos', async () => {
      const draftRef = await generateUniqueDraftReference(fx.tenantBId)
      const supplierNum = `TB-${Date.now()}`
      const invB = await createVendorInvoiceRecord({
        tenantId: fx.tenantBId,
        legalEntityId: fx.legalEntityTenantBId,
        vendorId: fx.vendorTenantBId,
        financialYearId: fx.financialYearTenantBId,
        draftReference: draftRef,
        supplierInvoiceNumber: supplierNum,
        supplierInvoiceNumberNormalized: normalizeSupplierInvoiceNumber(supplierNum),
        supplierInvoiceDate: new Date('2026-04-15'),
        invoiceType: 'GOODS',
        documentDate: new Date('2026-04-15'),
        vendorCodeSnapshot: 'V-TB',
        vendorNameSnapshot: 'Tenant B Vendor',
      })

      expect(await findVendorInvoiceById(fx.tenantAId, fx.legalEntityAId, invB.id)).toBeNull()
      expect(await findVendorInvoiceByDraftReference(fx.tenantAId, draftRef)).toBeNull()

      await prisma.vendorInvoice.delete({ where: { id: invB.id } })
    })
  })

  describe('Legal entity isolation', () => {
    it('does not return LE B invoice when querying with LE A filters', async () => {
      const draftRef = await generateUniqueDraftReference(fx.tenantAId)
      const invB = await createVendorInvoiceRecord({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityBId,
        vendorId: fx.vendorAId,
        financialYearId: fx.financialYearBId,
        draftReference: draftRef,
        supplierInvoiceNumber: `LEB-${Date.now()}`,
        supplierInvoiceNumberNormalized: normalizeSupplierInvoiceNumber(`LEB-${Date.now()}`),
        supplierInvoiceDate: new Date('2026-04-15'),
        invoiceType: 'SERVICE',
        documentDate: new Date('2026-04-15'),
        vendorCodeSnapshot: 'VEND-A',
        vendorNameSnapshot: 'Vendor A Pvt Ltd',
      })

      expect(await findVendorInvoiceById(fx.tenantAId, fx.legalEntityAId, invB.id)).toBeNull()
      expect(await listVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invB.id)).toEqual([])

      await prisma.vendorInvoice.delete({ where: { id: invB.id } })
    })
  })

  describe('Delete behaviour', () => {
    it('allows deleting MasterVendor referenced by invoice (soft ref — no FK)', async () => {
      const ephemeralVendor = await prisma.masterVendor.create({
        data: {
          tenantId: fx.tenantAId,
          code: `V-DEL-${Date.now()}`.slice(-12),
          name: 'Ephemeral Vendor',
        },
      })
      const invoice = await createVendorInvoiceRecord(
        await buildInvoiceInput(fx, { vendorId: ephemeralVendor.id }),
      )

      await expect(
        prisma.masterVendor.delete({ where: { id: ephemeralVendor.id } }),
      ).resolves.toBeDefined()

      const stillThere = await prisma.vendorInvoice.findUnique({ where: { id: invoice.id } })
      expect(stillThere?.vendorId).toBe(ephemeralVendor.id)

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })

    it('cascades delete of VendorInvoice to lines and source links', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      await replaceVendorInvoiceLines(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        { lineNumber: 1, lineType: 'ITEM', description: 'Cascade line' },
      ])
      await createVendorInvoiceSourceLinks(fx.tenantAId, fx.legalEntityAId, invoice.id, [
        {
          sourceType: 'OTHER',
          sourceDocumentId: '00000000-0000-4000-8000-000000000044',
        },
      ])

      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })

      expect(await prisma.vendorInvoiceLine.count({ where: { vendorInvoiceId: invoice.id } })).toBe(0)
      expect(
        await prisma.vendorInvoiceSourceLink.count({ where: { vendorInvoiceId: invoice.id } }),
      ).toBe(0)
    })

    it('restricts deleting VendorInvoice when PayableOpenItem is linked', async () => {
      const invoice = await createVendorInvoiceRecord(await buildInvoiceInput(fx))
      await createPayableOpenItemRecord({
        tenantId: fx.tenantAId,
        legalEntityId: fx.legalEntityAId,
        vendorId: fx.vendorAId,
        vendorCodeSnapshot: 'VEND-A',
        vendorNameSnapshot: 'Vendor A Pvt Ltd',
        side: 'CREDIT',
        documentType: 'VENDOR_INVOICE',
        documentId: invoice.id,
        documentNumber: invoice.draftReference,
        documentDate: new Date('2026-04-15'),
        postingDate: new Date('2026-04-15'),
        originalAmount: '300.0000',
        outstandingAmount: '300.0000',
        baseOriginalAmount: '300.0000',
        baseOutstandingAmount: '300.0000',
        vendorPayableAccountId: fx.payableAccountId,
        sourceVendorInvoiceId: invoice.id,
      })

      await expect(prisma.vendorInvoice.delete({ where: { id: invoice.id } })).rejects.toThrow()

      await prisma.payableOpenItem.deleteMany({ where: { sourceVendorInvoiceId: invoice.id } })
      await prisma.vendorInvoice.delete({ where: { id: invoice.id } })
    })
  })

  describe('Number series', () => {
    it('creates FinanceNumberSeries with documentType VENDOR_INVOICE without incrementing', async () => {
      const before = await prisma.financeNumberSeries.count({ where: { tenantId: fx.tenantAId } })
      const series = await prisma.financeNumberSeries.create({
        data: {
          tenantId: fx.tenantAId,
          legalEntityId: fx.legalEntityAId,
          financialYearId: fx.financialYearAId,
          documentType: 'VENDOR_INVOICE',
          prefix: 'VINV-',
          currentValue: 0,
          padLength: 6,
        },
      })

      expect(series.documentType).toBe('VENDOR_INVOICE')
      expect(series.currentValue).toBe(0)

      const after = await prisma.financeNumberSeries.count({ where: { tenantId: fx.tenantAId } })
      expect(after).toBe(before + 1)

      await prisma.financeNumberSeries.delete({ where: { id: series.id } })
    })

    it('does not modify CRM CodeSeries rows', async () => {
      const codeSeriesBefore = await prisma.codeSeries.count({ where: { tenantId: fx.tenantAId } })

      const series = await prisma.financeNumberSeries.create({
        data: {
          tenantId: fx.tenantAId,
          legalEntityId: fx.legalEntityAId,
          documentType: 'VENDOR_INVOICE',
          prefix: 'VINV-',
          currentValue: 0,
          padLength: 6,
        },
      })

      const codeSeriesAfter = await prisma.codeSeries.count({ where: { tenantId: fx.tenantAId } })
      expect(codeSeriesAfter).toBe(codeSeriesBefore)

      await prisma.financeNumberSeries.delete({ where: { id: series.id } })
    })
  })

  describe('Permissions', () => {
    it('registers AP permissions in PERMISSIONS array', () => {
      for (const perm of AP_PERMS) {
        expect(PERMISSIONS).toContain(perm)
      }
    })

    it('keeps AP permission names unique', () => {
      const apInPermissions = PERMISSIONS.filter((p) => p.startsWith('finance.ap.'))
      expect(new Set(apInPermissions).size).toBe(apInPermissions.length)
    })

    it('retains existing finance.ar.* permissions', () => {
      for (const perm of AR_SAMPLE) {
        expect(PERMISSIONS).toContain(perm)
      }
    })

    it('grants Finance Executive AP view via FINANCE_VIEW filter', () => {
      const execPerms = ROLE_PERMISSIONS['Finance Executive']
      expect(execPerms).toContain('finance.ap.view')
      expect(execPerms).toContain('finance.ap.vendor_invoice.view')
      expect(execPerms).toContain('finance.ap.open_item.view')
      expect(execPerms).not.toContain('finance.ap.vendor_invoice.post')
      expect(execPerms).not.toContain('finance.ap.vendor_invoice.approve')
    })

    it('grants Finance Manager full AP permissions via FINANCE_PERMISSIONS', () => {
      const mgrPerms = ROLE_PERMISSIONS['Finance Manager']
      for (const perm of AP_PERMS) {
        expect(mgrPerms).toContain(perm as PermissionName)
      }
    })

    it('grants Super Admin all AP permissions', () => {
      const adminPerms = ROLE_PERMISSIONS['Super Admin']
      for (const perm of AP_PERMS) {
        expect(adminPerms).toContain(perm)
      }
    })
  })
})
