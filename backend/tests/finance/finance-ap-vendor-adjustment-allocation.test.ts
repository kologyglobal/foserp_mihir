import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  adjustmentAllocationBody,
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createPostedCreditAdjustment,
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

describe.skipIf(!dbAvailable)('Phase 4C2 — vendor adjustment allocation', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-vadj-alloc')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('allocates a posted debit note against a vendor invoice', async () => {
    const inv = await createPostedInvoice(app, fx, { amount: '20000' })
    const dn = await createPostedDebitNote(app, fx, { taxableAmount: '10000' })
    const amount = '11800'

    const alloc = await postAdjustmentAllocation(
      app,
      fx,
      dn.documentId,
      adjustmentAllocationBody(dn, fx.postingDate, [{ target: inv, amount }]),
    )
    expect(alloc.status).toBe(200)

    const dnAfter = await refreshOpenItem(fx.tenantId, dn.openItemId)
    expect(Number(dnAfter.openItem.outstandingAmount)).toBe(0)
    expect(dnAfter.openItem.status).toBe('SETTLED')

    const invAfter = await refreshOpenItem(fx.tenantId, inv.openItemId)
    expect(Number(invAfter.openItem.outstandingAmount)).toBe(8200)
    expect(invAfter.openItem.status).toBe('PARTIALLY_SETTLED')
  }, 120_000)

  it('allocates a posted debit note against a credit adjustment target', async () => {
    const ca = await createPostedCreditAdjustment(app, fx, { taxableAmount: '5000' })
    const dn = await createPostedDebitNote(app, fx, { taxableAmount: '5000' })
    const amount = '5900'

    const alloc = await postAdjustmentAllocation(
      app,
      fx,
      dn.documentId,
      adjustmentAllocationBody(dn, fx.postingDate, [{ target: ca, amount }]),
    )
    expect(alloc.status).toBe(200)

    const caAfter = await refreshOpenItem(fx.tenantId, ca.openItemId)
    expect(Number(caAfter.openItem.outstandingAmount)).toBe(0)
    expect(caAfter.openItem.status).toBe('SETTLED')
  }, 120_000)

  it('blocks allocation from a credit adjustment (not a DEBIT source)', async () => {
    const ca = await createPostedCreditAdjustment(app, fx, { taxableAmount: '1000' })
    const inv = await createPostedInvoice(app, fx, { amount: '5000' })

    const alloc = await postAdjustmentAllocation(
      app,
      fx,
      ca.documentId,
      adjustmentAllocationBody(ca, fx.postingDate, [{ target: inv, amount: '1000' }]),
    )
    expect(alloc.status).toBe(422)
  }, 120_000)
})
