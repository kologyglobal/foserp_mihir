/**
 * Finance Phase 5B3 — Treasury adjustment posting: bank charge with GST posts a balanced voucher
 * via the central posting engine, updates GL balances correctly, reserves a TADJ/ number, and is
 * idempotent on repeat calls. Live MySQL.
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
  createGlTaxAccount,
  createReadyAdjustmentDraft,
  getGlBalance,
  markReadyAdjustment,
  postAdjustment,
} from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Treasury adjustment posting', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let expenseGl: { id: string }
  let taxGl: { id: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-post')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'POSTBANK' })
    expenseGl = await createGlExpenseAccount(fx, 'POSTEXP')
    taxGl = await createGlTaxAccount(fx, 'POSTGST')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('posts a bank charge with GST: Dr expense, Dr GST recoverable, Cr bank — balanced voucher', async () => {
    const result = await createAndPostAdjustment(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [
        {
          lineType: 'EXPENSE',
          accountId: expenseGl.id,
          amount: '1000',
          gstTreatment: 'GST_APPLICABLE',
          gstRate: '18',
          gstAccountId: taxGl.id,
        },
      ],
    })
    const adjustment = result.adjustment as Record<string, unknown>
    expect(adjustment.status).toBe('POSTED')
    expect(adjustment.adjustmentNumber).toMatch(/^TADJ\//)
    expect(adjustment.voucherId).toBeTruthy()
    expect(result.idempotentReplay).toBe(false)
    expect((result.posting as Record<string, unknown>).voucherNumber).toBeTruthy()

    expect(await getGlBalance(fx.tenantId, expenseGl.id)).toBe('1000.0000')
    expect(await getGlBalance(fx.tenantId, taxGl.id)).toBe('180.0000')
    expect(await getGlBalance(fx.tenantId, bank1.glAccountId)).toBe('-1180.0000')

    const voucher = await prisma.accountingVoucher.findFirst({ where: { id: adjustment.voucherId as string, tenantId: fx.tenantId } })
    expect(voucher?.status).toBe('POSTED')
    const lines = await prisma.generalLedgerEntry.findMany({ where: { voucherId: adjustment.voucherId as string, tenantId: fx.tenantId } })
    expect(lines).toHaveLength(3)
    const totalDebit = lines.reduce((acc, l) => acc + Number(l.debitAmount), 0)
    const totalCredit = lines.reduce((acc, l) => acc + Number(l.creditAmount), 0)
    expect(totalDebit).toBeCloseTo(totalCredit, 4)
  })

  it('posts a bank interest income adjustment: Dr bank, Cr income', async () => {
    const incomeGl = await createGlExpenseAccount(fx, 'POSTINC')
    const result = await createAndPostAdjustment(app, fx, bank1, {
      adjustmentType: 'BANK_INTEREST_INCOME',
      lines: [{ lineType: 'INCOME', accountId: incomeGl.id, amount: '500' }],
    })
    expect((result.adjustment as Record<string, unknown>).status).toBe('POSTED')
    expect(await getGlBalance(fx.tenantId, incomeGl.id)).toBe('-500.0000')
  })

  it('replays idempotently when posting an already-POSTED adjustment again', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '30' }],
    })
    const ready = await markReadyAdjustment(app, fx, draft.id, draft.updatedAt)
    expect(ready.status).toBe(200)
    const firstPost = await postAdjustment(app, fx, draft.id, ready.body.data.updatedAt, fx.postingDate)
    expect(firstPost.status, JSON.stringify(firstPost.body)).toBe(200)
    expect(firstPost.body.data.idempotentReplay).toBe(false)

    const secondPost = await postAdjustment(app, fx, draft.id, firstPost.body.data.adjustment.updatedAt, fx.postingDate)
    expect(secondPost.status, JSON.stringify(secondPost.body)).toBe(200)
    expect(secondPost.body.data.idempotentReplay).toBe(true)
    expect(secondPost.body.data.adjustment.voucherId).toBe(firstPost.body.data.adjustment.voucherId)
  })

  it('rejects posting a DRAFT adjustment (must be READY_TO_POST)', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '10' }],
    })
    const res = await postAdjustment(app, fx, draft.id, draft.updatedAt, fx.postingDate)
    expect(res.status, JSON.stringify(res.body)).toBe(422)
  })
})
