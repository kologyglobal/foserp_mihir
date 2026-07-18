import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { addDays } from '../../src/modules/accounting/receivables/reporting/receivable-ageing.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))
const AR_VIEW_NO_RECONCILE = FINANCE_PERMS.filter((p) => p !== 'finance.ar.reconcile.view') as PermissionName[]

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

interface ReportingFixture {
  tenantId: string
  otherTenantId: string
  slug: string
  otherSlug: string
  token: string
  otherToken: string
  noReconcileToken: string
  legalEntityId: string
  customerId: string
  revenueAccountId: string
  receivableAccountId: string
  retainedAccountId: string
  postingDate: string
  invoiceDate: string
}

async function createUserWithPerms(
  tenantId: string,
  slug: string,
  permNames: PermissionName[],
  label: string,
) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const email = `${label}-${Date.now()}@${slug}.test`

  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: label,
      lastName: 'User',
      email,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { in: permNames } } })
  const role = await prisma.role.create({
    data: {
      tenantId,
      name: `${label} Role ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email,
    password: 'Test@123',
    tenantSlug: slug,
  })

  return { token: loginRes.body.data?.accessToken ?? '' }
}

async function createFinanceTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'AR Reporting Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'AR',
      lastName: 'Reporter',
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

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })

  return { tenantId: tenant.id, slug, token: loginRes.body.data?.accessToken ?? '' }
}

async function bootstrapFinance(ctx: { tenantId: string; slug: string; token: string }) {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ code: `LE${Date.now()}`.slice(-8), legalName: 'AR Report Co', displayName: 'AR Report', stateCode: '27' })
  expect(leRes.status).toBe(201)
  const legalEntityId = leRes.body.data.id as string

  const fyRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId, name: `FY ${fyStartYear}`, startDate: fyStart, endDate: fyEnd, isCurrent: true })
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

  const sales = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'SALES', isGroup: false } })
  const receivable = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false } })
  const payable = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false } })
  const purchase = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false } })
  const retained = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false } })
  expect(sales && receivable && payable && purchase && retained).toBeTruthy()

  const gstCodes = ['520101', '520102', '520103', '220101', '220102', '220103'] as const
  const gstAccounts = await Promise.all(
    gstCodes.map((accountCode) => prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode } })),
  )

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
        { mappingKey: 'GST_INPUT_CGST', accountId: gstAccounts[0]!.id },
        { mappingKey: 'GST_INPUT_SGST', accountId: gstAccounts[1]!.id },
        { mappingKey: 'GST_INPUT_IGST', accountId: gstAccounts[2]!.id },
        { mappingKey: 'GST_OUTPUT_CGST', accountId: gstAccounts[3]!.id },
        { mappingKey: 'GST_OUTPUT_SGST', accountId: gstAccounts[4]!.id },
        { mappingKey: 'GST_OUTPUT_IGST', accountId: gstAccounts[5]!.id },
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
        (documentType) => ({ documentType, prefix: `${documentType.slice(0, 2)}-`, padLength: 5, resetEachYear: true, isActive: true }),
      ),
    })
    .expect(200)

  await prisma.financeNumberSeries.create({
    data: { tenantId: ctx.tenantId, legalEntityId, documentType: 'SALES_INVOICE', prefix: 'SINV-', currentValue: 0, padLength: 6, isActive: true },
  })

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId })
    .expect(200)

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: ctx.tenantId,
      companyCode: `CUST-${Date.now()}`.slice(-8),
      name: 'Reporting Customer Pvt Ltd',
      gstin: '27AAAAA0000A1Z5',
      state: '27',
      country: 'India',
      status: 'active',
      isActive: true,
    },
  })

  return {
    legalEntityId,
    customerId: customer.id,
    revenueAccountId: sales!.id,
    receivableAccountId: receivable!.id,
    retainedAccountId: retained!.id,
    postingDate,
    invoiceDate: postingDate,
  }
}

function linePayload(revenueAccountId: string, overrides: Record<string, unknown> = {}) {
  return {
    lineNumber: 1,
    description: 'Test item',
    hsnCode: '87089990',
    quantity: '1.000000',
    unitRate: '1000.0000',
    gstRate: '18',
    revenueAccountId,
    ...overrides,
  }
}

function draftPayload(fx: ReportingFixture, overrides: Record<string, unknown> = {}) {
  return {
    legalEntityId: fx.legalEntityId,
    customerId: fx.customerId,
    sourceType: 'DIRECT',
    invoiceDate: fx.invoiceDate,
    postingDate: fx.postingDate,
    placeOfSupply: '27',
    taxTreatment: 'REGISTERED',
    currencyCode: 'INR',
    lines: [linePayload(fx.revenueAccountId)],
    ...overrides,
  }
}

async function createReadyInvoice(fx: ReportingFixture, overrides: Record<string, unknown> = {}): Promise<string> {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send(draftPayload(fx, overrides))
  expect(created.status).toBe(201)
  const id = created.body.data.id as string
  await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .expect(200)
  return id
}

async function postInvoice(fx: ReportingFixture, overrides: Record<string, unknown> = {}): Promise<string> {
  const id = await createReadyInvoice(fx, overrides)
  const res = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${id}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(res.status).toBe(200)
  return id
}

async function postManualReceivableJournal(fx: ReportingFixture, amount = '250.0000') {
  const createRes = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/journals`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      documentDate: fx.postingDate,
      postingDate: fx.postingDate,
      lines: [
        {
          accountId: fx.receivableAccountId,
          debitAmount: amount,
          creditAmount: '0',
          partyType: 'CUSTOMER',
          partyId: fx.customerId,
          partyNameSnapshot: 'Reporting Customer Pvt Ltd',
        },
        { accountId: fx.retainedAccountId, debitAmount: '0', creditAmount: amount },
      ],
    })
  expect(createRes.status).toBe(201)
  const id = createRes.body.data.id as string
  await request(app).post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/submit`).set('Authorization', `Bearer ${fx.token}`).expect(200)
  const postRes = await request(app).post(`/api/v1/t/${fx.slug}/accounting/journals/${id}/post`).set('Authorization', `Bearer ${fx.token}`)
  if (postRes.status !== 200) {
    throw new Error(`journal post failed: ${postRes.status} ${JSON.stringify(postRes.body)}`)
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.updateMany({ where: { tenantId }, data: { accountingVoucherId: null, postingEventId: null } }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Finance Phase 3A5 — AR reporting', () => {
  let fx: ReportingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const primary = await createFinanceTenant('ar-report')
    const other = await createFinanceTenant('ar-report-other')
    const primaryBoot = await bootstrapFinance(primary)
    await bootstrapFinance(other)
    const noReconcile = await createUserWithPerms(primary.tenantId, primary.slug, AR_VIEW_NO_RECONCILE, 'no-reconcile')

    fx = {
      tenantId: primary.tenantId,
      otherTenantId: other.tenantId,
      slug: primary.slug,
      otherSlug: other.slug,
      token: primary.token,
      otherToken: other.token,
      noReconcileToken: noReconcile.token,
      ...primaryBoot,
    }
  })

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    if (fx?.otherTenantId) await cleanupTenant(fx.otherTenantId)
  })

  it('includes posted open items in outstanding and excludes draft/ready invoices', async () => {
    const draftId = await createReadyInvoice(fx)
    await createReadyInvoice(fx)
    const postedId = await postInvoice(fx)

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/outstanding`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(200)
    const ids = res.body.data.items.map((row: { salesInvoiceId: string | null }) => row.salesInvoiceId)
    expect(ids).toContain(postedId)
    expect(ids).not.toContain(draftId)
  })

  it('classifies due-date ageing buckets including CURRENT, 1d, 31d, 121d, NO_DUE_DATE', async () => {
    const reportDate = fx.postingDate
    await postInvoice(fx, { dueDate: reportDate })
    await postInvoice(fx, { dueDate: addDays(reportDate, -1) })
    await postInvoice(fx, { dueDate: addDays(reportDate, -31) })
    await postInvoice(fx, { dueDate: addDays(reportDate, -121) })
    await postInvoice(fx, { dueDate: null })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/ageing`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId, reportDate, ageingBasis: 'due_date' })
    expect(res.status).toBe(200)

    const buckets = Object.fromEntries(res.body.data.buckets.map((b: { bucket: string; openItemCount: number }) => [b.bucket, b.openItemCount]))
    expect(buckets.CURRENT).toBeGreaterThanOrEqual(1)
    expect(buckets.OVERDUE_1_30).toBeGreaterThanOrEqual(1)
    expect(buckets.OVERDUE_31_60).toBeGreaterThanOrEqual(1)
    expect(buckets.OVERDUE_ABOVE_120).toBeGreaterThanOrEqual(1)
    expect(buckets.NO_DUE_DATE).toBeGreaterThanOrEqual(1)
  })

  it('rejects future reportDate', async () => {
    const future = addDays(fx.postingDate, 2)
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/outstanding`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId, reportDate: future })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('RECEIVABLE_REPORT_DATE_IN_FUTURE')
  })

  it('keeps currencyBreakdown separate for multi-currency open items', async () => {
    await postInvoice(fx)
    const secondId = await postInvoice(fx)
    const secondOpen = await prisma.receivableOpenItem.findFirstOrThrow({
      where: { tenantId: fx.tenantId, salesInvoiceId: secondId },
    })
    await prisma.receivableOpenItem.update({
      where: { id: secondOpen.id },
      data: {
        currencyCode: 'USD',
        exchangeRate: '83.00000000',
        openAmount: '100.0000',
        baseOpenAmount: secondOpen.baseOpenAmount,
      },
    })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/ageing`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(200)

    const breakdown = res.body.data.currencyBreakdown as Array<{ currencyCode: string; outstandingAmount: string }>
    const inr = breakdown.find((r) => r.currencyCode === 'INR')
    const usd = breakdown.find((r) => r.currencyCode === 'USD')
    expect(inr).toBeTruthy()
    expect(usd).toBeTruthy()
    expect(Number(inr!.outstandingAmount)).toBeGreaterThan(Number(usd!.outstandingAmount))
    expect(res.body.data.totals.outstandingAmount).not.toBe(inr!.outstandingAmount)
  })

  it('returns MATCHED reconciliation after standard invoice post', async () => {
    await postInvoice(fx)
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/reconciliation`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('MATCHED')
    expect(res.body.data.exceptions).toEqual([])
  })

  it('returns MISMATCH when open item amount is altered after post', async () => {
    const invoiceId = await postInvoice(fx)
    const openItem = await prisma.receivableOpenItem.findFirst({ where: { tenantId: fx.tenantId, salesInvoiceId: invoiceId } })
    expect(openItem).toBeTruthy()
    await prisma.receivableOpenItem.update({
      where: { id: openItem!.id },
      data: { openAmount: openItem!.openAmount.sub(1), baseOpenAmount: openItem!.baseOpenAmount.sub(1) },
    })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/reconciliation`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('MISMATCH')
    expect(res.body.data.exceptions.some((e: { code: string }) => e.code === 'OPEN_ITEM_GL_AMOUNT_MISMATCH')).toBe(true)

    await prisma.receivableOpenItem.update({
      where: { id: openItem!.id },
      data: { openAmount: openItem!.openAmount, baseOpenAmount: openItem!.baseOpenAmount },
    })
  })

  it('flags CONTROL_ACCOUNT_MANUAL_POSTING for manual journal hitting receivable control account', async () => {
    await prisma.financeSettings.update({
      where: { legalEntityId: fx.legalEntityId },
      data: { allowManualControlAccountPosting: true },
    })
    await prisma.account.update({
      where: { id: fx.receivableAccountId },
      data: { allowManualPosting: true },
    })
    await postManualReceivableJournal(fx)
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/reconciliation`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(200)
    expect(res.body.data.exceptions.some((e: { code: string }) => e.code === 'CONTROL_ACCOUNT_MANUAL_POSTING')).toBe(true)
  })

  it('is read-only — reporting GETs do not create audit logs or mutate open item amounts', async () => {
    const invoiceId = await postInvoice(fx)
    const openItem = await prisma.receivableOpenItem.findFirstOrThrow({ where: { tenantId: fx.tenantId, salesInvoiceId: invoiceId } })
    const auditBefore = await prisma.auditLog.count({ where: { tenantId: fx.tenantId } })
    const amountBefore = openItem.openAmount.toString()

    await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/overview`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
      .expect(200)
    await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/outstanding`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
      .expect(200)
    await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/reconciliation`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
      .expect(200)

    const auditAfter = await prisma.auditLog.count({ where: { tenantId: fx.tenantId } })
    const openItemAfter = await prisma.receivableOpenItem.findFirstOrThrow({ where: { id: openItem.id } })
    expect(auditAfter).toBe(auditBefore)
    expect(openItemAfter.openAmount.toString()).toBe(amountBefore)
  })

  it('returns 403 for reconciliation without finance.ar.reconcile.view', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/reconciliation`)
      .set('Authorization', `Bearer ${fx.noReconcileToken}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(403)
  })

  it('enforces tenant isolation on outstanding list', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.otherSlug}/accounting/receivables/outstanding`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(403)
  })
})
