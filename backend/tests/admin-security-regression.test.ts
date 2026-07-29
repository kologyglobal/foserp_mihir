/**
 * Admin A3–A9 security regression — HTTP-level pack over invitations, scopes,
 * effective access, access review, login/sessions, module flags + administrators.
 * Run: npx vitest run tests/admin-security-regression.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { MAX_FAILED_LOGINS } from '../src/modules/security/security.constants.js'
import { hashPassword } from '../src/utils/password.js'

const TENANT_SLUG = 'vasant-trailers'
const app = createApp()

describe('admin security regression', () => {
  let tenantId = ''
  let otherTenantId = ''
  let adminToken = ''
  let limitedToken = ''
  let limitedUserId = ''
  let invitedUserId = ''
  let foreignUserId = ''
  let roleId = ''
  const password = 'Password123!'
  const touchedUsers: string[] = []

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — seed required`)
    tenantId = tenant.id

    const role = await prisma.role.findFirst({
      where: { tenantId, name: 'Tenant Admin', deletedAt: null },
    })
    if (!role) throw new Error('Tenant Admin role not found')
    roleId = role.id

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@vasant-trailers.com',
      password: 'Admin@123',
      tenantSlug: TENANT_SLUG,
    })
    expect(login.status).toBe(200)
    adminToken = login.body.data.accessToken as string

    const other = await prisma.tenant.create({
      data: {
        name: 'Admin Regression Other',
        slug: `admin-reg-other-${Date.now()}`,
        email: `admin-reg-other-${Date.now()}@example.com`,
        status: 'ACTIVE',
      },
    })
    otherTenantId = other.id

    const foreign = await prisma.user.create({
      data: {
        tenantId: otherTenantId,
        firstName: 'Foreign',
        lastName: 'Cross',
        email: `foreign.reg.${Date.now()}@example.com`,
        passwordHash: await hashPassword(password),
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    foreignUserId = foreign.id

    const limitedEmail = `limited.reg.${Date.now()}@example.com`
    const limited = await prisma.user.create({
      data: {
        tenantId,
        firstName: 'Limited',
        lastName: 'Viewer',
        email: limitedEmail,
        passwordHash: await hashPassword(password),
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    limitedUserId = limited.id
    touchedUsers.push(limitedUserId)

    const limitedLogin = await request(app).post('/api/v1/auth/login').send({
      email: limitedEmail,
      password,
      tenantSlug: TENANT_SLUG,
    })
    expect(limitedLogin.status).toBe(200)
    limitedToken = limitedLogin.body.data.accessToken as string
  })

  afterAll(async () => {
    const ids = [...new Set([...touchedUsers, invitedUserId].filter(Boolean))]
    if (ids.length) {
      await prisma.moduleAdministrator.deleteMany({ where: { userId: { in: ids } } })
      await prisma.userLegalEntityAccess.deleteMany({ where: { userId: { in: ids } } })
      await prisma.userBranchAccess.deleteMany({ where: { userId: { in: ids } } })
      await prisma.userWarehouseAccess.deleteMany({ where: { userId: { in: ids } } })
      await prisma.userInvitation.deleteMany({ where: { userId: { in: ids } } })
      await prisma.loginActivity.deleteMany({ where: { userId: { in: ids } } })
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } })
      await prisma.userRole.deleteMany({ where: { userId: { in: ids } } })
      await prisma.user.deleteMany({ where: { id: { in: ids } } })
    }
    if (foreignUserId) {
      await prisma.user.deleteMany({ where: { id: foreignUserId } })
    }
    if (otherTenantId) {
      await prisma.tenant.delete({ where: { id: otherTenantId } }).catch(() => {})
    }
    if (tenantId) {
      await prisma.moduleAdministrator.deleteMany({ where: { tenantId, moduleKey: 'gate' } })
      await prisma.tenantModuleFlag.deleteMany({ where: { tenantId, moduleKey: 'gate' } })
    }
  })

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` }
  }

  it('invite → accept → ACTIVE; deactivate revokes sessions', async () => {
    const email = `invite.reg.${Date.now()}@example.com`
    const invite = await request(app)
      .post(`/api/v1/t/${TENANT_SLUG}/users/invite`)
      .set(auth(adminToken))
      .send({ firstName: 'Invite', lastName: 'Reg', email, roleIds: [roleId] })
    expect(invite.status).toBe(201)
    invitedUserId = invite.body.data.user.id as string
    touchedUsers.push(invitedUserId)
    const token = invite.body.data.inviteToken as string
    expect(token).toBeTruthy()

    const accept = await request(app).post('/api/v1/auth/accept-invitation').send({
      token,
      password,
    })
    expect(accept.status).toBe(200)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: invitedUserId } })
    expect(user.status).toBe('ACTIVE')

    await prisma.refreshToken.create({
      data: {
        userId: invitedUserId,
        tenantId,
        tokenHash: await hashPassword(`session-${Date.now()}`),
        expiresAt: new Date(Date.now() + 86400000),
        userAgent: 'vitest-reg',
        ipAddress: '127.0.0.1',
      },
    })

    const deactivate = await request(app)
      .post(`/api/v1/t/${TENANT_SLUG}/users/${invitedUserId}/deactivate`)
      .set(auth(adminToken))
    expect(deactivate.status).toBe(200)
    expect(deactivate.body.data.revokedSessions).toBeGreaterThanOrEqual(1)

    const sessions = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users/${invitedUserId}/sessions`)
      .set(auth(adminToken))
    expect(sessions.status).toBe(200)
    expect(sessions.body.data).toHaveLength(0)
  })

  it('scopes replace → GET; empty = unrestricted', async () => {
    const target = limitedUserId
    const empty = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users/${target}/scopes`)
      .set(auth(adminToken))
    expect(empty.status).toBe(200)
    expect(empty.body.data.unrestricted).toBe(true)

    const le = await prisma.legalEntity.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true },
    })
    if (!le) return

    const put = await request(app)
      .put(`/api/v1/t/${TENANT_SLUG}/users/${target}/scopes`)
      .set(auth(adminToken))
      .send({
        legalEntities: [{ legalEntityId: le.id, isDefault: true, accessLevel: 'TRANSACT' }],
        branchIds: [],
        warehouseIds: [],
      })
    expect(put.status).toBe(200)
    expect(put.body.data.unrestricted).toBe(false)
    expect(put.body.data.legalEntities).toHaveLength(1)

    const clear = await request(app)
      .put(`/api/v1/t/${TENANT_SLUG}/users/${target}/scopes`)
      .set(auth(adminToken))
      .send({ legalEntities: [], branchIds: [], warehouseIds: [] })
    expect(clear.status).toBe(200)
    expect(clear.body.data.unrestricted).toBe(true)
  })

  it('effective access detailed shape + access review NO_ROLES', async () => {
    const ea = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users/${limitedUserId}/effective-access`)
      .set(auth(adminToken))
    expect(ea.status).toBe(200)
    expect(ea.body.data.explain).toBeTruthy()
    expect(Array.isArray(ea.body.data.moduleAdministrations)).toBe(true)
    expect(ea.body.data.permissionCount === 0 || typeof ea.body.data.permissions[0] === 'object').toBe(
      true,
    )

    const review = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/access-review`)
      .set(auth(adminToken))
    expect(review.status).toBe(200)
    const hit = (review.body.data.items as Array<{ userId: string; reasons: string[] }>).find(
      (i) => i.userId === limitedUserId,
    )
    expect(hit?.reasons).toContain('NO_ROLES')
  })

  it('login failures lock; unlock clears; sessions list + revoke', async () => {
    const email = `lock.reg.${Date.now()}@example.com`
    const u = await prisma.user.create({
      data: {
        tenantId,
        firstName: 'Lock',
        lastName: 'Reg',
        email,
        passwordHash: await hashPassword(password),
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    touchedUsers.push(u.id)

    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      const fail = await request(app).post('/api/v1/auth/login').send({
        email,
        password: 'WrongPassword!',
        tenantSlug: TENANT_SLUG,
      })
      expect(fail.status).toBe(401)
    }

    const locked = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(locked.status).toBe('BLOCKED')

    const unlock = await request(app)
      .post(`/api/v1/t/${TENANT_SLUG}/users/${u.id}/unlock`)
      .set(auth(adminToken))
    expect(unlock.status).toBe(200)

    const ok = await request(app).post('/api/v1/auth/login').send({
      email,
      password,
      tenantSlug: TENANT_SLUG,
    })
    expect(ok.status).toBe(200)

    const sessions = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/security/sessions`)
      .query({ userId: u.id, limit: 20 })
      .set(auth(adminToken))
    expect(sessions.status).toBe(200)
    expect(sessions.body.data.length).toBeGreaterThanOrEqual(1)
    const sessionId = sessions.body.data[0].id as string

    const revoke = await request(app)
      .post(`/api/v1/t/${TENANT_SLUG}/security/sessions/${sessionId}/revoke`)
      .set(auth(adminToken))
    expect(revoke.status).toBe(200)
  })

  it('module flag toggle + module administrator assign', async () => {
    const flag = await request(app)
      .put(`/api/v1/t/${TENANT_SLUG}/modules/gate`)
      .set(auth(adminToken))
      .send({ isEnabled: false })
    expect(flag.status).toBe(200)
    expect(flag.body.data.isEnabled).toBe(false)

    await request(app)
      .put(`/api/v1/t/${TENANT_SLUG}/modules/gate`)
      .set(auth(adminToken))
      .send({ isEnabled: true })

    const admins = await request(app)
      .put(`/api/v1/t/${TENANT_SLUG}/modules/gate/administrators`)
      .set(auth(adminToken))
      .send({ userIds: [limitedUserId] })
    expect(admins.status).toBe(200)
    expect(admins.body.data).toHaveLength(1)
    expect(admins.body.data[0].userId).toBe(limitedUserId)

    const ea = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users/${limitedUserId}/effective-access`)
      .set(auth(adminToken))
    expect(ea.body.data.moduleAdministrations).toContain('gate')

    await request(app)
      .put(`/api/v1/t/${TENANT_SLUG}/modules/gate/administrators`)
      .set(auth(adminToken))
      .send({ userIds: [] })
  })

  it('permission denials and cross-tenant 404', async () => {
    const deniedSecurity = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/security/login-activity`)
      .set(auth(limitedToken))
    expect(deniedSecurity.status).toBe(403)

    const deniedModules = await request(app)
      .put(`/api/v1/t/${TENANT_SLUG}/modules/gate`)
      .set(auth(limitedToken))
      .send({ isEnabled: false })
    expect(deniedModules.status).toBe(403)

    const deniedReview = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/access-review`)
      .set(auth(limitedToken))
    expect(deniedReview.status).toBe(403)

    const cross = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users/${foreignUserId}`)
      .set(auth(adminToken))
    expect(cross.status).toBe(404)

    const crossEa = await request(app)
      .get(`/api/v1/t/${TENANT_SLUG}/users/${foreignUserId}/effective-access`)
      .set(auth(adminToken))
    expect(crossEa.status).toBe(404)
  })
})
