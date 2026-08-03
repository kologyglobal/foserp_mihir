/**
 * Admin tenants / users / roles smoke — Super Admin tenant CRUD + tenant-scoped
 * user/role CRUD + cross-tenant isolation.
 * Run: npx vitest run tests/admin-tenants-users-roles-smoke.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = 'vasant-trailers'
const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

describe('admin tenants/users/roles smoke', () => {
  let superToken = ''
  let adminToken = ''
  let createdTenantId = ''
  let createdTenantSlug = ''
  let createdUserId = ''
  let createdRoleId = ''
  let foreignTenantId = ''
  let foreignUserId = ''

  beforeAll(async () => {
    if (!dbAvailable) return

    const superLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'super@fos-erp.com',
      password: 'Super@123',
      tenantSlug: TENANT_SLUG,
    })
    expect(superLogin.status).toBe(200)
    superToken = superLogin.body.data.accessToken as string

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@vasant-trailers.com',
      password: 'Admin@123',
      tenantSlug: TENANT_SLUG,
    })
    expect(adminLogin.status).toBe(200)
    adminToken = adminLogin.body.data.accessToken as string

    const foreign = await prisma.tenant.create({
      data: {
        name: 'Admin Smoke Foreign',
        slug: `admin-smoke-foreign-${Date.now()}`,
        email: `admin-smoke-foreign-${Date.now()}@example.com`,
        status: 'ACTIVE',
      },
    })
    foreignTenantId = foreign.id
    const { hashPassword } = await import('../src/utils/password.js')
    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenantId,
        firstName: 'Foreign',
        lastName: 'User',
        email: `foreign.smoke.${Date.now()}@example.com`,
        passwordHash: await hashPassword('ForeignPass1!'),
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    foreignUserId = foreignUser.id
  })

  afterAll(async () => {
    if (!dbAvailable) return
    if (createdUserId) {
      await prisma.userRole.deleteMany({ where: { userId: createdUserId } }).catch(() => {})
      await prisma.refreshToken.deleteMany({ where: { userId: createdUserId } }).catch(() => {})
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {})
    }
    if (createdRoleId) {
      await prisma.rolePermission.deleteMany({ where: { roleId: createdRoleId } }).catch(() => {})
      await prisma.role.delete({ where: { id: createdRoleId } }).catch(() => {})
    }
    if (createdTenantId) {
      await prisma.userRole.deleteMany({ where: { tenantId: createdTenantId } }).catch(() => {})
      await prisma.refreshToken.deleteMany({ where: { tenantId: createdTenantId } }).catch(() => {})
      await prisma.passwordResetToken.deleteMany({ where: { user: { tenantId: createdTenantId } } }).catch(() => {})
      await prisma.user.deleteMany({ where: { tenantId: createdTenantId } }).catch(() => {})
      await prisma.rolePermission.deleteMany({ where: { role: { tenantId: createdTenantId } } }).catch(() => {})
      await prisma.role.deleteMany({ where: { tenantId: createdTenantId } }).catch(() => {})
      await prisma.codeSeries.deleteMany({ where: { tenantId: createdTenantId } }).catch(() => {})
      await prisma.tenantSecuritySettings.deleteMany({ where: { tenantId: createdTenantId } }).catch(() => {})
      await prisma.auditLog.deleteMany({ where: { tenantId: createdTenantId } }).catch(() => {})
      await prisma.tenant.delete({ where: { id: createdTenantId } }).catch(() => {})
    }
    if (foreignUserId) {
      await prisma.user.delete({ where: { id: foreignUserId } }).catch(() => {})
    }
    if (foreignTenantId) {
      await prisma.tenant.delete({ where: { id: foreignTenantId } }).catch(() => {})
    }
  })

  it.skipIf(!dbAvailable)('Super Admin lists and creates a tenant with first admin', async () => {
    const list = await request(app)
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${superToken}`)
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.data?.items ?? list.body.data)).toBe(true)

    createdTenantSlug = `smoke-t-${Date.now()}`
    const create = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: 'Smoke Tenant',
        slug: createdTenantSlug,
        email: `${createdTenantSlug}@example.com`,
        status: 'ACTIVE',
        adminUser: {
          firstName: 'Smoke',
          lastName: 'Admin',
          email: `admin.${createdTenantSlug}@example.com`,
          password: 'SmokeAdmin1!',
        },
      })
    expect(create.status).toBe(201)
    createdTenantId = (create.body.data?.tenant?.id ?? create.body.data?.id) as string
    expect(createdTenantId).toBeTruthy()

    const get = await request(app)
      .get(`/api/v1/tenants/${createdTenantId}`)
      .set('Authorization', `Bearer ${superToken}`)
    expect(get.status).toBe(200)
    expect(get.body.data.slug).toBe(createdTenantSlug)

    const patch = await request(app)
      .patch(`/api/v1/tenants/${createdTenantId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: 'Smoke Tenant Updated' })
    expect(patch.status).toBe(200)
    expect(patch.body.data.name).toBe('Smoke Tenant Updated')
  })

  it.skipIf(!dbAvailable)('non–Super Admin cannot list all tenants', async () => {
    const list = await request(app)
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${adminToken}`)
    expect([401, 403]).toContain(list.status)
  })

  it.skipIf(!dbAvailable)('Tenant Admin lists users, creates role, creates user, assigns role', async () => {
    const users = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(users.status).toBe(200)
    expect(Array.isArray(users.body.data?.items ?? users.body.data)).toBe(true)

    const roles = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(roles.status).toBe(200)

    const catalog = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/roles/permissions/catalog`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(catalog.status).toBe(200)
    expect(Array.isArray(catalog.body.data)).toBe(true)

    const roleName = `Smoke Role ${Date.now()}`
    const createRole = await request(app)
      .post(`/api/v1/t/${TENANT_SLUG}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: roleName,
        description: 'Smoke test role',
        permissionNames: ['user.view', 'role.view'],
      })
    expect(createRole.status).toBe(201)
    createdRoleId = createRole.body.data.id as string
    expect(createdRoleId).toBeTruthy()

    const userEmail = `smoke.user.${Date.now()}@vasant-trailers.com`
    const createUser = await request(app)
      .post(`/api/v1/t/${TENANT_SLUG}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Smoke',
        lastName: 'User',
        email: userEmail,
        password: 'SmokeUser1!',
        status: 'ACTIVE',
        roleIds: [createdRoleId],
      })
    expect(createUser.status).toBe(201)
    createdUserId = createUser.body.data.id as string
    expect(createdUserId).toBeTruthy()

    const detail = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.email).toBe(userEmail)

    const patchUser = await request(app)
      .patch(`/api/v1/t/${TENANT_SLUG}/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ designation: 'Smoke Tester' })
    expect(patchUser.status).toBe(200)
    expect(patchUser.body.data.designation).toBe('Smoke Tester')

    const patchRole = await request(app)
      .patch(`/api/v1/t/${TENANT_SLUG}/roles/${createdRoleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Updated smoke role' })
    expect(patchRole.status).toBe(200)
    expect(patchRole.body.data.description).toBe('Updated smoke role')
  })

  it.skipIf(!dbAvailable)('rejects weak password on user create (policy)', async () => {
    const weak = await request(app)
      .post(`/api/v1/t/${TENANT_SLUG}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Weak',
        lastName: 'Pass',
        email: `weak.${Date.now()}@vasant-trailers.com`,
        password: 'short',
        status: 'ACTIVE',
      })
    expect(weak.status).toBe(400)
  })

  it.skipIf(!dbAvailable)('blocks cross-tenant user access', async () => {
    const cross = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users/${foreignUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect([403, 404]).toContain(cross.status)
  })
})
