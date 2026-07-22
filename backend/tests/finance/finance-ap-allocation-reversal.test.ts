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

describe.skipIf(!dbAvailable)('Phase 4C1 — AP allocation reversal', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-alloc-rev')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('reverses a full allocation batch and restores open-item balances without GL', async () => {
    const invA = await createPostedInvoice(app, fx, { amount: '60000' })
    const invB = await createPostedInvoice(app, fx, { amount: '40000' })
    const pay = await createPostedPayment(app, fx, { amount: '100000' })

    const allocRes = await postAllocation(
      app,
      fx,
      pay.documentId,
      allocationBody(pay, fx.postingDate, [
        { target: invA, amount: '60000' },
        { target: invB, amount: '40000' },
      ]),
    )
    expect(allocRes.status).toBe(200)
    const batchId = allocRes.body.data.batch.id as string
    const batchUpdatedAt = allocRes.body.data.batch.updatedAt as string

    const glBefore = await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })
    const voucherBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    const revRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/allocations/${batchId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Full batch reverse test',
        idempotencyKey: `alloc-rev-full-${Date.now()}`,
        expectedAllocationUpdatedAt: batchUpdatedAt,
      })

    expect(revRes.status).toBe(200)
    expect(revRes.body.data.idempotentReplay).toBe(false)
    expect(revRes.body.data.allocationBatchStatus).toBe('REVERSED')
    expect(revRes.body.data.totalReversedAmount).toBe('100000.0000')
    expect(revRes.body.data.sourceAfter.allocatedAmount).toBe('0.0000')
    expect(revRes.body.data.sourceAfter.outstandingAmount).toBe('100000.0000')
    expect(revRes.body.data.sourceAfter.status).toBe('OPEN')
    expect(revRes.body.data.reversalReference).toMatch(/^APALLOCREV\//)

    const payAfter = await refreshOpenItem(fx.tenantId, pay.openItemId)
    expect(payAfter.openItem.outstandingAmount).toBe('100000')
    expect(payAfter.openItem.status).toBe('OPEN')

    const invAAfter = await refreshOpenItem(fx.tenantId, invA.openItemId)
    expect(Number(invAAfter.openItem.outstandingAmount)).toBe(60000)
    const invBAfter = await refreshOpenItem(fx.tenantId, invB.openItemId)
    expect(Number(invBAfter.openItem.outstandingAmount)).toBe(40000)

    const glAfter = await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })
    const voucherAfter = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    expect(glAfter).toBe(glBefore)
    expect(voucherAfter).toBe(voucherBefore)

    const postingEvents = await prisma.postingEvent.count({
      where: { tenantId: fx.tenantId, eventType: { contains: 'ALLOC' } },
    })
    expect(postingEvents).toBe(0)
  }, 120_000)

  it('reverses selected lines and marks batch PARTIALLY_REVERSED', async () => {
    const invA = await createPostedInvoice(app, fx, { amount: '60000' })
    const invB = await createPostedInvoice(app, fx, { amount: '40000' })
    const pay = await createPostedPayment(app, fx, { amount: '100000' })

    const allocRes = await postAllocation(
      app,
      fx,
      pay.documentId,
      allocationBody(pay, fx.postingDate, [
        { target: invA, amount: '60000' },
        { target: invB, amount: '40000' },
      ]),
    )
    expect(allocRes.status).toBe(200)
    const batchId = allocRes.body.data.batch.id as string
    const batchUpdatedAt = allocRes.body.data.batch.updatedAt as string
    const lineA = (allocRes.body.data.lines as Array<{ id: string; targetCreditOpenItemId: string }>).find(
      (l) => l.targetCreditOpenItemId === invA.openItemId,
    )!
    expect(lineA).toBeTruthy()

    const revRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/allocations/${batchId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Selected line reverse',
        idempotencyKey: `alloc-rev-sel-${Date.now()}`,
        lineIds: [lineA.id],
        expectedAllocationUpdatedAt: batchUpdatedAt,
      })

    expect(revRes.status).toBe(200)
    expect(revRes.body.data.allocationBatchStatus).toBe('PARTIALLY_REVERSED')
    expect(revRes.body.data.totalReversedAmount).toBe('60000.0000')
    expect(revRes.body.data.sourceAfter.outstandingAmount).toBe('60000.0000')
    expect(revRes.body.data.sourceAfter.allocatedAmount).toBe('40000.0000')

    const invAAfter = await refreshOpenItem(fx.tenantId, invA.openItemId)
    expect(Number(invAAfter.openItem.outstandingAmount)).toBe(60000)
    const invBAfter = await refreshOpenItem(fx.tenantId, invB.openItemId)
    expect(Number(invBAfter.openItem.outstandingAmount)).toBe(0)
  }, 120_000)

  it('replays identical allocation reversal idempotently', async () => {
    const inv = await createPostedInvoice(app, fx, { amount: '25000' })
    const pay = await createPostedPayment(app, fx, { amount: '25000' })
    const allocRes = await postAllocation(
      app,
      fx,
      pay.documentId,
      allocationBody(pay, fx.postingDate, [{ target: inv, amount: '25000' }]),
    )
    expect(allocRes.status).toBe(200)
    const batchId = allocRes.body.data.batch.id as string
    const batchUpdatedAt = allocRes.body.data.batch.updatedAt as string
    const key = `alloc-rev-idem-${Date.now()}`

    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/allocations/${batchId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Idempotency',
        idempotencyKey: key,
        expectedAllocationUpdatedAt: batchUpdatedAt,
      })
    expect(first.status).toBe(200)
    expect(first.body.data.idempotentReplay).toBe(false)

    const second = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/allocations/${batchId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Idempotency',
        idempotencyKey: key,
        expectedAllocationUpdatedAt: batchUpdatedAt,
      })
    expect(second.status).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.reversalBatchId).toBe(first.body.data.reversalBatchId)
    expect(second.body.data.reversalReference).toBe(first.body.data.reversalReference)

    const revCount = await prisma.payableAllocationReversalBatch.count({
      where: { tenantId: fx.tenantId, allocationBatchId: batchId },
    })
    expect(revCount).toBe(1)
  }, 120_000)

  it('rejects payload mismatch on same idempotency key', async () => {
    const invA = await createPostedInvoice(app, fx, { amount: '30000' })
    const invB = await createPostedInvoice(app, fx, { amount: '20000' })
    const pay = await createPostedPayment(app, fx, { amount: '50000' })
    const allocRes = await postAllocation(
      app,
      fx,
      pay.documentId,
      allocationBody(pay, fx.postingDate, [
        { target: invA, amount: '30000' },
        { target: invB, amount: '20000' },
      ]),
    )
    expect(allocRes.status).toBe(200)
    const batchId = allocRes.body.data.batch.id as string
    const batchUpdatedAt = allocRes.body.data.batch.updatedAt as string
    const lines = allocRes.body.data.lines as Array<{ id: string }>
    const key = `alloc-rev-mismatch-${Date.now()}`

    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/allocations/${batchId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Mismatch test',
        idempotencyKey: key,
        lineIds: [lines[0]!.id],
        expectedAllocationUpdatedAt: batchUpdatedAt,
      })
    expect(first.status).toBe(200)

    const batchAfter = await prisma.payableAllocationBatch.findFirstOrThrow({ where: { id: batchId } })
    const mismatch = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/allocations/${batchId}/reverse`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        reversalDate: fx.postingDate,
        reason: 'Mismatch test',
        idempotencyKey: key,
        lineIds: [lines[1]!.id],
        expectedAllocationUpdatedAt: batchAfter.updatedAt.toISOString(),
      })
    expect(mismatch.status).toBe(409)
    expect(mismatch.body.error?.code ?? mismatch.body.code).toBe('PAYABLE_ALLOCATION_REVERSAL_PAYLOAD_MISMATCH')
  }, 120_000)
})
