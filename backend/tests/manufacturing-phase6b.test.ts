/**
 * Manufacturing Phase 6B — Costing / manufacturing GL (feature-flagged).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Request } from 'express'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { type PermissionName } from '../src/constants/permissions.js'
import { recordManufacturingAccountingEvent } from '../src/modules/manufacturing/accounting/manufacturing-accounting-event.service.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createManufacturingAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  MANUFACTURING_PERMS,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'
import {
  buildProductionReadySetup,
  cleanupProductionData,
} from './manufacturing/helpers/production-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const PHASE6B_PERMS = Array.from(
  new Set([...MANUFACTURING_PERMS, 'manufacturing.cost.view']),
) as PermissionName[]

function mfg(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

/** Minimal LE + CoA + OPEN period covering today so events can post when the flag is on. */
async function seedManufacturingFinance(tenantId: string): Promise<string> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = new Date(`${fyStartYear}-04-01`)
  const fyEnd = new Date(`${fyStartYear + 1}-03-31`)
  const stamp = String(Date.now()).slice(-6)

  const le = await prisma.legalEntity.create({
    data: {
      tenantId,
      code: `MFG${stamp}`.slice(0, 8),
      legalName: 'Mfg Phase6B Co',
      displayName: 'Mfg Phase6B',
      stateCode: '27',
      isDefault: true,
      isActive: true,
    },
  })
  await prisma.financeSettings.create({
    data: { tenantId, legalEntityId: le.id, baseCurrency: 'INR', financeActivated: true },
  })
  const fy = await prisma.financialYear.create({
    data: {
      tenantId,
      legalEntityId: le.id,
      name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
      startDate: fyStart,
      endDate: fyEnd,
      status: 'ACTIVE',
      isCurrent: true,
    },
  })
  await prisma.accountingPeriod.create({
    data: {
      tenantId,
      legalEntityId: le.id,
      financialYearId: fy.id,
      periodNumber: 1,
      name: 'FY Open',
      startDate: fyStart,
      endDate: fyEnd,
      status: 'OPEN',
    },
  })

  for (const def of [
    { code: '130100', name: 'Raw Material', type: 'RAW_MATERIAL_INVENTORY' as const, key: 'RAW_MATERIAL_INVENTORY' as const },
    { code: '130200', name: 'WIP', type: 'WIP_INVENTORY' as const, key: 'WIP_INVENTORY' as const },
    { code: '130300', name: 'Finished Goods', type: 'FINISHED_GOODS_INVENTORY' as const, key: 'FINISHED_GOODS_INVENTORY' as const },
  ]) {
    const acct = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId: le.id,
        accountCode: def.code,
        accountName: def.name,
        category: 'ASSET',
        accountType: def.type,
        isGroup: false,
        level: 1,
        normalBalance: 'DEBIT',
      },
    })
    await prisma.defaultAccountMapping.create({
      data: { tenantId, legalEntityId: le.id, mappingKey: def.key, accountId: acct.id, isMandatory: true },
    })
  }

  await prisma.financeNumberSeries.create({
    data: {
      tenantId,
      legalEntityId: le.id,
      documentType: 'JOURNAL',
      prefix: 'JO-',
      padLength: 5,
      resetEachYear: true,
      isActive: true,
    },
  })
  return le.id
}

async function cleanupFinance(tenantId: string) {
  await prisma.productionAccountingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeFeatureControl.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 6B — costing / manufacturing GL', () => {
  let fx: ManufacturingFixture
  let token: string
  let legalEntityId: string
  let workOrderId: string
  let noCostToken: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createManufacturingAdminTenant(app, 'mfg-p6b')
    const full = await createUserWithPerms(app, ctx.tenantId, ctx.slug, PHASE6B_PERMS, 'p6b-full')
    fx = await bootstrapManufacturingFixture({
      tenantId: ctx.tenantId,
      slug: ctx.slug,
      token: full.token,
      userId: full.userId,
    })
    token = full.token
    await buildProductionReadySetup(app, fx)
    legalEntityId = await seedManufacturingFinance(fx.tenantId)

    const wo = await request(app)
      .post(`${mfg(fx.slug)}/work-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        productItemId: fx.itemId,
        plannedQuantity: 2,
        requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    expect(wo.status).toBe(201)
    workOrderId = wo.body.data.id as string

    const noCost = await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['manufacturing.work_orders.view'] as PermissionName[],
      'p6b-nocost',
    )
    noCostToken = noCost.token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupFinance(fx.tenantId)
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
  })

  function auth(req: request.Test, t: string = token) {
    return req.set('Authorization', `Bearer ${t}`)
  }

  function mockReq(): Request {
    return { context: { userId: fx.userId } } as Request
  }

  it('gate status is disabled by default; events list is empty', async () => {
    const gate = await auth(request(app).get(`${mfg(fx.slug)}/accounting/gate`))
    expect(gate.status).toBe(200)
    expect(gate.body.data.enabled).toBe(false)
    expect(gate.body.data.legalEntityId).toBe(legalEntityId)

    const events = await auth(request(app).get(`${mfg(fx.slug)}/accounting/events`))
    expect(events.status).toBe(200)
    expect(events.body.data).toEqual([])
  })

  it('records MATERIAL_ISSUED as SKIPPED_FLAG_OFF when flag is off (no voucher)', async () => {
    const event = await recordManufacturingAccountingEvent(mockReq(), fx.tenantId, {
      eventType: 'MATERIAL_ISSUED',
      idempotencyKey: `P6B-SKIP-${Date.now()}`,
      sourceDocumentType: 'TEST',
      sourceDocumentId: 'skip-1',
      productionOrderId: workOrderId,
      quantity: 1,
      amount: 500,
    })
    expect(event.status).toBe('SKIPPED_FLAG_OFF')
    expect(event.voucherId).toBeNull()
  })

  it('posts MATERIAL_ISSUED when MANUFACTURING_ACCOUNTING enabled; replay is idempotent', async () => {
    await prisma.financeFeatureControl.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId,
        featureKey: 'MANUFACTURING_ACCOUNTING',
        isEnabled: true,
      },
    })

    const key = `P6B-POST-${Date.now()}`
    const posted = await recordManufacturingAccountingEvent(mockReq(), fx.tenantId, {
      eventType: 'MATERIAL_ISSUED',
      idempotencyKey: key,
      sourceDocumentType: 'TEST',
      sourceDocumentId: 'post-1',
      productionOrderId: workOrderId,
      quantity: 2,
      amount: 1250.5,
    })
    expect(posted.status).toBe('POSTED')
    expect(posted.voucherId).toBeTruthy()

    const replay = await recordManufacturingAccountingEvent(mockReq(), fx.tenantId, {
      eventType: 'MATERIAL_ISSUED',
      idempotencyKey: key,
      sourceDocumentType: 'TEST',
      sourceDocumentId: 'post-1',
      productionOrderId: workOrderId,
      quantity: 2,
      amount: 1250.5,
    })
    expect(replay.id).toBe(posted.id)
    expect(replay.voucherId).toBe(posted.voucherId)
  })

  it('cost preview requires manufacturing.cost.view', async () => {
    const forbidden = await auth(
      request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/costing/preview`),
      noCostToken,
    )
    expect(forbidden.status).toBe(403)

    const ok = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/costing/preview`))
    expect(ok.status).toBe(200)
    expect(ok.body.data.productionOrderId).toBe(workOrderId)
    expect(ok.body.data.accountingGate).toBeDefined()
  })
})
