import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
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

describe.skipIf(!dbAvailable)('Finance Phase 4B4 — AP allocation tenant isolation', () => {
  let fxA: ApAllocFixture
  let fxB: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctxA = await createFinanceAdminTenant(app, 'ap-alloc-tenA')
    fxA = await bootstrapApAllocFixture(app, ctxA)
    const ctxB = await createFinanceAdminTenant(app, 'ap-alloc-tenB')
    fxB = await bootstrapApAllocFixture(app, ctxB)
  }, 240_000)

  afterAll(async () => {
    if (fxA?.tenantId) await cleanupTenant(fxA.tenantId)
    if (fxB?.tenantId) await cleanupTenant(fxB.tenantId)
  })

  it('cannot allocate tenant A payment using tenant B credentials', async () => {
    const payment = await createPostedPayment(app, fxA, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fxA, { amount: '5000' })
    // Use tenant B's slug/token against tenant A's payment id.
    const res = await request(app)
      .post(`/api/v1/t/${fxB.slug}/accounting/payables/vendor-payments/${payment.documentId}/allocations`)
      .set('Authorization', `Bearer ${fxB.token}`)
      .send(allocationBody(payment, fxA.postingDate, [{ target: invoice, amount: '5000' }]))
    expect([403, 404]).toContain(res.status)

    // Nothing created in tenant B
    expect(await prisma.payableAllocationBatch.count({ where: { tenantId: fxB.tenantId } })).toBe(0)
    // Tenant A payment source untouched
    const source = await prisma.payableOpenItem.findFirstOrThrow({ where: { id: payment.openItemId } })
    expect(source.outstandingAmount.toString()).toBe('10000')
  })

  it('cannot read a tenant A allocation batch via tenant B', async () => {
    const payment = await createPostedPayment(app, fxA, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fxA, { amount: '6000' })
    const alloc = await postAllocation(app, fxA, payment.documentId, allocationBody(payment, fxA.postingDate, [{ target: invoice, amount: '6000' }]))
    expect(alloc.status).toBe(200)
    const batchId = alloc.body.data.batch.id as string

    const res = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/payables/allocations/${batchId}`)
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(res.status).toBe(404)
  })
})
