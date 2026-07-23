/**
 * Admin Panel Phase 7 — EffectiveAccessService + Access Review register.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/config/database.js'
import * as accessReviewService from '../src/modules/effective-access/access-review.service.js'
import * as effectiveAccessService from '../src/modules/effective-access/effective-access.service.js'
import * as userService from '../src/modules/users/user.service.js'

const TENANT_SLUG = 'vasant-trailers'

describe('admin effective access phase 7', () => {
  let tenantId = ''
  let userId = ''
  let roleId = ''

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
    expect(report.explain.notes.length).toBeGreaterThan(0)

    // No roles user for review
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
      // Tenant Admin typically has sensitive + unrestricted
      if (adminHit) {
        expect(adminHit.reasons.length).toBeGreaterThan(0)
      }
    } finally {
      await prisma.userRole.deleteMany({ where: { userId: emptyUser.id } })
      await prisma.user.deleteMany({ where: { id: emptyUser.id } })
    }
  })
})
