/**
 * Finance Phase 5B3 — Treasury adjustment foundation: draft creation, calculation/validation
 * fields, GST/TDS derived-line expansion, and list/get endpoints. Live MySQL.
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
import {
  createAdjustmentBankAccount,
  createAdjustmentDraft,
  createGlExpenseAccount,
  createGlTaxAccount,
  getAdjustment,
  listAdjustments,
} from './helpers/treasury-adjustment-fixture.js'
import type { TreasuryTransferAccount } from './helpers/treasury-transfer-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Phase 5B3 — Treasury adjustment foundation', () => {
  let fx: ApAllocFixture
  let bank1: TreasuryTransferAccount
  let expenseGl: { id: string }
  let taxGl: { id: string }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'tadj-fnd')
    fx = await bootstrapApAllocFixture(app, ctx)
    bank1 = await createAdjustmentBankAccount(app, fx, { namePrefix: 'FNDBANK' })
    expenseGl = await createGlExpenseAccount(fx, 'FNDEXP')
    taxGl = await createGlTaxAccount(fx, 'FNDGST')
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('creates a BANK_CHARGES draft with a balanced accounting preview (no tax)', async () => {
    const res = await createAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', accountId: expenseGl.id, amount: '100', description: 'Monthly maintenance fee' }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const data = res.body.data
    expect(data.status).toBe('DRAFT')
    expect(data.direction).toBe('BANK_DEBIT')
    expect(data.sourceMode).toBe('MANUAL')
    expect(data.draftReference).toMatch(/^TADJ-DRAFT-\d{8}-[0-9A-Z]{6}$/)
    expect(data.bankAmount).toBe('100.0000')
    expect(data.validation.isValid).toBe(true)
    expect(data.accountingPreview.isBalanced).toBe(true)
    expect(data.accountingPreview.totalDebit).toBe(data.accountingPreview.totalCredit)
    expect(data.accountingPreview.lines).toHaveLength(2)
    expect(data.accountingPreview.lines[0]).toMatchObject({ role: 'OFFSET', direction: 'DEBIT', accountId: expenseGl.id })
    expect(data.accountingPreview.lines[1]).toMatchObject({ role: 'BANK', direction: 'CREDIT', accountId: bank1.glAccountId })
    expect(data.allowedActions.markReady).toBe(true)
    expect(data.allowedActions.post).toBe(false)

    const fetched = await getAdjustment(app, fx, data.id)
    expect(fetched.status).toBe(200)
    expect(fetched.body.data.id).toBe(data.id)
  })

  it('creates a BANK_INTEREST_INCOME draft with a BANK_CREDIT direction', async () => {
    const incomeGl = await createGlExpenseAccount(fx, 'FNDINC')
    const res = await createAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_INTEREST_INCOME',
      lines: [{ lineType: 'INCOME', accountId: incomeGl.id, amount: '250' }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.direction).toBe('BANK_CREDIT')
    expect(res.body.data.bankAmount).toBe('250.0000')
    expect(res.body.data.accountingPreview.lines[0]).toMatchObject({ role: 'OFFSET', direction: 'CREDIT' })
    expect(res.body.data.accountingPreview.lines[1]).toMatchObject({ role: 'BANK', direction: 'DEBIT' })
  })

  it('auto-derives a RECOVERABLE_TAX line from gstRate on an offset line', async () => {
    const res = await createAdjustmentDraft(app, fx, bank1, {
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
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const data = res.body.data
    expect(data.lines).toHaveLength(2)
    expect(data.lines[0].lineType).toBe('EXPENSE')
    expect(data.lines[0].amount).toBe('1000.0000')
    expect(data.lines[1].lineType).toBe('RECOVERABLE_TAX')
    expect(data.lines[1].amount).toBe('180.0000')
    expect(data.bankAmount).toBe('1180.0000')
    expect(data.accountingPreview.isBalanced).toBe(true)
  })

  it('rejects a draft missing both accountId and mappingKey on a line (schema-level 400)', async () => {
    const res = await createAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'BANK_CHARGES',
      lines: [{ lineType: 'EXPENSE', amount: '100' } as never],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(400)
  })

  it('requires narration and an explicit offset line for OTHER_BANK_DEBIT (schema-level 400 without narration)', async () => {
    const res = await createAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'OTHER_BANK_DEBIT',
      lines: [{ lineType: 'OTHER', accountId: expenseGl.id, amount: '50' }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(400)
  })

  it('accepts OTHER_BANK_DEBIT with narration and forces approval required', async () => {
    const res = await createAdjustmentDraft(app, fx, bank1, {
      adjustmentType: 'OTHER_BANK_DEBIT',
      narration: 'Unclassified bank debit — pending investigation',
      lines: [{ lineType: 'OTHER', accountId: expenseGl.id, amount: '50' }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.approvalRequired).toBe(true)
    expect(res.body.data.status).toBe('DRAFT')
  })

  it('lists treasury adjustments scoped to the legal entity', async () => {
    const res = await listAdjustments(app, fx)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
    for (const item of res.body.data) {
      expect(item.legalEntityId).toBe(fx.legalEntityId)
    }
  })

  it('404s for an unknown adjustment id', async () => {
    const res = await getAdjustment(app, fx, '00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
  })
})
