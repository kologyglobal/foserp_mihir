/**
 * Phase 7D — Reporting foundation: manufacturing/quality/dispatch report catalog, query, export,
 * saved views, and the cross-module operational exception centre.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { type PermissionName } from '../src/constants/permissions.js'
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

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const REPORT_VIEW_PERMS = Array.from(
  new Set([
    ...MANUFACTURING_PERMS,
    'manufacturing.reports.saved_views',
    'manufacturing.reports.shared_views',
    'manufacturing.reports.production',
    'manufacturing.reports.shopfloor',
    'manufacturing.reports.shift',
    'manufacturing.reports.work_centres',
    'manufacturing.reports.downtime',
    'manufacturing.reports.materials',
    'manufacturing.reports.wip',
    'manufacturing.reports.job_work',
    'manufacturing.reports.export',
    'manufacturing.traceability.view',
    'manufacturing.traceability.export',
    'quality.reports.view',
    'quality.reports.production',
    'quality.reports.ncr',
    'dispatch.reports.view',
    'dispatch.reports.fulfilment',
    'dispatch.reports.invoice_readiness',
    'operations.exceptions.view',
    'operations.exceptions.manage',
  ]),
) as PermissionName[]

// Deliberately narrow — must NOT include manufacturing.reports.export (that's the point of the test).
const VIEW_ONLY_PERMS = ['manufacturing.reports.production'] as PermissionName[]

async function cleanupOpsReportsData(tenantId: string): Promise<void> {
  await prisma.savedReportView.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.operationalExceptionAction.deleteMany({ where: { tenantId } }).catch(() => {})
}

function reports(slug: string) {
  return `/api/v1/t/${slug}/reports`
}

function operations(slug: string) {
  return `/api/v1/t/${slug}/operations`
}

describe.skipIf(!dbAvailable)('Phase 7D — Reporting foundation', () => {
  let fx: ManufacturingFixture
  let token: string
  let workOrderId: string

  let otherFx: ManufacturingFixture

  beforeAll(async () => {
    await ensurePermissions()

    const ctx = await createManufacturingAdminTenant(app, 'ops-rpt-p7d')
    const full = await createUserWithPerms(app, ctx.tenantId, ctx.slug, REPORT_VIEW_PERMS, 'p7d-full')
    fx = await bootstrapManufacturingFixture({
      tenantId: ctx.tenantId,
      slug: ctx.slug,
      token: full.token,
      userId: full.userId,
    })
    token = full.token
    await buildProductionReadySetup(app, fx)

    const wo = await request(app)
      .post(`/api/v1/t/${fx.slug}/manufacturing/work-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        productItemId: fx.itemId,
        plannedQuantity: 5,
        requiredCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    expect(wo.status).toBe(201)
    workOrderId = wo.body.data.id as string

    const otherCtx = await createManufacturingAdminTenant(app, 'ops-rpt-p7d-x')
    const otherFull = await createUserWithPerms(app, otherCtx.tenantId, otherCtx.slug, REPORT_VIEW_PERMS, 'p7d-other')
    otherFx = await bootstrapManufacturingFixture({
      tenantId: otherCtx.tenantId,
      slug: otherCtx.slug,
      token: otherFull.token,
      userId: otherFull.userId,
    })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await cleanupOpsReportsData(fx.tenantId)
      await cleanupProductionData(fx.tenantId)
      await cleanupTenant(fx.tenantId)
    }
    if (otherFx?.tenantId) {
      await cleanupOpsReportsData(otherFx.tenantId)
      await cleanupProductionData(otherFx.tenantId)
      await cleanupTenant(otherFx.tenantId)
    }
  })

  function auth(req: request.Test, t = token) {
    return req.set('Authorization', `Bearer ${t}`)
  }

  describe('Catalog', () => {
    it('requires authentication', async () => {
      const res = await request(app).get(`${reports(fx.slug)}/manufacturing/catalog`)
      expect(res.status).toBe(401)
    })

    it('lists reports the caller has permission for', async () => {
      const res = await auth(request(app).get(`${reports(fx.slug)}/manufacturing/catalog`))
      expect(res.status).toBe(200)
      const reportList = res.body.data.reports as Array<{ key: string; availability: string; disabled: boolean }>
      expect(Array.isArray(reportList)).toBe(true)
      expect(reportList.find((r) => r.key === 'work-order-progress')).toBeTruthy()
      const challans = reportList.find((r) => r.key === 'delivery-challans')
      expect(challans?.availability).toBe('UNAVAILABLE')
      expect(challans?.disabled).toBe(true)
    })
  })

  describe('Query', () => {
    it('returns a well-formed ReportResult for work-order-progress', async () => {
      const res = await auth(
        request(app).post(`${reports(fx.slug)}/manufacturing/work-order-progress/query`).send({}),
      )
      expect(res.status).toBe(200)
      const data = res.body.data
      expect(data.reportKey).toBe('work-order-progress')
      expect(typeof data.generatedAt).toBe('string')
      expect(typeof data.timezone).toBe('string')
      expect(Array.isArray(data.columns)).toBe(true)
      expect(Array.isArray(data.rows)).toBe(true)
      expect(data.pagination).toEqual(
        expect.objectContaining({ page: 1, pageSize: expect.any(Number), totalRows: expect.any(Number) }),
      )
      expect(data.rows.some((r: { orderNumber: string }) => r.orderNumber)).toBe(true)
    })

    it('does not leak rows across tenants', async () => {
      const res = await auth(
        request(app).post(`${reports(otherFx.slug)}/manufacturing/work-order-progress/query`).send({}),
        otherFx.token,
      )
      expect(res.status).toBe(200)
      expect(res.body.data.rows).toEqual([])
    })

    it('marks unavailable reports with a clear warning and empty rows', async () => {
      const res = await auth(
        request(app).post(`${reports(fx.slug)}/manufacturing/delivery-challans/query`).send({}),
      )
      expect(res.status).toBe(200)
      const data = res.body.data
      expect(data.availability).toBe('UNAVAILABLE')
      expect(data.rows).toEqual([])
      expect(data.warnings.length).toBeGreaterThan(0)
      expect(data.warnings[0]).toMatch(/not implemented/i)
    })

    it('rejects an unknown report key', async () => {
      const res = await auth(
        request(app).post(`${reports(fx.slug)}/manufacturing/not-a-real-report/query`).send({}),
      )
      expect(res.status).toBe(404)
    })
  })

  describe('Export', () => {
    it('requires manufacturing.reports.export permission', async () => {
      const viewOnly = await createUserWithPerms(app, fx.tenantId, fx.slug, VIEW_ONLY_PERMS, 'p7d-view-only')
      const res = await auth(
        request(app).post(`${reports(fx.slug)}/manufacturing/work-order-progress/export`).send({}),
        viewOnly.token,
      )
      expect(res.status).toBe(403)
    })

    it('exports CSV for a caller with export permission', async () => {
      const res = await auth(
        request(app).post(`${reports(fx.slug)}/manufacturing/work-order-progress/export`).send({}),
      )
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/text\/csv/)
      expect(res.text).toContain('Work Order Progress')
    })
  })

  describe('Saved views', () => {
    it('creates and lists a saved view', async () => {
      const create = await auth(
        request(app).post(`${reports(fx.slug)}/saved-views`).send({
          reportKey: 'work-order-progress',
          name: 'My Overdue Orders',
          filters: { status: ['DRAFT', 'READY'] },
          isDefault: true,
        }),
      )
      expect(create.status).toBe(201)
      expect(create.body.data.name).toBe('My Overdue Orders')

      const list = await auth(request(app).get(`${reports(fx.slug)}/saved-views?reportKey=work-order-progress`))
      expect(list.status).toBe(200)
      const views = list.body.data.views as Array<{ name: string; isDefault: boolean }>
      expect(views.some((v) => v.name === 'My Overdue Orders' && v.isDefault)).toBe(true)
    })
  })

  describe('Operational exceptions', () => {
    it('returns a summary with category/severity breakdowns', async () => {
      const res = await auth(request(app).get(`${operations(fx.slug)}/exceptions/summary`))
      expect(res.status).toBe(200)
      const summary = res.body.data
      expect(typeof summary.totalOpen).toBe('number')
      expect(typeof summary.byCategory).toBe('object')
      expect(typeof summary.bySeverity).toBe('object')
    })

    it('lists open exceptions', async () => {
      const res = await auth(request(app).get(`${operations(fx.slug)}/exceptions`))
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data.exceptions)).toBe(true)
    })
  })

  describe('Shopfloor live', () => {
    it('returns the live board with refresh metadata', async () => {
      const res = await auth(request(app).get(`/api/v1/t/${fx.slug}/manufacturing/shopfloor/live`))
      expect(res.status).toBe(200)
      expect(res.body.data.suggestedRefreshSeconds).toBe(30)
      expect(Array.isArray(res.body.data.rows)).toBe(true)
    })
  })

  describe('Traceability', () => {
    it('finds the work order by order number and returns lineage', async () => {
      const order = await prisma.productionOrder.findUnique({ where: { id: workOrderId } })
      expect(order).toBeTruthy()

      const search = await auth(
        request(app).get(`/api/v1/t/${fx.slug}/manufacturing/traceability/search?query=${order!.orderNumber}`),
      )
      expect(search.status).toBe(200)
      const results = search.body.data.results as Array<{ entityType: string; entityId: string }>
      expect(results.some((r) => r.entityType === 'WORK_ORDER' && r.entityId === workOrderId)).toBe(true)

      const lineage = await auth(
        request(app).get(`/api/v1/t/${fx.slug}/manufacturing/traceability/WORK_ORDER/${workOrderId}`),
      )
      expect(lineage.status).toBe(200)
      expect(lineage.body.data.root.entityId).toBe(workOrderId)
    })
  })
})
