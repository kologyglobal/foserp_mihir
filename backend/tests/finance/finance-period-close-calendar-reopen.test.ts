/**
 * Period Close calendar + checklist templates + reopen-request approval — live MySQL suite.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { deriveCalendarStatus } from '../../src/modules/accounting/period-close-ops/period-close-ops.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const FINANCE_PERMS = PERMISSIONS.filter((p) => p.startsWith('finance.'))

async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({
        where: { name },
        create: { name, module, description: name },
        update: {},
      })
      .catch(() => {})
  }
}

async function createFinanceTenant(slugPrefix: string) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `${slugPrefix}-${Date.now()}`
  const tenant = await prisma.tenant.create({
    data: { name: 'PC Ops Test', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'PC',
      lastName: 'Ops',
      email: `user-${slug}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const perms = await prisma.permission.findMany({ where: { name: { in: [...FINANCE_PERMS] as PermissionName[] } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `PC Role ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id } })
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })
  return { tenantId: tenant.id, userId: user.id, slug, token: loginRes.body.data?.accessToken ?? '' }
}

async function cleanupTenant(tenantId: string) {
  await prisma.periodReopenRequestEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.periodReopenRequest.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.periodCloseCalendarEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.periodCloseChecklistTask.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.periodCloseChecklistTemplate.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

interface Fx {
  tenantId: string
  slug: string
  token: string
  userId: string
  legalEntityId: string
  periodId: string
  periodName: string
}

async function bootstrap(ctx: { tenantId: string; slug: string; token: string; userId: string }): Promise<Fx> {
  const now = new Date()
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const leRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      code: `PC${Date.now()}`.slice(-8),
      legalName: 'Period Close Ops Co',
      displayName: 'PC Ops',
    })
  expect(leRes.status).toBe(201)
  const legalEntityId = leRes.body.data.id as string

  const fyRes = await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .send({
      legalEntityId,
      name: `FY ${fyStartYear}`,
      startDate: `${fyStartYear}-04-01`,
      endDate: `${fyStartYear + 1}-03-31`,
      isCurrent: true,
    })
  expect(fyRes.status).toBe(201)
  const financialYearId = fyRes.body.data.id as string

  await request(app)
    .post(`/api/v1/t/${ctx.slug}/accounting/financial-years/${financialYearId}/activate`)
    .set('Authorization', `Bearer ${ctx.token}`)
    .expect(200)

  await prisma.financeSettings.upsert({
    where: { legalEntityId },
    create: {
      tenantId: ctx.tenantId,
      legalEntityId,
      financeActivated: true,
      allowBackdatedPosting: true,
      backdatedDaysLimit: 400,
    },
    update: { financeActivated: true, allowBackdatedPosting: true, backdatedDaysLimit: 400 },
  })

  const periods = await prisma.accountingPeriod.findMany({
    where: { tenantId: ctx.tenantId, financialYearId },
    orderBy: { periodNumber: 'asc' },
  })
  expect(periods.length).toBeGreaterThanOrEqual(1)
  const period = periods[0]!

  return {
    tenantId: ctx.tenantId,
    slug: ctx.slug,
    token: ctx.token,
    userId: ctx.userId,
    legalEntityId,
    periodId: period.id,
    periodName: period.name,
  }
}

function auth(fx: Fx) {
  return { Authorization: `Bearer ${fx.token}` }
}

function base(fx: Fx) {
  return `/api/v1/t/${fx.slug}/accounting/period-close`
}

describe.skipIf(!dbAvailable)('finance period-close calendar + reopen requests', () => {
  let fx: Fx

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceTenant('pcops')
    fx = await bootstrap(ctx)
  }, 120_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('deriveCalendarStatus classifies due dates', () => {
    const today = new Date()
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    expect(deriveCalendarStatus(todayUtc)).toBe('DUE_TODAY')
    const yesterday = new Date(todayUtc)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    expect(deriveCalendarStatus(yesterday)).toBe('OVERDUE')
    const inTwo = new Date(todayUtc)
    inTwo.setUTCDate(inTwo.getUTCDate() + 2)
    expect(deriveCalendarStatus(inTwo)).toBe('DUE_SOON')
  })

  it('creates templates, instantiates checklist, and generates calendar', async () => {
    const createTpl = await request(app)
      .post(`${base(fx)}/checklist-templates`)
      .set(auth(fx))
      .send({
        legalEntityId: fx.legalEntityId,
        code: 'AR_POST_INVOICES',
        title: 'Post AR invoices',
        module: 'SALES_AR',
        defaultOwnerRole: 'AR Clerk',
        defaultDueOffsetDays: -2,
      })
    expect(createTpl.status).toBe(201)
    expect(createTpl.body.data.code).toBe('AR_POST_INVOICES')

    const instantiate = await request(app)
      .post(`${base(fx)}/periods/${fx.periodId}/checklist/instantiate`)
      .set(auth(fx))
    expect(instantiate.status).toBe(200)
    expect(instantiate.body.data.length).toBeGreaterThanOrEqual(1)

    const calendar = await request(app)
      .post(`${base(fx)}/periods/${fx.periodId}/calendar/generate`)
      .set(auth(fx))
    expect(calendar.status).toBe(200)
    expect(calendar.body.data.length).toBeGreaterThanOrEqual(2)
    expect(calendar.body.data.some((e: { category: string }) => e.category === 'LOCK')).toBe(true)

    const listCal = await request(app)
      .get(`${base(fx)}/periods/${fx.periodId}/calendar-events`)
      .set(auth(fx))
    expect(listCal.status).toBe(200)
    expect(listCal.body.data.length).toBe(calendar.body.data.length)
  }, 60_000)

  it('reopen request approve path reopens a closed period', async () => {
    await prisma.accountingPeriod.update({
      where: { id: fx.periodId },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: fx.userId },
    })

    const until = new Date()
    until.setUTCDate(until.getUTCDate() + 7)
    const untilStr = until.toISOString().slice(0, 10)

    const create = await request(app)
      .post(`${base(fx)}/reopen-requests`)
      .set(auth(fx))
      .send({
        legalEntityId: fx.legalEntityId,
        periodId: fx.periodId,
        moduleLabel: 'Inventory',
        reasonCode: 'INCORRECT_AMOUNT',
        riskExplanation: 'Need to reverse a misposted stock adjustment in the locked period.',
        requestedUntil: untilStr,
        submit: true,
      })
    expect(create.status).toBe(201)
    expect(create.body.data.status).toBe('PENDING_APPROVAL')
    expect(create.body.data.requestNumber).toMatch(/^ROR-/)
    const id = create.body.data.id as string

    const approve = await request(app)
      .post(`${base(fx)}/reopen-requests/${id}/approve`)
      .set(auth(fx))
      .send({ note: 'Approved for correction', activate: true })
    expect(approve.status).toBe(200)
    expect(approve.body.data.status).toBe('OPEN_TEMPORARILY')

    const period = await prisma.accountingPeriod.findFirstOrThrow({ where: { id: fx.periodId } })
    expect(period.status).toBe('REOPENED')
    expect(period.reopenReason).toContain('ROR-')
  }, 60_000)

  it('rejects a pending reopen request without reopening', async () => {
    // Close again for a fresh request
    await prisma.accountingPeriod.update({
      where: { id: fx.periodId },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: fx.userId },
    })
    const until = new Date()
    until.setUTCDate(until.getUTCDate() + 3)
    const create = await request(app)
      .post(`${base(fx)}/reopen-requests`)
      .set(auth(fx))
      .send({
        legalEntityId: fx.legalEntityId,
        periodId: fx.periodId,
        moduleLabel: 'GL',
        reasonCode: 'OTHER',
        riskExplanation: 'Should be rejected',
        requestedUntil: until.toISOString().slice(0, 10),
        submit: true,
      })
    expect(create.status).toBe(201)

    const reject = await request(app)
      .post(`${base(fx)}/reopen-requests/${create.body.data.id}/reject`)
      .set(auth(fx))
      .send({ reason: 'Insufficient risk justification' })
    expect(reject.status).toBe(200)
    expect(reject.body.data.status).toBe('REJECTED')

    const period = await prisma.accountingPeriod.findFirstOrThrow({ where: { id: fx.periodId } })
    expect(period.status).toBe('CLOSED')
  }, 60_000)
})
