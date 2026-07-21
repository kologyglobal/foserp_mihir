/**
 * Phase 4D1 — AP reporting (outstanding, ageing, vendors, payment planning).
 * Live MySQL. Clones AR reporting coverage without reconciliation (4D2).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import type { PermissionName } from '../../src/constants/permissions.js'
import { addDays } from '../../src/modules/accounting/payables/reporting/payable-ageing.service.js'
import {
  ApAllocFixture,
  FINANCE_PERMS,
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createPostedInvoice,
  createPostedPayment,
  createUserWithPerms,
  ensurePermissions,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const AP_VIEW_ONLY = FINANCE_PERMS.filter((p) => p !== 'finance.ap.view') as PermissionName[]

interface ApReportingFixture extends ApAllocFixture {
  otherTenantId: string
  otherSlug: string
  otherToken: string
  noViewToken: string
}

async function createDraftInvoice(fx: ApAllocFixture): Promise<string> {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      vendorId: fx.vendorId,
      invoiceType: 'EXPENSE',
      supplierInvoiceNumber: `DRAFT-${Date.now()}`,
      supplierInvoiceDate: fx.documentDate,
      documentDate: fx.documentDate,
      postingDate: fx.postingDate,
      currencyCode: 'INR',
      exchangeRate: '1',
      taxTreatment: 'REGULAR',
      itcEligibility: 'ELIGIBLE',
      tdsRecognitionMode: 'NOT_APPLICABLE',
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
          description: 'Draft only',
          quantity: '1',
          unitPrice: '500',
          gstRate: '0',
          debitAccountId: fx.purchaseAccountId,
        },
      ],
    })
  expect(created.status).toBe(201)
  return created.body.data.id as string
}

describe.skipIf(!dbAvailable)('Finance Phase 4D1 — AP reporting', () => {
  let fx: ApReportingFixture

  beforeAll(async () => {
    await ensurePermissions()
    const primaryCtx = await createFinanceAdminTenant(app, 'ap-report')
    const primary = await bootstrapApAllocFixture(app, primaryCtx)
    const otherCtx = await createFinanceAdminTenant(app, 'ap-report-other')
    const other = await bootstrapApAllocFixture(app, otherCtx)
    const noView = await createUserWithPerms(app, primary.tenantId, primary.slug, AP_VIEW_ONLY, 'no-ap-view')

    fx = {
      ...primary,
      otherTenantId: other.tenantId,
      otherSlug: other.slug,
      otherToken: other.token,
      noViewToken: noView.token,
    }
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    if (fx?.otherTenantId) await cleanupTenant(fx.otherTenantId)
  })

  it('includes posted CREDIT open items in outstanding and excludes drafts', async () => {
    const draftId = await createDraftInvoice(fx)
    const posted = await createPostedInvoice(app, fx, { amount: '2500' })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/outstanding`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(200)

    const ids = res.body.data.items.map((row: { vendorInvoiceId: string | null }) => row.vendorInvoiceId)
    expect(ids).toContain(posted.documentId)
    expect(ids).not.toContain(draftId)
  })

  it('classifies due-date ageing buckets including CURRENT, 1d, 31d, 121d, NO_DUE_DATE', async () => {
    const reportDate = fx.postingDate
    await createPostedInvoice(app, fx, { amount: '100', dueDate: reportDate })
    await createPostedInvoice(app, fx, { amount: '100', dueDate: addDays(reportDate, -1) })
    await createPostedInvoice(app, fx, { amount: '100', dueDate: addDays(reportDate, -31) })
    await createPostedInvoice(app, fx, { amount: '100', dueDate: addDays(reportDate, -121) })
    const noDueDatePosted = await createPostedInvoice(app, fx, { amount: '100', dueDate: undefined })
    await prisma.payableOpenItem.update({
      where: { id: noDueDatePosted.openItemId },
      data: { dueDate: null },
    })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/ageing`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId, reportDate, ageingBasis: 'due_date' })
    expect(res.status).toBe(200)

    const buckets = Object.fromEntries(
      res.body.data.buckets.map((b: { bucket: string; openItemCount: number }) => [b.bucket, b.openItemCount]),
    )
    expect(buckets.CURRENT).toBeGreaterThanOrEqual(1)
    expect(buckets.OVERDUE_1_30).toBeGreaterThanOrEqual(1)
    expect(buckets.OVERDUE_31_60).toBeGreaterThanOrEqual(1)
    expect(buckets.OVERDUE_ABOVE_120).toBeGreaterThanOrEqual(1)
    expect(buckets.NO_DUE_DATE).toBeGreaterThanOrEqual(1)
  })

  it('rejects future reportDate', async () => {
    const future = addDays(fx.postingDate, 2)
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/outstanding`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId, reportDate: future })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('PAYABLE_REPORT_DATE_IN_FUTURE')
  })

  it('keeps currencyBreakdown separate for multi-currency open items', async () => {
    await createPostedInvoice(app, fx, { amount: '1000' })
    const second = await createPostedInvoice(app, fx, { amount: '1000' })
    const secondOpen = await prisma.payableOpenItem.findFirstOrThrow({
      where: { tenantId: fx.tenantId, sourceVendorInvoiceId: second.documentId },
    })
    await prisma.payableOpenItem.update({
      where: { id: secondOpen.id },
      data: {
        currencyCode: 'USD',
        exchangeRate: '83.00000000',
        outstandingAmount: '100.0000',
        baseOutstandingAmount: secondOpen.baseOutstandingAmount,
      },
    })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/ageing`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(200)

    const breakdown = res.body.data.currencyBreakdown as Array<{ currencyCode: string; outstandingAmount: string }>
    const inr = breakdown.find((r) => r.currencyCode === 'INR')
    const usd = breakdown.find((r) => r.currencyCode === 'USD')
    expect(inr).toBeTruthy()
    expect(usd).toBeTruthy()
    expect(Number(inr!.outstandingAmount)).toBeGreaterThan(Number(usd!.outstandingAmount))
  })

  it('vendor summary returns netPayableBase as credit minus debit outstanding', async () => {
    await createPostedInvoice(app, fx, { amount: '8000' })
    await createPostedPayment(app, fx, { amount: '3000', purpose: 'ADVANCE' })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendors`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(200)

    const row = res.body.data.items.find((v: { vendorId: string }) => v.vendorId === fx.vendorId)
    expect(row).toBeTruthy()
    expect(Number(row.creditOutstandingBase)).toBeGreaterThan(0)
    expect(Number(row.debitOutstandingBase)).toBeGreaterThan(0)
    expect(Number(row.netPayableBase)).toBeCloseTo(
      Number(row.creditOutstandingBase) - Number(row.debitOutstandingBase),
      2,
    )
  })

  it('payment planning returns vendors with due items within horizon', async () => {
    const dueSoon = addDays(fx.postingDate, 3)
    await createPostedInvoice(app, fx, { amount: '1500', dueDate: dueSoon })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/payment-planning`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId, horizonDays: 7 })
    expect(res.status).toBe(200)
    expect(res.body.data.horizonDays).toBe(7)
    expect(res.body.data.vendors.length).toBeGreaterThanOrEqual(1)
    expect(Number(res.body.data.totals.openItemCount)).toBeGreaterThanOrEqual(1)
  })

  it('is read-only — reporting GETs do not create audit logs or mutate open item amounts', async () => {
    const posted = await createPostedInvoice(app, fx, { amount: '400' })
    const openItem = await prisma.payableOpenItem.findFirstOrThrow({
      where: { tenantId: fx.tenantId, sourceVendorInvoiceId: posted.documentId },
    })
    const auditBefore = await prisma.auditLog.count({ where: { tenantId: fx.tenantId } })
    const amountBefore = openItem.outstandingAmount.toString()

    await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/overview`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
      .expect(200)
    await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/outstanding`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
      .expect(200)
    await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/ageing`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
      .expect(200)

    const auditAfter = await prisma.auditLog.count({ where: { tenantId: fx.tenantId } })
    const openItemAfter = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: openItem.id } })
    expect(auditAfter).toBe(auditBefore)
    expect(openItemAfter.outstandingAmount.toString()).toBe(amountBefore)
  })

  it('returns 403 for outstanding without finance.ap.view', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/outstanding`)
      .set('Authorization', `Bearer ${fx.noViewToken}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(403)
  })

  it('enforces tenant isolation on outstanding list', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.otherSlug}/accounting/payables/outstanding`)
      .set('Authorization', `Bearer ${fx.token}`)
      .query({ legalEntityId: fx.legalEntityId })
    expect(res.status).toBe(403)
  })
})
