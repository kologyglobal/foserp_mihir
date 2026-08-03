import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import * as crmAr from '../src/modules/accounting/receivables/source/crm-tax-invoice-ar.service.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('CRM tax invoice → Money In bridge', () => {
  let fx: ManufacturingFixture
  let companyId: string
  let invoiceId: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `crm-ar-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'CRM AR Bridge Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'crm-ar-user')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })

    const company = await prisma.crmCompany.create({
      data: {
        tenantId: tenant.id,
        companyCode: `C-${Date.now()}`,
        name: 'Bridge Test Customer',
        status: 'active',
        createdBy: user.userId,
        updatedBy: user.userId,
      },
    })
    companyId = company.id

    const inv = await prisma.crmTaxInvoice.create({
      data: {
        tenantId: tenant.id,
        invoiceNo: `INV-BR-${Date.now()}`,
        invoiceDate: new Date('2026-07-30'),
        dueDate: new Date('2026-08-20'),
        status: 'posted',
        paymentStatus: 'unpaid',
        accountingStatus: 'pending_review',
        accountingSubmittedAt: new Date(),
        companyId,
        customerNameSnapshot: company.name,
        taxableAmount: 1000,
        totalTaxAmount: 180,
        grandTotal: 1180,
        balanceDue: 1180,
        amountPaid: 0,
        createdBy: user.userId,
        createdByNameSnapshot: 'Bridge Tester',
        updatedBy: user.userId,
        lines: {
          create: [
            {
              tenantId: tenant.id,
              lineNo: 1,
              itemId: fx.componentItemId,
              itemCode: 'COMP-1',
              description: 'Test line',
              qty: 1,
              uom: 'NOS',
              unitPrice: 1000,
              taxPct: 18,
              taxableValue: 1000,
              gstAmount: 180,
              lineTotal: 1180,
            },
          ],
        },
      },
    })
    invoiceId = inv.id
  })

  afterAll(async () => {
    if (!fx?.tenantId) return
    await prisma.crmTaxInvoiceLine.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.crmTaxInvoice.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await prisma.crmCompany.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
    await cleanupTenant(fx.tenantId)
  })

  it('lists pending CRM tax invoices for Money In review', async () => {
    const result = await crmAr.listCrmPendingTaxInvoices(fx.tenantId)
    const row = result.items.find((i) => i.id === invoiceId)
    expect(row).toBeTruthy()
    expect(row!.accountingStatus).toBe('pending_review')
    expect(row!.createdByName).toBe('Bridge Tester')
  })

  it('prefills Money In draft fields from CRM tax invoice', async () => {
    const prefill = await crmAr.buildPrefillFromCrmTaxInvoice(fx.tenantId, invoiceId)
    expect(prefill.sourceType).toBe('CRM_TAX_INVOICE')
    expect(prefill.sourceDocumentId).toBe(invoiceId)
    expect(prefill.customerId).toBe(companyId)
    expect(prefill.lines.length).toBe(1)
    expect(prefill.lines[0].unitPrice).toBe('1000.00')
  })
})
