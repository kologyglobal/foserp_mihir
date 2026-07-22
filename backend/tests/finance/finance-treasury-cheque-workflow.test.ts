/**
 * Finance Phase 5B2 — Cheque workflow: approval-required drafts route through submit →
 * self-approval-block → approve/reject, below-limit drafts go straight to mark-ready, and
 * revise/cancel transitions behave as designed. Live MySQL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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
import {
  approveCheque,
  cancelCheque,
  createAndSetChequeClearingAccount,
  createChequeBankAccount,
  createReadyChequeDraft,
  markReadyCheque,
  rejectCheque,
  reviseCheque,
  submitCheque,
} from './helpers/treasury-cheque-fixture.js'
import { setFinanceSettings, type TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B2 — Cheque workflow', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let approverToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'chq-wf')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createChequeBankAccount(app, fx, { namePrefix: 'WFBANK' })
    await createAndSetChequeClearingAccount(app, fx, 'CHEQUE_PAYMENT_CLEARING', 'WFPAYCLR')
    const approver = await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['finance.treasury.cheque.view', 'finance.treasury.cheque.approve'],
      'chq-wf-approver',
    )
    approverToken = approver.token
    await setFinanceSettings(app, fx, { treasuryChequeApprovalLimit: 1000 })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('routes an over-limit draft through submit → self-approve-block → approve', async () => {
    const draft = await createReadyChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '5000' })
    expect(draft.body.approvalRequired).toBe(true)
    expect(draft.body.allowedActions.submit).toBe(true)
    expect(draft.body.allowedActions.markReady).toBe(false)

    const submitted = await submitCheque(app, fx, draft.id, draft.updatedAt)
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL')
    expect(submitted.body.data.allowedActions.approve).toBe(true)

    const approvalRequest = await prisma.financeApprovalRequest.findFirstOrThrow({
      where: { tenantId: fx.tenantId, documentType: 'TREASURY_CHEQUE', documentId: draft.id },
    })
    expect(approvalRequest.status).toBe('PENDING')

    const selfApprove = await approveCheque(app, fx, draft.id, submitted.body.data.updatedAt)
    expect(selfApprove.status, JSON.stringify(selfApprove.body)).toBe(422)
    expect(selfApprove.body.code ?? selfApprove.body.error?.code).toBe('TREASURY_CHEQUE_APPROVAL_REQUIRED')

    const approved = await approveCheque(app, fx, draft.id, submitted.body.data.updatedAt, approverToken)
    expect(approved.status, JSON.stringify(approved.body)).toBe(200)
    expect(approved.body.data.status).toBe('READY')

    const refreshedApproval = await prisma.financeApprovalRequest.findFirstOrThrow({ where: { id: approvalRequest.id, tenantId: fx.tenantId } })
    expect(refreshedApproval.status).toBe('APPROVED')
  })

  it('rejects and revises an over-limit draft back to DRAFT', async () => {
    const draft = await createReadyChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '4000' })
    const submitted = await submitCheque(app, fx, draft.id, draft.updatedAt)
    expect(submitted.status).toBe(200)

    const rejected = await rejectCheque(app, fx, draft.id, submitted.body.data.updatedAt, 'Incorrect payee', approverToken)
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200)
    expect(rejected.body.data.status).toBe('REJECTED')
    expect(rejected.body.data.rejectionReason).toBe('Incorrect payee')

    const revised = await reviseCheque(app, fx, draft.id, rejected.body.data.updatedAt)
    expect(revised.status, JSON.stringify(revised.body)).toBe(200)
    expect(revised.body.data.status).toBe('DRAFT')
    expect(revised.body.data.approvalRequestId).toBeNull()
  })

  it('marks a below-limit draft ready without requiring approval', async () => {
    const draft = await createReadyChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '200' })
    expect(draft.body.approvalRequired).toBe(false)
    expect(draft.body.allowedActions.markReady).toBe(true)
    expect(draft.body.allowedActions.submit).toBe(false)

    const submitAttempt = await submitCheque(app, fx, draft.id, draft.updatedAt)
    expect(submitAttempt.status, JSON.stringify(submitAttempt.body)).toBe(422)

    const ready = await markReadyCheque(app, fx, draft.id, draft.updatedAt)
    expect(ready.status, JSON.stringify(ready.body)).toBe(200)
    expect(ready.body.data.status).toBe('READY')
  })

  it('cancels a draft cheque and frees its uniqueness key', async () => {
    const draft = await createReadyChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '150' })
    const cancelled = await cancelCheque(app, fx, draft.id, draft.updatedAt, 'No longer needed')
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')
    expect(cancelled.body.data.allowedActions.cancel).toBe(false)

    const row = await prisma.treasuryCheque.findFirstOrThrow({ where: { id: draft.id, tenantId: fx.tenantId } })
    expect(row.uniquenessKey).toBeNull()
  })
})
