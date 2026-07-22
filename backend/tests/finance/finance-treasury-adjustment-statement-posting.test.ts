/**
 * Finance Phase 5B3 — Statement-led treasury adjustment creation + atomic post-and-match: create
 * a draft from a bank statement line, mark it ready, post it (which atomically creates the bank
 * reconciliation match for the new bank leg), verify the line-uniqueness lock, and verify
 * reversal is blocked while the match is active. Live MySQL.
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
import { createValidatedStatement, ensureReconciliationSession } from './helpers/bank-reconciliation-fixture.js'
import {
  createAdjustmentBankAccount,
  createGlExpenseAccount,
  markReadyAdjustment,
  postAdjustment,
  reverseAdjustment,
} from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Statement-led treasury adjustment + atomic post-and-match', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let expenseGl: { id: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-stmt')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'STMTBANK' })
    expenseGl = await createGlExpenseAccount(fx, 'STMTEXP')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  async function createAdjustmentFromLine(statementId: string, lineId: string, amount: string, idempotencyKey: string) {
    return request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/lines/${lineId}/treasury-adjustment`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        adjustmentType: 'BANK_CHARGES',
        adjustmentDate: fx.documentDate,
        currencyCode: 'INR',
        exchangeRate: '1',
        idempotencyKey,
        lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount }],
      })
  }

  it('creates a draft from a statement DEBIT line, posts it, and atomically creates the reconciliation match', async () => {
    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 250, description: 'Bank charges' },
    ])
    await ensureReconciliationSession(app, fx, stmt.statementId)
    const lineId = stmt.lines[0].id

    const created = await createAdjustmentFromLine(stmt.statementId, lineId, '250', `tadj-stmt-${lineId}`)
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    expect(created.body.data.sourceMode).toBe('BANK_STATEMENT')
    expect(created.body.data.bankStatementLineId).toBe(lineId)
    expect(created.body.data.bankAmount).toBe('250.0000')

    const ready = await markReadyAdjustment(app, fx, created.body.data.id, created.body.data.updatedAt)
    expect(ready.status, JSON.stringify(ready.body)).toBe(200)

    const posted = await postAdjustment(app, fx, created.body.data.id, ready.body.data.updatedAt, fx.postingDate)
    expect(posted.status, JSON.stringify(posted.body)).toBe(200)
    expect(posted.body.data.adjustment.status).toBe('POSTED')
    expect(posted.body.data.match).toBeTruthy()
    expect(posted.body.data.adjustment.reconciliationMatchId).toBe(posted.body.data.match.id)
    expect(posted.body.data.adjustment.hasActiveReconciliationMatch).toBe(true)

    const match = await prisma.bankReconciliationMatch.findFirst({ where: { id: posted.body.data.match.id, tenantId: fx.tenantId } })
    expect(match?.matchStatus).toBe('ACTIVE')

    const statementLine = await prisma.bankStatementLine.findFirst({ where: { id: lineId, tenantId: fx.tenantId } })
    expect(statementLine?.matchStatus).toBe('MATCHED')
  })

  it('blocks statement-led create when useTreasuryAdjustmentsForStatementItems is false', async () => {
    await prisma.financeSettings.upsert({
      where: { legalEntityId: fx.legalEntityId },
      create: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        useTreasuryAdjustmentsForStatementItems: false,
      },
      update: { useTreasuryAdjustmentsForStatementItems: false },
    })

    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 40, description: 'Flag off test' },
    ])
    await ensureReconciliationSession(app, fx, stmt.statementId)
    const lineId = stmt.lines[0].id

    const res = await createAdjustmentFromLine(stmt.statementId, lineId, '40', `tadj-flag-off-${lineId}`)
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('TREASURY_ADJUSTMENT_STATEMENT_PATH_DISABLED')

    await prisma.financeSettings.update({
      where: { legalEntityId: fx.legalEntityId },
      data: { useTreasuryAdjustmentsForStatementItems: true },
    })
  })

  it('blocks a second treasury adjustment from being created against the same statement line', async () => {
    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 60, description: 'Bank charges dup test' },
    ])
    await ensureReconciliationSession(app, fx, stmt.statementId)
    const lineId = stmt.lines[0].id

    const first = await createAdjustmentFromLine(stmt.statementId, lineId, '60', `tadj-dup-1-${lineId}`)
    expect(first.status, JSON.stringify(first.body)).toBe(201)

    const second = await createAdjustmentFromLine(stmt.statementId, lineId, '60', `tadj-dup-2-${lineId}`)
    expect(second.status, JSON.stringify(second.body)).toBe(409)
  })

  it('blocks reversal of a statement-matched adjustment while its match is active', async () => {
    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 90, description: 'Bank charges reversal-block test' },
    ])
    await ensureReconciliationSession(app, fx, stmt.statementId)
    const lineId = stmt.lines[0].id

    const created = await createAdjustmentFromLine(stmt.statementId, lineId, '90', `tadj-revblock-${lineId}`)
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const ready = await markReadyAdjustment(app, fx, created.body.data.id, created.body.data.updatedAt)
    const posted = await postAdjustment(app, fx, created.body.data.id, ready.body.data.updatedAt, fx.postingDate)
    expect(posted.status, JSON.stringify(posted.body)).toBe(200)

    const res = await reverseAdjustment(app, fx, created.body.data.id, {
      expectedUpdatedAt: posted.body.data.adjustment.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Attempted reversal while matched',
      idempotencyKey: `rev-block-${created.body.data.id}`,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
  })
})
