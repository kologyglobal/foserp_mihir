/**
 * Finance Phase 5B3 — Tenant isolation: tenant B's valid token/slug cannot read or act on
 * tenant A's treasury adjustments, standing instructions, or bank posting rules, even by
 * guessing a valid id. Live MySQL.
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
  createAdjustmentBankAccount,
  createAdjustmentDraft,
  createGlExpenseAccount,
  createReadyAdjustmentDraft,
  getAdjustment,
  markReadyAdjustment,
  postAdjustment,
} from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Tenant isolation', () => {
  let fxA: ApAllocFixture
  let fxB: ApAllocFixture
  let bankA: TreasuryTransferAccount
  let expenseGlA: { id: string }
  let adjustmentId: string
  let adjustmentUpdatedAt: string
  let ruleIdA: string
  let siIdA: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctxA = await createFinanceAdminTenant(app, 'tadj-tenA')
    fxA = await bootstrapApAllocFixture(app, ctxA)
    const ctxB = await createFinanceAdminTenant(app, 'tadj-tenB')
    fxB = await bootstrapApAllocFixture(app, ctxB)

    bankA = await createAdjustmentBankAccount(app, fxA, { namePrefix: 'TENAB' })
    expenseGlA = await createGlExpenseAccount(fxA, 'TENAEXP')

    const draft = await createReadyAdjustmentDraft(app, fxA, bankA, {
      adjustmentType: 'BANK_CHARGES',
      direction: 'BANK_DEBIT',
      narration: 'tenant isolation test',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGlA.id, amount: '100' }],
    })
    adjustmentId = draft.id
    adjustmentUpdatedAt = draft.updatedAt

    const ruleRes = await request(app)
      .post(`/api/v1/t/${fxA.slug}/accounting/treasury/bank-posting-rules`)
      .set('Authorization', `Bearer ${fxA.token}`)
      .send({
        legalEntityId: fxA.legalEntityId,
        treasuryAccountId: bankA.id,
        name: 'Tenant A rule',
        isActive: true,
        priority: 100,
        keywordPatterns: ['tenant a keyword'],
        adjustmentType: 'BANK_CHARGES',
        lineTemplate: { lineType: 'EXPENSE', accountId: expenseGlA.id },
      })
    expect(ruleRes.status, JSON.stringify(ruleRes.body)).toBe(201)
    ruleIdA = ruleRes.body.data.id

    const siRes = await request(app)
      .post(`/api/v1/t/${fxA.slug}/accounting/treasury/standing-instructions`)
      .set('Authorization', `Bearer ${fxA.token}`)
      .send({
        legalEntityId: fxA.legalEntityId,
        treasuryAccountId: bankA.id,
        name: 'Tenant A SI',
        adjustmentType: 'BANK_CHARGES',
        direction: 'BANK_DEBIT',
        frequency: 'MONTHLY',
        amountMode: 'FIXED',
        fixedAmount: '75',
        startDate: fxA.documentDate,
        lineTemplate: { lineType: 'EXPENSE', accountId: expenseGlA.id },
      })
    expect(siRes.status, JSON.stringify(siRes.body)).toBe(201)
    siIdA = siRes.body.data.id
  }, 180_000)

  afterAll(async () => {
    if (fxA?.tenantId) await cleanupTenant(fxA.tenantId)
    if (fxB?.tenantId) await cleanupTenant(fxB.tenantId)
  })

  it('cannot read tenant A treasury adjustment via tenant B credentials', async () => {
    const res = await getAdjustment(app, fxB, adjustmentId)
    expect(res.status).toBe(404)
  })

  it('cannot mark-ready or post tenant A treasury adjustment via tenant B credentials', async () => {
    const markReady = await markReadyAdjustment(app, fxB, adjustmentId, adjustmentUpdatedAt)
    expect(markReady.status).toBe(404)

    const posted = await postAdjustment(app, fxB, adjustmentId, adjustmentUpdatedAt, fxB.postingDate)
    expect(posted.status).toBe(404)

    const stillDraft = await prisma.treasuryAdjustment.findFirstOrThrow({ where: { id: adjustmentId, tenantId: fxA.tenantId } })
    expect(stillDraft.status).toBe('DRAFT')
  })

  it("cannot create a treasury adjustment referencing tenant A's treasury account via tenant B", async () => {
    const res = await createAdjustmentDraft(app, fxB, bankA, {
      adjustmentType: 'BANK_CHARGES',
      direction: 'BANK_DEBIT',
      narration: 'cross-tenant attempt',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGlA.id, amount: '10' }],
    })
    expect(res.status).toBe(404)
  })

  it("tenant B's treasury adjustment list never contains tenant A's adjustment id", async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/treasury/treasury-adjustments`)
      .query({ legalEntityId: fxB.legalEntityId })
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.some((row: { id: string }) => row.id === adjustmentId)).toBe(false)
  })

  it('cannot read or classify against tenant A bank posting rule via tenant B credentials', async () => {
    const getRes = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/treasury/bank-posting-rules/${ruleIdA}`)
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(getRes.status).toBe(404)

    const listRes = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/treasury/bank-posting-rules`)
      .query({ legalEntityId: fxB.legalEntityId })
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(listRes.status, JSON.stringify(listRes.body)).toBe(200)
    expect(listRes.body.data.some((row: { id: string }) => row.id === ruleIdA)).toBe(false)
  })

  it('cannot read tenant A standing instruction via tenant B credentials', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/treasury/standing-instructions/${siIdA}`)
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(res.status).toBe(404)

    const pauseRes = await request(app)
      .post(`/api/v1/t/${fxB.slug}/accounting/treasury/standing-instructions/${siIdA}/pause`)
      .set('Authorization', `Bearer ${fxB.token}`)
      .send({ expectedUpdatedAt: new Date().toISOString() })
    expect(pauseRes.status).toBe(404)
  })

  it("cannot fetch tenant A's bankbook via tenant B credentials", async () => {
    const res = await request(app)
      .get(`/api/v1/t/${fxB.slug}/accounting/treasury/books/bankbook`)
      .query({ legalEntityId: fxB.legalEntityId, treasuryAccountId: bankA.id })
      .set('Authorization', `Bearer ${fxB.token}`)
    expect(res.status).toBe(404)
  })
})
