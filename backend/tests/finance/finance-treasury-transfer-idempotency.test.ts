/**
 * Finance Phase 5B1 — Idempotency: repeating post/dispatch/receive/reverse on an
 * already-completed step returns `idempotentReplay: true` without creating duplicate
 * vouchers or ledger entries. Live MySQL.
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
  createReadyTransferDraft,
  createTreasuryAccount,
  dispatchTransfer,
  markReadyTransfer,
  postDirectTransfer,
  receiveTransfer,
  reverseTransfer,
  setFinanceSettings,
  setInternalTransferClearingMapping,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — Idempotency', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let bank2: TreasuryTransferAccount

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ttr-idm')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'IDMB1' })
    bank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'IDMB2' })

    const clearingGl = await prisma.account.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        accountCode: `IDMCLR${Date.now()}`.slice(-12),
        accountName: 'Idempotency Test Clearing',
        category: 'LIABILITY',
        accountType: 'GENERAL',
        isGroup: false,
        level: 1,
      },
    })
    await setInternalTransferClearingMapping(app, fx, clearingGl.id)
    // This suite exercises replay/idempotency mechanics with a single test user — maker-checker
    // dispatcher/receiver separation is covered separately in the workflow/permissions suites.
    await setFinanceSettings(app, fx, { treasuryTransferPreventDispatcherReceive: false })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('replays a repeated /post call without posting a second voucher', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '1200', postingModeOverride: 'DIRECT' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    const first = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.data.idempotentReplay).toBe(false)

    const second = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
    expect(second.body.data.posting.voucherId).toBe(first.body.data.posting.voucherId)

    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore + 1)
  })

  it('replays repeated /dispatch and /receive calls without duplicating postings', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '1300' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    const firstDispatch = await dispatchTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(firstDispatch.status, JSON.stringify(firstDispatch.body)).toBe(200)
    expect(firstDispatch.body.data.idempotentReplay).toBe(false)

    const secondDispatch = await dispatchTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(secondDispatch.status, JSON.stringify(secondDispatch.body)).toBe(200)
    expect(secondDispatch.body.data.idempotentReplay).toBe(true)
    expect(secondDispatch.body.data.posting.voucherId).toBe(firstDispatch.body.data.posting.voucherId)

    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore + 1)

    const firstReceive = await receiveTransfer(app, fx, draft.id, firstDispatch.body.data.transfer.updatedAt)
    expect(firstReceive.status, JSON.stringify(firstReceive.body)).toBe(200)
    expect(firstReceive.body.data.idempotentReplay).toBe(false)

    const secondReceive = await receiveTransfer(app, fx, draft.id, firstDispatch.body.data.transfer.updatedAt)
    expect(secondReceive.status, JSON.stringify(secondReceive.body)).toBe(200)
    expect(secondReceive.body.data.idempotentReplay).toBe(true)
    expect(secondReceive.body.data.posting.voucherId).toBe(firstReceive.body.data.posting.voucherId)

    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore + 2)
  })

  it('replays a repeated /reverse call with the same idempotencyKey without posting a second reversal', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '900', postingModeOverride: 'DIRECT' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    const body = {
      expectedUpdatedAt: posted.body.data.transfer.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Idempotency check',
      idempotencyKey: `idm-rev-${draft.id}`,
    }
    const first = await reverseTransfer(app, fx, draft.id, body)
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.data.idempotentReplay).toBe(false)

    const second = await reverseTransfer(app, fx, draft.id, body)
    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)

    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore + 1)
  })
})
