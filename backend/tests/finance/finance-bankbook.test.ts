/**
 * Finance Phase 5B3 — Read-only GL-based bankbook/cashbook: opening/closing/running balance,
 * date-range filtering, account-type guard, and CSV export. Live MySQL.
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
import { createAdjustmentBankAccount, createAndPostAdjustment, createGlExpenseAccount } from './helpers/treasury-adjustment-fixture.js'
import { createTreasuryAccount, type TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Bankbook / cashbook', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let cash1: TreasuryTransferAccount
  let expenseGl: { id: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-book')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'BOOKBANK' })
    cash1 = await createTreasuryAccount(app, fx, 'CASH', { namePrefix: 'BOOKCASH' })
    expenseGl = await createGlExpenseAccount(fx, 'BOOKEXP')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  async function getBankbook(query: Record<string, string>) {
    return request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/books/bankbook`)
      .query({ legalEntityId: fx.legalEntityId, ...query })
      .set('Authorization', `Bearer ${fx.token}`)
  }

  async function getCashbook(query: Record<string, string>) {
    return request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/books/cashbook`)
      .query({ legalEntityId: fx.legalEntityId, ...query })
      .set('Authorization', `Bearer ${fx.token}`)
  }

  it('returns an empty bankbook with zero opening/closing balance before any postings', async () => {
    const res = await getBankbook({ treasuryAccountId: bank1.id })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(Number(res.body.data.openingBalance)).toBe(0)
    expect(res.body.data.entries).toEqual([])
    expect(res.body.data.closingBalance).toBe(res.body.data.openingBalance)
  })

  it('reflects a posted BANK_CHARGES treasury adjustment in the bankbook with correct running/closing balance', async () => {
    const posted = await createAndPostAdjustment(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      direction: 'BANK_DEBIT',
      narration: 'Bankbook test — bank charges',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '100' }],
    })
    expect(posted.adjustment.status).toBe('POSTED')

    const res = await getBankbook({ treasuryAccountId: bank1.id })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.entries.length).toBeGreaterThanOrEqual(1)
    expect(Number(res.body.data.closingBalance)).toBeLessThanOrEqual(-100)

    const lastEntry = res.body.data.entries[res.body.data.entries.length - 1]
    expect(Number(lastEntry.runningBalance)).toBe(Number(res.body.data.closingBalance))
    expect(Number(lastEntry.creditAmount)).toBeGreaterThan(0)
  })

  it('reflects a posted treasury adjustment against a CASH treasury account in the cashbook', async () => {
    const posted = await createAndPostAdjustment(app, fx, cash1, {
      adjustmentType: 'DIRECT_DEBIT',
      direction: 'BANK_DEBIT',
      narration: 'Cashbook test — direct debit',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '50' }],
    })
    expect(posted.adjustment.status).toBe('POSTED')

    const res = await getCashbook({ treasuryAccountId: cash1.id })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.entries.length).toBeGreaterThanOrEqual(1)
    expect(Number(res.body.data.closingBalance)).toBeLessThanOrEqual(-50)
  })

  it('rejects fetching a CASH account through the bankbook endpoint (account-type guard)', async () => {
    const res = await getBankbook({ treasuryAccountId: cash1.id })
    expect(res.status, JSON.stringify(res.body)).toBe(400)
    expect(res.body.code).toBe('TREASURY_BOOK_ACCOUNT_TYPE_MISMATCH')
  })

  it('rejects fetching a BANK account through the cashbook endpoint (account-type guard)', async () => {
    const res = await getCashbook({ treasuryAccountId: bank1.id })
    expect(res.status, JSON.stringify(res.body)).toBe(400)
    expect(res.body.code).toBe('TREASURY_BOOK_ACCOUNT_TYPE_MISMATCH')
  })

  it('returns 404 for a treasury account that does not exist', async () => {
    const res = await getBankbook({ treasuryAccountId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status, JSON.stringify(res.body)).toBe(404)
  })

  it('excludes postings before dateFrom from entries but includes them in the opening balance', async () => {
    const futureDate = new Date()
    futureDate.setUTCDate(futureDate.getUTCDate() + 1)
    const dateFrom = futureDate.toISOString().slice(0, 10)

    const res = await getBankbook({ treasuryAccountId: bank1.id, dateFrom })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.entries.length).toBe(0)
    expect(Number(res.body.data.openingBalance)).toBeLessThanOrEqual(-100)
    expect(res.body.data.closingBalance).toBe(res.body.data.openingBalance)
  })

  it('exports the bankbook as CSV with account header, opening balance, and closing balance rows', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/books/bankbook/export`)
      .query({ legalEntityId: fx.legalEntityId, treasuryAccountId: bank1.id })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status, res.text).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('Opening Balance')
    expect(res.text).toContain('Closing Balance')
    expect(res.text).toContain('Posting Date,Voucher Number')
  })

  it('exports the cashbook as CSV', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/books/cashbook/export`)
      .query({ legalEntityId: fx.legalEntityId, treasuryAccountId: cash1.id })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status, res.text).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('Opening Balance')
  })
})
