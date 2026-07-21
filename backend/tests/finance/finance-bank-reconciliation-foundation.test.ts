/**
 * Phase 5A3 — Bank reconciliation foundation: session get-or-create via the workspace endpoint,
 * summary counts, and view-permission gating. Live MySQL.
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
import { createBankTreasury, createValidatedStatement } from './helpers/bank-reconciliation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Phase 5A3 — Bank reconciliation foundation', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string
  let noPermToken: string
  let viewOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'br-fnd')
    fx = await bootstrapApAllocFixture(app, ctx)
    const bank = await createBankTreasury(app, fx)
    treasuryAccountId = bank.id
    const noPerm = await createUserWithPerms(app, fx.tenantId, fx.slug, [], 'br-fnd-noperm')
    noPermToken = noPerm.token
    const viewer = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.bank.reconciliation.view'], 'br-fnd-viewer')
    viewOnlyToken = viewer.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('creates a session on first workspace visit and reuses it thereafter', async () => {
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 4000, referenceNumber: 'REF-1' },
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 1500, referenceNumber: 'REF-2' },
    ])

    const first = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.data.session.status).toBe('OPEN')
    expect(first.body.data.session.bankStatementId).toBe(statement.statementId)
    expect(first.body.data.lines.length).toBe(2)
    expect(first.body.data.allowedActions.match).toBe(true)
    const sessionId = first.body.data.session.id as string

    const second = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(second.status).toBe(200)
    expect(second.body.data.session.id).toBe(sessionId)

    const sessionRow = await prisma.bankReconciliationSession.findFirstOrThrow({ where: { tenantId: fx.tenantId, bankStatementId: statement.statementId } })
    expect(sessionRow.id).toBe(sessionId)
  })

  it('returns summary counts matching the statement lines', async () => {
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 2000 },
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 3000 },
    ])
    await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation`)
      .set('Authorization', `Bearer ${fx.token}`)

    const summary = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/summary`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(summary.status, JSON.stringify(summary.body)).toBe(200)
    expect(summary.body.data.lineCount).toBe(2)
    expect(summary.body.data.unmatchedLineCount).toBe(2)
    expect(summary.body.data.matchedLineCount).toBe(0)
    expect(summary.body.data.status).toBe('OPEN')
  })

  it('rejects a user with no bank reconciliation permission', async () => {
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 1000 },
    ])
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation`)
      .set('Authorization', `Bearer ${noPermToken}`)
    expect(res.status).toBe(403)
  })

  it('allows a view-only user to read the workspace but not run auto-match', async () => {
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 1000 },
    ])
    const view = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
    expect(view.status).toBe(200)
    expect(view.body.data.allowedActions.match).toBe(false)
    expect(view.body.data.allowedActions.runAutoMatch).toBe(false)

    const autoMatch = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/reconciliation/run-auto-match`)
      .set('Authorization', `Bearer ${viewOnlyToken}`)
      .send({})
    expect(autoMatch.status).toBe(403)
  })
})
