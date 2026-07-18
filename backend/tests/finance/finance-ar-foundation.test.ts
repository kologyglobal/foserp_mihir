import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, ROLE_PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import {
  findCustomerParty,
  findCustomerParties,
  requireActiveCustomerParty,
} from '../../src/modules/accounting/receivables/customer-party/customer-party.service.js'
import { CustomerPartyNotFoundError, InactiveCustomerPartyError } from '../../src/modules/accounting/receivables/customer-party/customer-party.errors.js'
import * as salesInvoiceRepo from '../../src/modules/accounting/receivables/sales-invoices/sales-invoice.repository.js'
import * as openItemRepo from '../../src/modules/accounting/receivables/receivable-open-items/receivable-open-item.repository.js'
import { formatForPersistence } from '../../src/modules/accounting/shared/finance-decimal.js'

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const AR_PERMS = [
  'finance.ar.view',
  'finance.ar.invoice.view',
  'finance.ar.invoice.create',
  'finance.ar.invoice.edit',
  'finance.ar.invoice.post',
  'finance.ar.invoice.cancel',
  'finance.ar.reconcile.view',
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

interface ArFixture {
  tenantId: string
  otherTenantId: string
  legalEntityId: string
  customerId: string
  inactiveCustomerId: string
  otherTenantCustomerId: string
  revenueAccountId: string
}

async function seedArFixture(): Promise<ArFixture> {
  const tenant = await prisma.tenant.create({
    data: { name: 'AR Test', slug: `ar-test-${Date.now()}`, email: `ar-${Date.now()}@test.com`, status: 'ACTIVE' },
  })
  const otherTenant = await prisma.tenant.create({
    data: {
      name: 'AR Other',
      slug: `ar-other-${Date.now()}`,
      email: `ar-other-${Date.now()}@test.com`,
      status: 'ACTIVE',
    },
  })

  const le = await prisma.legalEntity.create({
    data: {
      tenantId: tenant.id,
      code: `AR${Date.now()}`.slice(-8),
      legalName: 'AR Test Co',
      displayName: 'AR Test Co',
      isDefault: true,
    },
  })

  const revenue = await prisma.account.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      accountCode: '4100',
      accountName: 'Sales Revenue',
      category: 'INCOME',
      isGroup: false,
      level: 1,
    },
  })

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: tenant.id,
      companyCode: `CUST-${Date.now()}`.slice(-8),
      name: 'Active Customer Pvt Ltd',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      state: 'Maharashtra',
      country: 'India',
      creditDays: 30,
      status: 'active',
      isActive: true,
    },
  })

  const inactiveCustomer = await prisma.crmCompany.create({
    data: {
      tenantId: tenant.id,
      companyCode: `INAC-${Date.now()}`.slice(-8),
      name: 'Inactive Customer',
      status: 'inactive',
      isActive: false,
    },
  })

  const otherCustomer = await prisma.crmCompany.create({
    data: {
      tenantId: otherTenant.id,
      companyCode: `OTH-${Date.now()}`.slice(-8),
      name: 'Other Tenant Customer',
      status: 'active',
      isActive: true,
    },
  })

  return {
    tenantId: tenant.id,
    otherTenantId: otherTenant.id,
    legalEntityId: le.id,
    customerId: customer.id,
    inactiveCustomerId: inactiveCustomer.id,
    otherTenantCustomerId: otherCustomer.id,
    revenueAccountId: revenue.id,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Finance Phase 3A1 — AR foundation', () => {
  let fx: ArFixture

  beforeAll(async () => {
    await ensurePermissions()
    fx = await seedArFixture()
  })

  afterAll(async () => {
    if (fx) {
      await cleanupTenant(fx.tenantId)
      await cleanupTenant(fx.otherTenantId)
    }
  })

  it('exposes Prisma AR models', () => {
    expect(prisma.salesInvoice).toBeDefined()
    expect(prisma.salesInvoiceLine).toBeDefined()
    expect(prisma.receivableOpenItem).toBeDefined()
  })

  it('maps active CrmCompany via customer-party adapter', async () => {
    const party = await findCustomerParty(fx.tenantId, fx.customerId)
    expect(party).not.toBeNull()
    expect(party!.id).toBe(fx.customerId)
    expect(party!.code).toBeTruthy()
    expect(party!.name).toBe('Active Customer Pvt Ltd')
    expect(party!.gstin).toBe('27AAAAA0000A1Z5')
    expect(party!.creditDays).toBe(30)
    expect(party!.currencyCode).toBe('INR')
    expect(party!.receivableAccountId).toBeNull()
    expect(party!.isActive).toBe(true)
    expect(party!.billingAddress.line1).toBeNull()
  })

  it('rejects inactive customer via requireActiveCustomerParty', async () => {
    await expect(requireActiveCustomerParty(fx.tenantId, fx.inactiveCustomerId)).rejects.toBeInstanceOf(
      InactiveCustomerPartyError,
    )
  })

  it('returns null for missing customer', async () => {
    const missing = '00000000-0000-4000-8000-000000000099'
    await expect(findCustomerParty(fx.tenantId, missing)).resolves.toBeNull()
    await expect(requireActiveCustomerParty(fx.tenantId, missing)).rejects.toBeInstanceOf(CustomerPartyNotFoundError)
  })

  it('isolates customer-party by tenant', async () => {
    const cross = await findCustomerParty(fx.tenantId, fx.otherTenantCustomerId)
    expect(cross).toBeNull()
  })

  it('lists customer parties tenant-scoped', async () => {
    const { items, total } = await findCustomerParties(fx.tenantId, { page: 1, limit: 50 })
    expect(total).toBeGreaterThanOrEqual(2)
    expect(items.every((p) => p.id !== fx.otherTenantCustomerId)).toBe(true)
  })

  it('allows multiple draft invoices with null invoiceNumber per legal entity', async () => {
    const inv1 = await prisma.salesInvoice.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Active Customer Pvt Ltd',
        invoiceDate: new Date('2026-04-01'),
        status: 'DRAFT',
      },
    })
    const inv2 = await prisma.salesInvoice.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Active Customer Pvt Ltd',
        invoiceDate: new Date('2026-04-02'),
        status: 'DRAFT',
      },
    })
    expect(inv1.invoiceNumber).toBeNull()
    expect(inv2.invoiceNumber).toBeNull()
    await prisma.salesInvoice.deleteMany({ where: { id: { in: [inv1.id, inv2.id] } } })
  })

  it('enforces unique invoiceNumber per legal entity', async () => {
    const number = `SI-${Date.now()}`
    const inv1 = await prisma.salesInvoice.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Active Customer Pvt Ltd',
        invoiceNumber: number,
        invoiceDate: new Date('2026-04-01'),
      },
    })
    await expect(
      prisma.salesInvoice.create({
        data: {
          tenantId: fx.tenantId,
          legalEntityId: fx.legalEntityId,
          customerId: fx.customerId,
          customerNameSnapshot: 'Active Customer Pvt Ltd',
          invoiceNumber: number,
          invoiceDate: new Date('2026-04-02'),
        },
      }),
    ).rejects.toThrow()
    await prisma.salesInvoice.delete({ where: { id: inv1.id } })
  })

  it('enforces unique lineNumber per sales invoice', async () => {
    const invoice = await prisma.salesInvoice.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Active Customer Pvt Ltd',
        invoiceDate: new Date('2026-04-01'),
      },
    })
    await prisma.salesInvoiceLine.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        salesInvoiceId: invoice.id,
        lineNumber: 1,
        quantity: new Prisma.Decimal('10.500000'),
        unitRate: new Prisma.Decimal('100.0000'),
      },
    })
    await expect(
      prisma.salesInvoiceLine.create({
        data: {
          tenantId: fx.tenantId,
          legalEntityId: fx.legalEntityId,
          salesInvoiceId: invoice.id,
          lineNumber: 1,
          quantity: new Prisma.Decimal('1'),
          unitRate: new Prisma.Decimal('1'),
        },
      }),
    ).rejects.toThrow()
    await prisma.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: invoice.id } })
    await prisma.salesInvoice.delete({ where: { id: invoice.id } })
  })

  it('enforces unique open item per document', async () => {
    const invoice = await prisma.salesInvoice.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Active Customer Pvt Ltd',
        invoiceDate: new Date('2026-04-01'),
        totalAmount: new Prisma.Decimal('1180.0000'),
      },
    })
    await prisma.receivableOpenItem.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        documentType: 'SALES_INVOICE',
        documentId: invoice.id,
        salesInvoiceId: invoice.id,
        customerId: fx.customerId,
        originalAmount: new Prisma.Decimal('1180.0000'),
        openAmount: new Prisma.Decimal('1180.0000'),
        baseOriginalAmount: new Prisma.Decimal('1180.0000'),
        baseOpenAmount: new Prisma.Decimal('1180.0000'),
      },
    })
    await expect(
      prisma.receivableOpenItem.create({
        data: {
          tenantId: fx.tenantId,
          legalEntityId: fx.legalEntityId,
          documentType: 'SALES_INVOICE',
          documentId: invoice.id,
          customerId: fx.customerId,
          originalAmount: new Prisma.Decimal('1180.0000'),
          openAmount: new Prisma.Decimal('1180.0000'),
          baseOriginalAmount: new Prisma.Decimal('1180.0000'),
          baseOpenAmount: new Prisma.Decimal('1180.0000'),
        },
      }),
    ).rejects.toThrow()
    await prisma.receivableOpenItem.deleteMany({ where: { salesInvoiceId: invoice.id } })
    await prisma.salesInvoice.delete({ where: { id: invoice.id } })
  })

  it('persists decimal precision in repository DTOs', async () => {
    const invoice = await prisma.salesInvoice.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Active Customer Pvt Ltd',
        invoiceDate: new Date('2026-04-01'),
        exchangeRate: new Prisma.Decimal('1.12345678'),
        totalAmount: new Prisma.Decimal('1234.5678'),
        baseTotalAmount: new Prisma.Decimal('1386.5432'),
      },
    })
    await prisma.salesInvoiceLine.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        salesInvoiceId: invoice.id,
        lineNumber: 1,
        quantity: new Prisma.Decimal('10.123456'),
        unitRate: new Prisma.Decimal('99.9999'),
        cgstRate: new Prisma.Decimal('9.0000'),
        lineTotal: new Prisma.Decimal('1234.5678'),
      },
    })

    const dto = await salesInvoiceRepo.findSalesInvoiceById(fx.tenantId, invoice.id, { includeLines: true })
    expect(dto!.exchangeRate).toBe('1.12345678')
    expect(dto!.totalAmount).toBe(formatForPersistence('1234.5678'))
    expect(dto!.lines![0].quantity).toBe('10.123456')
    expect(dto!.lines![0].cgstRate).toBe('9.0000')

    await prisma.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: invoice.id } })
    await prisma.salesInvoice.delete({ where: { id: invoice.id } })
  })

  it('includes SALES_INVOICE in FinanceDocumentType and can create number series row', async () => {
    const series = await prisma.financeNumberSeries.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        documentType: 'SALES_INVOICE',
        prefix: 'SINV-',
        currentValue: 0,
        padLength: 6,
      },
    })
    expect(series.documentType).toBe('SALES_INVOICE')
    await prisma.financeNumberSeries.delete({ where: { id: series.id } })
  })

  it('registers AR permissions in PERMISSIONS array', () => {
    for (const perm of AR_PERMS) {
      expect(PERMISSIONS).toContain(perm)
    }
  })

  it('Finance Executive role lacks finance.ar.invoice.post', () => {
    const execPerms = ROLE_PERMISSIONS['Finance Executive']
    expect(execPerms).toContain('finance.ar.invoice.create')
    expect(execPerms).toContain('finance.ar.invoice.edit')
    expect(execPerms).toContain('finance.ar.invoice.cancel')
    expect(execPerms).not.toContain('finance.ar.invoice.post')
  })

  it('Finance Manager role includes finance.ar.invoice.post via FINANCE_PERMISSIONS', () => {
    const mgrPerms = ROLE_PERMISSIONS['Finance Manager']
    expect(mgrPerms).toContain('finance.ar.invoice.post' as PermissionName)
  })

  it('mounts receivables sales invoice routes under accounting', () => {
    const routesPath = join(process.cwd(), 'src/modules/accounting/accounting.routes.ts')
    const source = readFileSync(routesPath, 'utf8')
    expect(source).toMatch(/receivablesRoutes|\/receivables/)
  })

  it('sales invoice repository find methods are tenant-scoped', async () => {
    const invoice = await prisma.salesInvoice.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Active Customer Pvt Ltd',
        invoiceDate: new Date('2026-04-01'),
      },
    })
    const found = await salesInvoiceRepo.findSalesInvoiceById(fx.otherTenantId, invoice.id)
    expect(found).toBeNull()
    const list = await salesInvoiceRepo.listSalesInvoices(fx.tenantId, {
      legalEntityId: fx.legalEntityId,
      page: 1,
      limit: 10,
    })
    expect(list.items.some((i) => i.id === invoice.id)).toBe(true)
    await prisma.salesInvoice.delete({ where: { id: invoice.id } })
  })

  it('open item repository find methods are tenant-scoped', async () => {
    const invoice = await prisma.salesInvoice.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        customerId: fx.customerId,
        customerNameSnapshot: 'Active Customer Pvt Ltd',
        invoiceDate: new Date('2026-04-01'),
        totalAmount: new Prisma.Decimal('500.0000'),
      },
    })
    const openItem = await prisma.receivableOpenItem.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        documentType: 'SALES_INVOICE',
        documentId: invoice.id,
        salesInvoiceId: invoice.id,
        customerId: fx.customerId,
        originalAmount: new Prisma.Decimal('500.0000'),
        openAmount: new Prisma.Decimal('500.0000'),
        baseOriginalAmount: new Prisma.Decimal('500.0000'),
        baseOpenAmount: new Prisma.Decimal('500.0000'),
      },
    })
    const dto = await openItemRepo.findReceivableOpenItemById(fx.tenantId, openItem.id)
    expect(dto!.openAmount).toBe('500.0000')
    expect(await openItemRepo.findReceivableOpenItemById(fx.otherTenantId, openItem.id)).toBeNull()
    await prisma.receivableOpenItem.delete({ where: { id: openItem.id } })
    await prisma.salesInvoice.delete({ where: { id: invoice.id } })
  })
})
