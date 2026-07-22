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

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.')) as PermissionName[]

async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({ where: { name }, create: { name, module, description: name }, update: {} })
      .catch(() => {})
  }
}

interface VpWfFixture {
  tenantId: string
  slug: string
  token: string
  legalEntityId: string
  vendorId: string
  payableAccountId: string
  bankAccountId: string
  documentDate: string
  postingDate: string
}

async function createFinanceAdminTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`
  const tenant = await prisma.tenant.create({
    data: { name: 'AP Payment WF Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'AP',
      lastName: 'WF',
      email: `user-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const perms = await prisma.permission.findMany({ where: { name: { in: FINANCE_PERMS } } })
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

async function bootstrap(ctx: { tenantId: string; slug: string; token: string }): Promise<VpWfFixture> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const documentDate = now.toISOString().slice(0, 10)

  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `LE${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8),
      legalName: 'AP Payment WF Co Pvt Ltd',
      displayName: 'AP Payment WF Co',
      stateCode: '27',
      gstin: '27AAAAA0000A1Z5',
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

  const payable = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
  })
  const bank = await prisma.account.findFirst({
    where: { tenantId: ctx.tenantId, legalEntityId, accountType: 'BANK', isGroup: false },
  })
  expect(payable && bank).toBeTruthy()

  const vendor = await prisma.masterVendor.create({
    data: {
      tenantId: ctx.tenantId,
      code: `V${Date.now()}`.slice(-8),
      name: 'AP Payment WF Vendor Pvt Ltd',
      state: '27',
      status: 'ACTIVE',
      isBlocked: false,
    },
  })

  return {
    tenantId: ctx.tenantId,
    slug: ctx.slug,
    token: ctx.token,
    legalEntityId,
    vendorId: vendor.id,
    payableAccountId: payable!.id,
    bankAccountId: bank!.id,
    documentDate,
    postingDate: documentDate,
  }
}

let refSeq = 0
function nextBankRef(): string {
  refSeq += 1
  return `NEFT/WF/${Date.now()}/${refSeq}`
}

function draftPayload(fx: VpWfFixture, overrides: Record<string, unknown> = {}) {
  return {
    legalEntityId: fx.legalEntityId,
    vendorId: fx.vendorId,
    paymentPurpose: 'INVOICE_SETTLEMENT',
    paymentMethod: 'BANK_TRANSFER',
    documentDate: fx.documentDate,
    paymentDate: fx.documentDate,
    proposedPostingDate: fx.postingDate,
    currencyCode: 'INR',
    exchangeRate: '1',
    paymentAmount: '5000',
    paymentAccountId: fx.bankAccountId,
    vendorPayableAccountId: fx.payableAccountId,
    bankReference: nextBankRef(),
    approvalRequiredOverride: false,
    adjustments: [],
    ...overrides,
  }
}

async function createDraft(fx: VpWfFixture, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send(draftPayload(fx, overrides))
  expect(res.status).toBe(201)
  return res.body.data
}

async function cleanupTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPaymentAdjustmentLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.vendorPayment.updateMany({ where: { tenantId }, data: { approvalRequestId: null } }).catch(() => {})
  await prisma.vendorPayment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalStep.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalRequest.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Finance Phase 4B3 — AP vendor payment draft workflow', () => {
  let fx: VpWfFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant('ap-pay-wf')
    fx = await bootstrap(ctx)
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('create → update → validate → mark-ready (no approval) claims uniqueness key', async () => {
    const draft = await createDraft(fx)
    expect(draft.status).toBe('DRAFT')
    expect(draft.vendorPaymentNumber).toBeNull()
    expect(draft.vendorSettlementAmount).toBe('5000.0000')
    expect(draft.allowedActions.markReady).toBe(true)
    expect(draft.allowedActions.submit).toBe(false)
    expect(draft.allowedActions.allocate).toBe(false)
    expect(draft.allowedActions.reverse).toBe(false)

    const updated = await request(app)
      .patch(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ ...draftPayload(fx, { bankReference: draft.bankReference }), paymentAmount: '6000', expectedUpdatedAt: draft.updatedAt })
    expect(updated.status).toBe(200)
    expect(updated.body.data.vendorSettlementAmount).toBe('6000.0000')

    const validate = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}/validate`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(validate.status).toBe(200)
    expect(validate.body.data.valid).toBe(true)

    // validate persists calculated fields (bumps updatedAt) — re-fetch the current version.
    const afterValidate = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(afterValidate.status).toBe(200)

    const ready = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: afterValidate.body.data.updatedAt })
    expect(ready.status).toBe(200)
    expect(ready.body.data.status).toBe('READY_TO_POST')

    const row = await prisma.vendorPayment.findFirst({ where: { id: draft.id, tenantId: fx.tenantId } })
    expect(row?.paymentUniquenessKey).toBeTruthy()
  })

  it('stale expectedUpdatedAt on mark-ready is rejected (409)', async () => {
    const draft = await createDraft(fx)
    const stale = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: new Date(Date.now() - 60_000).toISOString() })
    expect(stale.status).toBe(409)
  })

  it('duplicate uniqueness key claim across two payments is rejected', async () => {
    const sharedRef = nextBankRef()
    const a = await createDraft(fx, { bankReference: sharedRef })
    const b = await createDraft(fx, { bankReference: sharedRef })

    const readyA = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${a.id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: a.updatedAt })
    expect(readyA.status).toBe(200)

    const readyB = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${b.id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: b.updatedAt })
    expect(readyB.status).toBe(409)
    expect(readyB.body.error?.code ?? readyB.body.code).toMatch(/UNIQUENESS/)
  })

  it('cancel from DRAFT releases the uniqueness key path (CASH has none)', async () => {
    const draft = await createDraft(fx, {
      paymentMethod: 'CASH',
      paymentAccountId: fx.bankAccountId,
      bankReference: undefined,
    })
    const cancel = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'not needed', expectedUpdatedAt: draft.updatedAt })
    expect(cancel.status).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')
    const row = await prisma.vendorPayment.findFirst({ where: { id: draft.id, tenantId: fx.tenantId } })
    expect(row?.paymentUniquenessKey).toBeNull()
  })

  it('submit → approve path yields READY_TO_POST with approval request', async () => {
    const draft = await createDraft(fx, { approvalRequiredOverride: true })
    expect(draft.allowedActions.submit).toBe(true)
    expect(draft.allowedActions.markReady).toBe(false)

    const submitted = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: draft.updatedAt })
    expect(submitted.status).toBe(200)
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL')
    expect(submitted.body.data.approvalRequestId).toBeTruthy()

    const approved = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}/approve`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: submitted.body.data.updatedAt })
    expect(approved.status).toBe(200)
    expect(approved.body.data.status).toBe('READY_TO_POST')
  })

  it('reject → revise returns to editable DRAFT', async () => {
    const draft = await createDraft(fx, { approvalRequiredOverride: true })
    const submitted = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: draft.updatedAt })
    expect(submitted.status).toBe(200)

    const rejected = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}/reject`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'insufficient docs', expectedUpdatedAt: submitted.body.data.updatedAt })
    expect(rejected.status).toBe(200)
    expect(rejected.body.data.status).toBe('REJECTED')

    const revised = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${draft.id}/revise`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'fixing', expectedUpdatedAt: rejected.body.data.updatedAt })
    expect(revised.status).toBe(200)
    expect(revised.body.data.status).toBe('DRAFT')
    expect(revised.body.data.allowedActions.submit).toBe(true)
  })
})
