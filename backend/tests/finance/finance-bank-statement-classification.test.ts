/**
 * Finance Phase 5B3 — Bank statement classification: deterministic keyword/rule scoring (no AI),
 * priority-based tie-breaking, no-match (404), and ambiguous-match (422) outcomes. Live MySQL.
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
import { createValidatedStatement } from './helpers/bank-reconciliation-fixture.js'
import { createAdjustmentBankAccount, createGlExpenseAccount } from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Bank statement classification', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let expenseGl: { id: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-cls')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'CLSBANK' })
    expenseGl = await createGlExpenseAccount(fx, 'CLSEXP')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  async function createRule(body: Record<string, unknown>) {
    return request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-posting-rules`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank1.id,
        isActive: true,
        priority: 100,
        keywordPatterns: ['bank charges'],
        adjustmentType: 'BANK_CHARGES',
        lineTemplate: { lineType: 'EXPENSE', accountId: expenseGl.id },
        ...body,
      })
  }

  async function classify(statementId: string, lineId: string) {
    return request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/lines/${lineId}/classify`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ legalEntityId: fx.legalEntityId })
  }

  it('creates a posting rule', async () => {
    const res = await createRule({ name: 'Bank charges keyword rule' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.isActive).toBe(true)
    expect(res.body.data.matchCount).toBe(0)
  })

  it('matches a statement line whose description contains the rule keyword', async () => {
    await createRule({ name: 'AMC fee rule', keywordPatterns: ['amc fee', 'annual maintenance'] })
    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 118, description: 'AMC FEE Q1 charge' },
    ])
    const res = await classify(stmt.statementId, stmt.lines[0].id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.adjustmentType).toBe('BANK_CHARGES')
    expect(res.body.data.ruleName).toBe('AMC fee rule')
    expect(res.body.data.matchedKeywords).toContain('amc fee')
    expect(Number(res.body.data.lineTemplate.amount)).toBe(118)
  })

  it('returns 404 when no rule matches the statement line description', async () => {
    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 10, description: 'Totally unrelated narration xyz123' },
    ])
    const res = await classify(stmt.statementId, stmt.lines[0].id)
    expect(res.status, JSON.stringify(res.body)).toBe(404)
  })

  it('returns 422 (ambiguous) when two active rules tie on score and priority', async () => {
    await createRule({ name: 'Ambiguous rule A', priority: 50, keywordPatterns: ['tie keyword unique'] })
    await createRule({ name: 'Ambiguous rule B', priority: 50, keywordPatterns: ['tie keyword unique'] })
    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 25, description: 'tie keyword unique charge' },
    ])
    const res = await classify(stmt.statementId, stmt.lines[0].id)
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.error?.code ?? res.body.code).toBe('BANK_POSTING_RULE_AMBIGUOUS')
  })

  it('prefers the higher-priority (lower number) rule when keyword scores tie but priorities differ', async () => {
    await createRule({ name: 'Low priority rule', priority: 200, keywordPatterns: ['priority tiebreak keyword'] })
    await createRule({ name: 'High priority rule', priority: 10, keywordPatterns: ['priority tiebreak keyword'] })
    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 40, description: 'priority tiebreak keyword charge' },
    ])
    const res = await classify(stmt.statementId, stmt.lines[0].id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.ruleName).toBe('High priority rule')
  })

  it('deactivates a rule and excludes it from future matching', async () => {
    const created = await createRule({ name: 'Deactivate-me rule', keywordPatterns: ['deactivateme keyword'] })
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-posting-rules/${created.body.data.id}/deactivate`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({})
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.isActive).toBe(false)

    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 15, description: 'deactivateme keyword charge' },
    ])
    const classifyRes = await classify(stmt.statementId, stmt.lines[0].id)
    expect(classifyRes.status, JSON.stringify(classifyRes.body)).toBe(404)
  })

  it('records match count and lastMatchedAt on the matched rule', async () => {
    const created = await createRule({ name: 'Match counter rule', keywordPatterns: ['matchcounter keyword'] })
    const stmt = await createValidatedStatement(app, fx, bank1.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 22, description: 'matchcounter keyword charge' },
    ])
    const res = await classify(stmt.statementId, stmt.lines[0].id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    const rule = await prisma.bankPostingRule.findFirst({ where: { id: created.body.data.id, tenantId: fx.tenantId } })
    expect(rule?.matchCount).toBe(1)
    expect(rule?.lastMatchedAt).not.toBeNull()
  })
})
