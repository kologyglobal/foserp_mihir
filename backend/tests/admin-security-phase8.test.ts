/**
 * Admin Panel Phase 8 — login activity, lockout, sessions register.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/config/database.js'
import * as authService from '../src/modules/auth/auth.service.js'
import { MAX_FAILED_LOGINS } from '../src/modules/security/security.constants.js'
import * as securityService from '../src/modules/security/security.service.js'
import * as userService from '../src/modules/users/user.service.js'
import { hashPassword } from '../src/utils/password.js'

const TENANT_SLUG = 'vasant-trailers'

describe('admin security phase 8', () => {
  let tenantId = ''
  let userId = ''
  const password = 'Password123!'
  let email = ''

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — seed required`)
    tenantId = tenant.id
  })

  afterAll(async () => {
    if (userId) {
      await prisma.loginActivity.deleteMany({ where: { userId } })
      await prisma.refreshToken.deleteMany({ where: { userId } })
      await prisma.userRole.deleteMany({ where: { userId } })
      await prisma.user.deleteMany({ where: { id: userId } })
    }
  })

  it('records login activity, auto-locks after failures, and unlocks', async () => {
    email = `sec.phase8.${Date.now()}@example.com`
    const user = await userService.createUser(tenantId, {
      firstName: 'Sec',
      lastName: 'Eight',
      email,
      password,
      status: 'ACTIVE',
    })
    userId = user.id
    // ensure ACTIVE (create may default INVITED)
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE', passwordHash: await hashPassword(password), emailVerified: true },
    })

    await authService.login(
      { tenantSlug: TENANT_SLUG, email, password },
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    )

    const activity = await securityService.listLoginActivity(tenantId, {
      page: 1,
      limit: 20,
      sortOrder: 'desc',
      success: 'all',
      userId,
    })
    expect(activity.items.some((a) => a.success && a.reason === 'SUCCESS')).toBe(true)

    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      await expect(
        authService.login(
          { tenantSlug: TENANT_SLUG, email, password: 'WrongPassword!' },
          { ipAddress: '127.0.0.1', userAgent: 'vitest' },
        ),
      ).rejects.toThrow()
    }

    const locked = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(locked.status).toBe('BLOCKED')
    expect(locked.failedLoginCount).toBeGreaterThanOrEqual(MAX_FAILED_LOGINS)
    expect(locked.lockedAt).not.toBeNull()

    const lockedList = await securityService.listLockedAccounts(tenantId)
    expect(lockedList.items.some((u) => u.id === userId)).toBe(true)

    const unlocked = await securityService.unlockUser(tenantId, userId)
    expect(unlocked.status).toBe('ACTIVE')

    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(after.failedLoginCount).toBe(0)
    expect(after.lockedAt).toBeNull()

    // re-login works
    const ok = await authService.login(
      { tenantSlug: TENANT_SLUG, email, password },
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    )
    expect(ok.accessToken).toBeTruthy()

    const sessions = await securityService.listActiveSessions(tenantId, {
      page: 1,
      limit: 50,
      sortOrder: 'desc',
      userId,
    })
    expect(sessions.items.length).toBeGreaterThan(0)
    await securityService.revokeSession(tenantId, sessions.items[0]!.id)
  })
})
