/**
 * Auth self-service — profile, password policy, forgot/reset, refresh/logout.
 * Run: npx vitest run tests/auth-self-service.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { hashPassword } from '../src/utils/password.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const slug = `auth-ss-${Date.now()}`
let tenantId = ''
let userEmail = ''
let currentPassword = 'StartPass1!'

beforeAll(async () => {
  if (!dbAvailable) return

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Auth Self Service',
      slug,
      email: `auth-ss-${Date.now()}@test.com`,
      status: 'ACTIVE',
    },
  })
  tenantId = tenant.id

  await prisma.tenantSecuritySettings.create({
    data: {
      tenantId,
      passwordMinLength: 10,
      maxFailedLogins: 5,
      requireComplexity: true,
      mfaMode: 'off',
    },
  })

  userEmail = `selfsvc-${Date.now()}@test.com`
  await prisma.user.create({
    data: {
      tenantId,
      firstName: 'Self',
      lastName: 'Service',
      email: userEmail,
      passwordHash: await hashPassword(currentPassword),
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
})

afterAll(async () => {
  if (!dbAvailable || !tenantId) return
  await prisma.passwordResetToken.deleteMany({ where: { user: { tenantId } } }).catch(() => {})
  await prisma.refreshToken.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenantSecuritySettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
})

async function login(pw = currentPassword) {
  const res = await request(app).post('/api/v1/auth/login').send({
    email: userEmail,
    password: pw,
    tenantSlug: slug,
  })
  expect(res.status).toBe(200)
  return res.body.data as { accessToken: string; refreshToken: string }
}

describe('Auth self-service', () => {
  it.skipIf(!dbAvailable)('GET /auth/me and PATCH profile', async () => {
    const { accessToken } = await login()
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`)
    expect(me.status).toBe(200)
    expect(me.body.data.email).toBe(userEmail)

    const patched = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: 'Updated',
        lastName: 'Profile',
        mobile: '9876543210',
        designation: 'Tester',
      })
    expect(patched.status).toBe(200)
    expect(patched.body.data.firstName).toBe('Updated')
    expect(patched.body.data.designation).toBe('Tester')
  })

  it.skipIf(!dbAvailable)('rejects change-password below tenant policy', async () => {
    const { accessToken } = await login()
    const short = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword, newPassword: 'Short12!' }) // 8 chars — passes Zod floor, fails tenant min 10
    expect(short.status).toBe(400)
    expect(String(short.body.message ?? '')).toMatch(/at least 10/i)

    const weak = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword, newPassword: 'alllowercase1' })
    expect(weak.status).toBe(400)
    expect(String(weak.body.message ?? '')).toMatch(/upper|lower|digit/i)
  })

  it.skipIf(!dbAvailable)('change-password succeeds and revokes refresh tokens', async () => {
    const tokens = await login()
    const nextPassword = 'NextPass2!'
    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({ currentPassword, newPassword: nextPassword })
    expect(changed.status).toBe(200)
    currentPassword = nextPassword

    const refresh = await request(app).post('/api/v1/auth/refresh-token').send({
      refreshToken: tokens.refreshToken,
    })
    expect(refresh.status).toBe(401)

    const relogin = await login()
    expect(relogin.accessToken).toBeTruthy()
  })

  it.skipIf(!dbAvailable)('forgot + reset password flow', async () => {
    const forgot = await request(app).post('/api/v1/auth/forgot-password').send({
      tenantSlug: slug,
      email: userEmail,
    })
    expect(forgot.status).toBe(200)
    expect(forgot.body.data?.resetToken).toBeTruthy()
    const resetToken = forgot.body.data.resetToken as string

    const badPolicy = await request(app).post('/api/v1/auth/reset-password').send({
      token: resetToken,
      password: 'tiny',
    })
    expect(badPolicy.status).toBe(400)

    const resetPw = 'ResetPass3!'
    const reset = await request(app).post('/api/v1/auth/reset-password').send({
      token: resetToken,
      password: resetPw,
    })
    expect(reset.status).toBe(200)
    currentPassword = resetPw

    const again = await login()
    expect(again.accessToken).toBeTruthy()
  })

  it.skipIf(!dbAvailable)('refresh then logout', async () => {
    const tokens = await login()
    const refreshed = await request(app).post('/api/v1/auth/refresh-token').send({
      refreshToken: tokens.refreshToken,
    })
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.data?.accessToken).toBeTruthy()

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`)
      .send({ refreshToken: refreshed.body.data.refreshToken ?? tokens.refreshToken })
    expect([200, 204]).toContain(logout.status)
  })
})
