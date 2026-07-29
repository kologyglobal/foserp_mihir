/**
 * A1 Authentication hardening — login messages, lockout, suspended tenant.
 * Run: npx vitest run tests/auth-hardening.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { AUTH_MSG, LOGIN_LOCKOUT_THRESHOLD } from '../src/modules/auth/auth.messages.js'

const app = createApp()
let dbAvailable = false

const slug = `auth-a1-${Date.now()}`
let tenantId = ''
let userEmail = ''
let suspendedSlug = ''
let suspendedTenantId = ''

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
    dbAvailable = true
  } catch {
    dbAvailable = false
    return
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Auth A1 Tenant',
      slug,
      email: `auth-a1-${Date.now()}@test.com`,
      status: 'ACTIVE',
    },
  })
  tenantId = tenant.id

  const suspended = await prisma.tenant.create({
    data: {
      name: 'Auth A1 Suspended',
      slug: `${slug}-suspended`,
      email: `auth-a1-susp-${Date.now()}@test.com`,
      status: 'SUSPENDED',
    },
  })
  suspendedSlug = suspended.slug
  suspendedTenantId = suspended.id

  const { hashPassword } = await import('../src/utils/password.js')
  const pw = await hashPassword('Test@12345')
  userEmail = `lockuser-${Date.now()}@test.com`
  await prisma.user.create({
    data: {
      tenantId,
      firstName: 'Lock',
      lastName: 'User',
      email: userEmail,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
})

afterAll(async () => {
  if (!dbAvailable) return
  if (tenantId) {
    await prisma.refreshToken.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
  }
  if (suspendedTenantId) {
    await prisma.tenant.delete({ where: { id: suspendedTenantId } }).catch(() => {})
  }
})

describe('A1 auth hardening', () => {
  it.skipIf(!dbAvailable)('rejects invalid credentials with generic message', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@example.com',
      password: 'wrong-password',
      tenantSlug: slug,
    })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe(AUTH_MSG.INVALID_CREDENTIALS)
    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it.skipIf(!dbAvailable)('rejects SUSPENDED tenant with organization message', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'any@example.com',
      password: 'anything',
      tenantSlug: suspendedSlug,
    })
    expect(res.status).toBe(401)
    expect(res.body.message).toBe(AUTH_MSG.TENANT_SUSPENDED)
    expect(res.body.code).toBe('AUTH_TENANT_SUSPENDED')
  })

  it.skipIf(!dbAvailable)('locks account after repeated failed passwords', async () => {
    for (let i = 0; i < LOGIN_LOCKOUT_THRESHOLD - 1; i++) {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: userEmail,
        password: 'WrongPassword!',
        tenantSlug: slug,
      })
      expect(res.status).toBe(401)
      expect(res.body.message).toBe(AUTH_MSG.INVALID_CREDENTIALS)
    }

    const locked = await request(app).post('/api/v1/auth/login').send({
      email: userEmail,
      password: 'WrongPassword!',
      tenantSlug: slug,
    })
    expect(locked.status).toBe(401)
    expect(locked.body.message).toBe(AUTH_MSG.ACCOUNT_LOCKED)
    expect(locked.body.code).toBe('AUTH_ACCOUNT_LOCKED')

    const stillLocked = await request(app).post('/api/v1/auth/login').send({
      email: userEmail,
      password: 'Test@12345',
      tenantSlug: slug,
    })
    expect(stillLocked.status).toBe(401)
    expect(stillLocked.body.message).toBe(AUTH_MSG.ACCOUNT_LOCKED)
  })

  it.skipIf(!dbAvailable)('successful login resets lockout counters', async () => {
    await prisma.user.updateMany({
      where: { tenantId, email: userEmail },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })

    const res = await request(app).post('/api/v1/auth/login').send({
      email: userEmail,
      password: 'Test@12345',
      tenantSlug: slug,
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data?.accessToken).toBeTruthy()

    const user = await prisma.user.findFirst({ where: { tenantId, email: userEmail } })
    expect(user?.failedLoginAttempts).toBe(0)
    expect(user?.lockedUntil).toBeNull()
  })
})
