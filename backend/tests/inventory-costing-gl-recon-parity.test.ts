/**
 * Inventory Costing ↔ Inventory↔GL trial-balance parity (live MySQL).
 *
 * Seeds RM stock + matching GL control postings (no Purchase PO path — avoids
 * unrelated purchase_settings migration drift). Proves operational stock value
 * ties to RAW_MATERIAL_INVENTORY GL; costing recon surfaces GL; no Force Balance.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { buildInventoryGlTrialBalance } from '../src/modules/accounting/inventory-gl-reconciliation/inventory-gl-trial-balance.service.js'
import * as costingService from '../src/modules/inventory/costing/costing.service.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import { DEFAULT_INVENTORY_SETTINGS } from '../src/modules/inventory/setup/setup.service.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

async function ensureAccount(args: {
  tenantId: string
  legalEntityId: string
  accountCode: string
  accountName: string
  category: 'ASSET' | 'LIABILITY' | 'EXPENSE'
  accountType: string
  normalBalance: 'DEBIT' | 'CREDIT'
}) {
  return prisma.account.upsert({
    where: {
      legalEntityId_accountCode: {
        legalEntityId: args.legalEntityId,
        accountCode: args.accountCode,
      },
    },
    create: {
      tenantId: args.tenantId,
      legalEntityId: args.legalEntityId,
      accountCode: args.accountCode,
      accountName: args.accountName,
      category: args.category,
      accountType: args.accountType as never,
      normalBalance: args.normalBalance,
      isGroup: false,
      isActive: true,
      allowManualPosting: true,
    },
    update: {
      accountName: args.accountName,
      isGroup: false,
      isActive: true,
    },
  })
}

async function upsertMapping(
  tenantId: string,
  legalEntityId: string,
  mappingKey: string,
  accountId: string,
) {
  return prisma.defaultAccountMapping.upsert({
    where: { legalEntityId_mappingKey: { legalEntityId, mappingKey: mappingKey as never } },
    create: {
      tenantId,
      legalEntityId,
      mappingKey: mappingKey as never,
      accountId,
      isMandatory: false,
    },
    update: { accountId },
  })
}

describe.skipIf(!dbAvailable)('Inventory Costing ↔ GL trial-balance parity', () => {
  let tenantId = ''
  let legalEntityId = ''
  let expectedStockValue = 0
  let rmAccountId = ''

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `inv-gl-parity-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Inv GL Parity', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const user = await createUserWithPerms(app, tenant.id, slug, [], 'inv-gl')
    const fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: user.token,
      userId: user.userId,
    })
    tenantId = fx.tenantId

    await prisma.inventorySettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        settings: {
          ...DEFAULT_INVENTORY_SETTINGS,
          general: { ...DEFAULT_INVENTORY_SETTINGS.general, defaultCostingMethod: 'average' },
        },
        createdById: fx.userId,
        updatedById: fx.userId,
      },
      update: {
        settings: {
          ...DEFAULT_INVENTORY_SETTINGS,
          general: { ...DEFAULT_INVENTORY_SETTINGS.general, defaultCostingMethod: 'average' },
        },
        updatedById: fx.userId,
      },
    })

    // Prefer raw_material component for RM bucket
    await prisma.masterItem.update({
      where: { id: fx.componentItemId },
      data: { itemType: 'raw_material', isStockable: true },
    })

    let le = await prisma.legalEntity.findFirst({
      where: { tenantId, isActive: true },
    })
    if (!le) {
      le = await prisma.legalEntity.create({
        data: {
          tenantId,
          code: 'LE-GL',
          legalName: 'GL Parity Entity',
          displayName: 'GL Parity',
          isDefault: true,
          isActive: true,
        },
      })
    }
    legalEntityId = le.id

    await prisma.financeSettings.upsert({
      where: { legalEntityId },
      create: { tenantId, legalEntityId, financeActivated: true },
      update: { financeActivated: true },
    })

    let fy = await prisma.financialYear.findFirst({
      where: { tenantId, legalEntityId, isCurrent: true },
    })
    if (!fy) {
      const now = new Date()
      const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
      fy = await prisma.financialYear.create({
        data: {
          tenantId,
          legalEntityId,
          name: `FY ${startYear}`,
          startDate: new Date(`${startYear}-04-01`),
          endDate: new Date(`${startYear + 1}-03-31`),
          status: 'ACTIVE',
          isCurrent: true,
        },
      })
    }
    let period = await prisma.accountingPeriod.findFirst({
      where: { tenantId, legalEntityId, financialYearId: fy.id, status: 'OPEN' },
    })
    if (!period) {
      period = await prisma.accountingPeriod.create({
        data: {
          tenantId,
          legalEntityId,
          financialYearId: fy.id,
          periodNumber: 1,
          name: 'Open',
          startDate: fy.startDate,
          endDate: fy.endDate,
          status: 'OPEN',
        },
      })
    }

    const rm = await ensureAccount({
      tenantId,
      legalEntityId,
      accountCode: '1301',
      accountName: 'Raw Material Inventory',
      category: 'ASSET',
      accountType: 'RAW_MATERIAL_INVENTORY',
      normalBalance: 'DEBIT',
    })
    rmAccountId = rm.id
    const fg = await ensureAccount({
      tenantId,
      legalEntityId,
      accountCode: '1303',
      accountName: 'Finished Goods Inventory',
      category: 'ASSET',
      accountType: 'FINISHED_GOODS_INVENTORY',
      normalBalance: 'DEBIT',
    })
    const grir = await ensureAccount({
      tenantId,
      legalEntityId,
      accountCode: '2110',
      accountName: 'GR/IR Clearing',
      category: 'LIABILITY',
      accountType: 'GENERAL',
      normalBalance: 'CREDIT',
    })
    const offset = await ensureAccount({
      tenantId,
      legalEntityId,
      accountCode: '3900',
      accountName: 'Opening Balance Equity',
      category: 'LIABILITY',
      accountType: 'GENERAL',
      normalBalance: 'CREDIT',
    })

    await Promise.all([
      upsertMapping(tenantId, legalEntityId, 'RAW_MATERIAL_INVENTORY', rm.id),
      upsertMapping(tenantId, legalEntityId, 'FINISHED_GOODS_INVENTORY', fg.id),
      upsertMapping(tenantId, legalEntityId, 'GRIR_CLEARING', grir.id),
    ])

    await prisma.financeFeatureControl.upsert({
      where: {
        legalEntityId_featureKey: { legalEntityId, featureKey: 'INVENTORY_ACCOUNTING' },
      },
      create: {
        tenantId,
        legalEntityId,
        featureKey: 'INVENTORY_ACCOUNTING',
        isEnabled: true,
      },
      update: { isEnabled: true },
    })

    const qty = 10
    const rate = 100

    await postStockMovement({
      tenantId,
      itemId: fx.componentItemId,
      warehouseId: fx.warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: qty,
      rate,
      idempotencyKey: `inv-gl-parity-open-${tenantId}`,
    })

    const stock = await prisma.inventoryStockBalance.aggregate({
      where: { tenantId },
      _sum: { stockValue: true },
    })
    expectedStockValue = Number(stock._sum.stockValue ?? 0)
    expect(expectedStockValue).toBeGreaterThan(0)

    const amount = String(expectedStockValue)
    const postingDate = new Date()
    const voucher = await prisma.accountingVoucher.create({
      data: {
        tenantId,
        legalEntityId,
        financialYearId: fy.id,
        accountingPeriodId: period.id,
        voucherType: 'JOURNAL',
        voucherNumber: `JV-GL-${Date.now()}`,
        status: 'POSTED',
        documentDate: postingDate,
        postingDate,
        totalDebit: amount,
        totalCredit: amount,
        baseTotalDebit: amount,
        baseTotalCredit: amount,
        narration: 'Inv GL parity seed',
        postedAt: postingDate,
        postedBy: fx.userId,
      },
    })
    const debitLine = await prisma.accountingVoucherLine.create({
      data: {
        tenantId,
        legalEntityId,
        voucherId: voucher.id,
        lineNumber: 1,
        accountId: rmAccountId,
        debitAmount: amount,
        baseDebitAmount: amount,
      },
    })
    const creditLine = await prisma.accountingVoucherLine.create({
      data: {
        tenantId,
        legalEntityId,
        voucherId: voucher.id,
        lineNumber: 2,
        accountId: offset.id,
        creditAmount: amount,
        baseCreditAmount: amount,
      },
    })
    await prisma.generalLedgerEntry.create({
      data: {
        tenantId,
        legalEntityId,
        financialYearId: fy.id,
        accountingPeriodId: period.id,
        voucherId: voucher.id,
        voucherLineId: debitLine.id,
        voucherType: 'JOURNAL',
        voucherNumber: voucher.voucherNumber!,
        lineNumber: 1,
        postingDate,
        documentDate: postingDate,
        accountId: rmAccountId,
        debitAmount: amount,
        baseDebitAmount: amount,
      },
    })
    await prisma.generalLedgerEntry.create({
      data: {
        tenantId,
        legalEntityId,
        financialYearId: fy.id,
        accountingPeriodId: period.id,
        voucherId: voucher.id,
        voucherLineId: creditLine.id,
        voucherType: 'JOURNAL',
        voucherNumber: voucher.voucherNumber!,
        lineNumber: 2,
        postingDate,
        documentDate: postingDate,
        accountId: offset.id,
        creditAmount: amount,
        baseCreditAmount: amount,
      },
    })
  }, 120_000)

  afterAll(async () => {
    if (!tenantId) return
    await cleanupTenant(tenantId).catch(() => {})
  })

  it('Inventory↔GL RM control matches operational stock value (no Force Balance)', async () => {
    const tb = await buildInventoryGlTrialBalance(tenantId, { legalEntityId })
    expect(tb.forceBalanceAllowed).toBe(false)
    expect(tb.inventoryAccountingEnabled).toBe(true)
    expect(tb.actions).not.toContain('FORCE_BALANCE' as never)

    const rm = tb.rows.find((r) => r.mappingKey === 'RAW_MATERIAL_INVENTORY')
    expect(rm).toBeTruthy()
    expect(Number(rm!.operationalBalance)).toBeCloseTo(expectedStockValue, 2)
    expect(Number(rm!.glBalance)).toBeCloseTo(expectedStockValue, 2)
    expect(Math.abs(Number(rm!.difference))).toBeLessThanOrEqual(0.01)
    expect(rm!.status).toBe('MATCHED')
  })

  it('costing valuation recon surfaces live GL totals when accounting is enabled', async () => {
    const recon = await costingService.reconcileValuation(tenantId, { mismatchesOnly: false })
    expect(recon.summary.accountingEnabled).toBe(true)
    expect(recon.summary.forceBalanceAllowed).toBe(false)
    expect(recon.summary.glInventoryValue).not.toBeNull()
    expect(recon.summary.glInventoryValue!).toBeCloseTo(expectedStockValue, 2)
    expect(Math.abs(recon.summary.difference ?? 999)).toBeLessThanOrEqual(0.01)
    expect(recon.summary.glReconciliation).toMatch(/Matched|Available|Warning/)
    expect(recon.summary.note).toContain('Inventory↔GL')
    expect(recon.summary.note).not.toContain('deferred')
  })

  it('costing overview accounting block reflects Inventory↔GL path', async () => {
    const overview = await costingService.getCostingOverview(tenantId)
    expect(overview.accounting.enabled).toBe(true)
    expect(overview.accounting.forceBalanceAllowed).toBe(false)
    expect(overview.accounting.inventoryGlPath).toBe('/accounting/inventory-gl-reconciliation')
    expect(overview.summary.glDifference).not.toBeNull()
    expect(Math.abs(overview.summary.glDifference ?? 999)).toBeLessThanOrEqual(0.01)
  })
})
