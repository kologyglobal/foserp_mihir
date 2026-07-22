/**
 * Wave 6 — AR master reuse over CrmCompany (soft links, no FinanceCustomer).
 *
 * Covers: CrmCompany resolve / unknown / cross-tenant rejection, snapshot
 * stability after CRM edits, refresh-from-master preview+apply, DIRECT vs
 * SALES_ORDER source modes, and the accounting lookup endpoints.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))

async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({ where: { name }, create: { name, module, description: name }, update: {} })
      .catch(() => {})
  }
}

interface Fixture {
  tenantId: string
  slug: string
  token: string
  legalEntityId: string
  customerId: string
  revenueAccountId: string
  postingDate: string
  invoiceDate: string
}

async function createFinanceAdminTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const tenant = await prisma.tenant.create({
    data: { name: 'AR Master Reuse Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'AR',
      lastName: 'MasterReuse',
      email: `user-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const perms = await prisma.permission.findMany({ where: { name: { in: [...FINANCE_PERMS] as PermissionName[] } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Finance Admin ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id } })
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@123', tenantSlug: slug })
  return { tenantId: tenant.id, slug, token: loginRes.body.data?.accessToken ?? '' }
}

async function bootstrapFixture(ctx: { tenantId: string; slug: string; token: string }): Promise<Fixture> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `LE${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8),
      legalName: 'AR Master Reuse Co Pvt Ltd',
      displayName: 'AR Master Reuse Co',
      stateCode: '27',
    })
  expect(leRes.status).toBe(201)
  const legalEntityId = leRes.body.data.id as string

  const fyRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      legalEntityId,
      name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
      startDate: `${fyStartYear}-04-01`,
      endDate: `${fyStartYear + 1}-03-31`,
      isCurrent: true,
    })
  expect(fyRes.status).toBe(201)
  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years/${fyRes.body.data.id}/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .expect(200)
  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/accounts/apply-template`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId, templateId: 'TRADING' })
    .expect(201)

  const byType = async (accountType: string) =>
    prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountType: accountType as never, isGroup: false } })
  const byCode = async (accountCode: string) =>
    prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode } })
  const [sales, receivable, payable, purchase, retained] = await Promise.all([
    byType('SALES'),
    byType('CUSTOMER_RECEIVABLE'),
    byType('VENDOR_PAYABLE'),
    byType('PURCHASE'),
    byType('RETAINED_EARNINGS'),
  ])
  const [gstInCgst, gstInSgst, gstInIgst, gstOutCgst, gstOutSgst, gstOutIgst] = await Promise.all([
    byCode('520101'),
    byCode('520102'),
    byCode('520103'),
    byCode('220101'),
    byCode('220102'),
    byCode('220103'),
  ])
  expect(sales && receivable && payable && purchase && retained).toBeTruthy()

  await request(app)
    .put(`/api/v1/t/${ctx.slug}/accounting/default-mappings`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      legalEntityId,
      mappings: [
        { mappingKey: 'CUSTOMER_RECEIVABLE', accountId: receivable!.id },
        { mappingKey: 'VENDOR_PAYABLE', accountId: payable!.id },
        { mappingKey: 'SALES_REVENUE', accountId: sales!.id },
        { mappingKey: 'PURCHASE', accountId: purchase!.id },
        { mappingKey: 'GST_INPUT_CGST', accountId: gstInCgst!.id },
        { mappingKey: 'GST_INPUT_SGST', accountId: gstInSgst!.id },
        { mappingKey: 'GST_INPUT_IGST', accountId: gstInIgst!.id },
        { mappingKey: 'GST_OUTPUT_CGST', accountId: gstOutCgst!.id },
        { mappingKey: 'GST_OUTPUT_SGST', accountId: gstOutSgst!.id },
        { mappingKey: 'GST_OUTPUT_IGST', accountId: gstOutIgst!.id },
        { mappingKey: 'RETAINED_EARNINGS', accountId: retained!.id },
      ],
    })
    .expect(200)

  await request(app)
    .put(`/api/v1/t/${ctx.slug}/accounting/number-series`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      legalEntityId,
      series: ['JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE', 'REVERSAL'].map(
        (documentType) => ({
          documentType,
          prefix: `${documentType.slice(0, 2)}-`,
          padLength: 5,
          resetEachYear: true,
          isActive: true,
        }),
      ),
    })
    .expect(200)

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId })
    .expect(200)

  await prisma.financeNumberSeries.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      documentType: 'SALES_INVOICE',
      prefix: 'SINV-',
      currentValue: 0,
      padLength: 6,
      isActive: true,
    },
  })

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: ctx.tenantId,
      companyCode: `CUST-${Date.now()}`.slice(-8),
      name: 'Master Reuse Customer Pvt Ltd',
      gstin: '27AAAAA0000A1Z5',
      state: '27',
      country: 'India',
      status: 'active',
      isActive: true,
    },
  })

  return {
    tenantId: ctx.tenantId,
    slug: ctx.slug,
    token: ctx.token,
    legalEntityId,
    customerId: customer.id,
    revenueAccountId: sales!.id,
    postingDate,
    invoiceDate: postingDate,
  }
}

function draftPayload(fx: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    legalEntityId: fx.legalEntityId,
    customerId: fx.customerId,
    sourceType: 'DIRECT',
    invoiceDate: fx.invoiceDate,
    postingDate: fx.postingDate,
    placeOfSupply: '27',
    taxTreatment: 'REGISTERED',
    currencyCode: 'INR',
    lines: [
      {
        lineNumber: 1,
        description: 'Master reuse test item',
        hsnCode: '87089990',
        quantity: '1.000000',
        unitRate: '1000.0000',
        gstRate: '18',
        revenueAccountId: fx.revenueAccountId,
      },
    ],
    ...overrides,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmSalesOrder.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

async function deleteInvoice(id: string) {
  await prisma.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: id } })
  await prisma.salesInvoice.delete({ where: { id } })
}

describe('Wave 6 — no duplicate finance masters (guardrail)', () => {
  it('has no FinanceCustomer / FinanceVendor prisma models', () => {
    expect('financeCustomer' in prisma).toBe(false)
    expect('financeVendor' in prisma).toBe(false)
  })
})

describe.skipIf(!dbAvailable)('Wave 6 — AR master reuse (CrmCompany soft links)', () => {
  let fx: Fixture
  let otherTenant: { tenantId: string; customerId: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant('ar-master-reuse')
    fx = await bootstrapFixture(ctx)

    const foreign = await prisma.tenant.create({
      data: {
        name: 'AR Foreign Tenant',
        slug: `ar-foreign-${Date.now()}`,
        email: `ar-foreign-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
    })
    const foreignCustomer = await prisma.crmCompany.create({
      data: {
        tenantId: foreign.id,
        companyCode: `FCUST-${Date.now()}`.slice(-8),
        name: 'Foreign Customer Pvt Ltd',
        status: 'active',
        isActive: true,
      },
    })
    otherTenant = { tenantId: foreign.id, customerId: foreignCustomer.id }
  })

  afterAll(async () => {
    if (otherTenant?.tenantId) {
      await prisma.crmCompany.deleteMany({ where: { tenantId: otherTenant.tenantId } }).catch(() => {})
      await prisma.tenant.delete({ where: { id: otherTenant.tenantId } }).catch(() => {})
    }
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('resolves CrmCompany on draft create and persists the party snapshot', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    expect(res.status).toBe(201)
    expect(res.body.data.sourceType).toBe('DIRECT')

    const row = await prisma.salesInvoice.findUniqueOrThrow({ where: { id: res.body.data.id } })
    expect(row.customerId).toBe(fx.customerId)
    expect(row.customerNameSnapshot).toBe('Master Reuse Customer Pvt Ltd')
    expect(row.customerGstinSnapshot).toBe('27AAAAA0000A1Z5')

    await deleteInvoice(res.body.data.id)
  })

  it('rejects an unknown customerId', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx, { customerId: randomUUID() }))
    expect([404, 422]).toContain(res.status)
  })

  it('rejects a cross-tenant customerId (tenant isolation)', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx, { customerId: otherTenant.customerId }))
    expect([404, 422]).toContain(res.status)
  })

  it('rejects an inactive customer', async () => {
    const inactive = await prisma.crmCompany.create({
      data: {
        tenantId: fx.tenantId,
        companyCode: `ICUST-${Date.now()}`.slice(-8),
        name: 'Inactive Customer',
        status: 'inactive',
        isActive: false,
      },
    })
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx, { customerId: inactive.id }))
    expect(res.status).toBe(422)
    await prisma.crmCompany.delete({ where: { id: inactive.id } })
  })

  it('keeps the draft snapshot stable after a CRM edit, then refresh-from-master applies it', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    expect(created.status).toBe(201)
    const id = created.body.data.id as string

    await prisma.crmCompany.update({
      where: { id: fx.customerId },
      data: { name: 'Master Reuse Customer RENAMED Pvt Ltd' },
    })

    // Snapshot must NOT change on read after the CRM edit.
    const afterEdit = await prisma.salesInvoice.findUniqueOrThrow({ where: { id } })
    expect(afterEdit.customerNameSnapshot).toBe('Master Reuse Customer Pvt Ltd')

    const preview = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${id}/refresh-from-master/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(preview.status).toBe(200)
    expect(preview.body.data.changedFields).toContain('customerNameSnapshot')
    expect(preview.body.data.proposed.customerNameSnapshot).toBe('Master Reuse Customer RENAMED Pvt Ltd')

    const apply = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${id}/refresh-from-master`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(apply.status).toBe(200)

    const afterApply = await prisma.salesInvoice.findUniqueOrThrow({ where: { id } })
    expect(afterApply.customerNameSnapshot).toBe('Master Reuse Customer RENAMED Pvt Ltd')

    // Restore the master name for subsequent tests.
    await prisma.crmCompany.update({
      where: { id: fx.customerId },
      data: { name: 'Master Reuse Customer Pvt Ltd' },
    })
    await deleteInvoice(id)
  })

  it('rejects refresh-from-master on a non-DRAFT invoice', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    const id = created.body.data.id as string

    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
      .expect(200)

    const preview = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${id}/refresh-from-master/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(preview.status).toBe(422)

    await deleteInvoice(id)
  })

  it('supports DIRECT and SALES_ORDER source modes with SO snapshot', async () => {
    const so = await prisma.crmSalesOrder.create({
      data: {
        tenantId: fx.tenantId,
        salesOrderNo: `SO-MR-${Date.now()}`,
        companyId: fx.customerId,
        status: 'confirmed',
        orderDate: new Date(fx.invoiceDate),
        lines: [],
      },
    })

    const direct = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx))
    expect(direct.status).toBe(201)
    expect(direct.body.data.sourceType).toBe('DIRECT')

    const fromSo = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx, { sourceType: 'SALES_ORDER', sourceDocumentId: so.id }))
    expect(fromSo.status).toBe(201)
    expect(fromSo.body.data.sourceType).toBe('SALES_ORDER')
    expect(fromSo.body.data.sourceDocumentSnapshot?.orderNumber).toBe(so.salesOrderNo)

    await deleteInvoice(direct.body.data.id)
    await deleteInvoice(fromSo.body.data.id)
    await prisma.crmSalesOrder.delete({ where: { id: so.id } })
  })

  it('rejects a fabricated sales order source id', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(draftPayload(fx, { sourceType: 'SALES_ORDER', sourceDocumentId: randomUUID() }))
    expect([404, 422]).toContain(res.status)
  })

  it('lists tenant-scoped customers via the accounting lookup endpoint', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/lookups/customers`)
      .query({ search: 'Master Reuse Customer' })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(fx.customerId)
    expect(ids).not.toContain(otherTenant.customerId)
  })

  it('filters sales order lookups to invoice-eligible statuses and checks eligibility', async () => {
    const eligible = await prisma.crmSalesOrder.create({
      data: {
        tenantId: fx.tenantId,
        salesOrderNo: `SO-EL-${Date.now()}`,
        companyId: fx.customerId,
        status: 'confirmed',
        orderDate: new Date(fx.invoiceDate),
        lines: [],
      },
    })
    const cancelled = await prisma.crmSalesOrder.create({
      data: {
        tenantId: fx.tenantId,
        salesOrderNo: `SO-CX-${Date.now()}`,
        companyId: fx.customerId,
        status: 'cancelled',
        lines: [],
      },
    })

    const list = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/lookups/sales-orders`)
      .query({ eligibleOnly: 'true', limit: 100 })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(list.status).toBe(200)
    const ids = (list.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(eligible.id)
    expect(ids).not.toContain(cancelled.id)

    const ok = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/lookups/sales-orders/${eligible.id}/invoice-eligibility`)
      .query({ customerId: fx.customerId })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(ok.status).toBe(200)
    expect(ok.body.data.eligible).toBe(true)

    const mismatch = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/lookups/sales-orders/${eligible.id}/invoice-eligibility`)
      .query({ customerId: randomUUID() })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(mismatch.status).toBe(200)
    expect(mismatch.body.data.eligible).toBe(false)
    expect(
      (mismatch.body.data.errors as Array<{ code: string }>).some((e) => e.code === 'SALES_ORDER_CUSTOMER_MISMATCH'),
    ).toBe(true)

    const notFound = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/lookups/sales-orders/${randomUUID()}/invoice-eligibility`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(notFound.status).toBe(404)

    await prisma.crmSalesOrder.deleteMany({ where: { id: { in: [eligible.id, cancelled.id] } } })
  })
})
