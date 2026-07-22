import request from 'supertest'
import { expect } from 'vitest'
import type { Express } from 'express'
import { prisma } from '../../../src/config/database.js'
import type { ApAllocFixture } from './ap-allocation-fixture.js'
import { createGlAccount } from './bank-reconciliation-fixture.js'
import { createTreasuryAccount, type TreasuryTransferAccount } from './treasury-transfer-fixture.js'

/** Creates a BANK treasury account for treasury adjustment tests. */
export async function createAdjustmentBankAccount(
  app: Express,
  fx: ApAllocFixture,
  opts: { namePrefix?: string; currencyCode?: string } = {},
): Promise<TreasuryTransferAccount> {
  return createTreasuryAccount(app, fx, 'BANK', { namePrefix: opts.namePrefix ?? 'TADJBANK', currencyCode: opts.currencyCode })
}

export interface AdjustmentLineOpts {
  lineType: 'EXPENSE' | 'INCOME' | 'ASSET' | 'LIABILITY' | 'RECOVERABLE_TAX' | 'NON_RECOVERABLE_TAX' | 'TDS_RECEIVABLE' | 'ROUND_OFF' | 'OTHER'
  accountId?: string | null
  mappingKey?: string | null
  description?: string
  amount: string | number
  gstTreatment?: 'GST_APPLICABLE' | 'GST_NOT_APPLICABLE' | 'GST_NON_RECOVERABLE' | 'GST_PENDING_REVIEW'
  gstRate?: string | number | null
  gstAccountId?: string | null
  gstMappingKey?: string | null
  tdsTreatment?: 'TDS_NOT_APPLICABLE' | 'TDS_DEDUCTED' | 'TDS_PENDING_REVIEW'
  tdsRate?: string | number | null
  tdsAccountId?: string | null
  tdsMappingKey?: string | null
  narration?: string
}

export interface CreateAdjustmentOpts {
  adjustmentType:
    | 'BANK_CHARGES'
    | 'BANK_INTEREST_INCOME'
    | 'BANK_INTEREST_EXPENSE'
    | 'COLLECTION_FEE'
    | 'MERCHANT_FEE'
    | 'DIRECT_DEBIT'
    | 'DIRECT_CREDIT'
    | 'STANDING_INSTRUCTION_DEBIT'
    | 'STANDING_INSTRUCTION_CREDIT'
    | 'GST_ADJUSTMENT'
    | 'OTHER_BANK_DEBIT'
    | 'OTHER_BANK_CREDIT'
  direction?: 'BANK_DEBIT' | 'BANK_CREDIT' | null
  adjustmentDate?: string
  currencyCode?: string
  exchangeRate?: string | number
  narration?: string
  internalNote?: string
  approvalRequiredOverride?: boolean
  lines: AdjustmentLineOpts[]
}

export function adjustmentCreateBody(fx: ApAllocFixture, treasuryAccount: { id: string }, opts: CreateAdjustmentOpts) {
  return {
    legalEntityId: fx.legalEntityId,
    treasuryAccountId: treasuryAccount.id,
    adjustmentType: opts.adjustmentType,
    direction: opts.direction,
    adjustmentDate: opts.adjustmentDate ?? fx.documentDate,
    currencyCode: opts.currencyCode ?? 'INR',
    exchangeRate: opts.exchangeRate ?? '1',
    narration: opts.narration,
    internalNote: opts.internalNote,
    approvalRequiredOverride: opts.approvalRequiredOverride,
    lines: opts.lines,
  }
}

export async function createAdjustmentDraft(app: Express, fx: ApAllocFixture, treasuryAccount: { id: string }, opts: CreateAdjustmentOpts, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send(adjustmentCreateBody(fx, treasuryAccount, opts))
}

export async function createReadyAdjustmentDraft(app: Express, fx: ApAllocFixture, treasuryAccount: { id: string }, opts: CreateAdjustmentOpts) {
  const created = await createAdjustmentDraft(app, fx, treasuryAccount, opts)
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  return { id: created.body.data.id as string, updatedAt: created.body.data.updatedAt as string, body: created.body.data }
}

export async function getAdjustment(app: Express, fx: ApAllocFixture, id: string, token?: string) {
  return request(app)
    .get(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
}

export async function listAdjustments(app: Express, fx: ApAllocFixture, query: Record<string, string> = {}, token?: string) {
  return request(app)
    .get(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments`)
    .query({ legalEntityId: fx.legalEntityId, ...query })
    .set('Authorization', `Bearer ${token ?? fx.token}`)
}

export async function updateAdjustment(app: Express, fx: ApAllocFixture, id: string, treasuryAccount: { id: string }, opts: CreateAdjustmentOpts & { expectedUpdatedAt: string }, token?: string) {
  return request(app)
    .patch(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ ...adjustmentCreateBody(fx, treasuryAccount, opts), expectedUpdatedAt: opts.expectedUpdatedAt })
}

export async function markReadyAdjustment(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}/mark-ready`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function submitAdjustment(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}/submit`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function approveAdjustment(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}/approve`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function rejectAdjustment(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, reason: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}/reject`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, reason })
}

export async function reviseAdjustment(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}/revise`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function cancelAdjustment(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, reason: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}/cancel`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, reason })
}

export async function postAdjustment(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, postingDate?: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}/post`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, postingDate })
}

export async function reverseAdjustment(
  app: Express,
  fx: ApAllocFixture,
  id: string,
  body: { expectedUpdatedAt: string; reversalDate: string; reason: string; idempotencyKey: string },
  token?: string,
) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/treasury-adjustments/${id}/reverse`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send(body)
}

/** End-to-end: create → mark-ready (non-approval) → post a treasury adjustment. */
export async function createAndPostAdjustment(app: Express, fx: ApAllocFixture, treasuryAccount: { id: string }, opts: CreateAdjustmentOpts) {
  const draft = await createReadyAdjustmentDraft(app, fx, treasuryAccount, opts)
  const ready = await markReadyAdjustment(app, fx, draft.id, draft.updatedAt)
  expect(ready.status, JSON.stringify(ready.body)).toBe(200)
  const posted = await postAdjustment(app, fx, draft.id, ready.body.data.updatedAt as string, fx.postingDate)
  expect(posted.status, JSON.stringify(posted.body)).toBe(200)
  return posted.body.data as { adjustment: Record<string, unknown>; posting: Record<string, unknown> | null; idempotentReplay: boolean }
}

export async function createGlExpenseAccount(fx: ApAllocFixture, namePrefix = 'TADJEXP') {
  return createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'EXPENSE', category: 'EXPENSE', namePrefix })
}

export async function createGlIncomeAccount(fx: ApAllocFixture, namePrefix = 'TADJINC') {
  return createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'OTHER_INCOME', category: 'INCOME', namePrefix })
}

export async function createGlTaxAccount(fx: ApAllocFixture, namePrefix = 'TADJGST') {
  return createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'GENERAL', category: 'ASSET', namePrefix })
}

export async function setFinanceSettings(app: Express, fx: ApAllocFixture, data: Record<string, unknown>) {
  const res = await request(app)
    .put(`/api/v1/t/${fx.slug}/accounting/settings`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ legalEntityId: fx.legalEntityId, ...data })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.data
}

export async function getGlBalance(tenantId: string, glAccountId: string): Promise<string> {
  const agg = await prisma.generalLedgerEntry.aggregate({
    where: { tenantId, accountId: glAccountId },
    _sum: { debitAmount: true, creditAmount: true },
  })
  const debit = Number(agg._sum.debitAmount ?? 0)
  const credit = Number(agg._sum.creditAmount ?? 0)
  return (debit - credit).toFixed(4)
}
