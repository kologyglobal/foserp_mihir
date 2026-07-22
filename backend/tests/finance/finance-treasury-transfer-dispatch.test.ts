/**
 * Finance Phase 5B1 — In-transit dispatch + receipt: BANK_TO_BANK (natural IN_TRANSIT
 * recommendation) dispatches Dr clearing / Cr source, then receipt Dr destination / Cr clearing,
 * with the clearing GL account netting to zero once received. Live MySQL.
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
  createReadyTransferDraft,
  createTreasuryAccount,
  dispatchTransfer,
  fundTreasuryAccount,
  getGlBalance,
  markReadyTransfer,
  receiveTransfer,
  setFinanceSettings,
  setInternalTransferClearingMapping,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — In-transit dispatch and receipt', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let bank2: TreasuryTransferAccount
  let clearingGlAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ttr-dsp')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'DSPB1' })
    bank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'DSPB2' })
    await fundTreasuryAccount(app, fx, bank1, '1000000')

    const clearingGl = await prisma.account.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        accountCode: `DSPCLR${Date.now()}`.slice(-12),
        accountName: 'Dispatch Clearing',
        category: 'LIABILITY',
        accountType: 'GENERAL',
        isGroup: false,
        level: 1,
      },
    })
    clearingGlAccountId = clearingGl.id
    await setInternalTransferClearingMapping(app, fx, clearingGlAccountId)
    // This suite exercises dispatch/receive mechanics with a single test user — maker-checker
    // dispatcher/receiver separation is covered separately in the workflow/permissions suites.
    await setFinanceSettings(app, fx, { treasuryTransferPreventDispatcherReceive: false })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('dispatches to IN_TRANSIT (Dr clearing / Cr source) then receives to COMPLETED (Dr destination / Cr clearing)', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '20000' })
    expect(draft.postingMode).toBe('IN_TRANSIT')

    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    expect(ready.status, JSON.stringify(ready.body)).toBe(200)
    expect(ready.body.data.allowedActions.dispatch).toBe(true)
    expect(ready.body.data.allowedActions.post).toBe(false)

    const dispatched = await dispatchTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(dispatched.status, JSON.stringify(dispatched.body)).toBe(200)
    expect(dispatched.body.data.transfer.status).toBe('IN_TRANSIT')
    expect(dispatched.body.data.transfer.transferNumber).toMatch(/^TTR\//)
    expect(dispatched.body.data.idempotentReplay).toBe(false)

    const dispatchVoucherId = dispatched.body.data.posting.voucherId as string
    const dispatchLines = await prisma.accountingVoucherLine.findMany({
      where: { voucherId: dispatchVoucherId, tenantId: fx.tenantId },
      orderBy: { lineNumber: 'asc' },
    })
    expect(dispatchLines).toHaveLength(2)
    expect(dispatchLines[0].accountId).toBe(clearingGlAccountId)
    expect(dispatchLines[0].debitAmount.toFixed(4)).toBe('20000.0000')
    expect(dispatchLines[1].accountId).toBe(bank1.glAccountId)
    expect(dispatchLines[1].creditAmount.toFixed(4)).toBe('20000.0000')

    expect(await getGlBalance(fx.tenantId, clearingGlAccountId)).toBe('20000.0000')

    const inTransitList = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/in-transit`)
      .query({ legalEntityId: fx.legalEntityId })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(inTransitList.body.data.some((t: { id: string }) => t.id === draft.id)).toBe(true)

    const received = await receiveTransfer(app, fx, draft.id, dispatched.body.data.transfer.updatedAt)
    expect(received.status, JSON.stringify(received.body)).toBe(200)
    expect(received.body.data.transfer.status).toBe('COMPLETED')
    expect(received.body.data.idempotentReplay).toBe(false)

    const receiveVoucherId = received.body.data.posting.voucherId as string
    const receiveLines = await prisma.accountingVoucherLine.findMany({
      where: { voucherId: receiveVoucherId, tenantId: fx.tenantId },
      orderBy: { lineNumber: 'asc' },
    })
    expect(receiveLines).toHaveLength(2)
    expect(receiveLines[0].accountId).toBe(bank2.glAccountId)
    expect(receiveLines[0].debitAmount.toFixed(4)).toBe('20000.0000')
    expect(receiveLines[1].accountId).toBe(clearingGlAccountId)
    expect(receiveLines[1].creditAmount.toFixed(4)).toBe('20000.0000')

    // Clearing account nets to zero once the receive leg settles it.
    expect(await getGlBalance(fx.tenantId, clearingGlAccountId)).toBe('0.0000')

    const finalTransfer = await prisma.treasuryTransfer.findFirstOrThrow({ where: { id: draft.id, tenantId: fx.tenantId } })
    expect(finalTransfer.sourceVoucherId).toBe(dispatchVoucherId)
    expect(finalTransfer.destinationVoucherId).toBe(receiveVoucherId)
  })

  it('blocks receiving a transfer that has not been dispatched', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '300' })
    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    expect(ready.status).toBe(200)
    const res = await receiveTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.code ?? res.body.error?.code).toBe('TREASURY_TRANSFER_NOT_IN_TRANSIT')
  })
})
