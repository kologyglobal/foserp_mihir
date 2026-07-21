/**
 * Finance Phase 5B3 — Treasury adjustment reversal: full accounting reversal of a posted
 * adjustment, idempotent replay, optimistic-lock guard, and status-guard rejections. Live MySQL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import {
  createAdjustmentBankAccount,
  createAndPostAdjustment,
  createGlExpenseAccount,
  createReadyAdjustmentDraft,
  getGlBalance,
  reverseAdjustment,
} from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Treasury adjustment reversal', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let expenseGl: { id: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-rev')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'REVBANK' })
    expenseGl = await createGlExpenseAccount(fx, 'REVEXP')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('fully reverses a posted bank charge, zeroing out the GL impact', async () => {
    const posted = await createAndPostAdjustment(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '200' }],
    })
    const adjustmentId = (posted.adjustment as Record<string, unknown>).id as string
    const updatedAt = (posted.adjustment as Record<string, unknown>).updatedAt as string
    expect(await getGlBalance(fx.tenantId, expenseGl.id)).toBe('200.0000')

    const res = await reverseAdjustment(app, fx, adjustmentId, {
      expectedUpdatedAt: updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Charged in error',
      idempotencyKey: `rev-${adjustmentId}`,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.adjustment.status).toBe('REVERSED')
    expect(res.body.data.idempotentReplay).toBe(false)
    expect(await getGlBalance(fx.tenantId, expenseGl.id)).toBe('0.0000')
    expect(await getGlBalance(fx.tenantId, bank1.glAccountId)).toBe('0.0000')

    const original = await prisma.accountingVoucher.findFirst({ where: { tenantId: fx.tenantId, id: posted.adjustment.voucherId as string } })
    expect(original?.status).toBe('REVERSED')
  })

  it('replays idempotently when reversing an already-REVERSED adjustment', async () => {
    const posted = await createAndPostAdjustment(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '35' }],
    })
    const adjustmentId = (posted.adjustment as Record<string, unknown>).id as string
    const first = await reverseAdjustment(app, fx, adjustmentId, {
      expectedUpdatedAt: (posted.adjustment as Record<string, unknown>).updatedAt as string,
      reversalDate: fx.postingDate,
      reason: 'Test reversal',
      idempotencyKey: `rev2-${adjustmentId}`,
    })
    expect(first.status, JSON.stringify(first.body)).toBe(200)

    const second = await reverseAdjustment(app, fx, adjustmentId, {
      expectedUpdatedAt: first.body.data.adjustment.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Test reversal again',
      idempotencyKey: `rev3-${adjustmentId}`,
    })
    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
  })

  it('rejects reversing a DRAFT (never-posted) adjustment', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '5' }],
    })
    const res = await reverseAdjustment(app, fx, draft.id, {
      expectedUpdatedAt: draft.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Should fail',
      idempotencyKey: `rev-fail-${draft.id}`,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
  })

  it('rejects reversal with a stale expectedUpdatedAt', async () => {
    const posted = await createAndPostAdjustment(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '12' }],
    })
    const adjustmentId = (posted.adjustment as Record<string, unknown>).id as string
    const res = await reverseAdjustment(app, fx, adjustmentId, {
      expectedUpdatedAt: new Date(Date.now() - 999999).toISOString(),
      reversalDate: fx.postingDate,
      reason: 'Stale check',
      idempotencyKey: `rev-stale-${adjustmentId}`,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(409)
  })
})
