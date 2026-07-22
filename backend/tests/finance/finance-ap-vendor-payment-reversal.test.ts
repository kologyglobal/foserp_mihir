import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createPostedInvoice,
  createPostedPayment,
  ensurePermissions,
  postAllocation,
  allocationBody,
  refreshOpenItem,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

describe.skipIf(!dbAvailable)('Phase 4C1 — vendor payment reversal', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-vp-rev')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  async function paymentUpdatedAt(id: string): Promise<string> {
    const row = await prisma.vendorPayment.findFirstOrThrow({ where: { id, tenantId: fx.tenantId } })
    return row.updatedAt.toISOString()
  }

  it('reverses a posted payment with no allocations and nets GL to zero', async () => {
    const pay = await createPostedPayment(app, fx, { amount: '50000' })
    const expectedUpdatedAt = await paymentUpdatedAt(pay.documentId)

    const glBefore = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, sourceDocumentId: pay.documentId },
    })
    expect(glBefore.length).toBeGreaterThan(0)

    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${pay.documentId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Duplicate bank payment',
        idempotencyKey: `vp-rev-${Date.now()}`,
        expectedUpdatedAt,
      })

    expect(rev.status).toBe(200)
    expect(rev.body.data.status).toBe('REVERSED')
    expect(rev.body.data.idempotentReplay).toBe(false)
    expect(rev.body.data.reversalVoucherId).toBeTruthy()

    const payment = await prisma.vendorPayment.findFirstOrThrow({
      where: { id: pay.documentId, tenantId: fx.tenantId },
    })
    expect(payment.status).toBe('REVERSED')

    const openItem = await refreshOpenItem(fx.tenantId, pay.openItemId)
    expect(openItem.openItem.status).toBe('REVERSED')
    expect(Number(openItem.openItem.outstandingAmount)).toBe(0)

    const originalVoucher = await prisma.accountingVoucher.findFirstOrThrow({
      where: { id: payment.accountingVoucherId!, tenantId: fx.tenantId },
    })
    expect(originalVoucher.status).toBe('REVERSED')

    const allGl = await prisma.generalLedgerEntry.findMany({
      where: {
        tenantId: fx.tenantId,
        OR: [{ voucherId: originalVoucher.id }, { voucherId: payment.reversalVoucherId! }],
      },
    })
    const byAccount = new Map<string, { debit: number; credit: number }>()
    for (const row of allGl) {
      const key = row.accountId
      const cur = byAccount.get(key) ?? { debit: 0, credit: 0 }
      cur.debit += Number(row.baseDebitAmount)
      cur.credit += Number(row.baseCreditAmount)
      byAccount.set(key, cur)
    }
    for (const [, bal] of byAccount) {
      expect(Math.abs(bal.debit - bal.credit)).toBeLessThan(0.02)
    }
  }, 120_000)

  it('blocks payment reversal when active allocations exist and cascade is false', async () => {
    const inv = await createPostedInvoice(app, fx, { amount: '20000' })
    const pay = await createPostedPayment(app, fx, { amount: '20000' })
    const alloc = await postAllocation(
      app,
      fx,
      pay.documentId,
      allocationBody(pay, fx.postingDate, [{ target: inv, amount: '20000' }]),
    )
    expect(alloc.status).toBe(200)

    const expectedUpdatedAt = await paymentUpdatedAt(pay.documentId)
    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${pay.documentId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Should block',
        idempotencyKey: `vp-rev-block-${Date.now()}`,
        expectedUpdatedAt,
        cascadeAllocationReversals: false,
      })

    expect(rev.status).toBe(422)
    expect(rev.body.error?.code ?? rev.body.code).toBe('VENDOR_PAYMENT_ACTIVE_ALLOCATIONS_EXIST')

    const payment = await prisma.vendorPayment.findFirstOrThrow({
      where: { id: pay.documentId, tenantId: fx.tenantId },
    })
    expect(payment.status).toBe('POSTED')
  }, 120_000)

  it('cascades allocation reversal then reverses payment atomically', async () => {
    const inv = await createPostedInvoice(app, fx, { amount: '15000' })
    const pay = await createPostedPayment(app, fx, { amount: '15000' })
    const alloc = await postAllocation(
      app,
      fx,
      pay.documentId,
      allocationBody(pay, fx.postingDate, [{ target: inv, amount: '15000' }]),
    )
    expect(alloc.status).toBe(200)

    const expectedUpdatedAt = await paymentUpdatedAt(pay.documentId)
    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${pay.documentId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Cascade reverse',
        idempotencyKey: `vp-rev-cascade-${Date.now()}`,
        expectedUpdatedAt,
        cascadeAllocationReversals: true,
      })

    expect(rev.status).toBe(200)
    expect(rev.body.data.status).toBe('REVERSED')
    expect(rev.body.data.allocationReversals?.length).toBeGreaterThan(0)

    const invAfter = await refreshOpenItem(fx.tenantId, inv.openItemId)
    expect(Number(invAfter.openItem.outstandingAmount)).toBe(15000)
    expect(invAfter.openItem.status).toBe('OPEN')

    const payOi = await refreshOpenItem(fx.tenantId, pay.openItemId)
    expect(payOi.openItem.status).toBe('REVERSED')
    expect(Number(payOi.openItem.outstandingAmount)).toBe(0)
  }, 120_000)
})
