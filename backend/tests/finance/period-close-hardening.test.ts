import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'

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

async function createFinanceTenant() {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `pc-harden-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: 'Period Close Harden', slug, email: `pc-${Date.now()}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Close',
      lastName: 'Tester',
      email: `pc-user-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { in: [...FINANCE_PERMS] as PermissionName[] } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `PC Admin ${Date.now()}`,
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
    userId: user.id,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.periodCloseChecklistAck.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.payableCloseGateRun.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.branch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Period close hardening', () => {
  let ctx = { tenantId: '', slug: '', token: '', userId: '' }
  let legalEntityId = ''
  let financialYearId = ''
  let periodId = ''

  beforeAll(async () => {
    await ensurePermissions()
    ctx = await createFinanceTenant()

    const leRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/legal-entities`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: `PC${Date.now()}`.slice(-8),
        legalName: 'Period Close LE',
        displayName: 'Period Close LE',
      })
    expect(leRes.status).toBe(201)
    legalEntityId = leRes.body.data.id

    const fyRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/financial-years`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        legalEntityId,
        name: 'FY 2026-27',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isCurrent: true,
      })
    expect(fyRes.status).toBe(201)
    financialYearId = fyRes.body.data.id

    await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/financial-years/${financialYearId}/activate`)
      .set('Authorization', `Bearer ${ctx.token}`)

    const periodsRes = await request(app)
      .get(
        `/api/v1/t/${ctx.slug}/accounting/periods?legalEntityId=${legalEntityId}&financialYearId=${financialYearId}&limit=100`,
      )
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(periodsRes.status).toBe(200)
    periodId = periodsRes.body.data[0].id
  }, 60_000)

  afterAll(async () => {
    if (ctx.tenantId) await cleanupTenant(ctx.tenantId)
  })

  it('returns close-readiness with checks and hardBlockEnabled false by default', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${ctx.slug}/accounting/periods/${periodId}/close-readiness`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.periodId).toBe(periodId)
    expect(res.body.data.hardBlockEnabled).toBe(false)
    expect(res.body.data.canClose).toBe(true)
    expect(Array.isArray(res.body.data.checks)).toBe(true)
    expect(res.body.data.checks.some((c: { key: string }) => c.key === 'AP_CLOSE_GATE')).toBe(true)
    expect(res.body.data.checks.some((c: { key: string }) => c.key === 'UNPOSTED_JOURNALS')).toBe(true)
  })

  it('persists checklist acks', async () => {
    const putRes = await request(app)
      .put(`/api/v1/t/${ctx.slug}/accounting/periods/${periodId}/checklist-acks`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        items: [{ checkKey: 'AP_CLOSE_GATE', status: 'ACK', note: 'Reviewed for test' }],
      })
    expect(putRes.status).toBe(200)
    expect(putRes.body.data).toHaveLength(1)
    expect(putRes.body.data[0].checkKey).toBe('AP_CLOSE_GATE')
    expect(putRes.body.data[0].status).toBe('ACK')

    const getRes = await request(app)
      .get(`/api/v1/t/${ctx.slug}/accounting/periods/${periodId}/checklist-acks`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.data[0].note).toBe('Reviewed for test')
  })

  it('rejects N/A without note', async () => {
    const res = await request(app)
      .put(`/api/v1/t/${ctx.slug}/accounting/periods/${periodId}/checklist-acks`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ items: [{ checkKey: 'BANK_RECON', status: 'NA' }] })
    expect(res.status).toBe(400)
  })

  it('hard-blocks close when periodCloseHardBlock is on and AP gate is BLOCKED', async () => {
    await request(app)
      .put(`/api/v1/t/${ctx.slug}/accounting/settings`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ legalEntityId, periodCloseHardBlock: true })

    await prisma.payableCloseGateRun.create({
      data: {
        tenantId: ctx.tenantId,
        legalEntityId,
        periodId,
        asOfDate: new Date('2026-04-30'),
        status: 'BLOCKED',
        checksTotal: 1,
        checksPassed: 0,
        checksWarning: 0,
        checksBlocked: 1,
        checksFailed: 0,
        createdBy: ctx.userId,
      },
    })

    const ready = await request(app)
      .get(`/api/v1/t/${ctx.slug}/accounting/periods/${periodId}/close-readiness`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(ready.status).toBe(200)
    expect(ready.body.data.hardBlockEnabled).toBe(true)
    expect(ready.body.data.blockingCount).toBeGreaterThan(0)
    expect(ready.body.data.canClose).toBe(false)

    const closeRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/periods/${periodId}/close`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(closeRes.status).toBe(400)
    expect(closeRes.body.code).toBe('PERIOD_CLOSE_BLOCKED')

    await request(app)
      .put(`/api/v1/t/${ctx.slug}/accounting/settings`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ legalEntityId, periodCloseHardBlock: false })

    const closeOk = await request(app)
      .post(`/api/v1/t/${ctx.slug}/accounting/periods/${periodId}/close`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(closeOk.status).toBe(200)
    expect(closeOk.body.data.status).toBe('CLOSED')
  })
})
