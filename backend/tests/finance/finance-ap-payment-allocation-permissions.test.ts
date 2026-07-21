import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
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
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 4B4 — AP allocation permissions', () => {
  let fx: ApAllocFixture
  let noCreateToken: string
  let postOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-alloc-perm')
    fx = await bootstrapApAllocFixture(app, ctx)

    const noCreate = FINANCE_PERMS.filter((p) => p !== 'finance.ap.allocation.create') as PermissionName[]
    noCreateToken = (await createUserWithPerms(app, fx.tenantId, fx.slug, noCreate, 'no-alloc-create')).token

    // A user with payment.post + view but WITHOUT allocation.create — post alone is insufficient.
    const postOnly = PERMISSIONS.filter(
      (p) =>
        p === 'finance.ap.payment.post' ||
        p === 'finance.ap.payment.view' ||
        p === 'finance.ap.allocation.view' ||
        p === 'finance.ap.view',
    ) as PermissionName[]
    postOnlyToken = (await createUserWithPerms(app, fx.tenantId, fx.slug, postOnly, 'post-only')).token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('rejects allocation without finance.ap.allocation.create (403)', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '5000' })
    const res = await postAllocation(
      app,
      fx,
      payment.documentId,
      allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]),
      noCreateToken,
    )
    expect(res.status).toBe(403)
  })

  it('payment.post permission alone is insufficient to allocate (403)', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const invoice = await createPostedInvoice(app, fx, { amount: '5000' })
    const res = await postAllocation(
      app,
      fx,
      payment.documentId,
      allocationBody(payment, fx.postingDate, [{ target: invoice, amount: '5000' }]),
      postOnlyToken,
    )
    expect(res.status).toBe(403)
  })

  it('allocatable-invoices requires allocation.view', async () => {
    const payment = await createPostedPayment(app, fx, { amount: '10000' })
    const noView = FINANCE_PERMS.filter((p) => p !== 'finance.ap.allocation.view') as PermissionName[]
    const noViewToken = (await createUserWithPerms(app, fx.tenantId, fx.slug, noView, 'no-alloc-view')).token
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-payments/${payment.documentId}/allocatable-invoices`)
      .set('Authorization', `Bearer ${noViewToken}`)
    expect(res.status).toBe(403)
  })
})
