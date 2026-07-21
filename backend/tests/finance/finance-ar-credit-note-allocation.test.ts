import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
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
      .upsert({
        where: { name },
        create: { name, module, description: name },
        update: {},
      })
      .catch(() => {})
  }
}

interface AllocFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  noAllocToken: string
  legalEntityId: string
  customerId: string
  otherCustomerId: string
  receivableAccountId: string
  revenueAccountId: string
  creditNoteDate: string
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
  return { userId: user.id, token: loginRes.body.data?.accessToken ?? '' }
}

async function bootstrap(): Promise<AllocFixture> {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `ar-cn-alloc-${Date.now()}`
  const tenant = await prisma.tenant.create({
    data: { name: 'AR CN Alloc Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'AR',
      lastName: 'CNAllocator',
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
  const token = loginRes.body.data?.accessToken ?? ''
  const ctx = { tenantId: tenant.id, slug, token }

  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `LE${Date.now()}`.slice(-8),
      legalName: 'AR CN Alloc Co Pvt Ltd',
      displayName: 'AR CN Alloc Co',
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
      startDate: fyStart,
      endDate: fyEnd,
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

  const sales = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'SALES', isGroup: false },
  })
  const receivable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
  })
  const payable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  const retained = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
  })

  const gstInCgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520101' } })
  const gstInSgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520102' } })
  const gstInIgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520103' } })
  const gstOutCgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220101' } })
  const gstOutSgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220102' } })
  const gstOutIgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220103' } })

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
  await prisma.financeNumberSeries.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      documentType: 'CUSTOMER_CREDIT_NOTE',
      prefix: 'CN-',
      currentValue: 0,
      padLength: 6,
      isActive: true,
    },
  })

  const customer = await prisma.crmCompany.create({
    data: {
      tenantId: ctx.tenantId,
      companyCode: `C1-${Date.now()}`.slice(-8),
      name: 'CN Alloc Customer Pvt Ltd',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      state: '27',
      country: 'India',
      status: 'active',
      isActive: true,
    },
  })
  const otherCustomer = await prisma.crmCompany.create({
    data: {
      tenantId: ctx.tenantId,
      companyCode: `C2-${Date.now()}`.slice(-8),
      name: 'Other CN Customer Pvt Ltd',
      gstin: '27BBBBB0000B1Z5',
      pan: 'BBBBB0000B',
      state: '27',
      country: 'India',
      status: 'active',
      isActive: true,
    },
  })

  const noAlloc = await createUserWithPerms(
    ctx.tenantId,
    ctx.slug,
    FINANCE_PERMS.filter((p) => !p.startsWith('finance.ar.allocation')) as PermissionName[],
    'no-cn-alloc',
  )

  return {
    tenantId: ctx.tenantId,
    userId: user.id,
    slug: ctx.slug,
    token: ctx.token,
    noAllocToken: noAlloc.token,
    legalEntityId,
    customerId: customer.id,
    otherCustomerId: otherCustomer.id,
    receivableAccountId: receivable!.id,
    revenueAccountId: sales!.id,
    creditNoteDate: postingDate,
    postingDate,
    invoiceDate: postingDate,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.customerCreditNoteAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerCreditNoteAllocationBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptAllocationBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerCreditNoteLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerCreditNote.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptDeductionLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceipt.deleteMany({ where: { tenantId } }).catch(() => {})
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

/** Registered GST invoice; returns actual posted outstanding from open item. */
async function postInvoice(fx: AllocFixture, unitRate: string, customerId = fx.customerId): Promise<{
  invoiceId: string
  openItemId: string
  outstanding: string
}> {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      customerId,
      sourceType: 'DIRECT',
      invoiceDate: fx.invoiceDate,
      postingDate: fx.postingDate,
      placeOfSupply: '27',
      taxTreatment: 'REGISTERED',
      currencyCode: 'INR',
      lines: [
        {
          lineNumber: 1,
          description: 'Alloc item',
          hsnCode: '87089990',
          quantity: '1.000000',
          unitRate,
          gstRate: '18',
          revenueAccountId: fx.revenueAccountId,
        },
      ],
    })
  if (created.status !== 201) {
    throw new Error(`invoice create failed: ${created.status} ${JSON.stringify(created.body)}`)
  }
  expect(created.status).toBe(201)
  const invoiceId = created.body.data.id as string
  await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .expect(200)
  const posted = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${invoiceId}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(posted.status).toBe(200)
  const openItem = await prisma.receivableOpenItem.findFirstOrThrow({
    where: { tenantId: fx.tenantId, salesInvoiceId: invoiceId, side: 'DEBIT' },
  })
  return {
    invoiceId,
    openItemId: openItem.id,
    outstanding: openItem.openAmount.toFixed(4),
  }
}

/** DIRECT customer credit note (no GST) so grandTotal == taxable == unitRate for simple math. */
async function postCreditNote(fx: AllocFixture, amount: string, customerId = fx.customerId): Promise<{
  creditNoteId: string
  creditOpenItemId: string
}> {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/credit-notes`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      customerId,
      purpose: 'COMMERCIAL_SETTLEMENT',
      sourceType: 'DIRECT',
      creditNoteDate: fx.creditNoteDate,
      postingDate: fx.postingDate,
      currencyCode: 'INR',
      lines: [
        {
          lineNumber: 1,
          adjustmentMode: 'FULL_LINE',
          quantity: '1',
          unitRate: amount,
          gstRate: '0',
          description: 'Alloc credit',
          revenueReversalAccountId: fx.revenueAccountId,
        },
      ],
    })
  if (created.status !== 201) {
    throw new Error(`credit note create failed: ${created.status} ${JSON.stringify(created.body)}`)
  }
  expect(created.status).toBe(201)
  const creditNoteId = created.body.data.id as string
  await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/credit-notes/${creditNoteId}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .expect(200)
  const posted = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/credit-notes/${creditNoteId}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(posted.status).toBe(200)
  return {
    creditNoteId,
    creditOpenItemId: posted.body.data.creditOpenItemId as string,
  }
}

async function allocate(
  fx: AllocFixture,
  creditNoteId: string,
  allocations: Array<{ invoiceId: string; invoiceOpenItemId: string; amount: string }>,
  key: string,
) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/receivables/credit-notes/${creditNoteId}/allocations`)
    .set('Authorization', `Bearer ${fx.token}`)
    .set('Idempotency-Key', key)
    .send({ allocationDate: fx.postingDate, allocations })
}

async function netAr(fx: AllocFixture) {
  const debits = await prisma.receivableOpenItem.aggregate({
    where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId, side: 'DEBIT' },
    _sum: { baseOpenAmount: true },
  })
  const credits = await prisma.receivableOpenItem.aggregate({
    where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId, side: 'CREDIT' },
    _sum: { baseOpenAmount: true },
  })
  const debit = Number(debits._sum.baseOpenAmount ?? 0)
  const credit = Number(credits._sum.baseOpenAmount ?? 0)
  return debit - credit
}

describe.skipIf(!dbAvailable)('Finance Phase 3C5 — AR credit note allocation', () => {
  let fx: AllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    fx = await bootstrap()
  }, 180000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('full invoice settlement: batch, settled open items, no GL side effects', async () => {
    const inv = await postInvoice(fx, '10000.0000')
    const cn = await postCreditNote(fx, inv.outstanding)
    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    const glBefore = await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })
    const eventsBefore = await prisma.postingEvent.count({ where: { tenantId: fx.tenantId } })
    const netBefore = await netAr(fx)

    const res = await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: inv.outstanding }],
      `full-${Date.now()}`,
    )
    expect(res.status).toBe(200)
    expect(res.body.data.idempotentReplay).toBe(false)
    expect(res.body.data.batch.status).toBe('POSTED')
    expect(res.body.data.allocations).toHaveLength(1)

    const debit = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: inv.openItemId } })
    expect(debit.status).toBe('SETTLED')
    expect(debit.openAmount.toFixed(4)).toBe('0.0000')
    expect(debit.allocatedAmount.toFixed(4)).toBe(inv.outstanding)

    const credit = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: cn.creditOpenItemId } })
    expect(credit.status).toBe('SETTLED')
    expect(credit.openAmount.toFixed(4)).toBe('0.0000')

    const note = await prisma.customerCreditNote.findUniqueOrThrow({ where: { id: cn.creditNoteId } })
    expect(note.allocatedAmount.toFixed(4)).toBe(inv.outstanding)
    expect(note.unallocatedAmount.toFixed(4)).toBe('0.0000')

    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore)
    expect(await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })).toBe(glBefore)
    expect(await prisma.postingEvent.count({ where: { tenantId: fx.tenantId } })).toBe(eventsBefore)
    expect(await netAr(fx)).toBeCloseTo(netBefore, 4)

    const audit = await prisma.auditLog.count({
      where: {
        tenantId: fx.tenantId,
        action: 'CUSTOMER_CREDIT_NOTE_ALLOCATION_POSTED',
        entityId: res.body.data.batch.id,
      },
    })
    expect(audit).toBe(1)
  })

  it('partial settlement and remaining customer advance', async () => {
    const inv = await postInvoice(fx, '10000.0000')
    const partial = (Number(inv.outstanding) * 0.4).toFixed(4)
    const remaining = (Number(inv.outstanding) - Number(partial)).toFixed(4)
    const cn = await postCreditNote(fx, partial)
    const res = await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: partial }],
      `partial-${Date.now()}`,
    )
    expect(res.status).toBe(200)

    const debit = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: inv.openItemId } })
    expect(debit.status).toBe('PARTIALLY_SETTLED')
    expect(debit.openAmount.toFixed(4)).toBe(remaining)

    const credit = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: cn.creditOpenItemId } })
    expect(credit.status).toBe('SETTLED')
    expect(credit.openAmount.toFixed(4)).toBe('0.0000')
  })

  it('multi-invoice allocation from one credit note leaves credit note advance', async () => {
    const a = await postInvoice(fx, '6000.0000')
    const b = await postInvoice(fx, '2500.0000')
    const totalAllocated = (Number(a.outstanding) + Number(b.outstanding)).toFixed(4)
    const creditGross = (Number(totalAllocated) + 1500).toFixed(4)
    const cn = await postCreditNote(fx, creditGross)
    const res = await allocate(
      fx,
      cn.creditNoteId,
      [
        { invoiceId: a.invoiceId, invoiceOpenItemId: a.openItemId, amount: a.outstanding },
        { invoiceId: b.invoiceId, invoiceOpenItemId: b.openItemId, amount: b.outstanding },
      ],
      `multi-inv-${Date.now()}`,
    )
    expect(res.status).toBe(200)
    expect(res.body.data.allocations).toHaveLength(2)
    expect(res.body.data.creditNote.unallocatedAmount).toBe('1500.0000')

    const credit = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: cn.creditOpenItemId } })
    expect(credit.status).toBe('PARTIALLY_SETTLED')
    expect(credit.openAmount.toFixed(4)).toBe('1500.0000')
  })

  it('multiple credit notes against one invoice merge in invoice allocation history', async () => {
    const inv = await postInvoice(fx, '10000.0000')
    const first = (Number(inv.outstanding) * 0.3).toFixed(4)
    const second = (Number(inv.outstanding) - Number(first)).toFixed(4)
    const cn1 = await postCreditNote(fx, first)
    const cn2 = await postCreditNote(fx, second)

    await allocate(
      fx,
      cn1.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: first }],
      `mcn1-${Date.now()}`,
    )
    let debit = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: inv.openItemId } })
    expect(debit.status).toBe('PARTIALLY_SETTLED')
    expect(debit.openAmount.toFixed(4)).toBe(second)

    await allocate(
      fx,
      cn2.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: second }],
      `mcn2-${Date.now()}`,
    )
    debit = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: inv.openItemId } })
    expect(debit.status).toBe('SETTLED')
    expect(debit.openAmount.toFixed(4)).toBe('0.0000')

    const hist = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/invoices/${inv.invoiceId}/allocations`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(hist.status).toBe(200)
    expect(hist.body.data.length).toBeGreaterThanOrEqual(2)
    expect(hist.body.data.every((r: { sourceType: string }) => r.sourceType === 'CUSTOMER_CREDIT_NOTE')).toBe(true)
  })

  it('multiple batches on one credit note', async () => {
    const a = await postInvoice(fx, '4000.0000')
    const b = await postInvoice(fx, '3500.0000')
    const creditGross = (Number(a.outstanding) + Number(b.outstanding) + 2500).toFixed(4)
    const cn = await postCreditNote(fx, creditGross)

    await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: a.invoiceId, invoiceOpenItemId: a.openItemId, amount: a.outstanding }],
      `batch1-${Date.now()}`,
    )
    await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: b.invoiceId, invoiceOpenItemId: b.openItemId, amount: b.outstanding }],
      `batch2-${Date.now()}`,
    )

    const note = await prisma.customerCreditNote.findUniqueOrThrow({ where: { id: cn.creditNoteId } })
    expect(note.allocatedAmount.toFixed(4)).toBe((Number(a.outstanding) + Number(b.outstanding)).toFixed(4))
    expect(note.unallocatedAmount.toFixed(4)).toBe('2500.0000')
  })

  it('unallocated credit note remains customer advance; customer-credits lists it', async () => {
    const cn = await postCreditNote(fx, '5000.0000')
    const credit = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: cn.creditOpenItemId } })
    expect(credit.status).toBe('OPEN')
    expect(credit.openAmount.toFixed(4)).toBe('5000.0000')

    const credits = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/customer-credits`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId, customerId: fx.customerId })
    expect(credits.status).toBe(200)
    const row = credits.body.data.find((r: { creditNoteId: string }) => r.creditNoteId === cn.creditNoteId)
    expect(row).toBeTruthy()
    expect(row.sourceType).toBe('CUSTOMER_CREDIT_NOTE')
  })

  it('rejects over-allocation and empty/zero amounts', async () => {
    const inv = await postInvoice(fx, '1000.0000')
    const half = (Number(inv.outstanding) / 2).toFixed(4)
    const cn = await postCreditNote(fx, half)

    const overInv = await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: (Number(half) + 1).toFixed(4) }],
      `over-inv-${Date.now()}`,
    )
    expect(overInv.status).toBe(422)

    const overCn = await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: (Number(half) + 0.0001).toFixed(4) }],
      `over-cn-${Date.now()}`,
    )
    expect(overCn.status).toBe(422)

    const zero = await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: '0.0000' }],
      `zero-${Date.now()}`,
    )
    expect([400, 422]).toContain(zero.status)
  })

  it('rejects cross-customer allocation', async () => {
    const inv = await postInvoice(fx, '1000.0000', fx.otherCustomerId)
    const cn = await postCreditNote(fx, inv.outstanding)
    const res = await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: inv.outstanding }],
      `xcust-${Date.now()}`,
    )
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('CREDIT_NOTE_ALLOCATION_CUSTOMER_MISMATCH')
  })

  it('idempotent replay returns same batch without duplicate audit', async () => {
    const inv = await postInvoice(fx, '2000.0000')
    const cn = await postCreditNote(fx, inv.outstanding)
    const key = `idem-${Date.now()}`
    const body = [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: inv.outstanding }]

    const first = await allocate(fx, cn.creditNoteId, body, key)
    expect(first.status).toBe(200)
    const second = await allocate(fx, cn.creditNoteId, body, key)
    expect(second.status).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.batch.id).toBe(first.body.data.batch.id)

    const mismatch = await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: (Number(inv.outstanding) / 2).toFixed(4) }],
      key,
    )
    expect(mismatch.status).toBe(409)
    expect(mismatch.body.code).toBe('CREDIT_NOTE_ALLOCATION_PAYLOAD_MISMATCH')

    const audits = await prisma.auditLog.count({
      where: {
        tenantId: fx.tenantId,
        action: 'CUSTOMER_CREDIT_NOTE_ALLOCATION_POSTED',
        entityId: first.body.data.batch.id,
      },
    })
    expect(audits).toBe(1)
  })

  it('requires allocation.create permission; credit_note.post alone is insufficient', async () => {
    const inv = await postInvoice(fx, '1000.0000')
    const cn = await postCreditNote(fx, inv.outstanding)
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/receivables/credit-notes/${cn.creditNoteId}/allocations`)
      .set('Authorization', `Bearer ${fx.noAllocToken}`)
      .set('Idempotency-Key', `perm-${Date.now()}`)
      .send({
        allocationDate: fx.postingDate,
        allocations: [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: inv.outstanding }],
      })
    expect(res.status).toBe(403)
  })

  it('invoice outstanding unchanged after credit-note post alone; reduced only after allocation', async () => {
    const inv = await postInvoice(fx, '3000.0000')
    const cn = await postCreditNote(fx, inv.outstanding)

    const afterPostOnly = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: inv.openItemId } })
    expect(afterPostOnly.openAmount.toFixed(4)).toBe(inv.outstanding)
    expect(afterPostOnly.status).toBe('OPEN')

    await allocate(
      fx,
      cn.creditNoteId,
      [{ invoiceId: inv.invoiceId, invoiceOpenItemId: inv.openItemId, amount: inv.outstanding }],
      `recon-${Date.now()}`,
    )

    const afterAllocation = await prisma.receivableOpenItem.findUniqueOrThrow({ where: { id: inv.openItemId } })
    expect(afterAllocation.openAmount.toFixed(4)).toBe('0.0000')
    expect(afterAllocation.status).toBe('SETTLED')

    const outstanding = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/outstanding`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(outstanding.status).toBe(200)
    const rows = outstanding.body.data?.items ?? outstanding.body.data
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.every((r: { openItemId: string }) => r.openItemId !== cn.creditOpenItemId)).toBe(true)

    const recon = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/receivables/reconciliation`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(recon.status).toBe(200)
    expect(recon.body.data.status).toBe('MATCHED')
  })
})
