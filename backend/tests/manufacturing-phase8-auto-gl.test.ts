/**
 * Wave 3 — Auto mfg-GL rollout (Stage 4).
 * Covers the MANUFACTURING_ACCOUNTING feature-control admin API (enable blocked by
 * readiness, enable when ready, disable), flag-on auto posting of shop-floor events,
 * the absorption HTTP endpoints and the autoPostAbsorption daily-production hook.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Request } from 'express'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import type { PermissionName } from '../src/constants/permissions.js'
import { recordManufacturingAccountingEvent } from '../src/modules/manufacturing/accounting/manufacturing-accounting-event.service.js'
import { autoPostAbsorptionAfterProduction } from '../src/modules/manufacturing/costing/posting-orchestrator.service.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createManufacturingAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  MANUFACTURING_PERMS,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'
import { buildProductionReadySetup, cleanupProductionData } from './manufacturing/helpers/production-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
const P8 = [
  ...MANUFACTURING_PERMS,
  'manufacturing.cost.view',
  'manufacturing.cost.calculate',
  'manufacturing.cost.details',
  'manufacturing.costing_policy.view',
  'manufacturing.costing_policy.manage',
  'manufacturing.accounting.view',
  'manufacturing.accounting.validate',
  'manufacturing.accounting.post',
  'manufacturing.accounting.retry',
  'manufacturing.accounting.financial_close',
  'manufacturing.accounting.reconcile',
  'finance.settings.manage',
] as PermissionName[]
const mfg = (slug: string) => `/api/v1/t/${slug}/manufacturing`

async function seedFinanceBase(tenantId: string) {
  const now = new Date()
  const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const le = await prisma.legalEntity.create({
    data: {
      tenantId,
      code: `P8G${String(Date.now()).slice(-5)}`,
      legalName: 'Phase 8 Auto GL',
      displayName: 'Phase 8 Auto GL',
      isDefault: true,
      isActive: true,
    },
  })
  await prisma.financeSettings.create({ data: { tenantId, legalEntityId: le.id, financeActivated: true } })
  const fy = await prisma.financialYear.create({
    data: {
      tenantId,
      legalEntityId: le.id,
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
      legalEntityId: le.id,
      financialYearId: fy.id,
      periodNumber: 1,
      name: 'Open',
      startDate: fy.startDate,
      endDate: fy.endDate,
      status: 'OPEN',
    },
  })
  await prisma.financeNumberSeries.create({
    data: { tenantId, legalEntityId: le.id, documentType: 'JOURNAL', prefix: 'MFG-', padLength: 6, isActive: true },
  })
  return le.id
}

async function seedMappings(tenantId: string, legalEntityId: string) {
  const keys = [
    'RAW_MATERIAL_INVENTORY',
    'WIP_INVENTORY',
    'FINISHED_GOODS_INVENTORY',
    'LABOUR_ABSORPTION',
    'MACHINE_ABSORPTION',
    'JOB_WORK_ABSORPTION',
    'PRODUCTION_OVERHEAD_ABSORPTION',
    'PRODUCTION_VARIANCE',
    'SCRAP_LOSS',
  ] as const
  for (const [index, key] of keys.entries()) {
    const existing = await prisma.defaultAccountMapping.findFirst({
      where: { tenantId, legalEntityId, mappingKey: key },
    })
    if (existing) continue
    const inventory = key.includes('INVENTORY')
    const account = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId,
        accountCode: `8G${String(index).padStart(4, '0')}`,
        accountName: key,
        category: inventory ? 'ASSET' : 'EXPENSE',
        accountType: inventory ? key : 'GENERAL',
        normalBalance: 'DEBIT',
      },
    })
    await prisma.defaultAccountMapping.create({
      data: { tenantId, legalEntityId, mappingKey: key, accountId: account.id, isMandatory: true },
    })
  }
}

async function cleanupFinance(tenantId: string) {
  await prisma.workOrderCostEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.workOrderCostSnapshot.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingCostingPolicy.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionAccountingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeFeatureControl.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Manufacturing Phase 8 — Auto mfg-GL (Wave 3)', () => {
  let fx: ManufacturingFixture
  let token: string
  let noManageToken: string
  let workOrderId: string
  let legalEntityId: string

  const featurePath = () =>
    `${mfg(fx.slug)}/accounting/feature-controls/${legalEntityId}/MANUFACTURING_ACCOUNTING`
  const auth = (test: request.Test, bearer = token) => test.set('Authorization', `Bearer ${bearer}`)

  beforeAll(async () => {
    await ensurePermissions()
    const tenant = await createManufacturingAdminTenant(app, 'mfg-p8-gl')
    const user = await createUserWithPerms(app, tenant.tenantId, tenant.slug, P8, 'p8gl-full')
    fx = await bootstrapManufacturingFixture({ tenantId: tenant.tenantId, slug: tenant.slug, token: user.token, userId: user.userId })
    token = user.token
    await buildProductionReadySetup(app, fx)
    legalEntityId = await seedFinanceBase(fx.tenantId)
    const created = await request(app).post(`${mfg(fx.slug)}/work-orders`).set('Authorization', `Bearer ${token}`).send({
      productItemId: fx.itemId,
      plannedQuantity: 2,
      requiredCompletionDate: new Date(Date.now() + 86_400_000).toISOString(),
    })
    workOrderId = created.body.data.id
    noManageToken = (await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['manufacturing.accounting.view'] as PermissionName[],
      'p8gl-view-only',
    )).token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupFinance(fx.tenantId)
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
  })

  it('lists feature controls and reports a not-ready disabled status', async () => {
    const list = await auth(request(app).get(`${mfg(fx.slug)}/accounting/feature-controls`))
    expect(list.status).toBe(200)
    expect(list.body.data).toEqual([])

    const status = await auth(request(app).get(featurePath()))
    expect(status.status).toBe(200)
    expect(status.body.data.isEnabled).toBe(false)
    expect(status.body.data.enablement.ready).toBe(false)
    expect(status.body.data.enablement.blockers).toContain('MISSING_ACCOUNT_MAPPINGS')
  })

  it('blocks enabling with 422 + blockers while readiness is incomplete', async () => {
    const response = await auth(request(app).put(featurePath())).send({
      isEnabled: true,
      pilotSignOff: true,
      inventoryReconcileConfirmed: true,
      signOffNote: 'Phase 8 test attempt before mappings',
    })
    // Pilot pre-accept rejects missing mappings as 422 (not a readiness race 409).
    expect(response.status).toBe(422)
    expect(String(response.body.code ?? '')).toBe('PILOT_FINANCE_SIGNOFF_REQUIRED')
    expect(
      (response.body.errors as Array<{ message: string }>).map((error) => error.message),
    ).toContain('MISSING_ACCOUNT_MAPPINGS')
    const control = await prisma.financeFeatureControl.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, featureKey: 'MANUFACTURING_ACCOUNTING' },
    })
    expect(control?.isEnabled ?? false).toBe(false)
  })

  it('rejects enable/disable without finance.settings.manage', async () => {
    const response = await auth(request(app).put(featurePath()), noManageToken).send({
      isEnabled: true,
      pilotSignOff: true,
      inventoryReconcileConfirmed: true,
    })
    expect(response.status).toBe(403)
  })

  it('rejects enable without pilot / inventory sign-off', async () => {
    const response = await auth(request(app).put(featurePath())).send({ isEnabled: true })
    expect(response.status).toBe(422)
    expect(String(response.body.code ?? '')).toMatch(/INVENTORY_RECONCILE_NOT_SIGNED_OFF|PILOT_FINANCE_SIGNOFF_REQUIRED/)
    expect(String(response.body.message ?? '')).toMatch(/inventoryReconcileConfirmed|pilotSignOff/i)
  })

  it('blocks enabling when unreconciled RECORDED events exist', async () => {
    await seedMappings(fx.tenantId, legalEntityId)
    const idempotencyKey = `P8GL_UNREC:${workOrderId}:V1`
    await prisma.productionAccountingEvent.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId,
        eventType: 'MATERIAL_ISSUED',
        status: 'RECORDED',
        productionOrderId: workOrderId,
        idempotencyKey,
        sourceDocumentType: 'PRODUCTION_MATERIAL_ISSUE',
        sourceDocumentId: workOrderId,
        quantity: 1,
        amount: 10,
        currencyCode: 'INR',
      },
    })
    try {
      const response = await auth(request(app).put(featurePath())).send({
        isEnabled: true,
        pilotSignOff: true,
        inventoryReconcileConfirmed: true,
        signOffNote: 'Should block on unreconciled',
      })
      expect(response.status).toBe(409)
      expect(
        (response.body.errors as Array<{ message: string }>).map((error) => error.message),
      ).toContain('INVENTORY_POSTINGS_UNRECONCILED')
    } finally {
      await prisma.productionAccountingEvent.deleteMany({
        where: { tenantId: fx.tenantId, idempotencyKey },
      })
    }
  })

  it('enables the flag once mappings and open period are ready', async () => {
    await seedMappings(fx.tenantId, legalEntityId)
    await prisma.productionAccountingEvent.deleteMany({ where: { tenantId: fx.tenantId } })
    const response = await auth(request(app).put(featurePath())).send({
      isEnabled: true,
      pilotSignOff: true,
      inventoryReconcileConfirmed: true,
      signOffNote: 'Phase 8 pilot Finance sign-off',
    })
    expect(response.status).toBe(200)
    expect(response.body.data.isEnabled).toBe(true)
    expect(response.body.data.readiness.ready).toBe(true)

    const gate = await auth(request(app).get(`${mfg(fx.slug)}/accounting/gate`))
    expect(gate.body.data.enabled).toBe(true)

    const list = await auth(
      request(app).get(`${mfg(fx.slug)}/accounting/feature-controls?featureKey=MANUFACTURING_ACCOUNTING`),
    )
    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(1)
    expect(list.body.data[0].isEnabled).toBe(true)
  })

  it('flag-on: material issue event records and auto-posts a GL voucher', async () => {
    const event = await recordManufacturingAccountingEvent({ context: { userId: fx.userId } } as Request, fx.tenantId, {
      eventType: 'MATERIAL_ISSUED',
      idempotencyKey: `P8GL_MAT:${workOrderId}:V1`,
      sourceDocumentType: 'PRODUCTION_MATERIAL_ISSUE',
      sourceDocumentId: workOrderId,
      productionOrderId: workOrderId,
      quantity: 2,
      amount: 250,
    })
    expect(event.status).toBe('POSTED')
    expect(event.voucherId).toBeTruthy()
  })

  it('absorption endpoints record and post labour absorption', async () => {
    const calculated = await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${workOrderId}/cost/calculate`)).send({ persist: true })
    expect(calculated.status).toBe(200)
    const snapshot = await prisma.workOrderCostSnapshot.findFirstOrThrow({
      where: { tenantId: fx.tenantId, productionOrderId: workOrderId },
      orderBy: { snapshotVersion: 'desc' },
    })
    await prisma.workOrderCostSnapshot.update({ where: { id: snapshot.id }, data: { actualLabourCost: 100, totalActualCost: 100 } })

    const response = await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${workOrderId}/cost/absorption/post`))
    expect(response.status).toBe(201)
    expect(response.body.data.recorded).toBe(1)
    expect(response.body.data.failed).toEqual([])
    expect(response.body.data.posted).toHaveLength(1)
    expect(response.body.data.posted[0].status).toBe('POSTED')
    expect(response.body.data.posted[0].eventType).toBe('LABOUR_ABSORPTION')

    // Idempotent — same snapshot yields no new absorption deltas.
    const again = await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${workOrderId}/cost/absorption`))
    expect(again.status).toBe(201)
    expect(again.body.data).toEqual([])
  })

  it('auto absorption hook is off without autoPostAbsorption and safe when on', async () => {
    const req = { context: { userId: fx.userId } } as Request
    expect(await autoPostAbsorptionAfterProduction(req, fx.tenantId, [workOrderId])).toEqual([])

    await prisma.manufacturingSettings.create({
      data: { tenantId: fx.tenantId, payloadJson: {}, autoPostAbsorption: true },
    })
    const results = await autoPostAbsorptionAfterProduction(req, fx.tenantId, [workOrderId, workOrderId])
    expect(results).toHaveLength(1)
    expect(results[0].workOrderId).toBe(workOrderId)
    expect(results[0].error).toBeUndefined()
  })

  it('disables the flag without readiness checks', async () => {
    const response = await auth(request(app).put(featurePath())).send({ isEnabled: false })
    expect(response.status).toBe(200)
    expect(response.body.data.isEnabled).toBe(false)
    const gate = await auth(request(app).get(`${mfg(fx.slug)}/accounting/gate`))
    expect(gate.body.data.enabled).toBe(false)
  })
})
