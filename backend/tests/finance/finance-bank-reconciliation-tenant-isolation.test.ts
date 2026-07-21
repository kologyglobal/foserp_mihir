/**
 * Phase 5A3 — Tenant isolation: tenant B's valid token/slug cannot read or act on tenant A's
 * bank reconciliation sessions, matches, or statement lines. Live MySQL.
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

describe.skipIf(!dbAvailable)('Phase 5A3 — Tenant isolation', () => {
  let fxA: ApAllocFixture
  let fxB: ApAllocFixture
  let treasuryAccountIdA: string
  let bankGlAccountIdA: string
  let statementId: string
  let lineId: string
  let matchId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctxA = await createFinanceAdminTenant(app, 'br-tenA')
    fxA = await bootstrapApAllocFixture(app, ctxA)
    const ctxB = await createFinanceAdminTenant(app, 'br-tenB')
    fxB = await bootstrapApAllocFixture(app, ctxB)

    const bankA = await createBankTreasury(app, fxA)
    treasuryAccountIdA = bankA.id
    bankGlAccountIdA = bankA.glAccountId

    await postJournal(app, fxA, [
      { accountId: bankGlAccountIdA, debitAmount: '1500' },
      { accountId: fxA.purchaseAccountId, creditAmount: '1500' },
    ])
    const statement = await createValidatedStatement(app, fxA, treasuryAccountIdA, [
      { transactionDate: fxA.documentDate, direction: 'CREDIT', amount: 1500 },
    ])
    statementId = statement.statementId
    lineId = statement.lines[0].id
    await ensureReconciliationSession(app, fxA, statementId)

    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fxA.slug}/accounting/treasury/bank-statements/${statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fxA.token}`)
    const candidate = candidatesRes.body.data.direct[0]
    const matchRes = await request(app)
      .post(`/api/v1/t/${fxA.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fxA.token}`)
      .send({
        statementId,
        statementAllocations: [{ bankStatementLineId: lineId, amount: '1500' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '1500' }],
        idempotencyKey: `tenant-iso-fixture-${Date.now()}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)
    matchId = matchRes.body.data.id as string
  }, 240_000)

  afterAll(async () => {
    if (fxA?.tenantId) await cleanupTenant(fxA.tenantId)
    if (fxB?.tenantId) await cleanupTenant(fxB.tenantId)
  })

  it('cannot read tenant A workspace/summary via tenant B credentials', async () => {
    const workspace = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/treasury/bank-statements/${statementId}/reconciliation`)
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(workspace.status).toBe(404)

    const summary = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/treasury/bank-statements/${statementId}/reconciliation/summary`)
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(summary.status).toBe(404)
  })

  it('cannot read tenant A match via tenant B credentials', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/treasury/bank-reconciliation/matches/${matchId}`)
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(res.status).toBe(404)
  })

  it('cannot unmatch tenant A match via tenant B credentials', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fxB.slug}/accounting/treasury/bank-reconciliation/matches/${matchId}/unmatch`)
      .set('Authorization', `Bearer ${fxB.token}`)
      .send({ reason: 'cross-tenant attempt', idempotencyKey: `tenant-iso-unmatch-${Date.now()}` })
    expect(res.status).toBe(404)

    const match = await prisma.bankReconciliationMatch.findFirstOrThrow({ where: { id: matchId, tenantId: fxA.tenantId } })
    expect(match.matchStatus).toBe('ACTIVE')
  })

  it('cannot list reconciliation candidates for tenant A statement line via tenant B', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/treasury/bank-statements/${statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(res.status).toBe(404)
  })

  it('cannot finalize tenant A session via tenant B credentials', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fxB.slug}/accounting/treasury/bank-statements/${statementId}/reconciliation/finalize`)
      .set('Authorization', `Bearer ${fxB.token}`)
      .send({ idempotencyKey: `tenant-iso-finalize-${Date.now()}` })
    expect(res.status).toBe(404)
  })
})
