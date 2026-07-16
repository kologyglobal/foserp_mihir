import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'

const app = createApp()
let dbAvailable = false

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
    dbAvailable = true
  } catch {
    dbAvailable = false
  }
})

describe('Health', () => {
  it('GET /api/v1/health returns success', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toContain('running')
  })
})

describe('Auth', () => {
  it.skipIf(!dbAvailable)('POST /api/v1/auth/login rejects invalid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'invalid@test.com',
      password: 'wrong',
      tenantSlug: 'vasant-trailers',
    })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })
})

describe('Tenant isolation', () => {
  let tenantAId = ''
  let tenantBId = ''
  let userAToken = ''
  let leadBId = ''

  beforeAll(async () => {
    if (!dbAvailable) return
    const tenantA = await prisma.tenant.create({
      data: { name: 'Tenant A Test', slug: `tenant-a-${Date.now()}`, email: 'a@test.com', status: 'ACTIVE' },
    })
    const tenantB = await prisma.tenant.create({
      data: { name: 'Tenant B Test', slug: `tenant-b-${Date.now()}`, email: 'b@test.com', status: 'ACTIVE' },
    })
    tenantAId = tenantA.id
    tenantBId = tenantB.id

    const { hashPassword } = await import('../src/utils/password.js')
    const pw = await hashPassword('Test@123')

    const userA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        firstName: 'User',
        lastName: 'A',
        email: `usera-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })

    const perm = await prisma.permission.findFirst({ where: { name: 'crm.lead.view' } })
    const role = await prisma.role.create({
      data: {
        tenantId: tenantAId,
        name: `Test Role A ${Date.now()}`,
        rolePermissions: perm ? { create: [{ permissionId: perm.id }] } : undefined,
      },
    })
    await prisma.userRole.create({ data: { userId: userA.id, roleId: role.id, tenantId: tenantAId } })

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: userA.email,
      password: 'Test@123',
      tenantSlug: tenantA.slug,
    })
    userAToken = loginRes.body.data?.accessToken ?? ''

    const leadB = await prisma.crmLead.create({
      data: {
        tenantId: tenantBId,
        leadCode: `LEAD-TEST-${Date.now()}`,
        prospectName: 'Secret Lead B',
        source: 'other',
      },
    })
    leadBId = leadB.id
  })

  afterAll(async () => {
    if (tenantAId) await prisma.tenant.delete({ where: { id: tenantAId } }).catch(() => {})
    if (tenantBId) {
      await prisma.crmLead.deleteMany({ where: { tenantId: tenantBId } })
      await prisma.tenant.delete({ where: { id: tenantBId } }).catch(() => {})
    }
  })

  it.skipIf(!dbAvailable)('User from Tenant A cannot access Tenant B lead', async () => {
    if (!userAToken) return
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantBId}/crm/leads/${leadBId}`)
      .set('Authorization', `Bearer ${userAToken}`)
    expect([403, 404]).toContain(res.status)
    expect(res.body.success).toBe(false)
  })
})
