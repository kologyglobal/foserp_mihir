import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { env } from '../../src/config/env.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import {
  buildStatementLineHash,
  buildStatementUniquenessKey,
} from '../../src/modules/accounting/treasury/statements/bank-statement-identity.service.js'
import {
  computeLineTotals,
  validateLineTotalsMatchHeader,
  validateStatementHeader,
} from '../../src/modules/accounting/treasury/statements/bank-statement-validation.service.js'
import {
  createImportBatch,
  createStatement,
  createStatementLine,
} from '../../src/modules/accounting/treasury/statements/bank-statement.repository.js'
import {
  assertAccountNumberSecurityAvailable,
  deriveAccountNumberSecurityFields,
  isAccountNumberSecurityAvailable,
  maskAccountNumber,
} from '../../src/modules/accounting/treasury/treasury-account-security.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

async function createGlAccount(
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

describe.skipIf(!dbAvailable)('Phase 5A1 — Bank/Cash treasury foundation', () => {
  let fx: ApAllocFixture
  let viewerToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'treasury-fnd')
    fx = await bootstrapApAllocFixture(app, ctx)
    const viewer = await createUserWithPerms(app, fx.tenantId, fx.slug, ['finance.treasury.account.view'], 'treasury-viewer')
    viewerToken = viewer.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  // ── 1. Create BANK account + profile — mask returned, no plaintext/hash/encrypted in response ──
  it('creates a BANK treasury account with a masked account number and never returns hash/encrypted fields', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: `BANK-${Date.now()}`,
        name: 'Primary Current Account',
        accountType: 'BANK',
        glAccountId: fx.bankAccountId,
        currencyCode: 'INR',
        bankProfile: {
          bankName: 'HDFC Bank',
          bankAccountKind: 'CURRENT',
          accountNumber: '000123456789',
          accountHolderName: 'Trailer Co Pvt Ltd',
        },
      })

    expect(res.status).toBe(201)
    const body = res.body.data
    expect(body.bankProfile.accountNumberLast4).toBe('6789')
    expect(body.bankProfile.accountNumberMasked).toBe('XXXXXXXX6789')
    expect(body.bankProfile.accountNumberHash).toBeUndefined()
    expect(body.bankProfile.accountNumberEncrypted).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('000123456789')

    const raw = await prisma.treasuryBankProfile.findUniqueOrThrow({ where: { treasuryAccountId: body.id } })
    expect(raw.accountNumberHash).toBeTruthy()
  })

  // ── 2. Create CASH + CLEARING accounts ──
  it('creates a CASH treasury account and a CLEARING treasury account', async () => {
    const cashRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: `CASH-${Date.now()}`,
        name: 'Petty Cash',
        accountType: 'CASH',
        glAccountId: fx.cashAccountId,
        cashProfile: { custodianName: 'Cashier One', imprestLimit: 5000 },
      })
    expect(cashRes.status).toBe(201)
    expect(cashRes.body.data.cashProfile.custodianName).toBe('Cashier One')

    const clearingGl = await createGlAccount(fx.tenantId, fx.legalEntityId, {
      accountType: 'GENERAL',
      category: 'ASSET',
      namePrefix: 'CLR',
    })
    const clearingRes = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: `CLR-${Date.now()}`,
        name: 'Payment Gateway Clearing',
        accountType: 'CLEARING',
        glAccountId: clearingGl.id,
      })
    expect(clearingRes.status).toBe(201)
    expect(clearingRes.body.data.accountType).toBe('CLEARING')
  })

  // ── 3. Reject duplicate active GL mapping ──
  it('rejects a second ACTIVE treasury account mapped to the same GL account', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: `BANKDUP-${Date.now()}`,
        name: 'Duplicate GL bank account',
        accountType: 'BANK',
        glAccountId: fx.bankAccountId,
        bankProfile: { bankName: 'ICICI Bank' },
      })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('TREASURY_ACCOUNT_GL_MAPPING_CONFLICT')
  })

  // ── 4. Reject duplicate account number hash (same LE) ──
  it('rejects a duplicate bank account number within the same legal entity', async () => {
    const glAccount = await createGlAccount(fx.tenantId, fx.legalEntityId, {
      accountType: 'BANK',
      category: 'ASSET',
      namePrefix: 'BNK',
    })
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: `BANKDUPNUM-${Date.now()}`,
        name: 'Same number bank account',
        accountType: 'BANK',
        glAccountId: glAccount.id,
        bankProfile: { bankName: 'Axis Bank', accountNumber: '000123456789' },
      })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('TREASURY_BANK_ACCOUNT_DUPLICATE_NUMBER')
  })

  // ── 5 & 6. Payment mapping resolution priority + ambiguity ──
  describe('payment account mapping resolution', () => {
    let genericMappingId: string
    let specificMappingId: string
    let specificTreasuryAccountId: string

    beforeAll(async () => {
      const cashLikeGl = await createGlAccount(fx.tenantId, fx.legalEntityId, {
        accountType: 'BANK',
        category: 'ASSET',
        namePrefix: 'RESGEN',
      })
      const genericAccountRes = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          code: `RESGEN-${Date.now()}`,
          name: 'Resolve generic account',
          accountType: 'BANK',
          glAccountId: cashLikeGl.id,
          bankProfile: { bankName: 'Generic Bank' },
        })
      expect(genericAccountRes.status).toBe(201)

      const specificGl = await createGlAccount(fx.tenantId, fx.legalEntityId, {
        accountType: 'BANK',
        category: 'ASSET',
        namePrefix: 'RESSPC',
      })
      const specificAccountRes = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          code: `RESSPC-${Date.now()}`,
          name: 'Resolve specific account',
          accountType: 'BANK',
          glAccountId: specificGl.id,
          bankProfile: { bankName: 'Specific Bank' },
        })
      expect(specificAccountRes.status).toBe(201)
      specificTreasuryAccountId = specificAccountRes.body.data.id

      const genericMapRes = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          paymentMethod: 'UPI',
          direction: 'BOTH',
          useCase: 'CUSTOMER_RECEIPT',
          role: 'DIRECT_POSTING',
          treasuryAccountId: genericAccountRes.body.data.id,
        })
      expect(genericMapRes.status).toBe(201)
      genericMappingId = genericMapRes.body.data.id

      const specificMapRes = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          paymentMethod: 'UPI',
          direction: 'RECEIPT',
          useCase: 'CUSTOMER_RECEIPT',
          role: 'DIRECT_POSTING',
          currencyCode: 'INR',
          treasuryAccountId: specificTreasuryAccountId,
        })
      expect(specificMapRes.status).toBe(201)
      specificMappingId = specificMapRes.body.data.id
    })

    it('resolves the more specific (currency + direction exact) mapping over the generic fallback', async () => {
      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings/resolve`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          paymentMethod: 'UPI',
          useCase: 'CUSTOMER_RECEIPT',
          direction: 'RECEIPT',
          currencyCode: 'INR',
        })
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(specificMappingId)
      expect(res.body.data.treasuryAccountId).toBe(specificTreasuryAccountId)
    })

    it('falls back to the generic mapping when currency does not match the specific one', async () => {
      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings/resolve`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          paymentMethod: 'UPI',
          useCase: 'CUSTOMER_RECEIPT',
          direction: 'RECEIPT',
          currencyCode: 'USD',
        })
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(genericMappingId)
    })

    it('rejects resolution as ambiguous when two mappings tie on specificity and priority', async () => {
      const tieGl1 = await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'BANK', category: 'ASSET', namePrefix: 'TIE1' })
      const tieAccount1 = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          code: `TIE1-${Date.now()}`,
          name: 'Tie account 1',
          accountType: 'BANK',
          glAccountId: tieGl1.id,
          bankProfile: { bankName: 'Tie Bank 1' },
        })
      const tieGl2 = await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'BANK', category: 'ASSET', namePrefix: 'TIE2' })
      const tieAccount2 = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          code: `TIE2-${Date.now()}`,
          name: 'Tie account 2',
          accountType: 'BANK',
          glAccountId: tieGl2.id,
          bankProfile: { bankName: 'Tie Bank 2' },
        })

      await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          paymentMethod: 'CHEQUE',
          direction: 'BOTH',
          useCase: 'VENDOR_PAYMENT',
          treasuryAccountId: tieAccount1.body.data.id,
        })
        .expect(201)
      await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          paymentMethod: 'CHEQUE',
          direction: 'BOTH',
          useCase: 'VENDOR_PAYMENT',
          treasuryAccountId: tieAccount2.body.data.id,
        })
        .expect(201)

      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings/resolve`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          paymentMethod: 'CHEQUE',
          useCase: 'VENDOR_PAYMENT',
          direction: 'PAYMENT',
        })
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('PAYMENT_ACCOUNT_MAPPING_AMBIGUOUS')
    })

    it('rejects creating a second active default mapping for the same method/use case/direction', async () => {
      await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          paymentMethod: 'CARD',
          direction: 'RECEIPT',
          useCase: 'CARD_SETTLEMENT',
          treasuryAccountId: specificTreasuryAccountId,
          isDefault: true,
        })
        .expect(201)

      const res = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/payment-account-mappings`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          paymentMethod: 'CARD',
          direction: 'RECEIPT',
          useCase: 'CARD_SETTLEMENT',
          treasuryAccountId: specificTreasuryAccountId,
          isDefault: true,
        })
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('PAYMENT_ACCOUNT_MAPPING_DEFAULT_CONFLICT')
    })
  })

  // ── 7. Reconciliation profile — bank-only ──
  describe('bank reconciliation profile', () => {
    it('creates and reads a reconciliation profile for a BANK account, and blocks CASH accounts', async () => {
      const bankRes = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          code: `RECON-${Date.now()}`,
          name: 'Reconciliation bank account',
          accountType: 'BANK',
          glAccountId: (await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'BANK', category: 'ASSET', namePrefix: 'RECON' })).id,
          bankProfile: { bankName: 'Recon Bank' },
        })
      expect(bankRes.status).toBe(201)
      const bankAccountId = bankRes.body.data.id

      const putRes = await request(app)
        .put(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${bankAccountId}/reconciliation-profile`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ autoMatchEnabled: true, autoMatchToleranceAmount: 5, duplicatePolicy: 'WARN' })
      expect(putRes.status).toBe(200)
      expect(putRes.body.data.autoMatchEnabled).toBe(true)
      expect(putRes.body.data.duplicatePolicy).toBe('WARN')

      const getRes = await request(app)
        .get(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${bankAccountId}/reconciliation-profile`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(getRes.status).toBe(200)
      expect(getRes.body.data.autoMatchToleranceAmount).toBe('5.0000')

      // Blocked write to a lastReconciled* field.
      const blockedRes = await request(app)
        .put(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${bankAccountId}/reconciliation-profile`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ lastReconciledBalance: 1000, expectedUpdatedAt: getRes.body.data.updatedAt })
      expect(blockedRes.status).toBe(400)

      const cashGl = await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'CASH', category: 'ASSET', namePrefix: 'RECONCASH' })
      const cashRes = await request(app)
        .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({
          legalEntityId: fx.legalEntityId,
          code: `RECONCASH-${Date.now()}`,
          name: 'Reconciliation cash account',
          accountType: 'CASH',
          glAccountId: cashGl.id,
        })
      expect(cashRes.status).toBe(201)

      const cashProfileRes = await request(app)
        .put(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${cashRes.body.data.id}/reconciliation-profile`)
        .set('Authorization', `Bearer ${fx.token}`)
        .send({ autoMatchEnabled: true })
      expect(cashProfileRes.status).toBe(400)
      expect(cashProfileRes.body.code).toBe('BANK_RECONCILIATION_PROFILE_BANK_ONLY')
    })
  })

  // ── 8. Statement foundation via internal validation/identity helpers ──
  describe('bank statement foundation (internal only, no HTTP route)', () => {
    it('validates a balanced statement header and detects a broken balance equation', () => {
      const ok = validateStatementHeader({
        openingBalance: 1000,
        closingBalance: 1500,
        totalCreditAmount: 800,
        totalDebitAmount: 300,
        periodStartDate: new Date('2026-06-01'),
        periodEndDate: new Date('2026-06-30'),
        statementDate: new Date('2026-06-30'),
        currencyCode: 'INR',
        treasuryAccountCurrencyCode: 'INR',
      })
      expect(ok.valid).toBe(true)

      const bad = validateStatementHeader({
        openingBalance: 1000,
        closingBalance: 9999,
        totalCreditAmount: 800,
        totalDebitAmount: 300,
        periodStartDate: new Date('2026-06-01'),
        periodEndDate: new Date('2026-06-30'),
        statementDate: new Date('2026-06-30'),
        currencyCode: 'USD',
        treasuryAccountCurrencyCode: 'INR',
      })
      expect(bad.valid).toBe(false)
      expect(bad.errors.length).toBeGreaterThanOrEqual(2)
    })

    it('computes line totals and cross-checks them against the header', () => {
      const totals = computeLineTotals({
        lines: [
          { direction: 'CREDIT', amount: 500 },
          { direction: 'CREDIT', amount: 300 },
          { direction: 'DEBIT', amount: 200 },
        ],
      })
      expect(totals).toEqual({ creditTotal: '800.0000', debitTotal: '200.0000' })
      const match = validateLineTotalsMatchHeader(totals, { totalCreditAmount: 800, totalDebitAmount: 200 })
      expect(match.valid).toBe(true)
      const mismatch = validateLineTotalsMatchHeader(totals, { totalCreditAmount: 900, totalDebitAmount: 200 })
      expect(mismatch.valid).toBe(false)
    })

    it('builds deterministic statement/line identity keys and persists the DB foundation rows', async () => {
      const treasuryAccount = await prisma.treasuryAccount.findFirstOrThrow({ where: { tenantId: fx.tenantId, accountType: 'BANK' } })
      const batch = await createImportBatch({
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: treasuryAccount.id,
        batchReference: `BATCH-${Date.now()}`,
      })

      const periodStartDate = new Date('2026-06-01')
      const periodEndDate = new Date('2026-06-30')
      const key1 = buildStatementUniquenessKey({
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: treasuryAccount.id,
        statementReference: 'STMT-001',
        periodStartDate,
        periodEndDate,
      })
      const key2 = buildStatementUniquenessKey({
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: treasuryAccount.id,
        statementReference: 'stmt-001',
        periodStartDate,
        periodEndDate,
      })
      expect(key1).toBe(key2)
      expect(key1).toHaveLength(64)

      const statement = await createStatement({
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        treasuryAccountId: treasuryAccount.id,
        importBatchId: batch.id,
        statementReference: 'STMT-001',
        statementDate: periodEndDate,
        periodStartDate,
        periodEndDate,
        currencyCode: 'INR',
        openingBalance: 0,
        closingBalance: 500,
        totalCreditAmount: 500,
        totalDebitAmount: 0,
        statementUniquenessKey: key1,
      })

      const lineHash = buildStatementLineHash({
        treasuryAccountId: treasuryAccount.id,
        transactionDate: periodEndDate,
        direction: 'CREDIT',
        amount: 500,
        referenceNumber: 'REF-1',
      })
      const line = await createStatementLine({
        tenantId: fx.tenantId,
        legalEntityId: fx.legalEntityId,
        bankStatementId: statement.id,
        lineNumber: 1,
        transactionDate: periodEndDate,
        direction: 'CREDIT',
        amount: 500,
        referenceNumber: 'REF-1',
        lineHash,
      })
      expect(line.matchStatus).toBe('UNMATCHED')

      // Re-importing the exact same statement should be detectable via the uniqueness key.
      const existing = await prisma.bankStatement.findFirst({ where: { tenantId: fx.tenantId, statementUniquenessKey: key1 } })
      expect(existing?.id).toBe(statement.id)
    })
  })

  // ── 9. Setup APIs never mutate GL/vouchers/vendor payments ──
  it('never mutates AccountingVoucher, GeneralLedgerEntry, or VendorPayment rows from treasury setup APIs', async () => {
    const voucherCountBefore = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    const glCountBefore = await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })
    const vendorPaymentCountBefore = await prisma.vendorPayment.count({ where: { tenantId: fx.tenantId } })

    const glAccount = await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'BANK', category: 'ASSET', namePrefix: 'NOMUT' })
    await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: `NOMUT-${Date.now()}`,
        name: 'No mutation check account',
        accountType: 'BANK',
        glAccountId: glAccount.id,
        bankProfile: { bankName: 'No Mutation Bank' },
      })
      .expect(201)

    const voucherCountAfter = await prisma.accountingVoucher.count({ where: { tenantId: fx.tenantId } })
    const glCountAfter = await prisma.generalLedgerEntry.count({ where: { tenantId: fx.tenantId } })
    const vendorPaymentCountAfter = await prisma.vendorPayment.count({ where: { tenantId: fx.tenantId } })

    expect(voucherCountAfter).toBe(voucherCountBefore)
    expect(glCountAfter).toBe(glCountBefore)
    expect(vendorPaymentCountAfter).toBe(vendorPaymentCountBefore)
  })

  // ── 10. Permission enforcement ──
  it('returns 403 when creating a treasury account without the create permission', async () => {
    const glAccount = await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'BANK', category: 'ASSET', namePrefix: 'PERM' })
    const res = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: `PERM-${Date.now()}`,
        name: 'Should be forbidden',
        accountType: 'BANK',
        glAccountId: glAccount.id,
        bankProfile: { bankName: 'Forbidden Bank' },
      })
    expect(res.status).toBe(403)
  })

  // ── 11. Tenant isolation ──
  it('does not allow one tenant to read another tenant treasury account by id', async () => {
    const otherCtx = await createFinanceAdminTenant(app, 'treasury-fnd-other')
    try {
      const otherFx = await bootstrapApAllocFixture(app, otherCtx)
      const glAccount = await createGlAccount(otherFx.tenantId, otherFx.legalEntityId, {
        accountType: 'BANK',
        category: 'ASSET',
        namePrefix: 'ISO',
      })
      const created = await request(app)
        .post(`/api/v1/t/${otherFx.slug}/accounting/treasury/accounts`)
        .set('Authorization', `Bearer ${otherFx.token}`)
        .send({
          legalEntityId: otherFx.legalEntityId,
          code: `ISO-${Date.now()}`,
          name: 'Isolated bank account',
          accountType: 'BANK',
          glAccountId: glAccount.id,
          bankProfile: { bankName: 'Isolated Bank' },
        })
      expect(created.status).toBe(201)
      const otherAccountId = created.body.data.id

      const crossTenantRes = await request(app)
        .get(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${otherAccountId}`)
        .set('Authorization', `Bearer ${fx.token}`)
      expect(crossTenantRes.status).toBe(404)
    } finally {
      await cleanupTenant(otherCtx.tenantId)
    }
  })

  // ── 12. Optimistic concurrency ──
  it('rejects an update with a stale expectedUpdatedAt', async () => {
    const glAccount = await createGlAccount(fx.tenantId, fx.legalEntityId, { accountType: 'BANK', category: 'ASSET', namePrefix: 'CONC' })
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/treasury/accounts`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        code: `CONC-${Date.now()}`,
        name: 'Concurrency test account',
        accountType: 'BANK',
        glAccountId: glAccount.id,
        bankProfile: { bankName: 'Concurrency Bank' },
      })
    expect(created.status).toBe(201)
    const id = created.body.data.id
    const staleUpdatedAt = created.body.data.updatedAt

    const firstUpdate = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ name: 'Renamed once', expectedUpdatedAt: staleUpdatedAt })
    expect(firstUpdate.status).toBe(200)

    const staleRetry = await request(app)
      .put(`/api/v1/t/${fx.slug}/accounting/treasury/accounts/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ name: 'Renamed twice', expectedUpdatedAt: staleUpdatedAt })
    expect(staleRetry.status).toBe(409)
    expect(staleRetry.body.code).toBe('TREASURY_ACCOUNT_STALE_VERSION')
  })
})

describe('treasury account number security service (unit, no DB)', () => {
  it('masks account numbers and derives a stable HMAC hash', () => {
    const { last4, masked } = maskAccountNumber('000123456789')
    expect(last4).toBe('6789')
    expect(masked).toBe('XXXXXXXX6789')

    const first = deriveAccountNumberSecurityFields('000123456789', 'tenant-a', 'le-a')
    const second = deriveAccountNumberSecurityFields('0001-2345-6789', 'tenant-a', 'le-a')
    expect(first.hash).toBe(second.hash)

    const differentLe = deriveAccountNumberSecurityFields('000123456789', 'tenant-a', 'le-b')
    expect(differentLe.hash).not.toBe(first.hash)
  })

  it('rejects persisting an account number when no security secret is configured', () => {
    const originalHmac = env.TREASURY_ACCOUNT_HMAC_SECRET
    const originalKey = env.FIELD_ENCRYPTION_KEY
    ;(env as { TREASURY_ACCOUNT_HMAC_SECRET?: string }).TREASURY_ACCOUNT_HMAC_SECRET = undefined
    ;(env as { FIELD_ENCRYPTION_KEY?: string }).FIELD_ENCRYPTION_KEY = undefined
    try {
      expect(isAccountNumberSecurityAvailable()).toBe(false)
      let caughtCode: string | undefined
      try {
        assertAccountNumberSecurityAvailable()
      } catch (err) {
        caughtCode = (err as { code?: string }).code
      }
      expect(caughtCode).toBe('TREASURY_BANK_ACCOUNT_SECURITY_UNAVAILABLE')
      expect(() => deriveAccountNumberSecurityFields('000123456789', 'tenant-a', 'le-a')).toThrow()
    } finally {
      ;(env as { TREASURY_ACCOUNT_HMAC_SECRET?: string }).TREASURY_ACCOUNT_HMAC_SECRET = originalHmac
      ;(env as { FIELD_ENCRYPTION_KEY?: string }).FIELD_ENCRYPTION_KEY = originalKey
    }
  })
})
