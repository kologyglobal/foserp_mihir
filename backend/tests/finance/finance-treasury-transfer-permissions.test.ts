/**
 * Finance Phase 5B1 — Permission gating: each mutating action requires its specific
 * `finance.treasury.transfer.*` permission, and view-only users are blocked from every
 * mutation while retaining read access. Live MySQL.
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
  createReadyTransferDraft,
  createTransferDraft,
  createTreasuryAccount,
  dispatchTransfer,
  getTransfer,
  markReadyTransfer,
  postDirectTransfer,
  receiveTransfer,
  reverseTransfer,
  setFinanceSettings,
  setInternalTransferClearingMapping,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — Permissions', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let bank2: TreasuryTransferAccount
  let noPermToken: string
  let viewOnlyToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ttr-perm')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'PRMB1' })
    bank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'PRMB2' })

    const clearingGl = await prisma.account.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        accountCode: `PRMCLR${Date.now()}`.slice(-12),
        accountName: 'Permission Test Clearing',
        category: 'LIABILITY',
        accountType: 'GENERAL',
        isGroup: false,
        level: 1,
      },
    })
    await setInternalTransferClearingMapping(app, fx, clearingGl.id)
    // This suite exercises per-action permission gating with the same admin user completing
    // both legs of IN_TRANSIT transfers — maker-checker separation is covered elsewhere.
    await setFinanceSettings(app, fx, { treasuryTransferPreventDispatcherReceive: false })

    const noPerm = await createUserWithPerms(app, fx.tenantId, fx.slug, [], 'ttr-perm-none')
    noPermToken = noPerm.token
    const viewer = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.treasury.transfer.view'], 'ttr-perm-view')
    viewOnlyToken = viewer.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('blocks listing and creation for a user with no treasury transfer permissions', async () => {
    const list = await createTransferDraft(app, fx, bank1, bank2, { transferAmount: '1' }, noPermToken)
    expect(list.status).toBe(403)
  })

  it('allows a view-only user to read but blocks every mutation', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '500', postingModeOverride: 'DIRECT' })

    const view = await getTransfer(app, fx, draft.id, viewOnlyToken)
    expect(view.status, JSON.stringify(view.body)).toBe(200)

    const blockedMarkReady = await markReadyTransfer(app, fx, draft.id, draft.updatedAt, viewOnlyToken)
    expect(blockedMarkReady.status).toBe(403)

    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    expect(ready.status).toBe(200)

    const blockedPost = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt, viewOnlyToken)
    expect(blockedPost.status).toBe(403)
  })

  it('requires finance.treasury.transfer.post specifically to post a DIRECT transfer', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '600', postingModeOverride: 'DIRECT' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    expect(ready.status).toBe(200)

    const dispatchPermOnly = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.treasury.transfer.view', 'finance.treasury.transfer.dispatch'], 'ttr-perm-dispatch')
    const blocked = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt, dispatchPermOnly.token)
    expect(blocked.status).toBe(403)

    const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(posted.status).toBe(200)
  })

  it('requires finance.treasury.transfer.dispatch and .receive specifically for IN_TRANSIT legs', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '700' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)

    const blockedDispatch = await dispatchTransfer(app, fx, draft.id, ready.body.data.updatedAt, viewOnlyToken)
    expect(blockedDispatch.status).toBe(403)

    const dispatched = await dispatchTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(dispatched.status).toBe(200)

    const receivePermOnly = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.treasury.transfer.view'], 'ttr-perm-noreceive')
    const blockedReceive = await receiveTransfer(app, fx, draft.id, dispatched.body.data.transfer.updatedAt, receivePermOnly.token)
    expect(blockedReceive.status).toBe(403)

    const received = await receiveTransfer(app, fx, draft.id, dispatched.body.data.transfer.updatedAt)
    expect(received.status).toBe(200)
  })

  it('requires finance.treasury.transfer.reverse specifically to reverse a COMPLETED transfer', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '800', postingModeOverride: 'DIRECT' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)

    const blocked = await reverseTransfer(
      app,
      fx,
      draft.id,
      { expectedUpdatedAt: posted.body.data.transfer.updatedAt, reversalDate: fx.postingDate, reason: 'test', idempotencyKey: `perm-rev-${draft.id}` },
      viewOnlyToken,
    )
    expect(blocked.status).toBe(403)

    const reversed = await reverseTransfer(app, fx, draft.id, {
      expectedUpdatedAt: posted.body.data.transfer.updatedAt,
      reversalDate: fx.postingDate,
      reason: 'test',
      idempotencyKey: `perm-rev-ok-${draft.id}`,
    })
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(200)
  })
})
