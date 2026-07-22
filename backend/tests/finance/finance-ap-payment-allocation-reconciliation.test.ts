import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  allocationBody,
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createPostedInvoice,
  createPostedPayment,
  ensurePermissions,
  postAllocation,
  seedRawInvoiceOpenItem,
  seedRawPayment,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

async function netAp(tenantId: string): Promise<number> {
  const items = await prisma.payableOpenItem.findMany({ where: { tenantId } })
  // Net AP subledger = CREDIT outstanding − DEBIT outstanding (base currency).
  return items.reduce((acc, i) => {
    const base = Number(i.baseOutstandingAmount)
    return acc + (i.side === 'CREDIT' ? base : -base)
  }, 0)
}

describe.skipIf(!dbAvailable)('Finance Phase 4B4 — AP allocation reconciliation', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-alloc-recon')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('net AP subledger and GL are unchanged by allocation', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '6000' })

    const netBefore = await netAp(fx.tenantId)
    const glBefore = await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })
    const voucherBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    const eventBefore = await prisma.postingEvent.count({ where: { tenantId: fx.tenantId } })
    const seriesBefore = await prisma.financeNumberSeries.findMany({ where: { tenantId: fx.tenantId }, select: { documentType: true, currentValue: true } })

    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '6000' }]))
    expect(res.status).toBe(200)

    const netAfter = await netAp(fx.tenantId)
    // Allocation just moves outstanding between DEBIT and CREDIT sides — net AP is invariant.
    expect(netAfter).toBeCloseTo(netBefore, 4)

    expect(await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })).toBe(glBefore)
    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherBefore)
    expect(await prisma.postingEvent.count({ where: { tenantId: fx.tenantId } })).toBe(eventBefore)

    const seriesAfter = await prisma.financeNumberSeries.findMany({ where: { tenantId: fx.tenantId }, select: { documentType: true, currentValue: true } })
    expect(seriesAfter).toEqual(seriesBefore)
  })

  it('allocation batch/line totals reconcile with open-item deltas', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invA = await createPostedInvoice(app, fx, { amount: '6000' })
    const invB = await createPostedInvoice(app, fx, { amount: '4000' })

    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [
      { target: invA, amount: '6000' },
      { target: invB, amount: '3000' },
    ]))
    expect(res.status).toBe(200)
    const batchId = res.body.data.batch.id as string

    const batch = await prisma.payableAllocationBatch.findFirstOrThrow({ where: { id: batchId } })
    const lines = await prisma.payableAllocationLine.findMany({ where: { allocationBatchId: batchId } })
    const lineSum = lines.reduce((s, l) => s + Number(l.amount), 0)
    expect(lineSum).toBeCloseTo(Number(batch.totalAllocatedAmount), 4)
    expect(lineSum).toBe(9000)

    const source = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: payment.openItemId } })
    expect(Number(source.allocatedAmount)).toBe(9000)
    expect(Number(source.outstandingAmount)).toBe(1000)
  })

  it('FX mismatch is blocked (kept out of subledger, deferred to posting path)', async () => {
    const payment = await seedRawPayment(fx, { amount: '10000', currencyCode: 'USD', exchangeRate: '80' })
    const invoice = await seedRawInvoiceOpenItem(fx, { amount: '5000', currencyCode: 'USD', exchangeRate: '90' })
    const res = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]))
    expect(res.status).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('PAYABLE_ALLOCATION_FX_DIFFERENCE_REQUIRES_POSTING')
    // No batch persisted for the blocked attempt.
    const batches = await prisma.payableAllocationBatch.count({ where: { tenantId: fx.tenantId, sourceDebitOpenItemId: payment.openItemId } })
    expect(batches).toBe(0)
  })
})
