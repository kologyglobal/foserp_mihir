import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  adjustmentAllocationBody,
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createPostedDebitNote,
  createPostedInvoice,
  ensurePermissions,
  postAdjustmentAllocation,
  refreshOpenItem,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

describe.skipIf(!dbAvailable)('Phase 4C2 — vendor adjustment reversal', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-vadj-rev')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  async function adjustmentUpdatedAt(id: string): Promise<string> {
    const row = await prisma.vendorAdjustment.findFirstOrThrow({ where: { id, tenantId: fx.tenantId } })
    return row.updatedAt.toISOString()
  }

  it('reverses a posted debit note with no allocations and nets GL to zero', async () => {
    const dn = await createPostedDebitNote(app, fx, { taxableAmount: '8000' })
    const expectedUpdatedAt = await adjustmentUpdatedAt(dn.documentId)

    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${dn.documentId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Supplier withdrew debit note',
        idempotencyKey: `vadj-rev-${Date.now()}`,
        expectedUpdatedAt,
      })

    expect(rev.status).toBe(200)
    expect(rev.body.data.status).toBe('REVERSED')

    const adjustment = await prisma.vendorAdjustment.findFirstOrThrow({
      where: { id: dn.documentId, tenantId: fx.tenantId },
    })
    expect(adjustment.status).toBe('REVERSED')

    const openItem = await refreshOpenItem(fx.tenantId, dn.openItemId)
    expect(openItem.openItem.status).toBe('REVERSED')
    expect(Number(openItem.openItem.outstandingAmount)).toBe(0)

    const originalVoucher = await prisma.accountingVoucher.findFirstOrThrow({
      where: { id: adjustment.accountingVoucherId!, tenantId: fx.tenantId },
    })
    expect(originalVoucher.status).toBe('REVERSED')

    const allGl = await prisma.generalLedgerEntry.findMany({
      where: {
        tenantId: fx.tenantId,
        OR: [{ voucherId: originalVoucher.id }, { voucherId: adjustment.reversalVoucherId! }],
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

  it('blocks debit note reversal when active allocations exist', async () => {
    const inv = await createPostedInvoice(app, fx, { amount: '15000' })
    const dn = await createPostedDebitNote(app, fx, { taxableAmount: '10000' })
    const alloc = await postAdjustmentAllocation(
      app,
      fx,
      dn.documentId,
      adjustmentAllocationBody(dn, fx.postingDate, [{ target: inv, amount: '11800' }]),
    )
    expect(alloc.status).toBe(200)

    const expectedUpdatedAt = await adjustmentUpdatedAt(dn.documentId)
    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${dn.documentId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Should block',
        idempotencyKey: `vadj-rev-block-${Date.now()}`,
        expectedUpdatedAt,
        cascadeAllocationReversals: false,
      })

    expect(rev.status).toBe(422)
    expect(rev.body.error?.code ?? rev.body.code).toBe('VENDOR_ADJUSTMENT_ACTIVE_ALLOCATIONS_EXIST')
  }, 120_000)

  it('cascades allocation reversal then reverses debit note atomically', async () => {
    const inv = await createPostedInvoice(app, fx, { amount: '12000' })
    const dn = await createPostedDebitNote(app, fx, { taxableAmount: '10000' })
    const alloc = await postAdjustmentAllocation(
      app,
      fx,
      dn.documentId,
      adjustmentAllocationBody(dn, fx.postingDate, [{ target: inv, amount: '11800' }]),
    )
    expect(alloc.status).toBe(200)

    const expectedUpdatedAt = await adjustmentUpdatedAt(dn.documentId)
    const rev = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${dn.documentId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Cascade reverse debit note',
        idempotencyKey: `vadj-rev-cascade-${Date.now()}`,
        expectedUpdatedAt,
        cascadeAllocationReversals: true,
      })

    expect(rev.status).toBe(200)
    expect(rev.body.data.status).toBe('REVERSED')
    expect(rev.body.data.allocationReversals?.length).toBeGreaterThan(0)

    const dnAfter = await refreshOpenItem(fx.tenantId, dn.openItemId)
    expect(dnAfter.openItem.status).toBe('REVERSED')

    const invAfter = await refreshOpenItem(fx.tenantId, inv.openItemId)
    expect(Number(invAfter.openItem.outstandingAmount)).toBe(12000)
    expect(invAfter.openItem.status).toBe('OPEN')
  }, 120_000)
})
