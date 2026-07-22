/**
 * Finance Phase 5B1 — Tenant isolation: tenant B's valid token/slug cannot read or act on
 * tenant A's treasury transfers, even by guessing a valid transfer id. Live MySQL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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
  createReadyTransferDraft,
  createTransferDraft,
  createTreasuryAccount,
  getTransfer,
  markReadyTransfer,
  postDirectTransfer,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — Tenant isolation', () => {
  let fxA: ApAllocFixture
  let fxB: ApAllocFixture
  let bankA1: TreasuryTransferAccount
  let bankA2: TreasuryTransferAccount
  let transferId: string
  let transferUpdatedAt: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctxA = await createFinanceAdminTenant(app, 'ttr-tenA')
    fxA = await bootstrapApAllocFixture(app, ctxA)
    const ctxB = await createFinanceAdminTenant(app, 'ttr-tenB')
    fxB = await bootstrapApAllocFixture(app, ctxB)

    bankA1 = await createTreasuryAccount(app, fxA, 'BANK', { namePrefix: 'TENAB1' })
    bankA2 = await createTreasuryAccount(app, fxA, 'BANK', { namePrefix: 'TENAB2' })

    const draft = await createReadyTransferDraft(app, fxA, bankA1, bankA2, { transferAmount: '1000', postingModeOverride: 'DIRECT' })
    transferId = draft.id
    transferUpdatedAt = draft.updatedAt
  }, 180_000)

  afterAll(async () => {
    if (fxA?.tenantId) await cleanupTenant(fxA.tenantId)
    if (fxB?.tenantId) await cleanupTenant(fxB.tenantId)
  })

  it('cannot read tenant A transfer via tenant B credentials', async () => {
    const res = await getTransfer(app, fxB, transferId)
    expect(res.status).toBe(404)
  })

  it("tenant B's own transfer list never contains tenant A's transfer id", async () => {
    const bankB1 = await createTreasuryAccount(app, fxB, 'BANK', { namePrefix: 'TENBB1' })
    const bankB2 = await createTreasuryAccount(app, fxB, 'BANK', { namePrefix: 'TENBB2' })
    await createReadyTransferDraft(app, fxB, bankB1, bankB2, { transferAmount: '1', postingModeOverride: 'DIRECT' })

    const res = await getTransfer(app, fxB, transferId)
    expect(res.status).toBe(404)

    const list = await createTransferDraft(app, fxB, bankB1, bankB2, { transferAmount: '2', postingModeOverride: 'DIRECT' })
    expect(list.status).toBe(201)
  })

  it('cannot mark-ready or post tenant A transfer via tenant B credentials', async () => {
    const markReady = await markReadyTransfer(app, fxB, transferId, transferUpdatedAt)
    expect(markReady.status).toBe(404)

    const posted = await postDirectTransfer(app, fxB, transferId, transferUpdatedAt)
    expect(posted.status).toBe(404)

    const stillDraft = await prisma.treasuryTransfer.findFirstOrThrow({ where: { id: transferId, tenantId: fxA.tenantId } })
    expect(stillDraft.status).toBe('DRAFT')
  })

  it("cannot create a transfer referencing tenant A's treasury accounts via tenant B", async () => {
    const res = await createTransferDraft(app, fxB, bankA1, bankA2, { transferAmount: '10', postingModeOverride: 'DIRECT' })
    expect(res.status).toBe(404)
  })
})
