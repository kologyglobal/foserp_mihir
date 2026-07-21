/**
 * Finance Phase 5B2 — Cheque management foundation: draft creation, calculation/validation
 * fields, counterpart-clearing resolution, and list endpoints. Live MySQL.
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
  createAndSetChequeClearingAccount,
  createChequeBankAccount,
  createChequeDraft,
  getCheque,
} from './helpers/treasury-cheque-fixture.js'
import { createTreasuryAccount, type TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B2 — Cheque management foundation', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'chq-fnd')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createChequeBankAccount(app, fx, { namePrefix: 'FNDBANK' })
    await createAndSetChequeClearingAccount(app, fx, 'CHEQUE_PAYMENT_CLEARING', 'CHQPAYCLR')
    await createAndSetChequeClearingAccount(app, fx, 'CHEQUE_RECEIPT_CLEARING', 'CHQRCVCLR')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('creates an ISSUED-direction draft with a balanced ISSUE accounting preview', async () => {
    const res = await createChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '5000' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const data = res.body.data
    expect(data.status).toBe('DRAFT')
    expect(data.direction).toBe('ISSUED')
    expect(data.draftReference).toMatch(/^CHQ-DRAFT-\d{8}-[0-9A-Z]{6}$/)
    expect(data.chequeRegisterNumber).toBeNull()
    expect(data.validation.isValid).toBe(true)
    expect(data.accountingPreview.step).toBe('ISSUE')
    expect(data.accountingPreview.isBalanced).toBe(true)
    expect(data.accountingPreview.lines).toHaveLength(2)
    expect(data.accountingPreview.lines[0]).toMatchObject({ role: 'COUNTERPART', direction: 'DEBIT' })
    expect(data.accountingPreview.lines[1]).toMatchObject({ role: 'BANK', direction: 'CREDIT', accountId: bank1.glAccountId })
    expect(data.allowedActions.markReady).toBe(true)
    expect(data.allowedActions.issue).toBe(false)

    const fetched = await getCheque(app, fx, data.id)
    expect(fetched.status).toBe(200)
    expect(fetched.body.data.id).toBe(data.id)
  })

  it('creates a RECEIVED-direction draft with a balanced DEPOSIT accounting preview', async () => {
    const res = await createChequeDraft(app, fx, bank1, { direction: 'RECEIVED', amount: '3000' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const data = res.body.data
    expect(data.accountingPreview.step).toBe('DEPOSIT')
    expect(data.accountingPreview.isBalanced).toBe(true)
    expect(data.accountingPreview.lines[0]).toMatchObject({ role: 'BANK', direction: 'DEBIT', accountId: bank1.glAccountId })
    expect(data.accountingPreview.lines[1]).toMatchObject({ role: 'COUNTERPART', direction: 'CREDIT' })
  })

  it('marks a TRACK_ONLY cheque without a counterpart resolution requirement', async () => {
    const res = await createChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '1200', accountingMode: 'TRACK_ONLY' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.validation.isValid).toBe(true)
    expect(res.body.data.isTrackOnly).toBe(true)
    expect(res.body.data.accountingPreview.lines).toHaveLength(0)
  })

  it('flags a currency mismatch as an invalid draft rather than rejecting creation', async () => {
    const usdBank = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'CHQUSD', currencyCode: 'USD' })
    const res = await createChequeDraft(app, fx, usdBank, { direction: 'ISSUED', amount: '100', currencyCode: 'INR' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.validation.isValid).toBe(false)
    const codes = res.body.data.validation.errors.map((e: { code: string }) => e.code)
    expect(codes).toContain('CURRENCY_MISMATCH')
  })

  it('flags a missing PDC maturity date on a post-dated cheque (schema-level)', async () => {
    const res = await createChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '100', isPdc: true, pdcMaturityDate: null })
    expect(res.status, JSON.stringify(res.body)).toBe(400)
  })

  it('accepts a valid PDC with a maturity date', async () => {
    const res = await createChequeDraft(app, fx, bank1, {
      direction: 'ISSUED',
      amount: '100',
      isPdc: true,
      pdcMaturityDate: '2027-01-01',
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.isPdc).toBe(true)
    expect(res.body.data.pdcMaturityDate).toBe('2027-01-01')
  })

  it('flags an inactive treasury account as an invalid draft', async () => {
    const toDeactivate = await createChequeBankAccount(app, fx, { namePrefix: 'CHQDEACT' })
    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${toDeactivate.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    const deactivate = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${toDeactivate.id}/deactivate`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: detail.body.data.updatedAt, reason: 'test deactivation' })
    expect(deactivate.status, JSON.stringify(deactivate.body)).toBe(200)

    const res = await createChequeDraft(app, fx, toDeactivate, { direction: 'ISSUED', amount: '100' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.validation.isValid).toBe(false)
    const codes = res.body.data.validation.errors.map((e: { code: string }) => e.code)
    expect(codes).toContain('ACCOUNT_INACTIVE')
  })

  it('rejects duplicate active cheques with the same number, direction, and date', async () => {
    const chequeNumber = `DUP${Date.now()}`.slice(-9)
    const first = await createChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '500', chequeNumber })
    expect(first.status, JSON.stringify(first.body)).toBe(201)

    const dup = await createChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '600', chequeNumber })
    expect(dup.status, JSON.stringify(dup.body)).toBe(409)
    expect(dup.body.code ?? dup.body.error?.code).toBe('TREASURY_CHEQUE_DUPLICATE')
  })

  it('lists cheques filtered by legal entity, direction, and status', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/cheques`)
      .query({ legalEntityId: fx.legalEntityId, direction: 'ISSUED', status: 'DRAFT', page: 1, limit: 5 })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta.total).toBeGreaterThan(0)
    for (const item of res.body.data as Array<{ direction: string; status: string }>) {
      expect(item.direction).toBe('ISSUED')
      expect(item.status).toBe('DRAFT')
    }
  })

  it('re-runs validation via the validate endpoint', async () => {
    const created = await createChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '750' })
    expect(created.status).toBe(201)
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${created.body.data.id}/validate`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.valid).toBe(true)
    expect(res.body.data.accountingPreview.isBalanced).toBe(true)
  })

  it('updates a draft cheque via PATCH and recalculates the accounting preview', async () => {
    const created = await createChequeDraft(app, fx, bank1, { direction: 'ISSUED', amount: '900' })
    expect(created.status).toBe(201)
    const res = await request(app)
      .patch(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${created.body.data.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        ...created.body.data,
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: bank1.id,
        amount: '1500',
        expectedUpdatedAt: created.body.data.updatedAt,
      })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.amount).toBe('1500.0000')
    expect(res.body.data.accountingPreview.lines[0].amount).toBe('1500.0000')
  })
})
