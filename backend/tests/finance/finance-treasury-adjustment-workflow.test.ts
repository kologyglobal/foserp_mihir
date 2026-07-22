/**
 * Finance Phase 5B3 — Treasury adjustment workflow: mark-ready (non-approval), submit/approve/
 * reject/revise/cancel (approval-required), self-approval prevention, and optimistic-lock guards.
 * Live MySQL.
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
  FINANCE_PERMS,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import {
  approveAdjustment,
  cancelAdjustment,
  createAdjustmentBankAccount,
  createGlExpenseAccount,
  createReadyAdjustmentDraft,
  markReadyAdjustment,
  rejectAdjustment,
  reviseAdjustment,
  setFinanceSettings,
  submitAdjustment,
} from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Treasury adjustment workflow', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let expenseGl: { id: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-wf')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'WFBANK' })
    expenseGl = await createGlExpenseAccount(fx, 'WFEXP')
    // Default is treasuryAdjustmentPreventSelfApprove=true; most cases below use the same admin
    // user for both submit and approve, so disable it here and re-enable it in the dedicated test.
    await setFinanceSettings(app, fx, { treasuryAdjustmentPreventSelfApprove: false })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('marks a non-approval draft ready to post directly', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '80' }],
    })
    const res = await markReadyAdjustment(app, fx, draft.id, draft.updatedAt)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.status).toBe('READY_TO_POST')
    expect(res.body.data.allowedActions.post).toBe(true)
  })

  it('rejects mark-ready with a stale expectedUpdatedAt (optimistic lock)', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '81' }],
    })
    const res = await markReadyAdjustment(app, fx, draft.id, new Date(Date.now() - 999999).toISOString())
    expect(res.status, JSON.stringify(res.body)).toBe(409)
  })

  it('routes an approval-required (OTHER_BANK_DEBIT) draft through submit → approve → READY_TO_POST', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'OTHER_BANK_DEBIT',
      narration: 'Unclassified debit under investigation',
      lines: [{ lineType: 'OTHER', accountId: expenseGl.id, amount: '75' }],
    })
    expect(draft.body.approvalRequired).toBe(true)

    const submitted = await submitAdjustment(app, fx, draft.id, draft.updatedAt)
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL')
    expect(submitted.body.data.approvalRequest).not.toBeNull()

    const approved = await approveAdjustment(app, fx, draft.id, submitted.body.data.updatedAt)
    expect(approved.status, JSON.stringify(approved.body)).toBe(200)
    expect(approved.body.data.status).toBe('READY_TO_POST')
    expect(approved.body.data.approvalRequest.status).toBe('APPROVED')
  })

  it('routes an approval-required draft through submit → reject → REJECTED, then revise back to DRAFT', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'OTHER_BANK_CREDIT',
      narration: 'Unclassified credit under investigation',
      lines: [{ lineType: 'OTHER', accountId: expenseGl.id, amount: '60' }],
    })
    const submitted = await submitAdjustment(app, fx, draft.id, draft.updatedAt)
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)

    const rejected = await rejectAdjustment(app, fx, draft.id, submitted.body.data.updatedAt, 'Needs more detail')
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200)
    expect(rejected.body.data.status).toBe('REJECTED')
    expect(rejected.body.data.rejectionReason).toBe('Needs more detail')

    const revised = await reviseAdjustment(app, fx, draft.id, rejected.body.data.updatedAt)
    expect(revised.status, JSON.stringify(revised.body)).toBe(200)
    expect(revised.body.data.status).toBe('DRAFT')
  })

  it('cancels a DRAFT adjustment with a reason', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '20' }],
    })
    const res = await cancelAdjustment(app, fx, draft.id, draft.updatedAt, 'Created in error')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.status).toBe('CANCELLED')
  })

  it('prevents the submitter from self-approving when treasuryAdjustmentPreventSelfApprove is enabled', async () => {
    await setFinanceSettings(app, fx, { treasuryAdjustmentPreventSelfApprove: true })
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'OTHER_BANK_DEBIT',
      narration: 'Self-approve check',
      lines: [{ lineType: 'OTHER', accountId: expenseGl.id, amount: '15' }],
    })
    const submitted = await submitAdjustment(app, fx, draft.id, draft.updatedAt)
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)

    const approved = await approveAdjustment(app, fx, draft.id, submitted.body.data.updatedAt)
    expect(approved.status, JSON.stringify(approved.body)).toBe(422)
  })

  it('allows a different approver to approve when self-approval is prevented', async () => {
    const { token: approverToken } = await createUserWithPerms(app, fx.tenantId, fx.slug, FINANCE_PERMS, 'tadj-wf-approver')
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'OTHER_BANK_CREDIT',
      narration: 'Second approver check',
      lines: [{ lineType: 'OTHER', accountId: expenseGl.id, amount: '18' }],
    })
    const submitted = await submitAdjustment(app, fx, draft.id, draft.updatedAt)
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)

    const approved = await approveAdjustment(app, fx, draft.id, submitted.body.data.updatedAt, approverToken)
    expect(approved.status, JSON.stringify(approved.body)).toBe(200)
    expect(approved.body.data.status).toBe('READY_TO_POST')
  })
})
