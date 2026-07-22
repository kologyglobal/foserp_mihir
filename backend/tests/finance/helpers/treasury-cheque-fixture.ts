import request from 'supertest'
import { expect } from 'vitest'
import type { Express } from 'express'
import { prisma } from '../../../src/config/database.js'
import type { ApAllocFixture } from './ap-allocation-fixture.js'
import { createGlAccount } from './bank-reconciliation-fixture.js'
import { createTreasuryAccount, type TreasuryTransferAccount } from './treasury-transfer-fixture.js'

/** Creates a BANK treasury account for cheque tests (reuses the transfer-fixture BANK account helper). */
export async function createChequeBankAccount(
  app: Express,
  fx: ApAllocFixture,
  opts: { namePrefix?: string; currencyCode?: string } = {},
): Promise<TreasuryTransferAccount> {
  return createTreasuryAccount(app, fx, 'BANK', { namePrefix: opts.namePrefix ?? 'CHQBANK', currencyCode: opts.currencyCode })
}

/** Sets the CHEQUE_RECEIPT_CLEARING / CHEQUE_PAYMENT_CLEARING default mapping to an arbitrary GL account. */
export async function setChequeClearingMapping(
  app: Express,
  fx: ApAllocFixture,
  mappingKey: 'CHEQUE_RECEIPT_CLEARING' | 'CHEQUE_PAYMENT_CLEARING',
  glAccountId: string,
): Promise<void> {
  const res = await request(app)
    .put(`/api/v1/t/${fx.slug}/accounting/default-mappings`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ legalEntityId: fx.legalEntityId, mappings: [{ mappingKey, accountId: glAccountId }] })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}

/** Creates + configures a clearing GL account and wires it into the given cheque mapping key. */
export async function createAndSetChequeClearingAccount(
  app: Express,
  fx: ApAllocFixture,
  mappingKey: 'CHEQUE_RECEIPT_CLEARING' | 'CHEQUE_PAYMENT_CLEARING',
  namePrefix: string,
): Promise<string> {
  const gl = await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'GENERAL', category: 'LIABILITY', namePrefix })
  await setChequeClearingMapping(app, fx, mappingKey, gl.id)
  return gl.id
}

export interface CreateChequeOpts {
  direction: 'ISSUED' | 'RECEIVED'
  accountingMode?: 'TRACK_ONLY' | 'POST_ON_LIFECYCLE'
  chequeNumber?: string
  chequeDate?: string
  payeeOrDrawerName?: string
  amount: string | number
  currencyCode?: string
  exchangeRate?: string | number
  isPdc?: boolean
  pdcMaturityDate?: string | null
  counterpartGlAccountId?: string | null
  customerReceiptId?: string | null
  vendorPaymentId?: string | null
  approvalRequiredOverride?: boolean
  narration?: string
}

export function chequeCreateBody(fx: ApAllocFixture, treasuryAccount: { id: string }, opts: CreateChequeOpts) {
  return {
    legalEntityId: fx.legalEntityId,
    treasuryAccountId: treasuryAccount.id,
    direction: opts.direction,
    accountingMode: opts.accountingMode ?? 'POST_ON_LIFECYCLE',
    chequeNumber: opts.chequeNumber ?? `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9),
    chequeDate: opts.chequeDate ?? fx.documentDate,
    payeeOrDrawerName: opts.payeeOrDrawerName ?? 'Test Party',
    currencyCode: opts.currencyCode ?? 'INR',
    exchangeRate: opts.exchangeRate ?? '1',
    amount: opts.amount,
    isPdc: opts.isPdc ?? false,
    pdcMaturityDate: opts.pdcMaturityDate,
    counterpartGlAccountId: opts.counterpartGlAccountId,
    customerReceiptId: opts.customerReceiptId,
    vendorPaymentId: opts.vendorPaymentId,
    approvalRequiredOverride: opts.approvalRequiredOverride,
    narration: opts.narration,
  }
}

export async function createChequeDraft(app: Express, fx: ApAllocFixture, treasuryAccount: { id: string }, opts: CreateChequeOpts, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send(chequeCreateBody(fx, treasuryAccount, opts))
}

export async function createReadyChequeDraft(app: Express, fx: ApAllocFixture, treasuryAccount: { id: string }, opts: CreateChequeOpts) {
  const created = await createChequeDraft(app, fx, treasuryAccount, opts)
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  return { id: created.body.data.id as string, updatedAt: created.body.data.updatedAt as string, body: created.body.data }
}

export async function getCheque(app: Express, fx: ApAllocFixture, id: string, token?: string) {
  return request(app)
    .get(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
}

export async function markReadyCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/mark-ready`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function submitCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/submit`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function approveCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/approve`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function rejectCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, reason: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/reject`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, reason })
}

export async function reviseCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/revise`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function cancelCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, reason: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/cancel`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, reason })
}

export async function issueCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, issueDate?: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/issue`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, issueDate })
}

export async function depositCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, depositDate: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/deposit`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, depositDate })
}

export async function clearCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, clearanceDate: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/clear`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, clearanceDate })
}

export async function bounceCheque(
  app: Express,
  fx: ApAllocFixture,
  id: string,
  expectedUpdatedAt: string,
  bounceDate: string,
  bounceReason: string,
  token?: string,
) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/bounce`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, bounceDate, bounceReason })
}

export async function stopCheque(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, stopReason: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/stop`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, stopReason })
}

export async function reverseCheque(
  app: Express,
  fx: ApAllocFixture,
  id: string,
  body: { expectedUpdatedAt: string; reversalDate: string; reason: string; idempotencyKey: string },
  token?: string,
) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/cheques/${id}/reverse`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send(body)
}

/** End-to-end: create → mark-ready → issue an ISSUED-direction cheque. */
export async function createAndIssueCheque(app: Express, fx: ApAllocFixture, treasuryAccount: { id: string }, opts: CreateChequeOpts) {
  const draft = await createReadyChequeDraft(app, fx, treasuryAccount, { ...opts, direction: 'ISSUED' })
  const ready = await markReadyCheque(app, fx, draft.id, draft.updatedAt)
  expect(ready.status, JSON.stringify(ready.body)).toBe(200)
  const issued = await issueCheque(app, fx, draft.id, ready.body.data.updatedAt as string)
  expect(issued.status, JSON.stringify(issued.body)).toBe(200)
  return issued.body.data as { cheque: Record<string, unknown>; posting: Record<string, unknown> | null; idempotentReplay: boolean }
}

/** End-to-end: create → mark-ready → deposit a RECEIVED-direction cheque. */
export async function createAndDepositCheque(app: Express, fx: ApAllocFixture, treasuryAccount: { id: string }, opts: CreateChequeOpts) {
  const draft = await createReadyChequeDraft(app, fx, treasuryAccount, { ...opts, direction: 'RECEIVED' })
  const ready = await markReadyCheque(app, fx, draft.id, draft.updatedAt)
  expect(ready.status, JSON.stringify(ready.body)).toBe(200)
  const deposited = await depositCheque(app, fx, draft.id, ready.body.data.updatedAt as string, fx.postingDate)
  expect(deposited.status, JSON.stringify(deposited.body)).toBe(200)
  return deposited.body.data as { cheque: Record<string, unknown>; posting: Record<string, unknown> | null; idempotentReplay: boolean }
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
