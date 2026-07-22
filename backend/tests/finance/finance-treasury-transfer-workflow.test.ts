/**
 * Finance Phase 5B1 — Workflow: approval-required drafts route through submit → approve/reject,
 * self-approval is blocked by default, non-approval drafts go straight to mark-ready, and
 * reject/revise/cancel transitions behave as designed. Live MySQL.
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
  approveTransfer,
  cancelTransfer,
  createReadyTransferDraft,
  createTreasuryAccount,
  markReadyTransfer,
  postDirectTransfer,
  rejectTransfer,
  reviseTransfer,
  setFinanceSettings,
  submitTransfer,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — Workflow', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let bank2: TreasuryTransferAccount
  let approverToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ttr-wf')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'WFB1' })
    bank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'WFB2' })
    const approver = await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['finance.treasury.transfer.view', 'finance.treasury.transfer.approve'],
      'ttr-wf-approver',
    )
    approverToken = approver.token
    await setFinanceSettings(app, fx, { treasuryTransferApprovalLimit: 1000 })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('routes an over-limit draft through submit → self-approve-block → approve → post', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '5000', postingModeOverride: 'DIRECT' })
    expect(draft.body.approvalRequired).toBe(true)
    expect(draft.body.allowedActions.submit).toBe(true)
    expect(draft.body.allowedActions.markReady).toBe(false)

    const submitted = await submitTransfer(app, fx, draft.id, draft.updatedAt)
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL')
    expect(submitted.body.data.allowedActions.approve).toBe(true)

    const approvalRequest = await prisma.financeApprovalRequest.findFirstOrThrow({
      where: { tenantId: fx.tenantId, documentType: 'TREASURY_TRANSFER', documentId: draft.id },
    })
    expect(approvalRequest.status).toBe('PENDING')

    // The submitter cannot approve their own transfer by default.
    const selfApprove = await approveTransfer(app, fx, draft.id, submitted.body.data.updatedAt)
    expect(selfApprove.status, JSON.stringify(selfApprove.body)).toBe(422)
    expect(selfApprove.body.code ?? selfApprove.body.error?.code).toBe('TREASURY_TRANSFER_APPROVAL_REQUIRED')

    const approved = await approveTransfer(app, fx, draft.id, submitted.body.data.updatedAt, approverToken)
    expect(approved.status, JSON.stringify(approved.body)).toBe(200)
    expect(approved.body.data.status).toBe('READY_TO_POST')

    const refreshedApproval = await prisma.financeApprovalRequest.findFirstOrThrow({ where: { id: approvalRequest.id, tenantId: fx.tenantId } })
    expect(refreshedApproval.status).toBe('APPROVED')

    const posted = await postDirectTransfer(app, fx, draft.id, approved.body.data.updatedAt)
    expect(posted.status, JSON.stringify(posted.body)).toBe(200)
    expect(posted.body.data.transfer.status).toBe('COMPLETED')
  })

  it('rejects and revises an over-limit draft back to DRAFT', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '4000', postingModeOverride: 'DIRECT' })
    const submitted = await submitTransfer(app, fx, draft.id, draft.updatedAt)
    expect(submitted.status).toBe(200)

    const rejected = await rejectTransfer(app, fx, draft.id, submitted.body.data.updatedAt, 'Wrong destination account', approverToken)
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200)
    expect(rejected.body.data.status).toBe('REJECTED')
    expect(rejected.body.data.rejectionReason).toBe('Wrong destination account')

    const revised = await reviseTransfer(app, fx, draft.id, rejected.body.data.updatedAt)
    expect(revised.status, JSON.stringify(revised.body)).toBe(200)
    expect(revised.body.data.status).toBe('DRAFT')
    expect(revised.body.data.approvalRequestId).toBeNull()
  })

  it('marks a below-limit draft ready without requiring approval', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '200', postingModeOverride: 'DIRECT' })
    expect(draft.body.approvalRequired).toBe(false)
    expect(draft.body.allowedActions.markReady).toBe(true)
    expect(draft.body.allowedActions.submit).toBe(false)

    const submitAttempt = await submitTransfer(app, fx, draft.id, draft.updatedAt)
    expect(submitAttempt.status, JSON.stringify(submitAttempt.body)).toBe(422)

    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    expect(ready.status, JSON.stringify(ready.body)).toBe(200)
    expect(ready.body.data.status).toBe('READY_TO_POST')
  })

  it('cancels a draft transfer', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '150', postingModeOverride: 'DIRECT' })
    const cancelled = await cancelTransfer(app, fx, draft.id, draft.updatedAt, 'No longer needed')
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')
    expect(cancelled.body.data.allowedActions.cancel).toBe(false)
  })
})
