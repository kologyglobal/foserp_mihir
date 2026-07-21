/**
 * Phase 5A3 — Clearing match posting: matching a statement line against a CLEARING-GL
 * candidate posts a SYSTEM settlement voucher (Dr Bank / Cr Clearing for a CREDIT statement
 * line) via the central post() service. Live MySQL.
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

describe.skipIf(!dbAvailable)('Phase 5A3 — Clearing settlement posting', () => {
  let fx: ApAllocFixture
  let treasuryAccountId: string
  let bankGlAccountId: string
  let clearingGlAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'br-clear')
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

  it('posts Dr Bank / Cr Clearing when matching a CREDIT statement line to a clearing-GL receipt', async () => {
    // Money received via a payment gateway: initially recorded Dr Clearing / Cr Sales (in transit).
    await postJournal(app, fx, [
      { accountId: clearingGlAccountId, debitAmount: '8000' },
      { accountId: fx.purchaseAccountId, creditAmount: '8000' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'CREDIT', amount: 8000 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id

    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(candidatesRes.status, JSON.stringify(candidatesRes.body)).toBe(200)
    expect(candidatesRes.body.data.clearing.length).toBeGreaterThanOrEqual(1)
    const candidate = candidatesRes.body.data.clearing[0]

    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    const matchRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: lineId, amount: '8000' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '8000' }],
        idempotencyKey: `clearing-match-${Date.now()}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)
    expect(matchRes.body.data.matchSource).toBe('CLEARING_GL')
    expect(matchRes.body.data.postingMode).toBe('CLEARING_SETTLEMENT')
    expect(matchRes.body.data.accountingVoucherId).toBeTruthy()

    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore + 1)

    const voucher = await prisma.accountingVoucher.findFirstOrThrow({ where: { id: matchRes.body.data.accountingVoucherId, tenantId: fx.tenantId } })
    expect(voucher.voucherType).toBe('SYSTEM')
    expect(voucher.sourceDocumentType).toBe('BANK_RECONCILIATION_MATCH')
    expect(voucher.sourceDocumentId).toBe(matchRes.body.data.id)

    const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId: voucher.id, tenantId: fx.tenantId }, orderBy: { lineNumber: 'asc' } })
    expect(lines).toHaveLength(2)
    const bankLine = lines.find((l) => l.accountId === bankGlAccountId)!
    const clearingLine = lines.find((l) => l.accountId === clearingGlAccountId)!
    expect(bankLine.debitAmount.toFixed(4)).toBe('8000.0000')
    expect(bankLine.creditAmount.toFixed(4)).toBe('0.0000')
    expect(clearingLine.creditAmount.toFixed(4)).toBe('8000.0000')
    expect(clearingLine.debitAmount.toFixed(4)).toBe('0.0000')

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { id: lineId, tenantId: fx.tenantId } })
    expect(line.matchStatus).toBe('MATCHED')
  })

  it('posts Dr Clearing / Cr Bank when matching a DEBIT statement line to a clearing-GL payment', async () => {
    await postJournal(app, fx, [
      { accountId: fx.purchaseAccountId, debitAmount: '3500' },
      { accountId: clearingGlAccountId, creditAmount: '3500' },
    ])
    const statement = await createValidatedStatement(app, fx, treasuryAccountId, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 3500 },
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
        statementAllocations: [{ bankStatementLineId: lineId, amount: '3500' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '3500' }],
        idempotencyKey: `clearing-match-debit-${Date.now()}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)

    const voucher = await prisma.accountingVoucher.findFirstOrThrow({ where: { id: matchRes.body.data.accountingVoucherId, tenantId: fx.tenantId } })
    const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId: voucher.id, tenantId: fx.tenantId } })
    const bankLine = lines.find((l) => l.accountId === bankGlAccountId)!
    const clearingLine = lines.find((l) => l.accountId === clearingGlAccountId)!
    expect(bankLine.creditAmount.toFixed(4)).toBe('3500.0000')
    expect(clearingLine.debitAmount.toFixed(4)).toBe('3500.0000')
  })
})
