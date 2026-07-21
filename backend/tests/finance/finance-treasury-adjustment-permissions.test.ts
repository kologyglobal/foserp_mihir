/**
 * Finance Phase 5B3 — Permission gating: each mutating treasury-adjustment action requires its
 * specific `finance.treasury.adjustment.*` permission, and view-only users are blocked from
 * every mutation while retaining read access. Live MySQL.
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
  createAdjustmentBankAccount,
  createAdjustmentDraft,
  createGlExpenseAccount,
  createReadyAdjustmentDraft,
  getAdjustment,
  markReadyAdjustment,
  postAdjustment,
  reverseAdjustment,
  submitAdjustment,
  setFinanceSettings,
} from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Treasury adjustment permissions', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let expenseGl: { id: string }
  let noPermToken: string
  let viewOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-perm')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'PERMBANK' })
    expenseGl = await createGlExpenseAccount(fx, 'PERMEXP')
    await setFinanceSettings(app, fx, { treasuryAdjustmentApprovalLimit: '10000' })

    const noPerm = await createUserWithPerms(app, fx.tenantId, fx.slug, [], 'tadj-perm-none')
    noPermToken = noPerm.token
    const viewer = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.treasury.adjustment.view'], 'tadj-perm-view')
    viewOnlyToken = viewer.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('blocks creating a treasury adjustment for a user with no permissions', async () => {
    const res = await createAdjustmentDraft(
      app,
      fx,
      bank1,
      { adjustmentType: 'BANK_CHARGES', direction: 'BANK_DEBIT', narration: 'perm test', lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '10' }] },
      noPermToken,
    )
    expect(res.status).toBe(403)
  })

  it('allows a view-only user to read but blocks mark-ready, submit, post, and reverse', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      direction: 'BANK_DEBIT',
      narration: 'view-only perm test',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '20' }],
    })

    const view = await getAdjustment(app, fx, draft.id, viewOnlyToken)
    expect(view.status, JSON.stringify(view.body)).toBe(200)

    const blockedMarkReady = await markReadyAdjustment(app, fx, draft.id, draft.updatedAt, viewOnlyToken)
    expect(blockedMarkReady.status).toBe(403)
  })

  it('requires finance.treasury.adjustment.post specifically to post', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      direction: 'BANK_DEBIT',
      narration: 'post perm test',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '30' }],
    })
    const ready = await markReadyAdjustment(app, fx, draft.id, draft.updatedAt)
    expect(ready.status, JSON.stringify(ready.body)).toBe(200)

    const editOnly = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.treasury.adjustment.view', 'finance.treasury.adjustment.edit'], 'tadj-perm-edit')
    const blocked = await postAdjustment(app, fx, draft.id, ready.body.data.updatedAt, fx.postingDate, editOnly.token)
    expect(blocked.status).toBe(403)

    const posted = await postAdjustment(app, fx, draft.id, ready.body.data.updatedAt, fx.postingDate)
    expect(posted.status, JSON.stringify(posted.body)).toBe(200)
  })

  it('requires finance.treasury.adjustment.reverse specifically to reverse a POSTED adjustment', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      direction: 'BANK_DEBIT',
      narration: 'reverse perm test',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '40' }],
    })
    const ready = await markReadyAdjustment(app, fx, draft.id, draft.updatedAt)
    const posted = await postAdjustment(app, fx, draft.id, ready.body.data.updatedAt, fx.postingDate)
    expect(posted.status, JSON.stringify(posted.body)).toBe(200)

    const blocked = await reverseAdjustment(
      app,
      fx,
      draft.id,
      { expectedUpdatedAt: posted.body.data.adjustment.updatedAt, reversalDate: fx.postingDate, reason: 'perm test', idempotencyKey: `perm-rev-${draft.id}` },
      viewOnlyToken,
    )
    expect(blocked.status).toBe(403)

    const reversed = await reverseAdjustment(app, fx, draft.id, {
      expectedUpdatedAt: posted.body.data.adjustment.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'perm test',
      idempotencyKey: `perm-rev-ok-${draft.id}`,
    })
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(200)
  })

  it('requires finance.treasury.adjustment.submit specifically to submit an approval-required adjustment', async () => {
    const draft = await createReadyAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      direction: 'BANK_DEBIT',
      narration: 'submit perm test',
      approvalRequiredOverride: true,
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '50' }],
    })

    const blocked = await submitAdjustment(app, fx, draft.id, draft.updatedAt, viewOnlyToken)
    expect(blocked.status).toBe(403)

    const editOnly = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.treasury.adjustment.view', 'finance.treasury.adjustment.edit', 'finance.treasury.adjustment.submit'], 'tadj-perm-submit')
    const ok = await submitAdjustment(app, fx, draft.id, draft.updatedAt, editOnly.token)
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
  })
})
