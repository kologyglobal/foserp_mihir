/**
 * Phase 5A3 — Manual matching: 1:1 DIRECT bank-GL match (never posts) and a manual partial
 * match that leaves a statement line PARTIALLY_MATCHED. Live MySQL.
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
import { createBankTreasury, createValidatedStatement, ensureReconciliationSession, postJournal } from './helpers/bank-reconciliation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Phase 5A3 — Manual reconciliation', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string
  let bankGlAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'br-manual')
    fx = await bootstrapApAllocFixture(app, ctx)
    const bank = await createBankTreasury(app, fx)
    treasuryAccountId = bank.id
    bankGlAccountId = bank.glAccountId
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('creates a 1:1 DIRECT match with no voucher/posting', async () => {
    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    await postJournal(app, fx, [
      { accountId: bankGlAccountId, debitAmount: '6000' },
      { accountId: fx.purchaseAccountId, creditAmount: '6000' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 6000 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id

    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(candidatesRes.status, JSON.stringify(candidatesRes.body)).toBe(200)
    expect(candidatesRes.body.data.direct.length).toBeGreaterThanOrEqual(1)
    const candidate = candidatesRes.body.data.direct[0]

    const matchRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: lineId, amount: '6000' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '6000' }],
        idempotencyKey: `manual-direct-${Date.now()}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)
    expect(matchRes.body.data.matchSource).toBe('DIRECT_BANK_GL')
    expect(matchRes.body.data.matchStatus).toBe('ACTIVE')
    expect(matchRes.body.data.postingMode).toBe('NONE')
    expect(matchRes.body.data.accountingVoucherId).toBeNull()
    expect(matchRes.body.data.matchedAmount).toBe('6000.0000')

    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore + 1)

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { id: lineId, tenantId: fx.tenantId } })
    expect(line.matchStatus).toBe('MATCHED')
    expect(line.matchedAmount.toFixed(4)).toBe('6000.0000')

    const getRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches/${matchRes.body.data.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.data.allowedActions.unmatch).toBe(true)
  })

  it('supports a manual partial match, leaving the line PARTIALLY_MATCHED', async () => {
    await postJournal(app, fx, [
      { accountId: bankGlAccountId, debitAmount: '4000' },
      { accountId: fx.purchaseAccountId, creditAmount: '4000' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 10000 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id

    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    const candidate = candidatesRes.body.data.direct.find((c: { unreconciledAmount: string }) => c.unreconciledAmount === '4000.0000')
    expect(candidate).toBeTruthy()

    const matchRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: lineId, amount: '4000' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '4000' }],
        idempotencyKey: `manual-partial-${Date.now()}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)
    expect(matchRes.body.data.matchedAmount).toBe('4000.0000')

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { id: lineId, tenantId: fx.tenantId } })
    expect(line.matchStatus).toBe('PARTIALLY_MATCHED')
    expect(line.matchedAmount.toFixed(4)).toBe('4000.0000')
  })

  it('rejects a match where statement total does not equal ledger total', async () => {
    await postJournal(app, fx, [
      { accountId: bankGlAccountId, debitAmount: '2000' },
      { accountId: fx.purchaseAccountId, creditAmount: '2000' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 2000 },
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
        statementAllocations: [{ bankStatementLineId: lineId, amount: '2000' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '1500' }],
        idempotencyKey: `manual-mismatch-${Date.now()}`,
      })
    expect(matchRes.status).toBe(400)
  })
})
