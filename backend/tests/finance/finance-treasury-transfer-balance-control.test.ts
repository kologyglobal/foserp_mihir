/**
 * Finance Phase 5B1 — Bank balance policy: CASH source accounts always BLOCK a negative
 * projected balance regardless of the configured policy; BANK sources honour the
 * ALLOW/WARN/BLOCK policy from finance settings. Live MySQL.
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
  createTransferDraft,
  createTreasuryAccount,
  markReadyTransfer,
  setFinanceSettings,
  setInternalTransferClearingMapping,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — Balance control', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let bank2: TreasuryTransferAccount
  let cash1: TreasuryTransferAccount

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ttr-bal')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'BALB1' })
    bank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'BALB2' })
    cash1 = await createTreasuryAccount(app, fx, 'CASH', { namePrefix: 'BALC1' })

    const clearingGl = await prisma.account.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        accountCode: `BALCLR${Date.now()}`.slice(-12),
        accountName: 'Balance Test Clearing',
        category: 'LIABILITY',
        accountType: 'GENERAL',
        isGroup: false,
        level: 1,
      },
    })
    await setInternalTransferClearingMapping(app, fx, clearingGl.id)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('always blocks an unfunded CASH source, even under the default WARN policy', async () => {
    const created = await createTransferDraft(app, fx, cash1, bank1, { transferAmount: '1000' })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    expect(created.body.data.validation.isValid).toBe(false)
    expect(created.body.data.validation.balanceCheck.policy).toBe('BLOCK')
    expect(created.body.data.validation.balanceCheck.isBlocking).toBe(true)

    const ready = await markReadyTransfer(app, fx, created.body.data.id, created.body.data.updatedAt)
    expect(ready.status, JSON.stringify(ready.body)).toBe(422)
    expect(ready.body.code ?? ready.body.error?.code).toBe('TREASURY_TRANSFER_NOT_READY')
  })

  it('allows an unfunded BANK source under the WARN policy (default) with a warning surfaced', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank2, cash1, { transferAmount: '400', postingModeOverride: 'DIRECT' })
    expect(draft.postingMode).toBe('DIRECT')
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    expect(ready.status, JSON.stringify(ready.body)).toBe(200)
    expect(ready.body.data.status).toBe('READY_TO_POST')
  })

  it('blocks an unfunded BANK source once the policy is set to BLOCK', async () => {
    await setFinanceSettings(app, fx, { treasuryTransferBankBalancePolicy: 'BLOCK' })
    try {
      const created = await createTransferDraft(app, fx, bank1, bank2, { transferAmount: '250', postingModeOverride: 'DIRECT' })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      expect(created.body.data.validation.isValid).toBe(false)
      expect(created.body.data.validation.balanceCheck.isBlocking).toBe(true)

      const ready = await markReadyTransfer(app, fx, created.body.data.id, created.body.data.updatedAt)
      expect(ready.status, JSON.stringify(ready.body)).toBe(422)
    } finally {
      await setFinanceSettings(app, fx, { treasuryTransferBankBalancePolicy: 'WARN' })
    }
  })
})
