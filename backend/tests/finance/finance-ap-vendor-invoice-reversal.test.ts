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

describe.skipIf(!dbAvailable)('Phase 4C1 — vendor invoice reversal', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-vi-rev')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  async function invoiceUpdatedAt(id: string): Promise<string> {
    const row = await prisma.vendorInvoice.findFirstOrThrow({ where: { id, tenantId: fx.tenantId } })
    return row.updatedAt.toISOString()
  }

  it('reverses a posted invoice with no allocations and nets GL to zero', async () => {
    const inv = await createPostedInvoice(app, fx, { amount: '45000' })
    const expectedUpdatedAt = await invoiceUpdatedAt(inv.documentId)

    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${inv.documentId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Supplier cancelled invoice',
        idempotencyKey: `vi-rev-${Date.now()}`,
        expectedUpdatedAt,
      })

    expect(rev.status).toBe(200)
    expect(rev.body.data.status).toBe('REVERSED')
    expect(rev.body.data.reversalVoucherId).toBeTruthy()

    const invoice = await prisma.vendorInvoice.findFirstOrThrow({
      where: { id: inv.documentId, tenantId: fx.tenantId },
    })
    expect(invoice.status).toBe('REVERSED')

    const openItem = await refreshOpenItem(fx.tenantId, inv.openItemId)
    expect(openItem.openItem.status).toBe('REVERSED')
    expect(Number(openItem.openItem.outstandingAmount)).toBe(0)

    const originalVoucher = await prisma.accountingVoucher.findFirstOrThrow({
      where: { id: invoice.accountingVoucherId!, tenantId: fx.tenantId },
    })
    expect(originalVoucher.status).toBe('REVERSED')

    const allGl = await prisma.generalLedgerEntry.findMany({
      where: {
        tenantId: fx.tenantId,
        OR: [{ voucherId: originalVoucher.id }, { voucherId: invoice.reversalVoucherId! }],
      },
    })
    const byAccount = new Map<string, { debit: number; credit: number }>()
    for (const row of allGl) {
      const cur = byAccount.get(row.accountId) ?? { debit: 0, credit: 0 }
      cur.debit += Number(row.baseDebitAmount)
      cur.credit += Number(row.baseCreditAmount)
      byAccount.set(row.accountId, cur)
    }
    for (const [, bal] of byAccount) {
      expect(Math.abs(bal.debit - bal.credit)).toBeLessThan(0.02)
    }
  }, 120_000)

  it('blocks invoice reversal when active allocations exist and cascade is false', async () => {
    const inv = await createPostedInvoice(app, fx, { amount: '18000' })
    const pay = await createPostedPayment(app, fx, { amount: '18000' })
    const alloc = await postAllocation(
      app,
      fx,
      pay.documentId,
      allocationBody(pay, fx.postingDate, [{ target: inv, amount: '18000' }]),
    )
    expect(alloc.status).toBe(200)

    const expectedUpdatedAt = await invoiceUpdatedAt(inv.documentId)
    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${inv.documentId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Should block',
        idempotencyKey: `vi-rev-block-${Date.now()}`,
        expectedUpdatedAt,
        cascadeAllocationReversals: false,
      })

    expect(rev.status).toBe(422)
    expect(rev.body.error?.code ?? rev.body.code).toBe('VENDOR_INVOICE_ACTIVE_ALLOCATIONS_EXIST')

    const invoice = await prisma.vendorInvoice.findFirstOrThrow({
      where: { id: inv.documentId, tenantId: fx.tenantId },
    })
    expect(invoice.status).toBe('POSTED')
  }, 120_000)

  it('cascades allocation reversal then reverses invoice atomically', async () => {
    const inv = await createPostedInvoice(app, fx, { amount: '12000' })
    const pay = await createPostedPayment(app, fx, { amount: '12000' })
    const alloc = await postAllocation(
      app,
      fx,
      pay.documentId,
      allocationBody(pay, fx.postingDate, [{ target: inv, amount: '12000' }]),
    )
    expect(alloc.status).toBe(200)

    const expectedUpdatedAt = await invoiceUpdatedAt(inv.documentId)
    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${inv.documentId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Cascade reverse',
        idempotencyKey: `vi-rev-cascade-${Date.now()}`,
        expectedUpdatedAt,
        cascadeAllocationReversals: true,
      })

    expect(rev.status).toBe(200)
    expect(rev.body.data.status).toBe('REVERSED')
    expect(rev.body.data.allocationReversals?.length).toBeGreaterThan(0)

    const payAfter = await refreshOpenItem(fx.tenantId, pay.openItemId)
    expect(Number(payAfter.openItem.outstandingAmount)).toBe(12000)
    expect(payAfter.openItem.status).toBe('OPEN')

    const invOi = await refreshOpenItem(fx.tenantId, inv.openItemId)
    expect(invOi.openItem.status).toBe('REVERSED')
    expect(Number(invOi.openItem.outstandingAmount)).toBe(0)
  }, 120_000)
})
