import request from 'supertest'
import { expect } from 'vitest'
import type { Express } from 'express'
import { prisma } from '../../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../../src/constants/permissions.js'

export const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.')) as PermissionName[]

export interface ApAllocFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  legalEntityId: string
  financialYearId: string
  vendorId: string
  otherVendorId: string
  payableAccountId: string
  altPayableAccountId: string
  purchaseAccountId: string
  bankAccountId: string
  cashAccountId: string
  postingDate: string
  documentDate: string
}

export async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({ where: { name }, create: { name, module, description: name }, update: {} })
      .catch(() => {})
  }
}

export async function createUserWithPerms(
  app: Express,
  tenantId: string,
  slug: string,
  permNames: PermissionName[],
  label: string,
): Promise<{ userId: string; token: string }> {
  const { hashPassword } = await import('../../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}@${slug}.test`
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
      name: `${label} Role ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'Test@123', tenantSlug: slug })
  return { userId: user.id, token: loginRes.body.data?.accessToken ?? '' }
}

export async function createFinanceAdminTenant(app: Express, slugPrefix: string) {
  const { hashPassword } = await import('../../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const tenant = await prisma.tenant.create({
    data: { name: 'AP Alloc Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const { userId, token } = await createUserWithPerms(app, tenant.id, slug, FINANCE_PERMS, 'ap-alloc-admin')
  return { tenantId: tenant.id, userId, slug, token }
}

export async function bootstrapApAllocFixture(
  app: Express,
  ctx: { tenantId: string; slug: string; token: string; userId: string },
): Promise<ApAllocFixture> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd = `${fyStartYear + 1}-03-31`
  const postingDate = now.toISOString().slice(0, 10)
  const documentDate = postingDate

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `LE${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8),
      legalName: 'AP Alloc Co Pvt Ltd',
      displayName: 'AP Alloc Co',
      stateCode: '27',
      gstin: '27AAAAA0000A1Z5',
    })
  expect(leRes.status).toBe(201)
  const legalEntityId = leRes.body.data.id as string

  // Concurrent tenant bootstraps can transiently hit a MariaDB write-conflict (P2034)
  // inside the financial-year create transaction; retry a few times before failing.
  let fyRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      legalEntityId,
      name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
      startDate: fyStart,
      endDate: fyEnd,
      isCurrent: true,
    })
  for (let attempt = 0; attempt < 5 && fyRes.status !== 201; attempt += 1) {
    await new Promise((r) => setTimeout(r, 150 + Math.floor(Math.random() * 250)))
    fyRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
        startDate: fyStart,
        endDate: fyEnd,
        isCurrent: true,
      })
  }
  expect(fyRes.status).toBe(201)
  const financialYearId = fyRes.body.data.id as string

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years/${financialYearId}/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .expect(200)

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/accounts/apply-template`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({ legalEntityId, templateId: 'TRADING' })
    .expect(201)

  const payable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const bank = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'BANK', isGroup: false },
  })
  const cash = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CASH', isGroup: false },
  })
  const receivable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
  })
  const sales = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'SALES', isGroup: false },
  })
  const purchase = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false },
  })
  const retained = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
  })
  const tdsPayable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'TDS_PAYABLE', isGroup: false },
  })
  const gstInCgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520101' } })
  const gstInSgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520102' } })
  const gstInIgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '520103' } })
  const gstOutCgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220101' } })
  const gstOutSgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220102' } })
  const gstOutIgst = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, legalEntityId, accountCode: '220103' } })
  expect(payable && bank && cash && purchase && tdsPayable).toBeTruthy()

  // A second, non-mapped payable-category account to exercise control-account mismatch.
  const altPayable = await prisma.account.create({
    data: {
      tenantId: ctx.tenantId,
      legalEntityId,
      accountCode: `21${String(Date.now()).slice(-4)}`,
      accountName: 'Alt Trade Payables',
      category: 'LIABILITY',
      accountType: 'VENDOR_PAYABLE',
      isGroup: false,
      level: 1,
    },
  })

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
        { mappingKey: 'TDS_PAYABLE', accountId: tdsPayable!.id },
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
    data: { tenantId: ctx.tenantId, legalEntityId, documentType: 'VENDOR_INVOICE', prefix: 'VIN-', currentValue: 0, padLength: 6, isActive: true },
  })
  await prisma.financeNumberSeries.create({
    data: { tenantId: ctx.tenantId, legalEntityId, documentType: 'VENDOR_PAYMENT', prefix: 'VPY-', currentValue: 0, padLength: 6, isActive: true },
  })
  await prisma.financeNumberSeries.create({
    data: { tenantId: ctx.tenantId, legalEntityId, documentType: 'VENDOR_DEBIT_NOTE', prefix: 'VDN-', currentValue: 0, padLength: 6, isActive: true },
  })
  await prisma.financeNumberSeries.create({
    data: { tenantId: ctx.tenantId, legalEntityId, documentType: 'VENDOR_CREDIT_ADJUSTMENT', prefix: 'VCA-', currentValue: 0, padLength: 6, isActive: true },
  })

  const vendor = await prisma.masterVendor.create({
    data: { tenantId: ctx.tenantId, code: `V${Date.now()}`.slice(-8), name: 'AP Alloc Vendor Pvt Ltd', gstin: '27BBBBB0000B1Z5', pan: 'BBBBB0000B', state: '27', status: 'ACTIVE', isBlocked: false },
  })
  const otherVendor = await prisma.masterVendor.create({
    data: { tenantId: ctx.tenantId, code: `W${Date.now()}`.slice(-8), name: 'Other Vendor Pvt Ltd', gstin: '27CCCCC0000C1Z5', pan: 'CCCCC0000C', state: '27', status: 'ACTIVE', isBlocked: false },
  })

  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    slug: ctx.slug,
    token: ctx.token,
    legalEntityId,
    financialYearId,
    vendorId: vendor.id,
    otherVendorId: otherVendor.id,
    payableAccountId: payable!.id,
    altPayableAccountId: altPayable.id,
    purchaseAccountId: purchase!.id,
    bankAccountId: bank!.id,
    cashAccountId: cash!.id,
    postingDate,
    documentDate,
  }
}

let supplierRefSeq = 0
function nextSupplierReference(): string {
  supplierRefSeq += 1
  return `SUP/ADJ/${Date.now()}/${supplierRefSeq}`
}

/** Phase 4C2 — create + post a vendor debit note → DEBIT open item. */
export async function createPostedDebitNote(
  app: Express,
  fx: ApAllocFixture,
  opts: { taxableAmount?: string; vendorId?: string } = {},
): Promise<PostedOpenItem & { documentUpdatedAt: string; vendorPayableAmount: string }> {
  const taxable = opts.taxableAmount ?? '10000'
  const vendorId = opts.vendorId ?? fx.vendorId
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      vendorId,
      adjustmentType: 'VENDOR_DEBIT_NOTE',
      reason: 'PURCHASE_RETURN',
      supplierReferenceNumber: nextSupplierReference(),
      supplierReferenceDate: fx.documentDate,
      documentDate: fx.documentDate,
      postingDate: fx.postingDate,
      currencyCode: 'INR',
      exchangeRate: '1',
      taxEffect: 'REVERSE_RECOVERABLE_INPUT_TAX',
      itcTreatment: 'FULL_ITC_REVERSAL',
      tdsTreatment: 'NO_TDS_CHANGE',
      purchaseTaxTreatment: 'REGULAR',
      supplyType: 'INTRA_STATE',
      companyStateCode: '27',
      vendorStateCode: '27',
      placeOfSupply: '27',
      configuration: { roundingMode: 'NONE' },
      approvalRequiredOverride: false,
      lines: [
        {
          lineNumber: 1,
          lineType: 'EXPENSE',
          description: 'Purchase return',
          quantity: '1',
          unitPrice: taxable,
          gstRate: '18',
          offsetAccountId: fx.purchaseAccountId,
        },
      ],
    })
  expect(created.status).toBe(201)
  const id = created.body.data.id as string
  const updatedAt = created.body.data.updatedAt as string
  const vendorPayableAmount = created.body.data.vendorPayableAmount as string
  const ready = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: updatedAt })
  expect(ready.status).toBe(200)
  const post = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: ready.body.data.updatedAt })
  expect(post.status).toBe(200)

  const row = await prisma.vendorAdjustment.findFirstOrThrow({ where: { id, tenantId: fx.tenantId } })
  const openItem = await prisma.payableOpenItem.findFirstOrThrow({
    where: { tenantId: fx.tenantId, sourceVendorAdjustmentId: id },
  })
  expect(openItem.side).toBe('DEBIT')
  expect(openItem.documentType).toBe('VENDOR_DEBIT_NOTE')
  return {
    documentId: id,
    documentUpdatedAt: row.updatedAt.toISOString(),
    vendorPayableAmount: post.body.data.vendorPayableAmount ?? vendorPayableAmount,
    openItemId: openItem.id,
    openItem: {
      updatedAt: openItem.updatedAt,
      outstandingAmount: openItem.outstandingAmount.toString(),
      originalAmount: openItem.originalAmount.toString(),
      status: openItem.status,
    },
  }
}

/** Phase 4C2 — create + post a vendor credit adjustment → CREDIT open item. */
export async function createPostedCreditAdjustment(
  app: Express,
  fx: ApAllocFixture,
  opts: { taxableAmount?: string; vendorId?: string } = {},
): Promise<PostedOpenItem & { documentUpdatedAt: string; vendorPayableAmount: string }> {
  const taxable = opts.taxableAmount ?? '5000'
  const vendorId = opts.vendorId ?? fx.vendorId
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      vendorId,
      adjustmentType: 'VENDOR_CREDIT_ADJUSTMENT',
      reason: 'COMMERCIAL_DISCOUNT',
      supplierReferenceNumber: nextSupplierReference(),
      supplierReferenceDate: fx.documentDate,
      documentDate: fx.documentDate,
      postingDate: fx.postingDate,
      currencyCode: 'INR',
      exchangeRate: '1',
      taxEffect: 'ADD_RECOVERABLE_INPUT_TAX',
      itcTreatment: 'FULL_ITC_ADDITION',
      tdsTreatment: 'NO_TDS_CHANGE',
      purchaseTaxTreatment: 'REGULAR',
      supplyType: 'INTRA_STATE',
      companyStateCode: '27',
      vendorStateCode: '27',
      placeOfSupply: '27',
      configuration: { roundingMode: 'NONE' },
      approvalRequiredOverride: false,
      lines: [
        {
          lineNumber: 1,
          lineType: 'EXPENSE',
          description: 'Commercial discount',
          quantity: '1',
          unitPrice: taxable,
          gstRate: '18',
          offsetAccountId: fx.purchaseAccountId,
        },
      ],
    })
  expect(created.status).toBe(201)
  const id = created.body.data.id as string
  const updatedAt = created.body.data.updatedAt as string
  const vendorPayableAmount = created.body.data.vendorPayableAmount as string
  const ready = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: updatedAt })
  expect(ready.status).toBe(200)
  const post = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: ready.body.data.updatedAt })
  expect(post.status).toBe(200)

  const row = await prisma.vendorAdjustment.findFirstOrThrow({ where: { id, tenantId: fx.tenantId } })
  const openItem = await prisma.payableOpenItem.findFirstOrThrow({
    where: { tenantId: fx.tenantId, sourceVendorAdjustmentId: id },
  })
  expect(openItem.side).toBe('CREDIT')
  expect(openItem.documentType).toBe('VENDOR_CREDIT_ADJUSTMENT')
  return {
    documentId: id,
    documentUpdatedAt: row.updatedAt.toISOString(),
    vendorPayableAmount: post.body.data.vendorPayableAmount ?? vendorPayableAmount,
    openItemId: openItem.id,
    openItem: {
      updatedAt: openItem.updatedAt,
      outstandingAmount: openItem.outstandingAmount.toString(),
      originalAmount: openItem.originalAmount.toString(),
      status: openItem.status,
    },
  }
}

export function adjustmentAllocationBody(
  source: { openItem: { updatedAt: Date }; documentUpdatedAt?: string },
  allocationDate: string,
  lines: Array<{ target: PostedOpenItem; amount: string }>,
  idempotencyKey?: string,
) {
  return {
    expectedAdjustmentUpdatedAt: source.documentUpdatedAt,
    expectedSourceOpenItemUpdatedAt: source.openItem.updatedAt.toISOString(),
    allocationDate,
    idempotencyKey: idempotencyKey ?? `idem-adj-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    lines: lines.map((l) => ({
      targetCreditOpenItemId: l.target.openItemId,
      expectedTargetUpdatedAt: l.target.openItem.updatedAt.toISOString(),
      amount: l.amount,
    })),
  }
}

export async function postAdjustmentAllocation(
  app: Express,
  fx: ApAllocFixture,
  vendorAdjustmentId: string,
  body: Record<string, unknown>,
  token?: string,
) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${vendorAdjustmentId}/allocations`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send(body)
}

let supplierSeq = 0
function nextSupplierNumber(): string {
  supplierSeq += 1
  return `SUP/AP4B4/${Date.now()}/${supplierSeq}`
}

export interface PostedOpenItem {
  documentId: string
  openItemId: string
  openItem: { updatedAt: Date; outstandingAmount: string; originalAmount: string; status: string }
}

/** Create + post a single-line expense vendor invoice → returns its CREDIT open item. */
export async function createPostedInvoice(
  app: Express,
  fx: ApAllocFixture,
  opts: { amount: string; vendorId?: string; currencyCode?: string; exchangeRate?: string; dueDate?: string } = { amount: '10000' },
): Promise<PostedOpenItem> {
  const vendorId = opts.vendorId ?? fx.vendorId
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      vendorId,
      invoiceType: 'EXPENSE',
      supplierInvoiceNumber: nextSupplierNumber(),
      supplierInvoiceDate: fx.documentDate,
      documentDate: fx.documentDate,
      postingDate: fx.postingDate,
      currencyCode: opts.currencyCode ?? 'INR',
      exchangeRate: opts.exchangeRate ?? '1',
      taxTreatment: 'REGULAR',
      itcEligibility: 'ELIGIBLE',
      tdsRecognitionMode: 'NOT_APPLICABLE',
      supplyType: 'INTRA_STATE',
      companyStateCode: '27',
      vendorStateCode: '27',
      placeOfSupply: '27',
      configuration: { roundingMode: 'NONE' },
      approvalRequiredOverride: false,
      dueDate: opts.dueDate,
      lines: [
        {
          lineNumber: 1,
          lineType: 'EXPENSE',
          description: 'Consulting expense',
          quantity: '1',
          unitPrice: opts.amount,
          gstRate: '0',
          debitAccountId: fx.purchaseAccountId,
        },
      ],
    })
  expect(created.status).toBe(201)
  const id = created.body.data.id as string
  const updatedAt = created.body.data.updatedAt as string
  const ready = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: updatedAt })
  expect(ready.status).toBe(200)
  const post = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${id}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: ready.body.data.updatedAt })
  expect(post.status).toBe(200)

  const openItem = await prisma.payableOpenItem.findFirstOrThrow({
    where: { tenantId: fx.tenantId, sourceVendorInvoiceId: id },
  })
  return {
    documentId: id,
    openItemId: openItem.id,
    openItem: {
      updatedAt: openItem.updatedAt,
      outstandingAmount: openItem.outstandingAmount.toString(),
      originalAmount: openItem.originalAmount.toString(),
      status: openItem.status,
    },
  }
}

/** Create + post a vendor payment → returns its DEBIT open item. */
export async function createPostedPayment(
  app: Express,
  fx: ApAllocFixture,
  opts: {
    amount: string
    purpose?: 'INVOICE_SETTLEMENT' | 'ADVANCE'
    vendorId?: string
    currencyCode?: string
    exchangeRate?: string
    method?: 'BANK_TRANSFER' | 'CASH'
    vendorPayableAccountId?: string
  } = { amount: '10000' },
): Promise<PostedOpenItem & { documentUpdatedAt: string }> {
  const vendorId = opts.vendorId ?? fx.vendorId
  const method = opts.method ?? 'BANK_TRANSFER'
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      vendorId,
      paymentPurpose: opts.purpose ?? 'INVOICE_SETTLEMENT',
      paymentMethod: method,
      documentDate: fx.documentDate,
      paymentDate: fx.documentDate,
      proposedPostingDate: fx.postingDate,
      currencyCode: opts.currencyCode ?? 'INR',
      exchangeRate: opts.exchangeRate ?? '1',
      paymentAmount: opts.amount,
      paymentAccountId: method === 'CASH' ? fx.cashAccountId : fx.bankAccountId,
      vendorPayableAccountId: opts.vendorPayableAccountId ?? fx.payableAccountId,
      bankReference: method === 'BANK_TRANSFER' ? `NEFT/${Date.now()}/${Math.floor(Math.random() * 100000)}` : undefined,
      approvalRequiredOverride: false,
      adjustments: [],
    })
  expect(created.status).toBe(201)
  const id = created.body.data.id as string
  const updatedAt = created.body.data.updatedAt as string
  const ready = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: updatedAt })
  expect(ready.status).toBe(200)
  const post = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${id}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: ready.body.data.updatedAt })
  expect(post.status).toBe(200)

  const paymentRow = await prisma.vendorPayment.findFirstOrThrow({ where: { id, tenantId: fx.tenantId } })
  const openItem = await prisma.payableOpenItem.findFirstOrThrow({
    where: { tenantId: fx.tenantId, sourceVendorPaymentId: id },
  })
  return {
    documentId: id,
    documentUpdatedAt: paymentRow.updatedAt.toISOString(),
    openItemId: openItem.id,
    openItem: {
      updatedAt: openItem.updatedAt,
      outstandingAmount: openItem.outstandingAmount.toString(),
      originalAmount: openItem.originalAmount.toString(),
      status: openItem.status,
    },
  }
}

export function allocationBody(
  source: { openItem: { updatedAt: Date }; documentUpdatedAt?: string },
  allocationDate: string,
  lines: Array<{ target: PostedOpenItem; amount: string }>,
  idempotencyKey?: string,
) {
  return {
    expectedPaymentUpdatedAt: source.documentUpdatedAt,
    expectedSourceOpenItemUpdatedAt: source.openItem.updatedAt.toISOString(),
    allocationDate,
    idempotencyKey: idempotencyKey ?? `idem-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    lines: lines.map((l) => ({
      targetCreditOpenItemId: l.target.openItemId,
      expectedTargetUpdatedAt: l.target.openItem.updatedAt.toISOString(),
      amount: l.amount,
    })),
  }
}

export async function postAllocation(
  app: Express,
  fx: ApAllocFixture,
  paymentId: string,
  body: Record<string, unknown>,
  token?: string,
) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${paymentId}/allocations`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send(body)
}

/**
 * Directly seed a POSTED vendor payment + its DEBIT open item (bypasses posting pipeline).
 * Used for currency/FX edge cases where posting a non-INR document is not the unit under test.
 */
export async function seedRawPayment(
  fx: ApAllocFixture,
  opts: { amount: string; currencyCode?: string; exchangeRate?: string; vendorId?: string; vendorPayableAccountId?: string; documentType?: 'VENDOR_PAYMENT' | 'VENDOR_ADVANCE' },
): Promise<PostedOpenItem & { documentUpdatedAt: string }> {
  const vendorId = opts.vendorId ?? fx.vendorId
  const currencyCode = opts.currencyCode ?? 'INR'
  const rate = opts.exchangeRate ?? '1'
  const base = (Number(opts.amount) * Number(rate)).toString()
  const payment = await prisma.vendorPayment.create({
    data: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      vendorId,
      financialYearId: fx.financialYearId,
      draftReference: `RAWVP-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      vendorPaymentNumber: `RAWVPY-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      paymentPurpose: 'INVOICE_SETTLEMENT',
      paymentMethod: 'BANK_TRANSFER',
      status: 'POSTED',
      documentDate: new Date(fx.documentDate),
      paymentDate: new Date(fx.documentDate),
      currencyCode,
      exchangeRate: rate,
      vendorCodeSnapshot: 'RAW',
      vendorNameSnapshot: 'Raw Vendor',
      postedAt: new Date(),
    },
  })
  const openItem = await prisma.payableOpenItem.create({
    data: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      vendorId,
      vendorCodeSnapshot: 'RAW',
      vendorNameSnapshot: 'Raw Vendor',
      side: 'DEBIT',
      documentType: opts.documentType ?? 'VENDOR_PAYMENT',
      documentId: payment.id,
      documentNumber: payment.vendorPaymentNumber!,
      documentDate: new Date(fx.documentDate),
      postingDate: new Date(fx.postingDate),
      currencyCode,
      exchangeRate: rate,
      originalAmount: opts.amount,
      outstandingAmount: opts.amount,
      baseOriginalAmount: base,
      baseOutstandingAmount: base,
      status: 'OPEN',
      vendorPayableAccountId: opts.vendorPayableAccountId ?? fx.payableAccountId,
      sourceVendorPaymentId: payment.id,
    },
  })
  const linkedPayment = await prisma.vendorPayment.update({ where: { id: payment.id }, data: { payableOpenItemId: openItem.id } })
  return {
    documentId: payment.id,
    documentUpdatedAt: linkedPayment.updatedAt.toISOString(),
    openItemId: openItem.id,
    openItem: {
      updatedAt: openItem.updatedAt,
      outstandingAmount: openItem.outstandingAmount.toString(),
      originalAmount: openItem.originalAmount.toString(),
      status: openItem.status,
    },
  }
}

/** Directly seed a CREDIT VENDOR_INVOICE open item (no VendorInvoice row). */
export async function seedRawInvoiceOpenItem(
  fx: ApAllocFixture,
  opts: { amount: string; currencyCode?: string; exchangeRate?: string; vendorId?: string; vendorPayableAccountId?: string },
): Promise<PostedOpenItem> {
  const vendorId = opts.vendorId ?? fx.vendorId
  const currencyCode = opts.currencyCode ?? 'INR'
  const rate = opts.exchangeRate ?? '1'
  const base = (Number(opts.amount) * Number(rate)).toString()
  const openItem = await prisma.payableOpenItem.create({
    data: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      vendorId,
      vendorCodeSnapshot: 'RAW',
      vendorNameSnapshot: 'Raw Vendor',
      side: 'CREDIT',
      documentType: 'VENDOR_INVOICE',
      documentId: `raw-inv-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      documentNumber: `RAWVIN-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      documentDate: new Date(fx.documentDate),
      postingDate: new Date(fx.postingDate),
      currencyCode,
      exchangeRate: rate,
      originalAmount: opts.amount,
      outstandingAmount: opts.amount,
      baseOriginalAmount: base,
      baseOutstandingAmount: base,
      status: 'OPEN',
      vendorPayableAccountId: opts.vendorPayableAccountId ?? fx.payableAccountId,
    },
  })
  return {
    documentId: openItem.documentId,
    openItemId: openItem.id,
    openItem: {
      updatedAt: openItem.updatedAt,
      outstandingAmount: openItem.outstandingAmount.toString(),
      originalAmount: openItem.originalAmount.toString(),
      status: openItem.status,
    },
  }
}

export async function refreshOpenItem(tenantId: string, openItemId: string): Promise<PostedOpenItem> {
  const openItem = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: openItemId, tenantId } })
  return {
    documentId: openItem.sourceVendorInvoiceId ?? openItem.sourceVendorPaymentId ?? '',
    openItemId: openItem.id,
    openItem: {
      updatedAt: openItem.updatedAt,
      outstandingAmount: openItem.outstandingAmount.toString(),
      originalAmount: openItem.originalAmount.toString(),
      status: openItem.status,
    },
  }
}

export async function cleanupTenant(tenantId: string): Promise<void> {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableAllocationReversalLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableAllocationReversalBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableAllocationLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableAllocationBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorAdjustment.updateMany({
    where: { tenantId },
    data: {
      accountingVoucherId: null,
      postingEventId: null,
      approvalRequestId: null,
      payableOpenItemId: null,
      reversalVoucherId: null,
      reversalPostingEventId: null,
    },
  }).catch(() => {})
  await prisma.vendorAdjustmentLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorAdjustmentSourceLink.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorAdjustment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPayment.updateMany({
    where: { tenantId },
    data: {
      accountingVoucherId: null,
      postingEventId: null,
      approvalRequestId: null,
      payableOpenItemId: null,
      reversalVoucherId: null,
      reversalPostingEventId: null,
    },
  }).catch(() => {})
  await prisma.vendorPaymentAdjustmentLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPayment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorInvoice.updateMany({
    where: { tenantId },
    data: {
      accountingVoucherId: null,
      postingEventId: null,
      approvalRequestId: null,
      reversalVoucherId: null,
      reversalPostingEventId: null,
    },
  }).catch(() => {})
  await prisma.vendorInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorInvoiceSourceLink.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalStep.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalRequest.deleteMany({ where: { tenantId } }).catch(() => {})
  // Phase 5A3 — bank reconciliation (must run before generalLedgerEntry deletion below: ledger
  // allocations FK generalLedgerEntry without cascade). Deleting the match cascades its
  // statement/ledger allocations automatically.
  await prisma.bankReconciliationMatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankReconciliationSuggestion.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankReconciliationMatchRun.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankReconciliationException.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankReconciliationSession.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankLedgerReconciliationPosition.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.updateMany({
    where: { tenantId },
    data: { reversedByVoucherId: null, reversalOfVoucherId: null },
  }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableCloseGateCheck.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableCloseGateRun.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableReconciliationException.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableReconciliationAccountResult.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableReconciliationRun.deleteMany({ where: { tenantId } }).catch(() => {})
  // Phase 5A1 — treasury foundation (children first; TreasuryAccount FKs Account/LegalEntity/Branch/Tenant).
  await prisma.bankStatementImportIssue.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankStatementLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankStatement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankStatementImportBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankStatementColumnMappingTemplate.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.paymentAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankReconciliationProfile.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.treasuryBankProfile.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.treasuryCashProfile.deleteMany({ where: { tenantId } }).catch(() => {})
  // Phase 5B1 — internal treasury transfers (must run before treasuryAccount deletion below:
  // treasury_transfers FKs treasury_accounts without cascade).
  await prisma.treasuryTransfer.deleteMany({ where: { tenantId } }).catch(() => {})
  // Phase 5B2 — cheque management (must also run before treasuryAccount deletion: treasury_cheques
  // FKs treasury_accounts without cascade).
  await prisma.treasuryCheque.deleteMany({ where: { tenantId } }).catch(() => {})
  // Phase 5B3 — treasury adjustments / classification / standing instructions (must also run before
  // treasuryAccount deletion: treasury_adjustments and standing_instructions FK treasury_accounts
  // without cascade). treasury_adjustment_lines cascade automatically with their parent.
  await prisma.treasuryAdjustment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.standingInstructionExecution.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.standingInstruction.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankPostingRule.deleteMany({ where: { tenantId } }).catch(() => {})
  // Phase 5C1 — soft treasury day-close (FKs legalEntity/tenant).
  await prisma.treasuryDayClose.deleteMany({ where: { tenantId } }).catch(() => {})
  // Phase 5D1 — bank connectors (FK treasury_accounts).
  await prisma.budgetLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.budgetVersion.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankConnectorConsent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.bankConnector.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.treasuryAccount.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}
