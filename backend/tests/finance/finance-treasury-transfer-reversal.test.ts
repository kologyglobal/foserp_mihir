/**
 * Finance Phase 5B1 — Reversal: DIRECT transfers reverse with a single swapped-line voucher,
 * IN_TRANSIT transfers reverse both legs (receipt then dispatch), reversal is only eligible
 * from COMPLETED, and an ACTIVE bank reconciliation match on either leg's GL entries blocks
 * reversal until unmatched. Live MySQL.
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
  dispatchTransfer,
  markReadyTransfer,
  postDirectTransfer,
  receiveTransfer,
  reversalPreview,
  reverseTransfer,
  setFinanceSettings,
  setInternalTransferClearingMapping,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — Reversal', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let bank2: TreasuryTransferAccount

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ttr-rev')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'REVB1' })
    bank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'REVB2' })

    const clearingGl = await prisma.account.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        accountCode: `REVCLR${Date.now()}`.slice(-12),
        accountName: 'Reversal Test Clearing',
        category: 'LIABILITY',
        accountType: 'GENERAL',
        isGroup: false,
        level: 1,
      },
    })
    await setInternalTransferClearingMapping(app, fx, clearingGl.id)
    // This suite exercises reversal mechanics with a single test user — maker-checker
    // dispatcher/receiver separation is covered separately in the workflow/permissions suites.
    await setFinanceSettings(app, fx, { treasuryTransferPreventDispatcherReceive: false })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('reverses a DIRECT transfer with a single swapped-line reversal voucher', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '8000', postingModeOverride: 'DIRECT' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(posted.status).toBe(200)
    const originalVoucherId = posted.body.data.posting.voucherId as string

    const preview = await reversalPreview(app, fx, draft.id)
    expect(preview.status, JSON.stringify(preview.body)).toBe(200)
    expect(preview.body.data.eligible).toBe(true)
    expect(preview.body.data.postingMode).toBe('DIRECT')

    const reversed = await reverseTransfer(app, fx, draft.id, {
      expectedUpdatedAt: posted.body.data.transfer.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Wrong beneficiary account',
      idempotencyKey: `rev-direct-${draft.id}`,
    })
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(200)
    expect(reversed.body.data.transfer.status).toBe('REVERSED')
    expect(reversed.body.data.postings).toHaveLength(1)

    const original = await prisma.accountingVoucher.findFirstOrThrow({ where: { id: originalVoucherId, tenantId: fx.tenantId } })
    expect(original.status).toBe('REVERSED')

    const reversalVoucherId = reversed.body.data.postings[0].voucherId as string
    const originalLines = await prisma.accountingVoucherLine.findMany({ where: { voucherId: originalVoucherId, tenantId: fx.tenantId }, orderBy: { lineNumber: 'asc' } })
    const reversalLines = await prisma.accountingVoucherLine.findMany({ where: { voucherId: reversalVoucherId, tenantId: fx.tenantId }, orderBy: { lineNumber: 'asc' } })
    for (let i = 0; i < originalLines.length; i += 1) {
      expect(reversalLines[i].accountId).toBe(originalLines[i].accountId)
      expect(reversalLines[i].debitAmount.toString()).toBe(originalLines[i].creditAmount.toString())
      expect(reversalLines[i].creditAmount.toString()).toBe(originalLines[i].debitAmount.toString())
    }

    const finalTransfer = await prisma.treasuryTransfer.findFirstOrThrow({ where: { id: draft.id, tenantId: fx.tenantId } })
    expect(finalTransfer.reversalSourceVoucherId).toBe(finalTransfer.reversalDestinationVoucherId)
  })

  it('reverses an IN_TRANSIT transfer by reversing the receipt then the dispatch leg', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '9000' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const dispatched = await dispatchTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(dispatched.status).toBe(200)
    const received = await receiveTransfer(app, fx, draft.id, dispatched.body.data.transfer.updatedAt)
    expect(received.status).toBe(200)

    const dispatchVoucherId = dispatched.body.data.posting.voucherId as string
    const receiveVoucherId = received.body.data.posting.voucherId as string

    const reversed = await reverseTransfer(app, fx, draft.id, {
      expectedUpdatedAt: received.body.data.transfer.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Duplicate transfer',
      idempotencyKey: `rev-transit-${draft.id}`,
    })
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(200)
    expect(reversed.body.data.transfer.status).toBe('REVERSED')
    expect(reversed.body.data.postings).toHaveLength(2)

    const dispatchVoucher = await prisma.accountingVoucher.findFirstOrThrow({ where: { id: dispatchVoucherId, tenantId: fx.tenantId } })
    const receiveVoucher = await prisma.accountingVoucher.findFirstOrThrow({ where: { id: receiveVoucherId, tenantId: fx.tenantId } })
    expect(dispatchVoucher.status).toBe('REVERSED')
    expect(receiveVoucher.status).toBe('REVERSED')

    const finalTransfer = await prisma.treasuryTransfer.findFirstOrThrow({ where: { id: draft.id, tenantId: fx.tenantId } })
    expect(finalTransfer.reversalSourceVoucherId).not.toBe(finalTransfer.reversalDestinationVoucherId)
  })

  it('replays an already-reversed transfer idempotently', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '600', postingModeOverride: 'DIRECT' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    const body = {
      expectedUpdatedAt: posted.body.data.transfer.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Test replay',
      idempotencyKey: `rev-replay-${draft.id}`,
    }
    const first = await reverseTransfer(app, fx, draft.id, body)
    expect(first.status).toBe(200)
    const second = await reverseTransfer(app, fx, draft.id, body)
    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(second.body.data.idempotentReplay).toBe(true)
  })

  it('rejects reversal of a transfer that is not COMPLETED', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '100', postingModeOverride: 'DIRECT' })
    const res = await reverseTransfer(app, fx, draft.id, {
      expectedUpdatedAt: draft.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Not eligible yet',
      idempotencyKey: `rev-notcompleted-${draft.id}`,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.code ?? res.body.error?.code).toBe('TREASURY_TRANSFER_REVERSAL_NOT_ELIGIBLE')
  })

  it('blocks reversal while an ACTIVE bank reconciliation match references the source-leg GL entry', async () => {
    const reconBank = await createBankTreasury(app, fx)
    const draft = await createReadyTransferDraft(app, fx, reconBank, bank2, { transferAmount: '3300', postingModeOverride: 'DIRECT' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(posted.status, JSON.stringify(posted.body)).toBe(200)

    const statement = await createValidatedStatement(app, fx, reconBank.id, [
      { transactionDate: fx.documentDate, direction: 'DEBIT', amount: 3300 },
    ])
    await ensureReconciliationSession(app, fx, statement.statementId)
    const lineId = statement.lines[0].id
    const candidatesRes = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statement.statementId}/lines/${lineId}/reconciliation-candidates`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(candidatesRes.body.data.direct.length).toBeGreaterThan(0)
    const candidate = candidatesRes.body.data.direct[0]
    const matchRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-reconciliation/matches`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        statementId: statement.statementId,
        statementAllocations: [{ bankStatementLineId: lineId, amount: '3300' }],
        ledgerAllocations: [{ generalLedgerEntryId: candidate.generalLedgerEntryId, amount: '3300' }],
        idempotencyKey: `ttr-recon-lock-${draft.id}`,
      })
    expect(matchRes.status, JSON.stringify(matchRes.body)).toBe(201)

    const preview = await reversalPreview(app, fx, draft.id)
    expect(preview.status).toBe(200)
    expect(preview.body.data.eligible).toBe(false)
    expect(preview.body.data.bankReconciliationLocked).toBe(true)

    const reversed = await reverseTransfer(app, fx, draft.id, {
      expectedUpdatedAt: posted.body.data.transfer.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'Attempt while reconciled',
      idempotencyKey: `rev-locked-${draft.id}`,
    })
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(422)
    expect(reversed.body.code ?? reversed.body.error?.code).toBe('TREASURY_TRANSFER_RECONCILIATION_LOCK')
  })
})
