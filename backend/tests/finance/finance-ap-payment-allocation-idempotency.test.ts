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

describe.skipIf(!dbAvailable)('Finance Phase 4B4 — AP allocation idempotency', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-alloc-idem')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('replays the same batch for a repeated idempotency key without duplicating balances or audit', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '6000' })
    const body = allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '4000' }], `idem-fixed-${Date.now()}`)

    const first = await postAllocation(app, fx, payment.documentId, body)
    expect(first.status).toBe(200)
    expect(first.body.data.idempotentReplay).toBe(false)
    const batchId = first.body.data.batch.id as string

    const second = await postAllocation(app, fx, payment.documentId, body)
    expect(second.status).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.batch.id).toBe(batchId)

    const source = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: payment.openItemId } })
    expect(source.outstandingAmount.toString()).toBe('6000')
    const target = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: invoice.openItemId } })
    expect(target.outstandingAmount.toString()).toBe('2000')

    const batches = await prisma.payableAllocationBatch.count({ where: { tenantId: fx.tenantId, idempotencyKey: body.idempotencyKey } })
    expect(batches).toBe(1)
    const audits = await prisma.auditLog.count({
      where: { tenantId: fx.tenantId, action: 'PAYABLE_ALLOCATION_CREATED', entityId: batchId },
    })
    expect(audits).toBe(1)
  })

  it('rejects a reused idempotency key carrying a different payload', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '8000' })
    const key = `idem-mismatch-${Date.now()}`
    const first = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '3000' }], key))
    expect(first.status).toBe(200)

    const invoice2 = await createPostedInvoice(app, fx, { amount: '8000' })
    const second = await postAllocation(app, fx, payment.documentId, allocationBody(payment, fx.postingDate, [{ target: invoice2, amount: '5000' }], key))
    expect(second.status).toBe(409)
    expect(second.body.error?.code ?? second.body.code).toBe('PAYABLE_ALLOCATION_IDEMPOTENCY_PAYLOAD_MISMATCH')
  })
})
