/**
 * Live: FG_DISPATCH inventory accounting posts Dr COGS / Cr FINISHED_GOODS.
 * Enablement API + recordInventoryAccountingEvent → POSTED voucher.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import type { PermissionName } from '../src/constants/permissions.js'
import { recordInventoryAccountingEvent } from '../src/modules/inventory/accounting/inventory-accounting-event.service.js'
import {
  cleanupTenant,
  createManufacturingAdminTenant,
  createUserWithPerms,
  ensurePermissions,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

const PERMS = [
  'inventory.view',
  'inventory.view_cost',
  'finance.settings.manage',
  'tenant.manage',
] as PermissionName[]

function inv(slug: string) {
  return `/api/v1/t/${slug}/inventory`
}

describe.skipIf(!dbAvailable)('Dispatch COGS — Inventory Accounting FG_DISPATCH', () => {
  let tenantId: string
  let slug: string
  let token: string
  let legalEntityId: string
  let cogsAccountId: string
  let fgAccountId: string

  beforeAll(async () => {
    await ensurePermissions()
    const tenant = await createManufacturingAdminTenant(app, 'cogs-gl')
    tenantId = tenant.tenantId
    slug = tenant.slug
    const user = await createUserWithPerms(app, tenantId, slug, PERMS, 'cogs-fin')
    token = user.token

    const now = new Date()
    const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
    const le = await prisma.legalEntity.create({
      data: {
        tenantId,
        code: `COGS${String(Date.now()).slice(-5)}`,
        legalName: 'COGS Test LE',
        displayName: 'COGS Test LE',
        isDefault: true,
        isActive: true,
      },
    })
    legalEntityId = le.id
    await prisma.financeSettings.create({
      data: { tenantId, legalEntityId, financeActivated: true },
    })
    const fy = await prisma.financialYear.create({
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
    await prisma.accountingPeriod.create({
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
    await prisma.financeNumberSeries.create({
      data: {
        tenantId,
        legalEntityId,
        documentType: 'JOURNAL',
        prefix: 'COGS-',
        padLength: 6,
        isActive: true,
      },
    })

    const cogs = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId,
        accountCode: '5600',
        accountName: 'Cost of Goods Sold',
        category: 'EXPENSE',
        accountType: 'EXPENSE',
        normalBalance: 'DEBIT',
        isGroup: false,
        isActive: true,
      },
    })
    const fg = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId,
        accountCode: '130300',
        accountName: 'Finished Goods',
        category: 'ASSET',
        accountType: 'FINISHED_GOODS_INVENTORY',
        normalBalance: 'DEBIT',
        isGroup: false,
        isActive: true,
      },
    })
    cogsAccountId = cogs.id
    fgAccountId = fg.id

    await prisma.defaultAccountMapping.create({
      data: {
        tenantId,
        legalEntityId,
        mappingKey: 'COST_OF_GOODS_SOLD',
        accountId: cogs.id,
        isMandatory: false,
      },
    })
    await prisma.defaultAccountMapping.create({
      data: {
        tenantId,
        legalEntityId,
        mappingKey: 'FINISHED_GOODS_INVENTORY',
        accountId: fg.id,
        isMandatory: false,
      },
    })
  }, 120_000)

  afterAll(async () => {
    if (!tenantId) return
    await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.inventoryAccountingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.financeFeatureControl.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
    await cleanupTenant(tenantId).catch(() => {})
  })

  it('blocks enable without mappings; enables when ready', async () => {
    const otherLe = await prisma.legalEntity.create({
      data: {
        tenantId,
        code: `NMAP${String(Date.now()).slice(-4)}`,
        legalName: 'No Map LE',
        displayName: 'No Map LE',
        isActive: true,
      },
    })
    await prisma.financeSettings.create({
      data: { tenantId, legalEntityId: otherLe.id, financeActivated: true },
    })

    const blocked = await request(app)
      .put(`${inv(slug)}/accounting/feature-controls/${otherLe.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
    expect(blocked.status).toBe(422)
    expect(String(blocked.body.code ?? blocked.body.message ?? '')).toMatch(
      /INVENTORY_ACCOUNTING_MAPPINGS_INCOMPLETE|Map COST_OF_GOODS/i,
    )

    const status = await request(app)
      .get(`${inv(slug)}/accounting/feature-controls/${legalEntityId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(status.status).toBe(200)
    expect(status.body.data.canEnable).toBe(true)
    expect(status.body.data.mapping.ready).toBe(true)

    const enabled = await request(app)
      .put(`${inv(slug)}/accounting/feature-controls/${legalEntityId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true, note: 'COGS pilot' })
    expect(enabled.status).toBe(200)
    expect(enabled.body.data.isEnabled).toBe(true)

    const gate = await request(app)
      .get(`${inv(slug)}/accounting/gate`)
      .set('Authorization', `Bearer ${token}`)
    expect(gate.status).toBe(200)
    expect(gate.body.data.enabled).toBe(true)
  }, 60_000)

  it('posts Dr COGS / Cr FG for ₹4,00,000 FG_DISPATCH when flag on', async () => {
    await prisma.financeFeatureControl.upsert({
      where: {
        legalEntityId_featureKey: {
          legalEntityId,
          featureKey: 'INVENTORY_ACCOUNTING',
        },
      },
      create: {
        tenantId,
        legalEntityId,
        featureKey: 'INVENTORY_ACCOUNTING',
        isEnabled: true,
      },
      update: { isEnabled: true },
    })

    const sourceDocumentId = randomUUID()
    const event = await recordInventoryAccountingEvent(null, tenantId, {
      eventType: 'FG_DISPATCH',
      idempotencyKey: `INV_ACCT:cogs-live-${sourceDocumentId}:V1`,
      sourceDocumentType: 'OUTBOUND_DISPATCH',
      sourceDocumentId,
      quantity: 1,
      amount: 400000,
      documentDate: new Date().toISOString().slice(0, 10),
      postingDate: new Date().toISOString().slice(0, 10),
      narration: 'Fuel Tank COGS test',
      attemptPost: true,
      legalEntityId,
    })

    expect(event.status).toBe('POSTED')
    expect(event.voucherId).toBeTruthy()
    expect(event.legalEntityId).toBe(legalEntityId)
    expect(Number(event.amount)).toBe(400000)

    const lines = await prisma.accountingVoucherLine.findMany({
      where: { tenantId, voucherId: event.voucherId! },
      orderBy: { lineNumber: 'asc' },
    })
    expect(lines.length).toBeGreaterThanOrEqual(2)
    const debit = lines.find((l) => Number(l.debitAmount) > 0)
    const credit = lines.find((l) => Number(l.creditAmount) > 0)
    expect(debit?.accountId).toBe(cogsAccountId)
    expect(credit?.accountId).toBe(fgAccountId)
    expect(Number(debit?.debitAmount)).toBe(400000)
    expect(Number(credit?.creditAmount)).toBe(400000)

    const again = await recordInventoryAccountingEvent(null, tenantId, {
      eventType: 'FG_DISPATCH',
      idempotencyKey: `INV_ACCT:cogs-live-${sourceDocumentId}:V1`,
      sourceDocumentType: 'OUTBOUND_DISPATCH',
      sourceDocumentId,
      quantity: 1,
      amount: 400000,
      attemptPost: true,
      legalEntityId,
    })
    expect(again.id).toBe(event.id)
    expect(again.status).toBe('POSTED')
  }, 60_000)

  it('skips G/L when INVENTORY_ACCOUNTING is off for the Legal Entity', async () => {
    await prisma.financeFeatureControl.upsert({
      where: {
        legalEntityId_featureKey: {
          legalEntityId,
          featureKey: 'INVENTORY_ACCOUNTING',
        },
      },
      create: {
        tenantId,
        legalEntityId,
        featureKey: 'INVENTORY_ACCOUNTING',
        isEnabled: false,
      },
      update: { isEnabled: false },
    })

    const sourceDocumentId = randomUUID()
    const event = await recordInventoryAccountingEvent(null, tenantId, {
      eventType: 'FG_DISPATCH',
      idempotencyKey: `INV_ACCT:cogs-skip-${sourceDocumentId}:V1`,
      sourceDocumentType: 'OUTBOUND_DISPATCH',
      sourceDocumentId,
      quantity: 1,
      amount: 400000,
      attemptPost: true,
      legalEntityId,
    })
    expect(event.status).toBe('SKIPPED_FLAG_OFF')
    expect(event.voucherId).toBeNull()
  }, 60_000)
})
