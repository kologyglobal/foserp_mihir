import request from 'supertest'
import { expect } from 'vitest'
import type { Express } from 'express'
import { prisma } from '../../../src/config/database.js'
import type { ApAllocFixture } from './ap-allocation-fixture.js'

export async function createGlAccount(
  tenantId: string,
  legalEntityId: string,
  opts: { accountType: string; category: string; namePrefix: string },
) {
  return prisma.account.create({
    data: {
      tenantId,
      legalEntityId,
      accountCode: `${opts.namePrefix}${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12),
      accountName: `${opts.namePrefix} Test Account`,
      category: opts.category as never,
      accountType: opts.accountType as never,
      isGroup: false,
      level: 1,
    },
  })
}

export interface BankReconTreasury {
  id: string
  glAccountId: string
  currencyCode: string
  updatedAt: string
}

/** Creates a BANK treasury account + a 5A3 reconciliation profile (defaults are permissive for tests). */
export async function createBankTreasury(
  app: Express,
  fx: ApAllocFixture,
  profileOverrides: Record<string, unknown> = {},
): Promise<BankReconTreasury> {
  const gl = await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'BANK', category: 'ASSET', namePrefix: 'BRGL' })
  const res = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      code: `BR-BANK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: 'Bank Reconciliation Test Bank',
      accountType: 'BANK',
      glAccountId: gl.id,
      currencyCode: 'INR',
      bankProfile: {
        bankName: 'Test Bank',
        bankAccountKind: 'CURRENT',
        accountNumber: `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`.slice(-14),
      },
    })
  expect(res.status, JSON.stringify(res.body)).toBe(201)

  const profileRes = await request(app)
    .put(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${res.body.data.id}/reconciliation-profile`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      duplicatePolicy: 'BLOCK',
      dateBasis: 'TRANSACTION_DATE',
      dateToleranceDays: 3,
      amountTolerance: '0',
      autoReconcileEnabled: true,
      autoReconcileScore: 100,
      requireUniqueExactMatch: true,
      groupedSuggestionsEnabled: true,
      partialSuggestionsEnabled: true,
      allowManualPartialMatch: true,
      allowManualGroupedMatch: true,
      maximumGroupSize: 5,
      requireFullMatchToFinalize: true,
      allowFinalizeWithExceptions: true,
      finalizationDifferenceTolerance: '0',
      ...profileOverrides,
    })
  expect(profileRes.status, JSON.stringify(profileRes.body)).toBe(200)

  return { id: res.body.data.id, glAccountId: gl.id, currencyCode: res.body.data.currencyCode, updatedAt: res.body.data.updatedAt }
}

export interface ClearingSetup {
  clearingTreasuryAccountId: string
  clearingGlAccountId: string
}

/** Creates a CLEARING treasury account + GL, and a CLEARING PaymentAccountMapping onto `treasuryAccountId`. */
export async function createClearingSetup(app: Express, fx: ApAllocFixture, treasuryAccountId: string): Promise<ClearingSetup> {
  const clearingGl = await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'GENERAL', category: 'LIABILITY', namePrefix: 'CLRGL' })
  const clearingRes = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      code: `BR-CLR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: 'Bank Reconciliation Test Clearing',
      accountType: 'CLEARING',
      glAccountId: clearingGl.id,
    })
  expect(clearingRes.status, JSON.stringify(clearingRes.body)).toBe(201)

  const mappingRes = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      paymentMethod: 'BANK_TRANSFER',
      direction: 'BOTH',
      useCase: 'VENDOR_PAYMENT',
      role: 'CLEARING',
      treasuryAccountId,
      clearingAccountId: clearingRes.body.data.id,
      priority: 100,
    })
  expect(mappingRes.status, JSON.stringify(mappingRes.body)).toBe(201)

  return { clearingTreasuryAccountId: clearingRes.body.data.id, clearingGlAccountId: clearingGl.id }
}

export interface StatementLineInput {
  transactionDate: string
  direction: 'CREDIT' | 'DEBIT'
  amount: number
  description?: string
  referenceNumber?: string
}

export interface ValidatedStatement {
  statementId: string
  status: string
  lines: Array<{ id: string; direction: string; amount: string; matchStatus: string; referenceNumber: string | null }>
}

/** Creates a manual bank statement (with lines) and validates it — a VALIDATED statement is
 * the gate for reconciliation session creation. */
export async function createValidatedStatement(
  app: Express,
  fx: ApAllocFixture,
  treasuryAccountId: string,
  lines: StatementLineInput[],
  opts: { openingBalance?: number; periodStartDate?: string; periodEndDate?: string; statementDate?: string } = {},
): Promise<ValidatedStatement> {
  const totalCreditAmount = lines.filter((l) => l.direction === 'CREDIT').reduce((acc, l) => acc + l.amount, 0)
  const totalDebitAmount = lines.filter((l) => l.direction === 'DEBIT').reduce((acc, l) => acc + l.amount, 0)
  const openingBalance = opts.openingBalance ?? 100000
  const closingBalance = openingBalance + totalCreditAmount - totalDebitAmount

  const create = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/manual`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      treasuryAccountId,
      statementReference: `BR-STMT-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      statementDate: opts.statementDate ?? fx.documentDate,
      periodStartDate: opts.periodStartDate ?? fx.documentDate,
      periodEndDate: opts.periodEndDate ?? fx.documentDate,
      currencyCode: 'INR',
      openingBalance,
      closingBalance,
      totalCreditAmount,
      totalDebitAmount,
      lines,
    })
  expect(create.status, JSON.stringify(create.body)).toBe(201)
  const statementId = create.body.data.id as string

  const validate = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/validate`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({ expectedUpdatedAt: create.body.data.updatedAt })
  expect(validate.status, JSON.stringify(validate.body)).toBe(200)
  expect(validate.body.data.status).toBe('VALIDATED')

  const detail = await request(app)
    .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(detail.status).toBe(200)

  return { statementId, status: validate.body.data.status, lines: detail.body.data.lines }
}

/**
 * A reconciliation session is created lazily on first workspace visit (or run-auto-match) —
 * match/finalize/reopen all require one to already exist. Call this right after
 * `createValidatedStatement` when a test goes straight to matching without visiting the
 * workspace endpoint first.
 */
export async function ensureReconciliationSession(app: Express, fx: ApAllocFixture, statementId: string): Promise<void> {
  const res = await request(app)
    .get(`/api/v1/t/${fx.slug}/accounting/treasury/bank-statements/${statementId}/reconciliation`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}

export interface JournalLineInput {
  accountId: string
  debitAmount?: string
  creditAmount?: string
  lineNarration?: string
}

export interface PostedJournalResult {
  journalId: string
  voucherId: string
  voucherNumber: string
}

/** Creates, submits and posts a manual JOURNAL — used to seed GL entries on a bank/clearing GL
 * account so reconciliation candidates exist. */
export async function postJournal(
  app: Express,
  fx: ApAllocFixture,
  lines: JournalLineInput[],
  opts: { documentDate?: string; postingDate?: string; narration?: string } = {},
): Promise<PostedJournalResult> {
  const created = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/journals`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send({
      legalEntityId: fx.legalEntityId,
      documentDate: opts.documentDate ?? fx.documentDate,
      postingDate: opts.postingDate ?? fx.postingDate,
      narration: opts.narration ?? 'Bank reconciliation test journal',
      currencyCode: 'INR',
      lines: lines.map((l, idx) => ({
        lineNumber: idx + 1,
        accountId: l.accountId,
        debitAmount: l.debitAmount ?? '0',
        creditAmount: l.creditAmount ?? '0',
        currencyCode: 'INR',
        lineNarration: l.lineNarration,
      })),
    })
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  const journalId = created.body.data.id as string

  const submitted = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/submit`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)

  const posted = await request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/journals/${journalId}/post`)
    .set('Authorization', `Bearer ${fx.token}`)
  expect(posted.status, JSON.stringify(posted.body)).toBe(200)

  return {
    journalId,
    voucherId: posted.body.data.posting.voucherId as string,
    voucherNumber: posted.body.data.posting.voucherNumber as string,
  }
}
