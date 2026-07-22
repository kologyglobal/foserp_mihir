import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Request } from 'express'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import type { PermissionName } from '../src/constants/permissions.js'
import { recordAbsorptionEvents } from '../src/modules/manufacturing/costing/posting-orchestrator.service.js'
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
const P7E = [
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
] as PermissionName[]
const mfg = (slug: string) => `/api/v1/t/${slug}/manufacturing`

async function seedFinanceBase(tenantId: string) {
  const now = new Date()
  const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const le = await prisma.legalEntity.create({
    data: {
      tenantId,
      code: `P7E${String(Date.now()).slice(-5)}`,
      legalName: 'Phase 7E Manufacturing',
      displayName: 'Phase 7E',
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
    const inventory = key.includes('INVENTORY')
    const account = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId,
        accountCode: `7E${String(index).padStart(4, '0')}`,
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

describe.skipIf(!dbAvailable)('Manufacturing Phase 7E', () => {
  let fx: ManufacturingFixture
  let token: string
  let noViewToken: string
  let workOrderId: string
  let legalEntityId: string
  let other: { tenantId: string; slug: string; token: string } | undefined

  beforeAll(async () => {
    await ensurePermissions()
    const tenant = await createManufacturingAdminTenant(app, 'mfg-p7e')
    const user = await createUserWithPerms(app, tenant.tenantId, tenant.slug, P7E, 'p7e-full')
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
    noViewToken = (await createUserWithPerms(
      app,
      fx.tenantId,
      fx.slug,
      ['manufacturing.work_orders.view'] as PermissionName[],
      'p7e-no-view',
    )).token
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupFinance(fx.tenantId)
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
    if (other) await cleanupTenant(other.tenantId)
  })

  const auth = (test: request.Test, bearer = token) => test.set('Authorization', `Bearer ${bearer}`)

  it('creates policies and activation replaces the active policy', async () => {
    const first = await auth(request(app).post(`${mfg(fx.slug)}/costing/policies`)).send({ name: 'Policy A' })
    const second = await auth(request(app).post(`${mfg(fx.slug)}/costing/policies`)).send({ name: 'Policy B' })
    expect(first.status).toBe(201)
    expect((await auth(request(app).post(`${mfg(fx.slug)}/costing/policies/${first.body.data.id}/activate`))).status).toBe(200)
    expect((await auth(request(app).post(`${mfg(fx.slug)}/costing/policies/${second.body.data.id}/activate`))).status).toBe(200)
    expect((await prisma.manufacturingCostingPolicy.findUnique({ where: { id: first.body.data.id } }))?.status).toBe('ARCHIVED')
  })

  it('calculates and persists a snapshot with honest completeness warnings', async () => {
    const response = await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${workOrderId}/cost/calculate`)).send({ persist: true })
    expect(response.status).toBe(200)
    expect(response.body.data.snapshot.id).toBeTruthy()
    expect(response.body.data.warnings.length).toBeGreaterThan(0)
  })

  it('cost summary is permission protected', async () => {
    expect((await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/cost-summary`))).status).toBe(200)
    expect((await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/cost-summary`), noViewToken)).status).toBe(403)
  })

  it('readiness reports disabled flag and missing mappings', async () => {
    const response = await auth(request(app).get(`${mfg(fx.slug)}/work-orders/${workOrderId}/accounting-readiness`))
    expect(response.status).toBe(200)
    expect(response.body.data.blockers).toContain('MANUFACTURING_ACCOUNTING_FLAG_DISABLED')
    expect(response.body.data.mappingKeys.missing.length).toBeGreaterThan(0)
  })

  it('records manual absorption, posts it, and retry is voucher-idempotent', async () => {
    await seedMappings(fx.tenantId, legalEntityId)
    await prisma.financeFeatureControl.create({
      data: { tenantId: fx.tenantId, legalEntityId, featureKey: 'MANUFACTURING_ACCOUNTING', isEnabled: true },
    })
    const snapshot = await prisma.workOrderCostSnapshot.findFirstOrThrow({
      where: { tenantId: fx.tenantId, productionOrderId: workOrderId },
      orderBy: { snapshotVersion: 'desc' },
    })
    await prisma.workOrderCostSnapshot.update({ where: { id: snapshot.id }, data: { actualLabourCost: 100, totalActualCost: 100 } })
    const events = await recordAbsorptionEvents({ context: { userId: fx.userId } } as Request, fx.tenantId, workOrderId)
    expect(events).toHaveLength(1)
    const posted = await auth(request(app).post(`${mfg(fx.slug)}/accounting/events/${events[0].id}/post`))
    expect(posted.status).toBe(200)
    expect(posted.body.data.status).toBe('POSTED')
    const retried = await auth(request(app).post(`${mfg(fx.slug)}/accounting/events/${events[0].id}/retry`))
    expect(retried.status).toBe(200)
    expect(retried.body.data.voucherId).toBe(posted.body.data.voucherId)
  })

  it('financial close blocks operationally, then records one variance event', async () => {
    const blocked = await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${workOrderId}/financial-close/preview`))
    expect(blocked.body.data.blockers).toContain('WORK_ORDER_NOT_COMPLETED')
    await prisma.productionOrder.update({ where: { id: workOrderId }, data: { status: 'COMPLETED' } })
    const closed = await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${workOrderId}/financial-close`))
    expect(closed.status).toBe(201)
    expect(closed.body.data.eventType).toBe('PRODUCTION_VARIANCE')
    expect((await auth(request(app).post(`${mfg(fx.slug)}/work-orders/${workOrderId}/financial-close`))).status).toBe(422)
  })

  it('isolates accounting workspace by tenant', async () => {
    const tenant = await createManufacturingAdminTenant(app, 'mfg-p7e-other')
    const user = await createUserWithPerms(app, tenant.tenantId, tenant.slug, P7E, 'p7e-other')
    other = { ...tenant, token: user.token }
    const response = await auth(request(app).get(`${mfg(other.slug)}/accounting/workspace/unposted`), other.token)
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
  })
})
