/**
 * Phase 5A3 — Idempotency: replaying POST /matches with the same idempotencyKey + identical
 * payload returns the original match (no duplicate posting/allocation); reusing the key with a
 * different payload is rejected. Live MySQL.
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

describe.skipIf(!dbAvailable)('Phase 5A3 — Idempotency', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string
  let bankGlAccountId: string
  let clearingGlAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'br-idem')
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

  it('replays an identical DIRECT match create request without creating a duplicate', async () => {
    await postJournal(app, fx, [
      { accountId: bankGlAccountId, debitAmount: '1900' },
      { accountId: fx.purchaseAccountId, creditAmount: '1900' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 1900 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id
    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    const candidate = candidatesRes.body.data.direct[0]
    const idempotencyKey = `idem-direct-${Date.now()}`
    const body = {
      statementId: statement.statementId,
      statementAllocations: [{ bankStatementLineId: lineId, amount: '1900' }],
      ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '1900' }],
      idempotencyKey,
    }

    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(body)
    expect(first.status, JSON.stringify(first.body)).toBe(201)
    expect(first.body.data.idempotentReplay).toBeFalsy()

    const matchCountBefore = await prisma.bankReconciliationMatch.count({ where: { tenantId: fx.tenantId } })

    const replay = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(body)
    expect(replay.status, JSON.stringify(replay.body)).toBe(201)
    expect(replay.body.data.id).toBe(first.body.data.id)
    expect(replay.body.data.idempotentReplay).toBe(true)

    expect(await prisma.bankReconciliationMatch.count({ where: { tenantId: fx.tenantId } })).toBe(matchCountBefore)

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { id: lineId, tenantId: fx.tenantId } })
    expect(line.matchedAmount.toFixed(4)).toBe('1900.0000')
  })

  it('rejects reusing an idempotencyKey with a different payload', async () => {
    await postJournal(app, fx, [
      { accountId: bankGlAccountId, debitAmount: '1200' },
      { accountId: fx.purchaseAccountId, creditAmount: '1200' },
    ])
    await postJournal(app, fx, [
      { accountId: bankGlAccountId, debitAmount: '1200' },
      { accountId: fx.purchaseAccountId, creditAmount: '1200' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 1200, referenceNumber: `IDEM-A-${Date.now()}` },
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 1200, referenceNumber: `IDEM-B-${Date.now()}` },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const candidatesRes0 = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${statement.lines[0].id}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    const candidatesRes1 = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${statement.lines[1].id}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    const candidate0 = candidatesRes0.body.data.direct[0]
    const candidate1 = candidatesRes1.body.data.direct.find((c: { generalLedgerEntryId: string }) => c.generalLedgerEntryId !== candidate0.generalLedgerEntryId)
    expect(candidate1).toBeTruthy()

    const idempotencyKey = `idem-conflict-${Date.now()}`
    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: statement.lines[0].id, amount: '1200' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate0.generalLedgerEntryId, amount: '1200' }],
        idempotencyKey,
      })
    expect(first.status, JSON.stringify(first.body)).toBe(201)

    const conflicting = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: statement.lines[1].id, amount: '1200' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate1.generalLedgerEntryId, amount: '1200' }],
        idempotencyKey,
      })
    expect(conflicting.status).toBe(409)
  })

  it('replays a CLEARING match create without posting a duplicate settlement voucher', async () => {
    await postJournal(app, fx, [
      { accountId: clearingGlAccountId, debitAmount: '3300' },
      { accountId: fx.purchaseAccountId, creditAmount: '3300' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 3300 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id
    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    const candidate = candidatesRes.body.data.clearing[0]
    const idempotencyKey = `idem-clearing-${Date.now()}`
    const body = {
      statementId: statement.statementId,
      statementAllocations: [{ bankStatementLineId: lineId, amount: '3300' }],
      ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '3300' }],
      idempotencyKey,
    }

    const first = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(body)
    expect(first.status, JSON.stringify(first.body)).toBe(201)

    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    const replay = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(body)
    expect(replay.status, JSON.stringify(replay.body)).toBe(201)
    expect(replay.body.data.id).toBe(first.body.data.id)
    expect(replay.body.data.accountingVoucherId).toBe(first.body.data.accountingVoucherId)
    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore)
  })
})
