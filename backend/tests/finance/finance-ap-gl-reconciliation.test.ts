import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import type { PermissionName } from '../../src/constants/permissions.js'
import {
  FINANCE_PERMS,
  allocationBody,
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createPostedInvoice,
  createPostedPayment,
  createUserWithPerms,
  ensurePermissions,
  postAllocation,
  seedRawInvoiceOpenItem,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

async function seedControlAccountGlVariance(fx: ApAllocFixture, amount: string): Promise<void> {
  const period = await prisma.accountingPeriod.findFirstOrThrow({
    where: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      startDate: { lte: new Date(fx.postingDate) },
      endDate: { gte: new Date(fx.postingDate) },
    },
  })
  const voucher = await prisma.accountingVoucher.create({
    data: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      financialYearId: fx.financialYearId,
      accountingPeriodId: period.id,
      voucherType: 'JOURNAL',
      voucherNumber: `RECON-TOL-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      status: 'POSTED',
      documentDate: new Date(fx.documentDate),
      postingDate: new Date(fx.postingDate),
      totalDebit: amount,
      totalCredit: amount,
      baseTotalDebit: amount,
      baseTotalCredit: amount,
      sourceModule: 'ACCOUNTING',
      sourceDocumentType: 'VENDOR_INVOICE',
      postedAt: new Date(),
    },
  })
  const debitLine = await prisma.accountingVoucherLine.create({
    data: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      voucherId: voucher.id,
      lineNumber: 1,
      accountId: fx.purchaseAccountId,
      debitAmount: amount,
      baseDebitAmount: amount,
    },
  })
  const creditLine = await prisma.accountingVoucherLine.create({
    data: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      voucherId: voucher.id,
      lineNumber: 2,
      accountId: fx.payableAccountId,
      creditAmount: amount,
      baseCreditAmount: amount,
    },
  })
  await prisma.generalLedgerEntry.create({
    data: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      financialYearId: fx.financialYearId,
      accountingPeriodId: period.id,
      voucherId: voucher.id,
      voucherLineId: debitLine.id,
      voucherType: 'JOURNAL',
      voucherNumber: voucher.voucherNumber!,
      lineNumber: 1,
      postingDate: voucher.postingDate,
      documentDate: voucher.documentDate,
      accountId: fx.purchaseAccountId,
      debitAmount: amount,
      baseDebitAmount: amount,
      sourceModule: 'ACCOUNTING',
      sourceDocumentType: 'VENDOR_INVOICE',
    },
  })
  await prisma.generalLedgerEntry.create({
    data: {
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      financialYearId: fx.financialYearId,
      accountingPeriodId: period.id,
      voucherId: voucher.id,
      voucherLineId: creditLine.id,
      voucherType: 'JOURNAL',
      voucherNumber: voucher.voucherNumber!,
      lineNumber: 2,
      postingDate: voucher.postingDate,
      documentDate: voucher.documentDate,
      accountId: fx.payableAccountId,
      creditAmount: amount,
      baseCreditAmount: amount,
      sourceModule: 'ACCOUNTING',
      sourceDocumentType: 'VENDOR_INVOICE',
    },
  })
}

describe.skipIf(!dbAvailable)('Finance Phase 4D2 — AP-to-GL reconciliation', () => {
  describe('clean reconciliation flow', () => {
    let fx: ApAllocFixture

    beforeAll(async () => {
      await ensurePermissions()
      const ctx = await createFinanceAdminTenant(app, 'ap-recon-clean')
      fx = await bootstrapApAllocFixture(app, ctx)
    }, 180_000)

    afterAll(async () => {
      if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    })

    it('perfect match: invoice 100000 + payment 40000 -> MATCHED, net 60000', async () => {
      await createPostedInvoice(app, fx, { amount: '100000' })
      await createPostedPayment(app, fx, { amount: '40000' })

      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/payables/reconciliation/runs`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ legalEntityId: fx.legalEntityId })

      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('MATCHED')
      expect(res.body.data.runStatus).toBe('COMPLETED')
      expect(res.body.data.glTotal).toBe('60000.0000')
      expect(res.body.data.subledgerTotal).toBe('60000.0000')
      expect(res.body.data.variance).toBe('0.0000')
      expect(res.body.data.mismatchedAccountCount).toBe(0)
      expect(res.body.data.sourceMode).toBe('CURRENT_BALANCE')
    })

    it('allocation neutrality: allocating a matched invoice+payment pair keeps MATCHED', async () => {
      const invoice2 = await createPostedInvoice(app, fx, { amount: '20000' })
      const payment2 = await createPostedPayment(app, fx, { amount: '20000' })
      const alloc = await postAllocation(
        app,
        fx,
        payment2.documentId,
        allocationBody(payment2, fx.postingDate, [{ target: invoice2, amount: '20000' }]),
      )
      expect(alloc.status).toBe(200)

      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/payables/reconciliation/runs`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ legalEntityId: fx.legalEntityId })

      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('MATCHED')
      expect(res.body.data.mismatchedAccountCount).toBe(0)
      // Fully-allocated pair nets to zero — the LE's total control-account balance is unchanged.
      expect(res.body.data.glTotal).toBe('60000.0000')
      expect(res.body.data.subledgerTotal).toBe('60000.0000')
    })

    it('does not mutate VendorInvoice / PayableOpenItem / GeneralLedgerEntry rows', async () => {
      const before = await Promise.all([
        prisma.vendorInvoice.findMany({ where: { tenantId: fx.tenantId }, select: { id: true, status: true, updatedAt: true } }),
        prisma.payableOpenItem.findMany({
          where: { tenantId: fx.tenantId },
          select: { id: true, status: true, outstandingAmount: true, updatedAt: true },
        }),
        prisma.generalLedgerEntry.findMany({
          where: { tenantId: fx.tenantId },
          select: { id: true, baseDebitAmount: true, baseCreditAmount: true },
        }),
      ])

      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/payables/reconciliation/runs`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ legalEntityId: fx.legalEntityId })
      expect(res.status).toBe(201)

      const after = await Promise.all([
        prisma.vendorInvoice.findMany({ where: { tenantId: fx.tenantId }, select: { id: true, status: true, updatedAt: true } }),
        prisma.payableOpenItem.findMany({
          where: { tenantId: fx.tenantId },
          select: { id: true, status: true, outstandingAmount: true, updatedAt: true },
        }),
        prisma.generalLedgerEntry.findMany({
          where: { tenantId: fx.tenantId },
          select: { id: true, baseDebitAmount: true, baseCreditAmount: true },
        }),
      ])

      expect(JSON.stringify(after[0])).toBe(JSON.stringify(before[0]))
      expect(JSON.stringify(after[1])).toBe(JSON.stringify(before[1]))
      expect(JSON.stringify(after[2])).toBe(JSON.stringify(before[2]))
    })

    it('rejects run creation without finance.ap.reconciliation.run (403)', async () => {
      const noRun = FINANCE_PERMS.filter((p) => p !== 'finance.ap.reconciliation.run') as PermissionName[]
      const { token } = await createUserWithPerms(app, fx.tenantId, fx.slug, noRun, 'no-recon-run')
      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/payables/reconciliation/runs`)
        .set('Authorization', `Bearer ${token}`)
        .send({ legalEntityId: fx.legalEntityId })
      expect(res.status).toBe(403)
    })
  })

  describe('mismatch detection', () => {
    let fx: ApAllocFixture

    beforeAll(async () => {
      await ensurePermissions()
      const ctx = await createFinanceAdminTenant(app, 'ap-recon-mismatch')
      fx = await bootstrapApAllocFixture(app, ctx)
    }, 180_000)

    afterAll(async () => {
      if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    })

    it('orphan open item without voucher/source -> MISMATCHED with a BLOCKER exception', async () => {
      await seedRawInvoiceOpenItem(fx, { amount: '5000' })

      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/payables/reconciliation/runs`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ legalEntityId: fx.legalEntityId })

      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('MISMATCHED')
      expect(res.body.data.blockerCount).toBeGreaterThanOrEqual(1)
      expect(res.body.data.mismatchedAccountCount).toBeGreaterThanOrEqual(1)

      const runId = res.body.data.id as string
      const exceptionsRes = await request(app)
        .get(`/api/v1/t/${fx.slug}/accounting/payables/reconciliation/runs/${runId}/exceptions`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(exceptionsRes.status).toBe(200)
      const blockerExceptions = exceptionsRes.body.data as Array<{ severity: string; code: string }>
      expect(blockerExceptions.some((e) => e.severity === 'BLOCKER' && e.code === 'OPEN_ITEM_WITHOUT_VOUCHER')).toBe(true)
    })
  })

  describe('tolerance', () => {
    let fx: ApAllocFixture

    beforeAll(async () => {
      await ensurePermissions()
      const ctx = await createFinanceAdminTenant(app, 'ap-recon-tolerance')
      fx = await bootstrapApAllocFixture(app, ctx)
      // Isolated GL-only variance of 0.50 on the payable control account — no matching
      // subledger effect, and no interference with other integrity checks.
      await seedControlAccountGlVariance(fx, '0.50')
    }, 180_000)

    afterAll(async () => {
      if (fx?.tenantId) await cleanupTenant(fx.tenantId)
    })

    it('variance within tolerance -> MATCHED', async () => {
      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/payables/reconciliation/runs`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ legalEntityId: fx.legalEntityId, toleranceOverride: '1.00' })

      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('MATCHED')
      expect(res.body.data.variance).toBe('0.5000')
    })

    it('same variance over a tighter tolerance -> MISMATCHED', async () => {
      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/payables/reconciliation/runs`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ legalEntityId: fx.legalEntityId, toleranceOverride: '0.10' })

      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('MISMATCHED')
      expect(res.body.data.mismatchedAccountCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('tenant isolation', () => {
    let fxA: ApAllocFixture
    let fxB: ApAllocFixture

    beforeAll(async () => {
      await ensurePermissions()
      const ctxA = await createFinanceAdminTenant(app, 'ap-recon-tenA')
      fxA = await bootstrapApAllocFixture(app, ctxA)
      const ctxB = await createFinanceAdminTenant(app, 'ap-recon-tenB')
      fxB = await bootstrapApAllocFixture(app, ctxB)
    }, 240_000)

    afterAll(async () => {
      if (fxA?.tenantId) await cleanupTenant(fxA.tenantId)
      if (fxB?.tenantId) await cleanupTenant(fxB.tenantId)
    })

    it('cannot create a run against another tenant legal entity', async () => {
      const res = await request(app)
        .post(`/api/v1/t/${fxB.slug}/accounting/payables/reconciliation/runs`)
        .set('Authorization', `Bearer ${fxB.token}`)
        .send({ legalEntityId: fxA.legalEntityId })
      expect([403, 404]).toContain(res.status)
      expect(await prisma.payableReconciliationRun.count({ where: { tenantId: fxB.tenantId } })).toBe(0)
    })

    it('cannot read a tenant A run via tenant B', async () => {
      const created = await request(app)
        .post(`/api/v1/t/${fxA.slug}/accounting/payables/reconciliation/runs`)
        .set('Authorization', `Bearer ${fxA.token}`)
        .send({ legalEntityId: fxA.legalEntityId })
      expect(created.status).toBe(201)
      const runId = created.body.data.id as string

      const res = await request(app)
        .get(`/api/v1/t/${fxB.slug}/accounting/payables/reconciliation/runs/${runId}`)
        .set('Authorization', `Bearer ${fxB.token}`)
      expect(res.status).toBe(404)
    })
  })
})
