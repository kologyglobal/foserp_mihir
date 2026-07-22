/**
 * Finance Phase 5B1 — Treasury transfer foundation: draft creation, calculation/validation
 * fields, clearing-account resolution, and list endpoints. Live MySQL.
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
  createTransferDraft,
  createTreasuryAccount,
  getTransfer,
  setInternalTransferClearingMapping,
  type TreasuryTransferAccount,
} from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B1 — Treasury transfer foundation', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let bank2: TreasuryTransferAccount
  let cash1: TreasuryTransferAccount

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ttr-fnd')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'BANK1' })
    bank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'BANK2' })
    cash1 = await createTreasuryAccount(app, fx, 'CASH', { namePrefix: 'CASH1' })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('creates a BANK_TO_CASH draft with DIRECT recommendation and a balanced accounting preview', async () => {
    const res = await createTransferDraft(app, fx, bank1, cash1, { transferAmount: '5000' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const data = res.body.data
    expect(data.transferType).toBe('BANK_TO_CASH')
    expect(data.postingMode).toBe('DIRECT')
    expect(data.status).toBe('DRAFT')
    expect(data.draftReference).toMatch(/^TTR-DRAFT-\d{8}-[0-9A-Z]{6}$/)
    expect(data.transferNumber).toBeNull()
    expect(data.validation.isValid).toBe(true)
    expect(data.accountingPreview.isBalanced).toBe(true)
    expect(data.accountingPreview.lines).toHaveLength(2)
    expect(data.accountingPreview.lines[0]).toMatchObject({ role: 'DESTINATION', direction: 'DEBIT', accountId: cash1.glAccountId })
    expect(data.accountingPreview.lines[1]).toMatchObject({ role: 'SOURCE', direction: 'CREDIT', accountId: bank1.glAccountId })
    expect(data.allowedActions.markReady).toBe(true)
    expect(data.allowedActions.submit).toBe(false)
    expect(data.allowedActions.post).toBe(false)

    const fetched = await getTransfer(app, fx, data.id)
    expect(fetched.status).toBe(200)
    expect(fetched.body.data.id).toBe(data.id)
  })

  it('fails BANK_TO_BANK draft creation with a clearing-account-missing error before any clearing is configured', async () => {
    const freshBank1 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'NOCLR1' })
    const freshBank2 = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'NOCLR2' })
    const res = await createTransferDraft(app, fx, freshBank1, freshBank2, { transferAmount: '1000' })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.code ?? res.body.error?.code).toBe('TREASURY_TRANSFER_CLEARING_ACCOUNT_MISSING')
  })

  it('resolves the in-transit clearing account via the INTERNAL_TRANSFER_CLEARING default mapping once configured', async () => {
    const clearingGl = await prisma.account.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        accountCode: `TTRCLR${Date.now()}`.slice(-12),
        accountName: 'Internal Transfer Clearing',
        category: 'LIABILITY',
        accountType: 'GENERAL',
        isGroup: false,
        level: 1,
      },
    })
    await setInternalTransferClearingMapping(app, fx, clearingGl.id)

    const res = await createTransferDraft(app, fx, bank1, bank2, { transferAmount: '2500' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.transferType).toBe('BANK_TO_BANK')
    expect(res.body.data.postingMode).toBe('IN_TRANSIT')
    expect(res.body.data.validation.modeRecommendation.forced).toBe(false)
    expect(res.body.data.accountingPreview.step).toBe('DISPATCH')
    expect(res.body.data.accountingPreview.lines[0]).toMatchObject({ role: 'CLEARING', direction: 'DEBIT', accountId: clearingGl.id })
    expect(res.body.data.accountingPreview.lines[1]).toMatchObject({ role: 'SOURCE', direction: 'CREDIT', accountId: bank1.glAccountId })
  })

  it('rejects a draft where source and destination are the same account (schema-level)', async () => {
    const res = await createTransferDraft(app, fx, bank1, bank1, { transferAmount: '1000' })
    expect(res.status).toBe(400)
  })

  it('flags a currency mismatch as an invalid draft rather than rejecting creation', async () => {
    const usdBank = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'USDBANK', currencyCode: 'USD' })
    const res = await createTransferDraft(app, fx, bank1, usdBank, { transferAmount: '100', currencyCode: 'INR' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.validation.isValid).toBe(false)
    const codes = res.body.data.validation.errors.map((e: { code: string }) => e.code)
    expect(codes).toContain('CURRENCY_MISMATCH')
  })

  it('flags an inactive destination account as an invalid draft', async () => {
    const toDeactivate = await createTreasuryAccount(app, fx, 'BANK', { namePrefix: 'DEACT' })
    const detail = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${toDeactivate.id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    const deactivate = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${toDeactivate.id}/deactivate`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: detail.body.data.updatedAt, reason: 'test deactivation' })
    expect(deactivate.status, JSON.stringify(deactivate.body)).toBe(200)

    const res = await createTransferDraft(app, fx, bank1, toDeactivate, { transferAmount: '100' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.validation.isValid).toBe(false)
    const codes = res.body.data.validation.errors.map((e: { code: string }) => e.code)
    expect(codes).toContain('ACCOUNT_INACTIVE')
  })

  it('lists transfers filtered by legal entity and paginates results', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/transfers`)
      .query({ legalEntityId: fx.legalEntityId, page: 1, limit: 5 })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta.total).toBeGreaterThan(0)
  })

  it('lists only IN_TRANSIT transfers on the /in-transit endpoint', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/in-transit`)
      .query({ legalEntityId: fx.legalEntityId })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    for (const item of res.body.data as Array<{ status: string }>) {
      expect(item.status).toBe('IN_TRANSIT')
    }
  })

  it('re-runs validation via the validate endpoint', async () => {
    const created = await createTransferDraft(app, fx, bank1, cash1, { transferAmount: '750' })
    expect(created.status).toBe(201)
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${created.body.data.id}/validate`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.valid).toBe(true)
    expect(res.body.data.accountingPreview.isBalanced).toBe(true)
  })
})
