/**
 * Admin Panel Phase 4 — invitations + deactivate/session revoke (service-level).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/config/database.js'
import * as invitationService from '../src/modules/users/user-invitation.service.js'
import { hashPassword } from '../src/utils/password.js'

const TENANT_SLUG = 'vasant-trailers'

describe('admin user invitations phase 4', () => {
  let tenantId = ''
  let createdUserId = ''

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — seed required`)
    tenantId = tenant.id
  })

  afterAll(async () => {
    if (createdUserId) {
      await prisma.userInvitation.deleteMany({ where: { userId: createdUserId } })
      await prisma.refreshToken.deleteMany({ where: { userId: createdUserId } })
      await prisma.userRole.deleteMany({ where: { userId: createdUserId } })
      await prisma.user.deleteMany({ where: { id: createdUserId } })
    }
  })

  it('invites user, accepts invitation, and revokes sessions on deactivate', async () => {
    const email = `invite.phase4.${Date.now()}@example.com`
    const invited = await invitationService.inviteUser(tenantId, {
      firstName: 'Phase',
      lastName: 'Four',
      email,
    })
    createdUserId = invited.user.id
    expect(invited.user.status).toBe('INVITED')
    expect(invited.inviteToken).toBeTruthy()

    await invitationService.acceptInvitationByToken(invited.inviteToken!, 'Password123!')
    const active = await prisma.user.findUniqueOrThrow({ where: { id: createdUserId } })
    expect(active.status).toBe('ACTIVE')
    expect(active.emailVerified).toBe(true)

    // Seed a fake active session
    await prisma.refreshToken.create({
      data: {
        userId: createdUserId,
        tenantId,
        tokenHash: await hashPassword('session-token'),
        expiresAt: new Date(Date.now() + 86400000),
        userAgent: 'vitest',
        ipAddress: '127.0.0.1',
      },
    })
    const sessionsBefore = await invitationService.listUserSessions(tenantId, createdUserId)
    expect(sessionsBefore.length).toBeGreaterThanOrEqual(1)

    const deactivated = await invitationService.deactivateUser(tenantId, createdUserId)
    expect(deactivated.user.status).toBe('INACTIVE')
    expect(deactivated.revokedSessions).toBeGreaterThanOrEqual(1)

    const sessionsAfter = await invitationService.listUserSessions(tenantId, createdUserId)
    expect(sessionsAfter).toHaveLength(0)
  })
})
