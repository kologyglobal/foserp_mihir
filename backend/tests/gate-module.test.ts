/**
 * Gate & Security foundation — visitor lifecycle + tenant isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'
import {
  createUserWithPerms,
  ensurePermissions,
} from './manufacturing/helpers/manufacturing-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const GATE_PERMS = PERMISSIONS.filter((p) => p.startsWith('gate.')) as PermissionName[]

function gate(slug: string) {
  return `/api/v1/t/${slug}/gate`
}

async function createGateTenant(appInstance: Express, slugPrefix: string) {
  const slug = `${slugPrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const tenant = await prisma.tenant.create({
    data: { name: 'Gate Test Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const { userId, token } = await createUserWithPerms(appInstance, tenant.id, slug, GATE_PERMS, 'gate-admin')
  return { tenantId: tenant.id, userId, slug, token }
}

async function cleanupGateTenant(tenantId: string) {
  await prisma.gateActivity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateApproval.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gatePassItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gatePass.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateMaterialOutward.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateMaterialInward.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateVehicle.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateVisitorVisit.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateVisitorProfile.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateExpectedVisitor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateContractorEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateCourierEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateLocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.gateSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Gate & Security foundation', () => {
  let tenantA: Awaited<ReturnType<typeof createGateTenant>>
  let tenantB: Awaited<ReturnType<typeof createGateTenant>>

  beforeAll(async () => {
    await ensurePermissions()
    tenantA = await createGateTenant(app, 'gate-a')
    tenantB = await createGateTenant(app, 'gate-b')
  }, 120_000)

  afterAll(async () => {
    if (tenantA?.tenantId) await cleanupGateTenant(tenantA.tenantId)
    if (tenantB?.tenantId) await cleanupGateTenant(tenantB.tenantId)
  })

  function auth(req: request.Test, token: string) {
    return req.set('Authorization', `Bearer ${token}`)
  }

  it('creates visitor → approve → entry → exit and lists visitors', async () => {
    // Disable host approval default for a clean walk-in approval path we control
    const settingsRes = await auth(request(app).get(`${gate(tenantA.slug)}/settings`), tenantA.token)
    expect(settingsRes.status).toBe(200)
    const settings = settingsRes.body.data
    settings.visitor.hostApprovalRequired = false

    await auth(request(app).put(`${gate(tenantA.slug)}/settings`).send(settings), tenantA.token)

    const create = await auth(
      request(app)
        .post(`${gate(tenantA.slug)}/visitors`)
        .send({
          visitorName: 'Ravi Kumar',
          mobile: '9876543210',
          company: 'Acme Steels',
          visitorType: 'vendor',
          visitorCount: 1,
          hostName: 'Suresh',
          department: 'Purchase',
          purpose: 'PO discussion',
          gate: 'Main Gate',
          laptopCarried: false,
          equipmentCarried: false,
          bagCount: 0,
          safetyDeclarationAccepted: true,
          ppeRequired: false,
          ndaRequired: false,
          hostApprovalRequired: true,
          mode: 'walk_in',
        }),
      tenantA.token,
    )
    expect(create.status).toBe(201)
    expect(create.body.data.status).toBe('waiting_approval')
    expect(create.body.data.entryNumber).toMatch(/^VIS-/)
    const visitId = create.body.data.id as string

    const approve = await auth(
      request(app).post(`${gate(tenantA.slug)}/visitors/${visitId}/approve`).send({ remarks: 'OK' }),
      tenantA.token,
    )
    expect(approve.status).toBe(200)
    expect(approve.body.data.status).toBe('approved')

    const entry = await auth(
      request(app).post(`${gate(tenantA.slug)}/visitors/${visitId}/entry`).send({}),
      tenantA.token,
    )
    expect(entry.status).toBe(200)
    expect(entry.body.data.status).toBe('inside')
    expect(entry.body.data.entryTime).toBeTruthy()

    const dupExitGuard = await auth(
      request(app)
        .post(`${gate(tenantA.slug)}/visitors/${visitId}/exit`)
        .send({ badgeReturned: true }),
      tenantA.token,
    )
    expect(dupExitGuard.status).toBe(200)
    expect(dupExitGuard.body.data.status).toBe('exited')

    const secondExit = await auth(
      request(app)
        .post(`${gate(tenantA.slug)}/visitors/${visitId}/exit`)
        .send({ badgeReturned: true }),
      tenantA.token,
    )
    expect(secondExit.status).toBeGreaterThanOrEqual(400)
    expect(secondExit.status).toBeLessThan(500)

    const list = await auth(request(app).get(`${gate(tenantA.slug)}/visitors`), tenantA.token)
    expect(list.status).toBe(200)
    expect(list.body.data.some((v: { id: string }) => v.id === visitId)).toBe(true)

    const dashboard = await auth(request(app).get(`${gate(tenantA.slug)}/dashboard`), tenantA.token)
    expect(dashboard.status).toBe(200)
    expect(dashboard.body.data).toHaveProperty('visitorsInside')
  }, 60_000)

  it('enforces tenant isolation on visitor get', async () => {
    const create = await auth(
      request(app)
        .post(`${gate(tenantA.slug)}/visitors`)
        .send({
          visitorName: 'Isolation Test',
          mobile: '9123456780',
          visitorType: 'other',
          visitorCount: 1,
          hostName: 'Host',
          department: 'Admin',
          purpose: 'Visit',
          gate: 'Main Gate',
          laptopCarried: false,
          equipmentCarried: false,
          bagCount: 0,
          safetyDeclarationAccepted: true,
          ppeRequired: false,
          ndaRequired: false,
          hostApprovalRequired: false,
          mode: 'walk_in',
        }),
      tenantA.token,
    )
    expect(create.status).toBe(201)
    const visitId = create.body.data.id as string

    const cross = await auth(
      request(app).get(`${gate(tenantB.slug)}/visitors/${visitId}`),
      tenantB.token,
    )
    expect(cross.status).toBe(404)

    const own = await auth(
      request(app).get(`${gate(tenantA.slug)}/visitors/${visitId}`),
      tenantA.token,
    )
    expect(own.status).toBe(200)
    expect(own.body.data.id).toBe(visitId)
  }, 45_000)
})
