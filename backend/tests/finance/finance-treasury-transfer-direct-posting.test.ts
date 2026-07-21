/**
 * Finance Phase 5B1 — Direct posting: BANK_TO_BANK forced into DIRECT mode via
 * `postingModeOverride`, single `post()` call (Dr destination / Cr source), TTR/ numbering,
 * and no AR/AP side effects. Live MySQL.
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
  fundTreasuryAccount,
  markReadyTransfer,
  postDirectTransfer,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — Direct posting', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let bank2: TreasuryTransferAccount

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ttr-dir')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'DIRB1' })
    bank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'DIRB2' })
    await fundTreasuryAccount(app, fx, bank1, '1000000')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('posts a BANK_TO_BANK transfer directly when overridden, Dr destination / Cr source', async () => {
    const arCountBefore = await prisma.payableOpenItem.count({ where: { tenantId: fx.tenantId } })
    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })

    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, {
      transferAmount: '15000',
      postingModeOverride: 'DIRECT',
    })
    expect(draft.postingMode).toBe('DIRECT')

    const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
    expect(ready.status, JSON.stringify(ready.body)).toBe(200)
    expect(ready.body.data.status).toBe('READY_TO_POST')
    expect(ready.body.data.allowedActions.post).toBe(true)

    const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt)
    expect(posted.status, JSON.stringify(posted.body)).toBe(200)
    const { transfer, posting, idempotentReplay } = posted.body.data
    expect(idempotentReplay).toBe(false)
    expect(transfer.status).toBe('COMPLETED')
    expect(transfer.transferNumber).toMatch(/^TTR\//)
    expect(transfer.sourceVoucherId).toBe(transfer.destinationVoucherId)
    expect(posting.voucherStatus).toBe('POSTED')
    expect(posting.totalDebit).toBe('15000.0000')
    expect(posting.totalCredit).toBe('15000.0000')

    const lines = await prisma.accountingVoucherLine.findMany({
      where: { voucherId: posting.voucherId, tenantId: fx.tenantId },
      orderBy: { lineNumber: 'asc' },
    })
    expect(lines).toHaveLength(2)
    expect(lines[0].accountId).toBe(bank2.glAccountId)
    expect(lines[0].debitAmount.toFixed(4)).toBe('15000.0000')
    expect(lines[1].accountId).toBe(bank1.glAccountId)
    expect(lines[1].creditAmount.toFixed(4)).toBe('15000.0000')

    const glEntries = await prisma.generalLedgerEntry.findMany({ where: { voucherId: posting.voucherId, tenantId: fx.tenantId } })
    expect(glEntries).toHaveLength(2)
    for (const entry of glEntries) {
      expect(entry.sourceDocumentType).toBe('TREASURY_TRANSFER')
      expect(entry.sourceDocumentId).toBe(transfer.id)
    }

    const voucher = await prisma.accountingVoucher.findFirstOrThrow({ where: { id: posting.voucherId, tenantId: fx.tenantId } })
    expect(voucher.voucherType).toBe('SYSTEM')
    expect(voucher.referenceNumber).toBe(transfer.transferNumber)

    // No AR/AP side effects from an internal treasury transfer.
    expect(await prisma.payableOpenItem.count({ where: { tenantId: fx.tenantId } })).toBe(arCountBefore)
    expect(await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })).toBe(voucherCountBefore + 1)

    const series = await prisma.financeNumberSeries.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId, documentType: 'TREASURY_TRANSFER' },
    })
    expect(series?.prefix).toBe('TTR/')
    expect(series?.currentValue).toBeGreaterThanOrEqual(1)
  })

  it('blocks posting a DRAFT transfer that has not been marked ready', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '500', postingModeOverride: 'DIRECT' })
    const res = await postDirectTransfer(app, fx, draft.id, draft.updatedAt)
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.code ?? res.body.error?.code).toBe('TREASURY_TRANSFER_NOT_READY_TO_POST')
  })

  it('rejects a stale expectedUpdatedAt on mark-ready with a conflict', async () => {
    const draft = await createReadyTransferDraft(app, fx, bank1, bank2, { transferAmount: '500', postingModeOverride: 'DIRECT' })
    const stale = new Date(new Date(draft.updatedAt).getTime() - 1000).toISOString()
    const res = await markReadyTransfer(app, fx, draft.id, stale)
    expect(res.status, JSON.stringify(res.body)).toBe(409)
  })
})
