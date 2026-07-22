/**
 * Finance Phase 5B1 — Reconciliation eligibility: BANK-leg GL entries from a treasury transfer
 * are discoverable as bank reconciliation candidates and can be matched; CASH treasury accounts
 * are not eligible for bank reconciliation at all (profile setup is BANK-only). Live MySQL.
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
import { createBankTreasury, createValidatedStatement, ensureReconciliationSession } from './helpers/bank-reconciliation-fixture.js'
import {
  createReadyTransferDraft,
  createTreasuryAccount,
  markReadyTransfer,
  postDirectTransfer,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — Reconciliation eligibility', () => {
  let fx: ApAllocFixture
  let recBank: { id: string; glAccountId: string; currencyCode: string; updatedAt: string }
  let bank2: TreasuryTransferAccount
  let cash1: TreasuryTransferAccount

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ttr-rec')
    fx = await bootstrapApAllocFixture(app, ctx)
    recBank = await createBankTreasury(app, fx)
    bank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'RECB2' })
    cash1 = await createTreasuryAccount(app, fx, 'CASH', { namePrefix: 'RECC1' })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('exposes a DIRECT BANK_TO_BANK transfer leg as a reconciliation candidate and lets it be matched', async () => {
    const draft = await createReadyTransferDraft(app, fx, recBank, bank2, { transferAmount: '4400', postingModeOverride: 'DIRECT' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(posted.status, JSON.stringify(posted.body)).toBe(200)

    const statement = await createValidatedStatement(app, fx, recBank.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 4400 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id

    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(candidatesRes.status, JSON.stringify(candidatesRes.body)).toBe(200)
    const candidate = candidatesRes.body.data.direct.find((c: { generalLedgerEntryId: string }) =>
      Boolean(c.generalLedgerEntryId),
    )
    expect(candidate).toBeTruthy()

    const matchRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: lineId, amount: '4400' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '4400' }],
        idempotencyKey: `ttr-rec-eligible-${draft.id}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)
    expect(matchRes.body.data.matchStatus).toBe('ACTIVE')

    const line = await prisma.bankStatementLine.findFirstOrThrow({ where: { id: lineId, tenantId: fx.tenantId } })
    expect(line.matchStatus).toBe('MATCHED')
  })

  it('rejects setting up a bank reconciliation profile on a CASH treasury account', async () => {
    const res = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${cash1.id}/reconciliation-profile`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        duplicatePolicy: 'BLOCK',
        dateBasis: 'TRANSACTION_DATE',
        dateToleranceDays: 3,
        amountTolerance: '0',
        autoReconcileEnabled: true,
        autoReconcileScore: 100,
        requireUniqueExactMatch: true,
        groupedSuggestionsEnabled: true,
        partialSuggestionsEnabled: true,
        allowManualPartialMatch: true,
        allowManualGroupedMatch: true,
        maximumGroupSize: 5,
        requireFullMatchToFinalize: true,
        allowFinalizeWithExceptions: true,
        finalizationDifferenceTolerance: '0',
      })
    expect(res.status, JSON.stringify(res.body)).toBe(400)
    expect(res.body.code ?? res.body.error?.code).toBe('BANK_RECONCILIATION_PROFILE_BANK_ONLY')
  })

  it('never surfaces a CASH-leg GL entry as a reconciliation candidate for a BANK statement', async () => {
    const draft = await createReadyTransferDraft(app, fx, recBank, cash1, { transferAmount: '250', postingModeOverride: 'DIRECT' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(posted.status).toBe(200)

    const cashGlEntry = await prisma.generalLedgerEntry.findFirst({
      where: { tenantId: fx.tenantId, voucherId: posted.body.data.posting.voucherId, accountId: cash1.glAccountId },
    })
    expect(cashGlEntry).toBeTruthy()

    const statement = await createValidatedStatement(app, fx, recBank.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 250 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id
    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    const candidateIds = (candidatesRes.body.data.direct as Array<{ generalLedgerEntryId: string }>).map((c) => c.generalLedgerEntryId)
    expect(candidateIds).not.toContain(cashGlEntry!.id)
  })
})
