import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import * as voucherRepo from '../../src/modules/accounting/ledger/accounting-voucher.repository.js'
import * as lineRepo from '../../src/modules/accounting/ledger/accounting-voucher-line.repository.js'
import * as glRepo from '../../src/modules/accounting/ledger/general-ledger.repository.js'
import * as postingEventRepo from '../../src/modules/accounting/ledger/posting-event.repository.js'
import {
  validateBalancedVoucher,
  validateReversalEligibility,
  validateVoucherLinesStructure,
  validateVoucherLinesWithMasters,
} from '../../src/modules/accounting/ledger/ledger.validators.js'
import type { DraftVoucherLineInput } from '../../src/modules/accounting/ledger/ledger.types.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))

async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    }).catch(() => {})
  }
}

async function createTenantWithFinanceAdmin() {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `ledger-test-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'Ledger Test', slug, email: `ledger-${Date.now()}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Ledger',
      lastName: 'Tester',
      email: `ledger-user-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { in: [...FINANCE_PERMS] as PermissionName[] } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Ledger Admin ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id } })

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })

  return {
    tenantId: tenant.id,
    slug,
    token: loginRes.body.data?.accessToken ?? '',
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingRule.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeApprovalRule.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeFeatureControl.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.costCentre.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

interface LedgerFixture {
  tenantId: string
  legalEntityId: string
  otherLegalEntityId: string
  financialYearId: string
  accountingPeriodId: string
  ledgerAccountId: string
  groupAccountId: string
  inactiveAccountId: string
  receivableAccountId: string
  otherLeAccountId: string
}

async function seedLedgerFixture(tenantId: string): Promise<LedgerFixture> {
  const le = await prisma.legalEntity.create({
    data: {
      tenantId,
      code: `LE${Date.now()}`.slice(-8),
      legalName: 'Ledger Co',
      displayName: 'Ledger Co',
      isDefault: true,
    },
  })
  const otherLe = await prisma.legalEntity.create({
    data: {
      tenantId,
      code: `OL${Date.now()}`.slice(-8),
      legalName: 'Other Co',
      displayName: 'Other Co',
    },
  })
  const fy = await prisma.financialYear.create({
    data: {
      tenantId,
      legalEntityId: le.id,
      name: 'FY 2025-26',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      status: 'ACTIVE',
      isCurrent: true,
    },
  })
  const period = await prisma.accountingPeriod.create({
    data: {
      tenantId,
      legalEntityId: le.id,
      financialYearId: fy.id,
      periodNumber: 1,
      name: 'Apr 2025',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-04-30'),
      status: 'OPEN',
    },
  })
  const group = await prisma.account.create({
    data: {
      tenantId,
      legalEntityId: le.id,
      accountCode: '1000',
      accountName: 'Assets Group',
      category: 'ASSET',
      isGroup: true,
      level: 1,
    },
  })
  const ledger = await prisma.account.create({
    data: {
      tenantId,
      legalEntityId: le.id,
      accountCode: '1100',
      accountName: 'Cash',
      category: 'ASSET',
      parentAccountId: group.id,
      isGroup: false,
      level: 2,
    },
  })
  const inactive = await prisma.account.create({
    data: {
      tenantId,
      legalEntityId: le.id,
      accountCode: '1200',
      accountName: 'Inactive Bank',
      category: 'ASSET',
      isGroup: false,
      isActive: false,
      level: 1,
    },
  })
  const receivable = await prisma.account.create({
    data: {
      tenantId,
      legalEntityId: le.id,
      accountCode: '2100',
      accountName: 'Customer Receivable',
      category: 'ASSET',
      accountType: 'CUSTOMER_RECEIVABLE',
      isGroup: false,
      level: 1,
    },
  })
  const otherLeAccount = await prisma.account.create({
    data: {
      tenantId,
      legalEntityId: otherLe.id,
      accountCode: '1100',
      accountName: 'Other Cash',
      category: 'ASSET',
      isGroup: false,
      level: 1,
    },
  })
  return {
    tenantId,
    legalEntityId: le.id,
    otherLegalEntityId: otherLe.id,
    financialYearId: fy.id,
    accountingPeriodId: period.id,
    ledgerAccountId: ledger.id,
    groupAccountId: group.id,
    inactiveAccountId: inactive.id,
    receivableAccountId: receivable.id,
    otherLeAccountId: otherLeAccount.id,
  }
}

function balancedLines(accountId: string, receivableId: string): DraftVoucherLineInput[] {
  return [
    { lineNumber: 1, accountId, debitAmount: '1000', creditAmount: '0', exchangeRate: '1' },
    { lineNumber: 2, accountId: receivableId, partyType: 'CUSTOMER', partyId: '00000000-0000-4000-8000-000000000001', debitAmount: '0', creditAmount: '1000', exchangeRate: '1' },
  ]
}

describe.skipIf(!dbAvailable)('Finance ledger foundation (Phase 2A)', () => {
  let ctx = { tenantId: '', slug: '', token: '' }
  let otherCtx = { tenantId: '', slug: '', token: '' }
  let fx: LedgerFixture
  let otherFx: LedgerFixture

  beforeAll(async () => {
    await ensurePermissions()
    ctx = await createTenantWithFinanceAdmin()
    otherCtx = await createTenantWithFinanceAdmin()
    fx = await seedLedgerFixture(ctx.tenantId)
    otherFx = await seedLedgerFixture(otherCtx.tenantId)
  })

  afterAll(async () => {
    if (ctx.tenantId) await cleanupTenant(ctx.tenantId)
    if (otherCtx.tenantId) await cleanupTenant(otherCtx.tenantId)
  })

  it('returns ledger schema-status via HTTP', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${ctx.slug}/accounting/ledger/schema-status`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.phase).toBe('2B')
    expect(res.body.data.postingEngine).toBe(true)
    expect(res.body.data.foundationReady).toBe(true)
    expect(res.body.data.modelsPresent).toBe(true)
  })

  it('isolates voucher findById by tenant', async () => {
    const voucher = await voucherRepo.createDraft(ctx.tenantId, {
      legalEntityId: fx.legalEntityId,
      financialYearId: fx.financialYearId,
      accountingPeriodId: fx.accountingPeriodId,
      voucherType: 'JOURNAL',
      documentDate: '2025-04-15',
      postingDate: '2025-04-15',
    })
    const own = await voucherRepo.findById(ctx.tenantId, voucher.id)
    const cross = await voucherRepo.findById(otherCtx.tenantId, voucher.id)
    expect(own?.id).toBe(voucher.id)
    expect(cross).toBeNull()
  })

  it('rejects cross-LE account on line validator', async () => {
    const lines: DraftVoucherLineInput[] = [
      { lineNumber: 1, accountId: fx.otherLeAccountId, debitAmount: '100', creditAmount: '0' },
      { lineNumber: 2, accountId: fx.ledgerAccountId, debitAmount: '0', creditAmount: '100' },
    ]
    const result = await validateVoucherLinesWithMasters(ctx.tenantId, fx.legalEntityId, lines)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'ACCOUNT_NOT_FOUND')).toBe(true)
  })

  it('rejects duplicate line numbers', () => {
    const lines: DraftVoucherLineInput[] = [
      { lineNumber: 1, accountId: fx.ledgerAccountId, debitAmount: '100', creditAmount: '0' },
      { lineNumber: 1, accountId: fx.ledgerAccountId, debitAmount: '0', creditAmount: '100' },
    ]
    const result = validateVoucherLinesStructure(lines)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'DUPLICATE_LINE_NUMBER')).toBe(true)
  })

  it('rejects both debit and credit, zero, and negative amounts', () => {
    const both: DraftVoucherLineInput[] = [
      { lineNumber: 1, accountId: fx.ledgerAccountId, debitAmount: '50', creditAmount: '50' },
    ]
    expect(validateVoucherLinesStructure(both).errors.some((e) => e.code === 'BOTH_DEBIT_CREDIT')).toBe(true)

    const zero: DraftVoucherLineInput[] = [
      { lineNumber: 1, accountId: fx.ledgerAccountId, debitAmount: '0', creditAmount: '0' },
    ]
    expect(validateVoucherLinesStructure(zero).errors.some((e) => e.code === 'ZERO_LINE')).toBe(true)

    const negative: DraftVoucherLineInput[] = [
      { lineNumber: 1, accountId: fx.ledgerAccountId, debitAmount: '-10', creditAmount: '0' },
    ]
    expect(validateVoucherLinesStructure(negative).errors.some((e) => e.code === 'NEGATIVE_AMOUNT')).toBe(true)
  })

  it('rejects group, inactive, and receivable-without-party accounts', async () => {
    const groupLines: DraftVoucherLineInput[] = [
      { lineNumber: 1, accountId: fx.groupAccountId, debitAmount: '100', creditAmount: '0' },
      { lineNumber: 2, accountId: fx.ledgerAccountId, debitAmount: '0', creditAmount: '100' },
    ]
    const groupResult = await validateVoucherLinesWithMasters(ctx.tenantId, fx.legalEntityId, groupLines)
    expect(groupResult.errors.some((e) => e.code === 'ACCOUNT_IS_GROUP')).toBe(true)

    const inactiveLines: DraftVoucherLineInput[] = [
      { lineNumber: 1, accountId: fx.inactiveAccountId, debitAmount: '100', creditAmount: '0' },
      { lineNumber: 2, accountId: fx.ledgerAccountId, debitAmount: '0', creditAmount: '100' },
    ]
    const inactiveResult = await validateVoucherLinesWithMasters(ctx.tenantId, fx.legalEntityId, inactiveLines)
    expect(inactiveResult.errors.some((e) => e.code === 'ACCOUNT_INACTIVE')).toBe(true)

    const recvLines: DraftVoucherLineInput[] = [
      { lineNumber: 1, accountId: fx.receivableAccountId, debitAmount: '100', creditAmount: '0' },
      { lineNumber: 2, accountId: fx.ledgerAccountId, debitAmount: '0', creditAmount: '100' },
    ]
    const recvResult = await validateVoucherLinesWithMasters(ctx.tenantId, fx.legalEntityId, recvLines)
    expect(recvResult.errors.some((e) => e.code === 'PARTY_REQUIRED')).toBe(true)
  })

  it('validates balanced vs unbalanced vouchers', () => {
    const balanced = validateBalancedVoucher(balancedLines(fx.ledgerAccountId, fx.receivableAccountId))
    expect(balanced.valid).toBe(true)

    const unbalanced: DraftVoucherLineInput[] = [
      { lineNumber: 1, accountId: fx.ledgerAccountId, debitAmount: '1000', creditAmount: '0' },
      { lineNumber: 2, accountId: fx.receivableAccountId, partyType: 'CUSTOMER', partyId: '00000000-0000-4000-8000-000000000001', debitAmount: '0', creditAmount: '900' },
    ]
    const result = validateBalancedVoucher(unbalanced)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'UNBALANCED')).toBe(true)
  })

  it('handles posting event duplicate key and payload hash mismatch', async () => {
    const base = {
      legalEntityId: fx.legalEntityId,
      eventKey: `evt-${Date.now()}`,
      eventType: 'TEST_EVENT',
      payload: { amount: '100' },
    }
    const first = await postingEventRepo.createReceivedEvent(ctx.tenantId, base)
    const dup = await postingEventRepo.createReceivedEvent(ctx.tenantId, base)
    expect(dup.id).toBe(first.id)

    const otherLeEvent = await postingEventRepo.createReceivedEvent(ctx.tenantId, {
      ...base,
      legalEntityId: fx.otherLegalEntityId,
    })
    expect(otherLeEvent.id).not.toBe(first.id)

    await expect(
      postingEventRepo.createReceivedEvent(ctx.tenantId, {
        ...base,
        payload: { amount: '200' },
      }),
    ).rejects.toThrow(/payload hash/i)
  })

  it('blocks self, cross-LE, and second reversal', async () => {
    const postedId = '00000000-0000-4000-8000-000000000099'
    const source = {
      id: postedId,
      tenantId: ctx.tenantId,
      legalEntityId: fx.legalEntityId,
      status: 'POSTED' as const,
      reversedByVoucherId: null as string | null,
    }

    expect(validateReversalEligibility(source, postedId, ctx.tenantId, fx.legalEntityId).valid).toBe(false)
    expect(
      validateReversalEligibility(source, '00000000-0000-4000-8000-000000000098', otherCtx.tenantId, fx.legalEntityId).valid,
    ).toBe(false)
    expect(
      validateReversalEligibility(
        { ...source, reversedByVoucherId: '00000000-0000-4000-8000-000000000097' },
        '00000000-0000-4000-8000-000000000098',
        ctx.tenantId,
        fx.legalEntityId,
      ).valid,
    ).toBe(false)
  })

  it('GL repository exposes no update/delete methods', () => {
    const keys = Object.keys(glRepo)
    expect(keys).not.toContain('update')
    expect(keys).not.toContain('delete')
    expect(keys).not.toContain('upsert')
    expect(keys).not.toContain('deleteMany')
    expect(glRepo.GL_REPOSITORY_IMMUTABLE).toBe(true)
    expect(typeof glRepo.insertMany).toBe('function')
  })

  it('creates draft voucher lines via repository', async () => {
    const voucher = await voucherRepo.createDraft(ctx.tenantId, {
      legalEntityId: fx.legalEntityId,
      financialYearId: fx.financialYearId,
      accountingPeriodId: fx.accountingPeriodId,
      voucherType: 'JOURNAL',
      documentDate: '2025-04-15',
      postingDate: '2025-04-15',
    })
    const lines = await lineRepo.createManyForDraft(
      ctx.tenantId,
      voucher.id,
      balancedLines(fx.ledgerAccountId, fx.receivableAccountId),
    )
    expect(lines).toHaveLength(2)
    const updated = await voucherRepo.findById(ctx.tenantId, voucher.id)
    expect(updated?.totalDebit.toString()).toBe('1000')
    expect(updated?.totalCredit.toString()).toBe('1000')
  })
})
