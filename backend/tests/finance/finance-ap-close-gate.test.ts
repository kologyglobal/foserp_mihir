import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import type { PermissionName } from '../../src/constants/permissions.js'
import {
  FINANCE_PERMS,
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

/**
 * Close gate reconciles as of the period END date, so the test needs an already-elapsed
 * period (not the current, still-open one) to avoid the "asOfDate cannot be in the future"
 * validation on the underlying reconciliation run.
 */
async function findPeriodForFixture(fx: ApAllocFixture) {
  return prisma.accountingPeriod.findFirstOrThrow({
    where: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      endDate: { lt: new Date() },
    },
    orderBy: { periodNumber: 'desc' },
  })
}

let readyToPostSeq = 0
/** Create a vendor invoice dated within `periodDate` and move it to READY_TO_POST without posting it. */
async function createReadyToPostInvoice(fx: ApAllocFixture, periodDate: string): Promise<string> {
  readyToPostSeq += 1
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      vendorId: fx.vendorId,
      invoiceType: 'EXPENSE',
      supplierInvoiceNumber: `SUP/CG/${Date.now()}/${readyToPostSeq}`,
      supplierInvoiceDate: periodDate,
      documentDate: periodDate,
      postingDate: periodDate,
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
          description: 'Unposted consulting expense',
          quantity: '1',
          unitPrice: '1000',
          gstRate: '0',
          debitAccountId: fx.purchaseAccountId,
        },
      ],
    })
  expect(created.status).toBe(201)
  const id = created.body.data.id as string
  const ready = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${id}/mark-ready`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: created.body.data.updatedAt })
  expect(ready.status).toBe(200)
  expect(ready.body.data.status).toBe('READY_TO_POST')
  return id
}

describe.skipIf(!dbAvailable)('Finance Phase 4D2 — AP close gate', () => {
  let fx: ApAllocFixture
  let periodId: string
  let periodStatusBefore: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-closegate')
    fx = await bootstrapApAllocFixture(app, ctx)
    const period = await findPeriodForFixture(fx)
    periodId = period.id
    periodStatusBefore = period.status
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('PASSes when a fresh reconciliation is matched and no readiness issues exist', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/close-gate/runs`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ legalEntityId: fx.legalEntityId, periodId })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('PASS')
    expect(res.body.data.checksFailed).toBe(0)
    expect(res.body.data.checksBlocked).toBe(0)
    expect(res.body.data.reconciliationRunId).toBeTruthy()
  })

  it('is BLOCKED when a READY_TO_POST invoice is dated within the period', async () => {
    const period = await prisma.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } })
    await createReadyToPostInvoice(fx, period.startDate.toISOString().slice(0, 10))

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/close-gate/runs`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ legalEntityId: fx.legalEntityId, periodId })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('BLOCKED')
    expect(res.body.data.checksBlocked).toBeGreaterThanOrEqual(1)

    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/close-gate/runs/${res.body.data.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(detail.status).toBe(200)
    const checks = detail.body.data.checks as Array<{ checkCode: string; status: string }>
    expect(checks.some((c) => c.checkCode === 'READY_TO_POST_DOCS_IN_PERIOD' && c.status === 'BLOCKED')).toBe(true)
  })

  it('never mutates AccountingPeriod.status', async () => {
    const period = await prisma.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } })
    expect(period.status).toBe(periodStatusBefore)
    expect(period.closedAt).toBeNull()
  })

  it('rejects run creation without finance.ap.close_gate.run (403)', async () => {
    const noRun = FINANCE_PERMS.filter((p) => p !== 'finance.ap.close_gate.run') as PermissionName[]
    const { token } = await createUserWithPerms(app, fx.tenantId, fx.slug, noRun, 'no-close-gate-run')
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/close-gate/runs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ legalEntityId: fx.legalEntityId, periodId })
    expect(res.status).toBe(403)
  })
})
