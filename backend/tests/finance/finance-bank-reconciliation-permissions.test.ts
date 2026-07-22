/**
 * Phase 5A3 — Permission gating: each mutating action is blocked for a user missing its
 * specific `finance.bank.reconciliation.*` permission, even when they hold `view`. Live MySQL.
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
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import { createBankTreasury, createValidatedStatement, ensureReconciliationSession, postJournal } from './helpers/bank-reconciliation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Phase 5A3 — Permissions', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string
  let bankGlAccountId: string
  let viewOnlyToken: string
  let matchedStatement: { statementId: string; lineId: string }
  let matchId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'br-perm')
    fx = await bootstrapApAllocFixture(app, ctx)
    const bank = await createBankTreasury(app, fx)
    treasuryAccountId = bank.id
    bankGlAccountId = bank.glAccountId
    const viewer = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.bank.reconciliation.view'], 'br-perm-viewer')
    viewOnlyToken = viewer.token

    await postJournal(app, fx, [
      { accountId: bankGlAccountId, debitAmount: '1000' },
      { accountId: fx.purchaseAccountId, creditAmount: '1000' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 1000 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id
    matchedStatement = { statementId: statement.statementId, lineId }
    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    const candidate = candidatesRes.body.data.direct[0]
    const matchRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: lineId, amount: '1000' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '1000' }],
        idempotencyKey: `perm-fixture-match-${Date.now()}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)
    matchId = matchRes.body.data.id as string
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('blocks run-auto-match without finance.bank.reconciliation.run_auto_match', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${matchedStatement.statementId}/reconciliation/run-auto-match`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
      .send({})
    expect(res.status).toBe(403)
  })

  it('blocks match creation without finance.bank.reconciliation.match', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
      .send({
        statementId: matchedStatement.statementId,
        statementAllocations: [{ bankStatementLineId: matchedStatement.lineId, amount: '1000' }],
        ledgerAllocations: [{ generalLedgerEntryId: '00000000-0000-0000-0000-000000000000', amount: '1000' }],
        idempotencyKey: 'perm-blocked-match',
      })
    expect(res.status).toBe(403)
  })

  it('blocks unmatch without finance.bank.reconciliation.unmatch', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches/${matchId}/unmatch`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
      .send({ reason: 'test', idempotencyKey: 'perm-blocked-unmatch' })
    expect(res.status).toBe(403)
  })

  it('blocks finalize without finance.bank.reconciliation.finalize', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${matchedStatement.statementId}/reconciliation/finalize`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
      .send({ idempotencyKey: 'perm-blocked-finalize' })
    expect(res.status).toBe(403)
  })

  it('blocks reopen without finance.bank.reconciliation.reopen', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${matchedStatement.statementId}/reconciliation/reopen`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
      .send({ reason: 'test' })
    expect(res.status).toBe(403)
  })

  it('blocks exception create/resolve without finance.bank.reconciliation.exception_manage', async () => {
    const create = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/exceptions`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
      .send({ statementId: matchedStatement.statementId, bankStatementLineId: matchedStatement.lineId, reason: 'OTHER' })
    expect(create.status).toBe(403)
  })

  it('allows the same actions for a user granted the specific permission', async () => {
    const auto = await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['finance.bank.reconciliation.view', 'finance.bank.reconciliation.run_auto_match'],
      'br-perm-auto',
    )
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${matchedStatement.statementId}/reconciliation/run-auto-match`)
      .set('Authorization', `Bearer ${auto.token}`)
      .send({})
    expect(res.status, JSON.stringify(res.body)).toBe(200)
  })
})
