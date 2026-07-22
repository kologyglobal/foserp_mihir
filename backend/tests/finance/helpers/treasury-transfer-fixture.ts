import request from 'supertest'
import { expect } from 'vitest'
import type { Express } from 'express'
import { prisma } from '../../../src/config/database.js'
import type { ApAllocFixture } from './ap-allocation-fixture.js'
import { createGlAccount, postJournal } from './bank-reconciliation-fixture.js'

export interface TreasuryTransferAccount {
  id: string
  glAccountId: string
  accountType: 'BANK' | 'CASH' | 'CLEARING'
  currencyCode: string
}

/** Creates a BANK, CASH, or CLEARING treasury account (+ backing GL account) for transfer tests. */
export async function createTreasuryAccount(
  app: Express,
  fx: ApAllocFixture,
  accountType: 'BANK' | 'CASH' | 'CLEARING',
  opts: { namePrefix?: string; branchId?: string | null; currencyCode?: string; code?: string } = {},
): Promise<TreasuryTransferAccount> {
  const glAccountType = accountType === 'CLEARING' ? 'GENERAL' : accountType
  const glCategory = accountType === 'CLEARING' ? 'LIABILITY' : 'ASSET'
  const gl = await createGlAccount(fx.tenantId, fx.legalEntityId, {
    accountType: glAccountType,
    category: glCategory,
    namePrefix: opts.namePrefix ?? `TT${accountType}`,
  })

  const res = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      branchId: opts.branchId ?? undefined,
      code: opts.code ?? `TTR-${accountType}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `Treasury Transfer Test ${accountType}`,
      accountType,
      glAccountId: gl.id,
      currencyCode: opts.currencyCode ?? 'INR',
      bankProfile: accountType === 'BANK' ? { bankName: 'Treasury Test Bank', bankAccountKind: 'CURRENT' } : undefined,
    })
  expect(res.status, JSON.stringify(res.body)).toBe(201)

  return {
    id: res.body.data.id as string,
    glAccountId: gl.id,
    accountType,
    currencyCode: res.body.data.currencyCode as string,
  }
}

/** Posts a balancing journal (Dr treasury GL / Cr a throwaway income account) to fund an account's opening GL balance. */
export async function fundTreasuryAccount(
  app: Express,
  fx: ApAllocFixture,
  treasuryAccount: TreasuryTransferAccount,
  amount: string | number,
): Promise<void> {
  const fundingGl = await createGlAccount(fx.tenantId, fx.legalEntityId, {
    accountType: 'OTHER_INCOME',
    category: 'INCOME',
    namePrefix: 'TTFUND',
  })
  await postJournal(
    app,
    fx,
    [
      { accountId: treasuryAccount.glAccountId, debitAmount: String(amount) },
      { accountId: fundingGl.id, creditAmount: String(amount) },
    ],
    { narration: 'Treasury transfer test — opening funding' },
  )
}

/** Sets the `INTERNAL_TRANSFER_CLEARING` default mapping to an arbitrary GL account (simpler alternative to a CLEARING treasury account). */
export async function setInternalTransferClearingMapping(app: Express, fx: ApAllocFixture, glAccountId: string): Promise<void> {
  const res = await request(app)
    .put(`/api/v1/t/${fx.slug}/accounting/default-mappings`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ legalEntityId: fx.legalEntityId, mappings: [{ mappingKey: 'INTERNAL_TRANSFER_CLEARING', accountId: glAccountId }] })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}

export interface CreateTransferOpts {
  transferPurpose?: string
  transferAmount: string | number
  transferDate?: string
  sourcePostingDate?: string
  expectedReceiptDate?: string | null
  destinationPostingDate?: string | null
  currencyCode?: string
  exchangeRate?: string | number
  postingModeOverride?: 'DIRECT' | 'IN_TRANSIT'
  approvalRequiredOverride?: boolean
  sourceBranchId?: string | null
  destinationBranchId?: string | null
  narration?: string
  externalReference?: string
}

export function transferCreateBody(
  fx: ApAllocFixture,
  source: { id: string },
  destination: { id: string },
  opts: CreateTransferOpts,
) {
  return {
    legalEntityId: fx.legalEntityId,
    sourceTreasuryAccountId: source.id,
    destinationTreasuryAccountId: destination.id,
    transferPurpose: opts.transferPurpose ?? 'FUND_MOVEMENT',
    transferDate: opts.transferDate ?? fx.documentDate,
    sourcePostingDate: opts.sourcePostingDate ?? fx.postingDate,
    expectedReceiptDate: opts.expectedReceiptDate,
    destinationPostingDate: opts.destinationPostingDate,
    currencyCode: opts.currencyCode ?? 'INR',
    exchangeRate: opts.exchangeRate ?? '1',
    transferAmount: opts.transferAmount,
    postingModeOverride: opts.postingModeOverride,
    approvalRequiredOverride: opts.approvalRequiredOverride,
    sourceBranchId: opts.sourceBranchId,
    destinationBranchId: opts.destinationBranchId,
    narration: opts.narration,
    externalReference: opts.externalReference,
  }
}

export async function createTransferDraft(
  app: Express,
  fx: ApAllocFixture,
  source: { id: string },
  destination: { id: string },
  opts: CreateTransferOpts,
  token?: string,
) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send(transferCreateBody(fx, source, destination, opts))
}

export async function createReadyTransferDraft(
  app: Express,
  fx: ApAllocFixture,
  source: { id: string },
  destination: { id: string },
  opts: CreateTransferOpts,
): Promise<{ id: string; updatedAt: string; postingMode: 'DIRECT' | 'IN_TRANSIT'; body: Record<string, unknown> }> {
  const created = await createTransferDraft(app, fx, source, destination, opts)
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  return {
    id: created.body.data.id as string,
    updatedAt: created.body.data.updatedAt as string,
    postingMode: created.body.data.postingMode as 'DIRECT' | 'IN_TRANSIT',
    body: created.body.data,
  }
}

export async function markReadyTransfer(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/mark-ready`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function submitTransfer(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/submit`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function approveTransfer(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/approve`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function rejectTransfer(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, reason: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/reject`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, reason })
}

export async function reviseTransfer(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/revise`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function cancelTransfer(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, reason: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/cancel`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt, reason })
}

export async function postDirectTransfer(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/post`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function dispatchTransfer(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/dispatch`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function receiveTransfer(app: Express, fx: ApAllocFixture, id: string, expectedUpdatedAt: string, token?: string) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/receive`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send({ expectedUpdatedAt })
}

export async function getTransfer(app: Express, fx: ApAllocFixture, id: string, token?: string) {
  return request(app)
    .get(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
}

export async function reversalPreview(app: Express, fx: ApAllocFixture, id: string, token?: string) {
  return request(app)
    .get(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/reversal-preview`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
}

export async function reverseTransfer(
  app: Express,
  fx: ApAllocFixture,
  id: string,
  body: { expectedUpdatedAt: string; reversalDate: string; reason: string; idempotencyKey: string },
  token?: string,
) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/transfers/${id}/reverse`)
    .set('Authorization', `Bearer ${token ?? fx.token}`)
    .send(body)
}

/** End-to-end: create → mark-ready → post a DIRECT transfer. Returns the completed transfer + posting result. */
export async function createAndPostDirectTransfer(
  app: Express,
  fx: ApAllocFixture,
  source: { id: string },
  destination: { id: string },
  opts: CreateTransferOpts,
) {
  const draft = await createReadyTransferDraft(app, fx, source, destination, opts)
  const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
  expect(ready.status, JSON.stringify(ready.body)).toBe(200)
  const posted = await postDirectTransfer(app, fx, draft.id, ready.body.data.updatedAt as string)
  expect(posted.status, JSON.stringify(posted.body)).toBe(200)
  return posted.body.data as { transfer: Record<string, unknown>; posting: Record<string, unknown>; idempotentReplay: boolean }
}

/** End-to-end: create → mark-ready → dispatch → receive an IN_TRANSIT transfer. */
export async function createAndCompleteInTransitTransfer(
  app: Express,
  fx: ApAllocFixture,
  source: { id: string },
  destination: { id: string },
  opts: CreateTransferOpts,
) {
  const draft = await createReadyTransferDraft(app, fx, source, destination, opts)
  const ready = await markReadyTransfer(app, fx, draft.id, draft.updatedAt)
  expect(ready.status, JSON.stringify(ready.body)).toBe(200)
  const dispatched = await dispatchTransfer(app, fx, draft.id, ready.body.data.updatedAt as string)
  expect(dispatched.status, JSON.stringify(dispatched.body)).toBe(200)
  const received = await receiveTransfer(app, fx, draft.id, dispatched.body.data.transfer.updatedAt as string)
  expect(received.status, JSON.stringify(received.body)).toBe(200)
  return {
    dispatched: dispatched.body.data as { transfer: Record<string, unknown>; posting: Record<string, unknown>; idempotentReplay: boolean },
    received: received.body.data as { transfer: Record<string, unknown>; posting: Record<string, unknown>; idempotentReplay: boolean },
  }
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
