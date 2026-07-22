/**
 * Finance Phase 5B2 — Cheque posting: issue (ISSUED), deposit (RECEIVED), TRACK_ONLY lifecycle,
 * bounce reversal, permission checks, and tenant isolation. Live MySQL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import {
  bounceCheque,
  createAndDepositCheque,
  createAndIssueCheque,
  createAndSetChequeClearingAccount,
  createChequeBankAccount,
  createReadyChequeDraft,
  getGlBalance,
  issueCheque,
  markReadyCheque,
  reverseCheque,
  stopCheque,
} from './helpers/treasury-cheque-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B2 — Cheque posting', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let payClearingGlId: string
  let receiptClearingGlId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'chq-post')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createChequeBankAccount(app, fx, { namePrefix: 'PSTBANK' })
    payClearingGlId = await createAndSetChequeClearingAccount(app, fx, 'CHEQUE_PAYMENT_CLEARING', 'PSTPAYCLR')
    receiptClearingGlId = await createAndSetChequeClearingAccount(app, fx, 'CHEQUE_RECEIPT_CLEARING', 'PSTRCVCLR')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('issues an ISSUED-direction cheque and posts Dr counterpart / Cr bank', async () => {
    const before = await Promise.all([getGlBalance(fx.tenantId, bank1.glAccountId), getGlBalance(fx.tenantId, payClearingGlId)])

    const result = await createAndIssueCheque(app, fx, bank1, { amount: '2500' })
    const cheque = result.cheque as Record<string, unknown>
    expect(cheque.status).toBe('ISSUED')
    expect(cheque.chequeRegisterNumber).toMatch(/^CHQ\//)
    expect(cheque.voucherId).toBeTruthy()
    expect(result.posting).not.toBeNull()

    const after = await Promise.all([getGlBalance(fx.tenantId, bank1.glAccountId), getGlBalance(fx.tenantId, payClearingGlId)])
    expect(Number(after[0]) - Number(before[0])).toBeCloseTo(-2500, 4)
    expect(Number(after[1]) - Number(before[1])).toBeCloseTo(2500, 4)
  })

  it('is idempotent when issuing the same cheque twice', async () => {
    const draft = await createReadyChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '900' })
    const ready = await markReadyCheque(app, fx, draft.id, draft.updatedAt)
    expect(ready.status).toBe(200)

    const first = await issueCheque(app, fx, draft.id, ready.body.data.updatedAt as string)
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.data.idempotentReplay).toBe(false)

    const second = await issueCheque(app, fx, draft.id, ready.body.data.updatedAt as string)
    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.cheque.chequeRegisterNumber).toBe(first.body.data.cheque.chequeRegisterNumber)
  })

  it('deposits a RECEIVED-direction cheque and posts Dr bank / Cr counterpart', async () => {
    const before = await Promise.all([getGlBalance(fx.tenantId, bank1.glAccountId), getGlBalance(fx.tenantId, receiptClearingGlId)])

    const result = await createAndDepositCheque(app, fx, bank1, { amount: '1800' })
    const cheque = result.cheque as Record<string, unknown>
    expect(cheque.status).toBe('DEPOSITED')
    expect(cheque.chequeRegisterNumber).toMatch(/^CHQ\//)

    const after = await Promise.all([getGlBalance(fx.tenantId, bank1.glAccountId), getGlBalance(fx.tenantId, receiptClearingGlId)])
    expect(Number(after[0]) - Number(before[0])).toBeCloseTo(1800, 4)
    expect(Number(after[1]) - Number(before[1])).toBeCloseTo(-1800, 4)
  })

  it('issues a TRACK_ONLY cheque (linked to a vendor payment) without posting any GL entries', async () => {
    const before = await getGlBalance(fx.tenantId, bank1.glAccountId)
    const draft = await createReadyChequeDraft(app, fx, bank1, {
      direction: 'ISSUED',
      amount: '600',
      vendorPaymentId: 'external-vp-001',
    })
    expect(draft.body.isTrackOnly).toBe(true)
    const ready = await markReadyCheque(app, fx, draft.id, draft.updatedAt)
    expect(ready.status).toBe(200)
    const issued = await issueCheque(app, fx, draft.id, ready.body.data.updatedAt as string)
    expect(issued.status, JSON.stringify(issued.body)).toBe(200)
    expect(issued.body.data.cheque.status).toBe('ISSUED')
    expect(issued.body.data.cheque.voucherId).toBeNull()
    expect(issued.body.data.posting).toBeNull()

    const after = await getGlBalance(fx.tenantId, bank1.glAccountId)
    expect(after).toBe(before)
  })

  it('bounces an issued cheque and reverses its posted voucher', async () => {
    const issueResult = await createAndIssueCheque(app, fx, bank1, { amount: '1100' })
    const chequeId = (issueResult.cheque as Record<string, unknown>).id as string
    const updatedAt = (issueResult.cheque as Record<string, unknown>).updatedAt as string

    const bank1BalanceBefore = await getGlBalance(fx.tenantId, bank1.glAccountId)
    const bounced = await bounceCheque(app, fx, chequeId, updatedAt, fx.postingDate, 'Insufficient funds')
    expect(bounced.status, JSON.stringify(bounced.body)).toBe(200)
    expect(bounced.body.data.status).toBe('BOUNCED')
    expect(bounced.body.data.reversalVoucherId).toBeTruthy()

    const bank1BalanceAfter = await getGlBalance(fx.tenantId, bank1.glAccountId)
    expect(Number(bank1BalanceAfter) - Number(bank1BalanceBefore)).toBeCloseTo(1100, 4)
  })

  it('stops payment on a not-yet-issued cheque without needing a voucher reversal', async () => {
    const draft = await createReadyChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '450' })
    const stopped = await stopCheque(app, fx, draft.id, draft.updatedAt, 'Customer requested stop')
    expect(stopped.status, JSON.stringify(stopped.body)).toBe(200)
    expect(stopped.body.data.status).toBe('STOPPED')
  })

  it('reverses a cleared cheque via the full reversal endpoint', async () => {
    const issueResult = await createAndIssueCheque(app, fx, bank1, { amount: '333' })
    const cheque = issueResult.cheque as Record<string, unknown>

    const reversed = await reverseCheque(app, fx, cheque.id as string, {
      expectedUpdatedAt: cheque.updatedAt as string,
      reversalDate: fx.postingDate,
      reason: 'Issued in error',
      idempotencyKey: `rev-${cheque.id}`,
    })
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(200)
    expect(reversed.body.data.cheque.status).toBe('REVERSED')

    const row = await prisma.treasuryCheque.findFirstOrThrow({ where: { id: cheque.id as string, tenantId: fx.tenantId } })
    expect(row.uniquenessKey).toBeNull()
  })

  it('returns 403 when a user without the issue permission tries to issue a cheque', async () => {
    const draft = await createReadyChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '250' })
    const ready = await markReadyCheque(app, fx, draft.id, draft.updatedAt)
    expect(ready.status).toBe(200)

    const limited = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.treasury.cheque.view'], 'chq-post-noissue')
    const attempt = await issueCheque(app, fx, draft.id, ready.body.data.updatedAt as string, undefined, limited.token)
    expect(attempt.status, JSON.stringify(attempt.body)).toBe(403)
  })

  it('enforces tenant isolation — a cheque from one tenant is not visible to another', async () => {
    const otherCtx = await createFinanceAdminTenant(app, 'chq-post-other')
    const otherFx = await bootstrapApAllocFixture(app, otherCtx)
    try {
      const draft = await createReadyChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '175' })
      const res = await issueCheque(app, otherFx, draft.id, draft.updatedAt, undefined, otherFx.token)
      expect([403, 404]).toContain(res.status)
    } finally {
      await cleanupTenant(otherFx.tenantId)
    }
  })
})
