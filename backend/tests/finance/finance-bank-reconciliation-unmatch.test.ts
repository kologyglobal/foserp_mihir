/**
 * Phase 5A3 — Unmatch: DIRECT matches reverse subledger allocations only (no voucher ever
 * existed); CLEARING matches additionally post an exact reversal voucher. Idempotent replay
 * against an already-reversed match is a no-op. Live MySQL.
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
import {
  createBankTreasury,
  createClearingSetup,
  createValidatedStatement,
  ensureReconciliationSession,
  postJournal,
} from './helpers/bank-reconciliation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

async function createDirectMatch(app: import('express').Express, fx: ApAllocFixture, treasuryAccountId: string, bankGlAccountId: string, amount: string) {
  await postJournal(app, fx, [
    { accountId: bankGlAccountId, debitAmount: amount },
    { accountId: fx.purchaseAccountId, creditAmount: amount },
  ])
  const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
    { transactionDate: fx.documentDate, direction: 'CREDIT', amount: Number(amount) },
  ])
  await ensureReconciliationSession(app, fx, statement.statementId)
  const lineId = statement.lines[0].id
  const candidatesRes = await request(app)
    .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
    .set('Authorization', `Bearer ${fx.token}`)
  const candidate = candidatesRes.body.data.direct[0]
  const matchRes = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      statementId: statement.statementId,
      statementAllocations: [{ bankStatementLineId: lineId, amount }],
      ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount }],
      idempotencyKey: `direct-for-unmatch-${Date.now()}-${Math.random()}`,
    })
  expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)
  return { matchId: matchRes.body.data.id as string, statementId: statement.statementId, lineId }
}

describe.skipIf(!dbAvailable)('Phase 5A3 — Unmatch', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string
  let bankGlAccountId: string
  let clearingGlAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'br-unmatch')
    fx = await bootstrapApAllocFixture(app, ctx)
    const bank = await createBankTreasury(app, fx)
    treasuryAccountId = bank.id
    bankGlAccountId = bank.glAccountId
    const clearing = await createClearingSetup(app, fx, treasuryAccountId)
    clearingGlAccountId = clearing.clearingGlAccountId
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('unmatches a DIRECT match by reversing allocations only (no voucher posted)', async () => {
    const { matchId, lineId } = await createDirectMatch(app, fx, treasuryAccountId, bankGlAccountId, '4400')
    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches/${matchId}/unmatch`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Data entry error', idempotencyKey: `unmatch-${matchId}` })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.matchStatus).toBe('REVERSED')
    expect(res.body.data.reversalVoucherId).toBeNull()

    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore)

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { id: lineId, tenantId: fx.tenantId } })
    expect(line.matchStatus).toBe('UNMATCHED')
    expect(line.matchedAmount.toFixed(4)).toBe('0.0000')

    // Idempotent replay of an already-reversed match is a no-op, not an error.
    const replay = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches/${matchId}/unmatch`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Data entry error', idempotencyKey: `unmatch-${matchId}` })
    expect(replay.status).toBe(200)
    expect(replay.body.data.matchStatus).toBe('REVERSED')
  })

  it('unmatches a CLEARING match by posting an exact reversal voucher', async () => {
    await postJournal(app, fx, [
      { accountId: clearingGlAccountId, debitAmount: '2200' },
      { accountId: fx.purchaseAccountId, creditAmount: '2200' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 2200 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id
    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    const candidate = candidatesRes.body.data.clearing[0]
    const matchRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: lineId, amount: '2200' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '2200' }],
        idempotencyKey: `clearing-for-unmatch-${Date.now()}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)
    const matchId = matchRes.body.data.id as string
    const settlementVoucherId = matchRes.body.data.accountingVoucherId as string

    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches/${matchId}/unmatch`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Wrong clearing entry', idempotencyKey: `unmatch-clearing-${matchId}` })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.matchStatus).toBe('REVERSED')
    expect(res.body.data.reversalVoucherId).toBeTruthy()
    expect(res.body.data.reversalVoucherId).not.toBe(settlementVoucherId)

    // A new reversal voucher was posted.
    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore + 1)

    const reversalLines = await prisma.accountingVoucherLine.findMany({
      where: { voucherId: res.body.data.reversalVoucherId, tenantId: fx.tenantId },
      orderBy: { lineNumber: 'asc' },
    })
    const settlementLines = await prisma.accountingVoucherLine.findMany({
      where: { voucherId: settlementVoucherId, tenantId: fx.tenantId },
      orderBy: { lineNumber: 'asc' },
    })
    // Exact reversal: debit/credit sides flipped per line.
    for (let i = 0; i < settlementLines.length; i += 1) {
      expect(reversalLines[i].debitAmount.toString()).toBe(settlementLines[i].creditAmount.toString())
      expect(reversalLines[i].creditAmount.toString()).toBe(settlementLines[i].debitAmount.toString())
      expect(reversalLines[i].accountId).toBe(settlementLines[i].accountId)
    }

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { id: lineId, tenantId: fx.tenantId } })
    expect(line.matchStatus).toBe('UNMATCHED')
  })
})
