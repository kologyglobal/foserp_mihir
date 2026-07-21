/**
 * Phase 5A3 — Auto-match: unique EXACT-amount DIRECT candidates auto-match; ambiguous
 * (multiple equally-exact) candidates are left for manual review. Never auto-posts (DIRECT
 * matches never create a voucher). Live MySQL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import { createBankTreasury, createValidatedStatement, postJournal } from './helpers/bank-reconciliation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Phase 5A3 — Auto-matching', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string
  let bankGlAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'br-auto')
    fx = await bootstrapApAllocFixture(app, ctx)
    const bank = await createBankTreasury(app, fx)
    treasuryAccountId = bank.id
    bankGlAccountId = bank.glAccountId
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('auto-matches a unique exact DIRECT candidate (amount + date + reference all match)', async () => {
    const voucherBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    // A receipt posted directly on the bank GL (money already reflected in the books).
    const journal = await postJournal(app, fx, [
      { accountId: bankGlAccountId, debitAmount: '5000' },
      { accountId: fx.purchaseAccountId, creditAmount: '5000' },
    ])

    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 5000, referenceNumber: journal.voucherNumber },
    ])

    const run = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/run-auto-match`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({})
    expect(run.status, JSON.stringify(run.body)).toBe(200)
    expect(run.body.data.matchesCreated).toBe(1)
    expect(run.body.data.matches[0].matchSource).toBe('DIRECT_BANK_GL')
    expect(run.body.data.matches[0].matchMethod).toBe('AUTO_EXACT')
    expect(run.body.data.matches[0].postingMode).toBe('NONE')
    expect(run.body.data.matches[0].accountingVoucherId).toBeNull()

    // DIRECT matches never post — voucher count unchanged (only the seed journal above).
    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherBefore + 1)

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { tenantId: fx.tenantId, bankStatementId: statement.statementId } })
    expect(line.matchStatus).toBe('MATCHED')
    expect(line.matchedAmount.toFixed(4)).toBe('5000.0000')
  })

  it('leaves ambiguous (multiple equally-exact) candidates unmatched for manual review', async () => {
    // Lower autoReconcileScore so two same-amount/same-day candidates (no reference match, score 75)
    // both clear the "exact" bar and tie — exercising the ambiguity/requireUniqueExactMatch gate.
    const ambigBank = await createBankTreasury(app, fx, { autoReconcileScore: 70 })

    await postJournal(app, fx, [
      { accountId: ambigBank.glAccountId, debitAmount: '3000' },
      { accountId: fx.purchaseAccountId, creditAmount: '3000' },
    ])
    await postJournal(app, fx, [
      { accountId: ambigBank.glAccountId, debitAmount: '3000' },
      { accountId: fx.purchaseAccountId, creditAmount: '3000' },
    ])

    const statement = await createValidatedStatement(app, fx, ambigBank.id, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 3000, referenceNumber: `AMBIG-${Date.now()}` },
    ])

    const run = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/run-auto-match`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({})
    expect(run.status, JSON.stringify(run.body)).toBe(200)
    expect(run.body.data.matchesCreated).toBe(0)
    expect(run.body.data.ambiguousLines).toBe(1)

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { tenantId: fx.tenantId, bankStatementId: statement.statementId } })
    expect(line.matchStatus).toBe('UNMATCHED')
  })

  it('never auto-matches CLEARING candidates even when exact', async () => {
    const { createClearingSetup } = await import('./helpers/bank-reconciliation-fixture.js')
    const clearing = await createClearingSetup(app, fx, treasuryAccountId)
    const journal = await postJournal(app, fx, [
      { accountId: clearing.clearingGlAccountId, debitAmount: '7000' },
      { accountId: fx.purchaseAccountId, creditAmount: '7000' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 7000, referenceNumber: journal.voucherNumber },
    ])

    const run = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/run-auto-match`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({})
    expect(run.status, JSON.stringify(run.body)).toBe(200)
    expect(run.body.data.matchesCreated).toBe(0)

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { tenantId: fx.tenantId, bankStatementId: statement.statementId } })
    expect(line.matchStatus).toBe('UNMATCHED')
  })
})
