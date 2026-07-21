/**
 * Finance Phase 5C1 — Cash position / daily liquidity / forecast / day-close.
 * Live MySQL when available.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  FINANCE_PERMS,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import { createAdjustmentBankAccount } from './helpers/treasury-adjustment-fixture.js'
import { createTreasuryAccount, type TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5C1 — Treasury liquidity', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let cash1: TreasuryTransferAccount

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tliq')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'LIQBANK' })
    cash1 = await createTreasuryAccount(app, fx, 'CASH', { namePrefix: 'LIQCASH' })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  function authGet(path: string, query: Record<string, string | number> = {}) {
    return request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/liquidity${path}`)
      .query({ legalEntityId: fx.legalEntityId, ...query })
      .set('Authorization', `Bearer ${fx.token}`)
  }

  it('returns cash position with bank and cash accounts', async () => {
    const res = await authGet('/cash-position')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.legalEntityId).toBe(fx.legalEntityId)
    expect(res.body.data.accounts.some((a: { treasuryAccountId: string }) => a.treasuryAccountId === bank1.id)).toBe(true)
    expect(res.body.data.accounts.some((a: { treasuryAccountId: string }) => a.treasuryAccountId === cash1.id)).toBe(true)
    expect(Number(res.body.data.totalBookBalance)).toBeGreaterThanOrEqual(0)
  })

  it('returns daily liquidity buckets and available liquidity', async () => {
    const res = await authGet('/daily')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.buckets.length).toBeGreaterThan(0)
    expect(res.body.data.availableLiquidity).toBeDefined()
  })

  it('returns short-term forecast buckets for 7/14/30', async () => {
    const res = await authGet('/forecast', { horizonDays: 30 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.buckets.map((b: { horizonDays: number }) => b.horizonDays)).toEqual(
      expect.arrayContaining([7, 14, 30]),
    )
  })

  it('returns closing controls checklist', async () => {
    const res = await authGet('/closing-controls')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.items.some((i: { id: string }) => i.id === 'negative_cash')).toBe(true)
  })

  it('returns composed treasury dashboard', async () => {
    const res = await authGet('/dashboard', { horizonDays: 14 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.position).toBeDefined()
    expect(res.body.data.liquidity).toBeDefined()
    expect(res.body.data.forecast).toBeDefined()
    expect(res.body.data.closingControls).toBeDefined()
    expect(res.body.data.workflow).toBeDefined()
  })

  it('creates and closes a day-close record', async () => {
    const closeDate = new Date().toISOString().slice(0, 10)
    const create = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/liquidity/day-closes`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ legalEntityId: fx.legalEntityId, closeDate, notes: '5C1 test close' })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    const id = create.body.data.id as string
    const updatedAt = create.body.data.updatedAt as string

    const review = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/liquidity/day-closes/${id}/review`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: updatedAt })
    expect(review.status, JSON.stringify(review.body)).toBe(200)
    expect(review.body.data.status).toBe('REVIEWED')

    const closed = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/liquidity/day-closes/${id}/close`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: review.body.data.updatedAt })
    expect(closed.status, JSON.stringify(closed.body)).toBe(200)
    expect(closed.body.data.status).toBe('CLOSED')

    const dup = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/liquidity/day-closes`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ legalEntityId: fx.legalEntityId, closeDate })
    expect(dup.status).toBe(409)

    const reopened = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/liquidity/day-closes/${id}/reopen`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: closed.body.data.updatedAt, reason: 'Correct checklist item' })
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200)
    expect(reopened.body.data.status).toBe('OPEN')
  })

  it('returns 403 without liquidity.view permission', async () => {
    const limitedPerms = FINANCE_PERMS.filter(
      (p) =>
        p !== 'finance.treasury.liquidity.view' &&
        p !== 'finance.treasury.closing.view' &&
        p !== 'finance.treasury.closing.manage',
    )
    const { token } = await createUserWithPerms(app, fx.tenantId, fx.slug, limitedPerms, 'tliq-noview')
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/liquidity/cash-position`)
      .query({ legalEntityId: fx.legalEntityId })
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})
