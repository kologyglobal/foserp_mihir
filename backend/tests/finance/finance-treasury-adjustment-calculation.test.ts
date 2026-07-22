/**
 * Finance Phase 5B3 — Treasury adjustment calculation service: direction resolution, GST/TDS
 * derived-line expansion, bank-amount balancing, and validation rules. Exercised directly against
 * the calculation service (not through HTTP) using a live-MySQL-backed legal entity + GL accounts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'
import { createGlExpenseAccount, createGlTaxAccount } from './helpers/treasury-adjustment-fixture.js'
import { calculateTreasuryAdjustment, resolveDirection } from '../../src/modules/accounting/treasury/adjustments/treasury-adjustment-calculation.service.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Treasury adjustment calculation', () => {
  let fx: ApAllocFixture
  let expenseGl: { id: string }
  let taxGl: { id: string }
  let bankGlAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-calc')
    fx = await bootstrapApAllocFixture(app, ctx)
    expenseGl = await createGlExpenseAccount(fx, 'CALCEXP')
    taxGl = await createGlTaxAccount(fx, 'CALCGST')
    bankGlAccountId = fx.bankAccountId
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('resolves fixed directions per adjustment type', () => {
    expect(resolveDirection('BANK_CHARGES')).toBe('BANK_DEBIT')
    expect(resolveDirection('BANK_INTEREST_INCOME')).toBe('BANK_CREDIT')
    expect(resolveDirection('BANK_INTEREST_EXPENSE')).toBe('BANK_DEBIT')
    expect(resolveDirection('DIRECT_CREDIT')).toBe('BANK_CREDIT')
    expect(resolveDirection('DIRECT_DEBIT')).toBe('BANK_DEBIT')
  })

  it('lets the caller choose direction for GST_ADJUSTMENT', () => {
    expect(resolveDirection('GST_ADJUSTMENT', 'BANK_CREDIT')).toBe('BANK_CREDIT')
    expect(resolveDirection('GST_ADJUSTMENT', 'BANK_DEBIT')).toBe('BANK_DEBIT')
  })

  it('computes a simple bank-charge preview: Dr expense, Cr bank', async () => {
    const result = await calculateTreasuryAdjustment({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      bankGlAccountId,
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '100' }],
    })
    expect(result.direction).toBe('BANK_DEBIT')
    expect(result.bankAmount).toBe('100.0000')
    expect(result.validation.isValid).toBe(true)
    expect(result.accountingPreview.isBalanced).toBe(true)
    expect(result.accountingPreview.totalDebit).toBe('100.0000')
    expect(result.accountingPreview.totalCredit).toBe('100.0000')
  })

  it('expands a GST-applicable expense line into an EXPENSE + RECOVERABLE_TAX pair that balances', async () => {
    const result = await calculateTreasuryAdjustment({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      bankGlAccountId,
      adjustmentType: 'BANK_CHARGES',
      lines: [
        {
          lineType: 'EXPENSE',
          accountId: expenseGl.id,
          amount: '1000',
          gstTreatment: 'GST_APPLICABLE',
          gstRate: '18',
          gstAccountId: taxGl.id,
        },
      ],
    })
    expect(result.resolvedLines).toHaveLength(2)
    expect(result.resolvedLines[0]).toMatchObject({ lineType: 'EXPENSE', amount: '1000.0000', side: 'DEBIT' })
    expect(result.resolvedLines[1]).toMatchObject({ lineType: 'RECOVERABLE_TAX', amount: '180.0000', side: 'DEBIT' })
    expect(result.bankAmount).toBe('1180.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('expands a TDS-deducted interest-expense line into EXPENSE + TDS_RECEIVABLE, reducing the bank leg', async () => {
    const result = await calculateTreasuryAdjustment({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      bankGlAccountId,
      adjustmentType: 'BANK_INTEREST_EXPENSE',
      lines: [
        {
          lineType: 'EXPENSE',
          accountId: expenseGl.id,
          amount: '10000',
          tdsTreatment: 'TDS_DEDUCTED',
          tdsRate: '10',
          tdsAccountId: taxGl.id,
        },
      ],
    })
    // EXPENSE (Dr 10000) + TDS_RECEIVABLE (Dr 1000) => bank leg (BANK_DEBIT) = 10000 + 1000 = 11000
    expect(result.resolvedLines).toHaveLength(2)
    expect(result.resolvedLines[1]).toMatchObject({ lineType: 'TDS_RECEIVABLE', amount: '1000.0000', side: 'DEBIT' })
    expect(result.bankAmount).toBe('11000.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('supports a negative ROUND_OFF line flipping to the credit side', async () => {
    const result = await calculateTreasuryAdjustment({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      bankGlAccountId,
      adjustmentType: 'BANK_CHARGES',
      lines: [
        { lineType: 'EXPENSE', accountId: expenseGl.id, amount: '100.05' },
        { lineType: 'ROUND_OFF', accountId: expenseGl.id, amount: '-0.05' },
      ],
    })
    expect(result.resolvedLines[1]).toMatchObject({ lineType: 'ROUND_OFF', side: 'CREDIT' })
    expect(result.bankAmount).toBe('100.0000')
    expect(result.accountingPreview.isBalanced).toBe(true)
  })

  it('flags validation error when offset lines produce a non-positive bank amount', async () => {
    const result = await calculateTreasuryAdjustment({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      bankGlAccountId,
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'ROUND_OFF', accountId: expenseGl.id, amount: '0' }],
    })
    expect(result.validation.isValid).toBe(false)
    const codes = result.validation.errors.map((e) => e.code)
    expect(codes).toContain('BANK_AMOUNT_NOT_POSITIVE')
  })

  it('flags validation error when narration is missing for OTHER_BANK_CREDIT', async () => {
    const result = await calculateTreasuryAdjustment({
      tenantId: fx.tenantId,
      legalEntityId: fx.legalEntityId,
      bankGlAccountId,
      adjustmentType: 'OTHER_BANK_CREDIT',
      narration: null,
      lines: [{ lineType: 'OTHER', accountId: expenseGl.id, amount: '50' }],
    })
    expect(result.validation.isValid).toBe(false)
    const codes = result.validation.errors.map((e) => e.code)
    expect(codes).toContain('NARRATION_REQUIRED')
  })
})
