/**
 * Admin Panel Phase 7 — EffectiveAccessService + Access Review register.
 * Includes HTTP proof that Phase 7 owns GET …/users/:id/effective-access (not compact A4).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import * as accessReviewService from '../src/modules/effective-access/access-review.service.js'
import * as effectiveAccessService from '../src/modules/effective-access/effective-access.service.js'
import * as userService from '../src/modules/users/user.service.js'

const TENANT_SLUG = 'vasant-trailers'
const app = createApp()

describe('admin effective access phase 7', () => {
  let tenantId = ''
  let userId = ''
  let roleId = ''
  let adminToken = ''

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — seed required`)
    tenantId = tenant.id

    const role = await prisma.role.findFirst({
      where: { tenantId, name: 'Tenant Admin', deletedAt: null },
      include: { rolePermissions: { include: { permission: true } } },
    })
    if (!role) throw new Error('Tenant Admin role not found')
    roleId = role.id

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@vasant-trailers.com',
      password: 'Admin@123',
      tenantSlug: TENANT_SLUG,
    })
    if (login.status === 200 && login.body?.data?.accessToken) {
      adminToken = login.body.data.accessToken as string
    }
  })

  afterAll(async () => {
    if (userId) {
      await prisma.userRole.deleteMany({ where: { userId } })
      await prisma.user.deleteMany({ where: { id: userId } })
    }
  })

  it('explains effective access from roles and flags access-review attention', async () => {
    const email = `access.phase7.${Date.now()}@example.com`
    const user = await userService.createUser(tenantId, {
      firstName: 'Access',
      lastName: 'Seven',
      email,
      password: 'Password123!',
      roleIds: [roleId],
    })
    userId = user.id

    const report = await effectiveAccessService.getEffectiveAccess(tenantId, userId)
    expect(report.user.email).toBe(email)
    expect(report.roles.some((r) => r.name === 'Tenant Admin')).toBe(true)
    expect(report.permissionCount).toBeGreaterThan(0)
    expect(report.permissions.every((p) => p.sources.length > 0)).toBe(true)
    expect(report.scopes.unrestricted).toBe(true)
    expect(Array.isArray(report.moduleAdministrations)).toBe(true)
    expect(report.explain.notes.length).toBeGreaterThan(0)

    const emptyEmail = `noreview.phase7.${Date.now()}@example.com`
    const emptyUser = await userService.createUser(tenantId, {
      firstName: 'No',
      lastName: 'Roles',
      email: emptyEmail,
      password: 'Password123!',
    })

    try {
      const review = await accessReviewService.buildAccessReview(tenantId)
      expect(review.totals.usersScanned).toBeGreaterThan(0)
      const hit = review.items.find((i) => i.userId === emptyUser.id)
      expect(hit?.reasons).toContain('NO_ROLES')
      expect(hit?.severity).toBe('high')

      const adminHit = review.items.find((i) => i.userId === userId)
      if (adminHit) {
        expect(adminHit.reasons.length).toBeGreaterThan(0)
      }
    } finally {
      await prisma.userRole.deleteMany({ where: { userId: emptyUser.id } })
      await prisma.user.deleteMany({ where: { id: emptyUser.id } })
    }
  })

  it('HTTP GET effective-access returns Phase 7 detailed report shape', async () => {
    if (!adminToken) {
      throw new Error('Admin login failed — seed admin@vasant-trailers.com required')
    }
    if (!userId) {
      const user = await userService.createUser(tenantId, {
        firstName: 'Http',
        lastName: 'Access',
        email: `access.http.${Date.now()}@example.com`,
        password: 'Password123!',
        roleIds: [roleId],
      })
      userId = user.id
    }

    const res = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users/${userId}/effective-access`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const data = res.body.data
    expect(data.explain).toBeTruthy()
    expect(Array.isArray(data.explain?.notes)).toBe(true)
    expect(Array.isArray(data.permissions)).toBe(true)
    expect(data.permissions[0]?.sources).toBeDefined()
    expect(data.scopes).toBeTruthy()
    expect(data.generatedAt).toBeTruthy()
    expect(Array.isArray(data.moduleAdministrations)).toBe(true)
    expect(typeof data.permissions[0]).toBe('object')
    expect(data.user?.email).toBeTruthy()
  })
})
