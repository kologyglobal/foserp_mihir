/**
 * Finance Budgeting Phase 1 — versions, lines, BVA.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  FINANCE_PERMS,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

describe.skipIf(!dbAvailable)('Finance Budgeting Phase 1', () => {
  let fx: ApAllocFixture
  let otherFx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'budg')
    fx = await bootstrapApAllocFixture(app, ctx)
    const otherCtx = await createFinanceAdminTenant(app, 'budg2')
    otherFx = await bootstrapApAllocFixture(app, otherCtx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) {
      await prisma.budgetLine.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.budgetVersion.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupTenant(fx.tenantId)
    }
    if (otherFx?.tenantId) {
      await prisma.budgetLine.deleteMany({ where: { tenantId: otherFx.tenantId } }).catch(() => {})
      await prisma.budgetVersion.deleteMany({ where: { tenantId: otherFx.tenantId } }).catch(() => {})
      await cleanupTenant(otherFx.tenantId)
    }
  })

  const base = () => `/api/v1/t/${fx.slug}/accounting/budgeting`
  const auth = () => ({ Authorization: `Bearer ${fx.token}` })

  it('creates version → line → submit → approve → BVA returns budget', async () => {
    const now = new Date()
    const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
    const create = await request(app)
      .post(`${base()}/versions`)
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        code: 'BV-FY-01',
        name: 'Annual Budget FY',
        kind: 'ORIGINAL',
        financialYearLabel: `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
        fyStartDate: `${fyStartYear}-04-01`,
        fyEndDate: `${fyStartYear + 1}-03-31`,
        notes: 'phase1',
      })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    expect(create.body.data.status).toBe('DRAFT')
    const id = create.body.data.id as string
    let updatedAt = create.body.data.updatedAt as string

    const months = {
      Apr: '1000.0000',
      May: '1000.0000',
      Jun: '1000.0000',
      Jul: '1000.0000',
      Aug: '1000.0000',
      Sep: '1000.0000',
      Oct: '1000.0000',
      Nov: '1000.0000',
      Dec: '1000.0000',
      Jan: '1000.0000',
      Feb: '1000.0000',
      Mar: '1000.0000',
    }
    const line = await request(app)
      .post(`${base()}/versions/${id}/lines`)
      .set(auth())
      .send({ accountId: fx.purchaseAccountId, months })
    expect(line.status, JSON.stringify(line.body)).toBe(201)
    expect(line.body.data.total).toBe('12000.0000')

    const submit = await request(app)
      .post(`${base()}/versions/${id}/submit`)
      .set(auth())
      .send({ expectedUpdatedAt: updatedAt })
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    expect(submit.body.data.status).toBe('PENDING_APPROVAL')
    updatedAt = submit.body.data.updatedAt

    const approve = await request(app)
      .post(`${base()}/versions/${id}/approve`)
      .set(auth())
      .send({ expectedUpdatedAt: updatedAt })
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)
    expect(approve.body.data.status).toBe('APPROVED')

    const bva = await request(app)
      .get(`${base()}/budget-vs-actual`)
      .query({ legalEntityId: fx.legalEntityId, versionId: id })
      .set(auth())
    expect(bva.status, JSON.stringify(bva.body)).toBe(200)
    expect(bva.body.data.rows.length).toBeGreaterThanOrEqual(1)
    const row = bva.body.data.rows.find((r: { accountId: string }) => r.accountId === fx.purchaseAccountId)
    expect(row).toBeTruthy()
    expect(row.budgetTotal).toBe('12000.0000')
    expect(row.actual).toBeTruthy()

    const overview = await request(app)
      .get(`${base()}/overview`)
      .query({ legalEntityId: fx.legalEntityId })
      .set(auth())
    expect(overview.status).toBe(200)
    expect(overview.body.data.totalVersions).toBeGreaterThanOrEqual(1)
  })

  it('enforces tenant isolation', async () => {
    const create = await request(app)
      .post(`${base()}/versions`)
      .set(auth())
      .send({
        legalEntityId: fx.legalEntityId,
        code: 'BV-ISO',
        name: 'Isolation',
        financialYearLabel: '2025-26',
        fyStartDate: '2025-04-01',
        fyEndDate: '2026-03-31',
      })
    const id = create.body.data.id as string
    const other = await request(app)
      .get(`/api/v1/t/${otherFx.slug}/accounting/budgeting/versions/${id}`)
      .set('Authorization', `Bearer ${otherFx.token}`)
    expect(other.status).toBe(404)
  })

  it('returns 403 without finance.budget.view', async () => {
    const limited = FINANCE_PERMS.filter((p) => !p.startsWith('finance.budget.'))
    const { token } = await createUserWithPerms(app, fx.tenantId, fx.slug, limited, 'budg-noview')
    const res = await request(app)
      .get(`${base()}/overview`)
      .query({ legalEntityId: fx.legalEntityId })
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})
