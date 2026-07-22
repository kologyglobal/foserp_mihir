/**
 * Phase 5A3 — Finalize / reopen lifecycle: finalize is blocked while lines remain unmatched,
 * succeeds (and is idempotent) once fully matched, and reopen is blocked unless the session is
 * currently FINALIZED. Live MySQL.
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

describe.skipIf(!dbAvailable)('Phase 5A3 — Finalize / reopen', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string
  let bankGlAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'br-final')
    fx = await bootstrapApAllocFixture(app, ctx)
    const bank = await createBankTreasury(app, fx)
    treasuryAccountId = bank.id
    bankGlAccountId = bank.glAccountId
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('blocks finalize while a line is unmatched, then finalizes once fully matched, then reopens', async () => {
    await postJournal(app, fx, [
      { accountId: bankGlAccountId, debitAmount: '5000' },
      { accountId: fx.purchaseAccountId, creditAmount: '5000' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 5000 },
    ])
    const lineId = statement.lines[0].id

    // Ensure a session exists.
    await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation`)
      .set('Authorization', `Bearer ${fx.token}`)

    const blocked = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/finalize`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ idempotencyKey: `finalize-${statement.statementId}` })
    expect(blocked.status, JSON.stringify(blocked.body)).toBe(422)

    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    const candidate = candidatesRes.body.data.direct[0]
    const matchRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: lineId, amount: '5000' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '5000' }],
        idempotencyKey: `finalize-flow-match-${Date.now()}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)

    const finalize = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/finalize`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ idempotencyKey: `finalize-${statement.statementId}-2` })
    expect(finalize.status, JSON.stringify(finalize.body)).toBe(200)
    expect(finalize.body.data.status).toBe('FINALIZED')

    const statementRow = await prisma.bankStatement.findFirstOrThrow({ where: { id: statement.statementId, tenantId: fx.tenantId } })
    expect(statementRow.status).toBe('RECONCILED')

    // Idempotent replay against an already-finalized session — no error, same status.
    const finalizeAgain = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/finalize`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ idempotencyKey: `finalize-${statement.statementId}-3` })
    expect(finalizeAgain.status).toBe(200)
    expect(finalizeAgain.body.data.status).toBe('FINALIZED')

    const reopen = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/reopen`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Need to fix a mismatch' })
    expect(reopen.status, JSON.stringify(reopen.body)).toBe(200)
    expect(reopen.body.data.status).toBe('REOPENED')

    const statementRowAfterReopen = await prisma.bankStatement.findFirstOrThrow({ where: { id: statement.statementId, tenantId: fx.tenantId } })
    expect(statementRowAfterReopen.status).toBe('READY_TO_RECONCILE')

    // Reopen is blocked unless the session is currently FINALIZED.
    const reopenAgain = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/reopen`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ reason: 'Try again' })
    expect(reopenAgain.status).toBe(422)
  })
})
