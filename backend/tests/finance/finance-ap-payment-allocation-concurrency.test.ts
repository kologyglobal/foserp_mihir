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
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 4B4 — AP allocation concurrency', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-alloc-conc')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('two concurrent allocations of one payment do not over-allocate the source', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invA = await createPostedInvoice(app, fx, { amount: '8000' })
    const invB = await createPostedInvoice(app, fx, { amount: '8000' })

    const [r1, r2] = await Promise.all([
      postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invA, amount: '8000' }])),
      postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invB, amount: '8000' }])),
    ])
    const statuses = [r1.status, r2.status].sort()
    // Exactly one succeeds; the other fails with a concurrency/exceed guard.
    expect(statuses).toContain(200)
    expect(statuses.filter((s) => s === 200).length).toBe(1)
    const failed = [r1, r2].find((r) => r.status !== 200)!
    expect([409, 422]).toContain(failed.status)

    const source = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: payment.openItemId } })
    expect(Number(source.outstandingAmount)).toBeGreaterThanOrEqual(2000)
    expect(Number(source.allocatedAmount)).toBeLessThanOrEqual(10000)
    // Only one batch persisted
    const batches = await prisma.payableAllocationBatch.count({ where: { tenantId: fx.tenantId, sourceDebitOpenItemId: payment.openItemId } })
    expect(batches).toBe(1)
  })

  it('two concurrent payments do not over-settle one invoice', async () => {
    const invoice = await createPostedInvoice(app, fx, { amount: '10000' })
    const pay1 = await createPostedPayment(app, fx, { amount: '10000' })
    const pay2 = await createPostedPayment(app, fx, { amount: '10000' })

    const [r1, r2] = await Promise.all([
      postAllocation(app, fx, pay1.documentId, allocationBody(pay1, fx.postingDate, [{ target: invoice, amount: '10000' }])),
      postAllocation(app, fx, pay2.documentId, allocationBody(pay2, fx.postingDate, [{ target: invoice, amount: '10000' }])),
    ])
    const okCount = [r1, r2].filter((r) => r.status === 200).length
    expect(okCount).toBe(1)

    const target = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: invoice.openItemId } })
    expect(Number(target.outstandingAmount)).toBe(0)
    expect(Number(target.allocatedAmount)).toBe(10000)
  })
})
