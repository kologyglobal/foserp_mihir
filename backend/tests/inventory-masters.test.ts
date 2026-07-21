import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'

/**
 * Phase 2 — Plant / Warehouse / Storage Location / Bin setup (live DB integration).
 * Hierarchy rules + unique codes + tenant isolation + RBAC + activate/deactivate.
 */
const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

async function ensurePermissions() {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({
        where: { name },
        create: { name, module, description: name },
        update: {},
      })
      .catch(() => {})
  }
}

async function createTenantUser(opts: {
  slugPrefix: string
  permissionNames: PermissionName[]
  tenantId?: string
}) {
  const { hashPassword } = await import('../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  let tenantId = opts.tenantId
  let slug = ''
  if (!tenantId) {
    slug = `${opts.slugPrefix}-${suffix}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Inventory Masters', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
  } else {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    slug = tenant.slug
  }
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: 'Inv',
      lastName: 'Tester',
      email: `user-${suffix}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const perms = await prisma.permission.findMany({
    where: { name: { in: opts.permissionNames } },
  })
  const role = await prisma.role.create({
    data: {
      tenantId,
      name: `Role ${suffix}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })
  return {
    tenantId,
    userId: user.id,
    slug,
    token: loginRes.body.data?.accessToken as string,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.masterBin.deleteMany({ where: { tenantId } })
  await prisma.masterLocation.deleteMany({ where: { tenantId } })
  await prisma.masterWarehouse.deleteMany({ where: { tenantId } })
  await prisma.masterPlant.deleteMany({ where: { tenantId } })
  await prisma.auditLog.deleteMany({ where: { tenantId } })
  await prisma.userRole.deleteMany({ where: { tenantId } })
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } })
  await prisma.role.deleteMany({ where: { tenantId } })
  await prisma.user.deleteMany({ where: { tenantId } })
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

const MASTER_SETUP_PERMS = PERMISSIONS.filter(
  (p) =>
    p.startsWith('master.plant.') ||
    p.startsWith('master.warehouse.') ||
    p.startsWith('master.location.') ||
    p.startsWith('master.bin.') ||
    p === 'master.lookup.view',
) as PermissionName[]

describe.skipIf(!dbAvailable)('Inventory masters hierarchy (Phase 2)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let viewerToken = ''
  let otherSlug = ''
  let otherToken = ''
  let otherTenantId = ''

  let plantId = ''
  let warehouseId = ''
  let locationId = ''
  let binId = ''

  const base = (resource: string, s = slug) => `/api/v1/t/${s}/inventory/${resource}`
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })

  beforeAll(async () => {
    await ensurePermissions()
    const main = await createTenantUser({
      slugPrefix: 'inv-masters',
      permissionNames: MASTER_SETUP_PERMS,
    })
    tenantId = main.tenantId
    slug = main.slug
    token = main.token

    const viewer = await createTenantUser({
      slugPrefix: 'inv-viewer',
      permissionNames: ['master.plant.view', 'master.warehouse.view', 'master.location.view', 'master.bin.view'],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      slugPrefix: 'inv-other',
      permissionNames: MASTER_SETUP_PERMS,
    })
    otherSlug = other.slug
    otherToken = other.token
    otherTenantId = other.tenantId
  }, 120_000)

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId)
    if (otherTenantId) await cleanupTenant(otherTenantId)
  }, 120_000)

  it('creates a plant', async () => {
    const res = await request(app)
      .post(base('plants'))
      .set(auth())
      .send({ code: 'PL-01', name: 'Pune Plant', address: 'MIDC Bhosari' })
    expect(res.status).toBe(201)
    plantId = res.body.data.id
    const row = await prisma.masterPlant.findFirst({ where: { id: plantId, tenantId } })
    expect(row?.code).toBe('PL-01')
  })

  it('rejects duplicate plant code in tenant', async () => {
    const res = await request(app)
      .post(base('plants'))
      .set(auth())
      .send({ code: 'PL-01', name: 'Duplicate Plant' })
    expect(res.status).toBe(409)
  })

  it('creates a warehouse under the plant', async () => {
    const res = await request(app)
      .post(base('warehouses'))
      .set(auth())
      .send({ code: 'WH-RCV', name: 'Receiving Warehouse', warehouseType: 'receiving', plantId })
    expect(res.status).toBe(201)
    warehouseId = res.body.data.id
    expect(res.body.data.plantId).toBe(plantId)
  })

  it('rejects a warehouse under a plant of another tenant', async () => {
    const foreignPlant = await request(app)
      .post(base('plants', otherSlug))
      .set(auth(otherToken))
      .send({ code: 'PL-XX', name: 'Foreign Plant' })
    expect(foreignPlant.status).toBe(201)
    const res = await request(app)
      .post(base('warehouses'))
      .set(auth())
      .send({ code: 'WH-BAD', name: 'Bad Warehouse', plantId: foreignPlant.body.data.id })
    expect(res.status).toBe(400)
  })

  it('creates a storage location under the warehouse (storage-locations alias)', async () => {
    const res = await request(app)
      .post(base('storage-locations'))
      .set(auth())
      .send({ warehouseId, code: 'SL-A1', name: 'Zone A1' })
    expect(res.status).toBe(201)
    locationId = res.body.data.id
    expect(res.body.data.warehouseId).toBe(warehouseId)
  })

  it('creates a bin under warehouse + storage location', async () => {
    const res = await request(app)
      .post(base('bins'))
      .set(auth())
      .send({ warehouseId, storageLocationId: locationId, code: 'BIN-A1-01', name: 'Bin A1-01' })
    expect(res.status).toBe(201)
    binId = res.body.data.id
    const row = await prisma.masterBin.findFirst({ where: { id: binId, tenantId } })
    expect(row?.storageLocationId).toBe(locationId)
  })

  it('rejects a bin whose storage location belongs to a different warehouse', async () => {
    const wh2 = await request(app)
      .post(base('warehouses'))
      .set(auth())
      .send({ code: 'WH-QH', name: 'Quality Hold', warehouseType: 'quality_hold', plantId })
    expect(wh2.status).toBe(201)
    const res = await request(app)
      .post(base('bins'))
      .set(auth())
      .send({
        warehouseId: wh2.body.data.id,
        storageLocationId: locationId,
        code: 'BIN-BAD',
        name: 'Mismatched Bin',
      })
    expect(res.status).toBe(400)
  })

  it('rejects duplicate bin code within the same warehouse', async () => {
    const res = await request(app)
      .post(base('bins'))
      .set(auth())
      .send({ warehouseId, storageLocationId: locationId, code: 'BIN-A1-01', name: 'Dup Bin' })
    expect(res.status).toBe(409)
  })

  it('blocks bin creation under an inactive storage location', async () => {
    const deact = await request(app)
      .post(`${base('storage-locations')}/${locationId}/deactivate`)
      .set(auth())
    expect(deact.status).toBe(200)
    const res = await request(app)
      .post(base('bins'))
      .set(auth())
      .send({ warehouseId, storageLocationId: locationId, code: 'BIN-A1-02', name: 'Blocked Bin' })
    expect(res.status).toBe(400)
    const react = await request(app)
      .post(`${base('storage-locations')}/${locationId}/activate`)
      .set(auth())
    expect(react.status).toBe(200)
  })

  it('blocks hard delete of a warehouse referenced by bins', async () => {
    const res = await request(app).delete(`${base('warehouses')}/${warehouseId}`).set(auth())
    expect(res.status).toBe(409)
  })

  it('blocks hard delete of a plant referenced by warehouses', async () => {
    const res = await request(app).delete(`${base('plants')}/${plantId}`).set(auth())
    expect(res.status).toBe(409)
  })

  it('supports dependent list filters: plant→warehouse, warehouse→location, location→bin', async () => {
    const wh = await request(app).get(`${base('warehouses')}?plantId=${plantId}`).set(auth())
    expect(wh.status).toBe(200)
    expect(wh.body.data.some((w: { id: string }) => w.id === warehouseId)).toBe(true)

    const locs = await request(app)
      .get(`${base('storage-locations')}?warehouseId=${warehouseId}`)
      .set(auth())
    expect(locs.status).toBe(200)
    expect(locs.body.data.every((l: { warehouseId: string }) => l.warehouseId === warehouseId)).toBe(true)

    const bins = await request(app)
      .get(`${base('bins')}?warehouseId=${warehouseId}&storageLocationId=${locationId}`)
      .set(auth())
    expect(bins.status).toBe(200)
    expect(bins.body.data.some((b: { id: string }) => b.id === binId)).toBe(true)
  })

  it('enforces tenant isolation on reads', async () => {
    const res = await request(app).get(`${base('plants', otherSlug)}/${plantId}`).set(auth(otherToken))
    expect(res.status).toBe(404)
  })

  it('denies create without permission', async () => {
    const res = await request(app)
      .post(base('plants'))
      .set(auth(viewerToken))
      .send({ code: 'PL-DENY', name: 'Denied Plant' })
    expect(res.status).toBe(403)
  })

  it('writes audit logs for master creates', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { tenantId, entity: 'masterPlant', action: 'CREATE' },
    })
    expect(logs.length).toBeGreaterThan(0)
  })

  it('rejects unknown inventory resource', async () => {
    const res = await request(app).get(base('countries')).set(auth())
    expect(res.status).toBe(404)
  })

  it('persists records across app instances (MySQL, not memory)', async () => {
    const freshApp = createApp()
    const res = await request(freshApp).get(`${base('bins')}/${binId}`).set(auth())
    expect(res.status).toBe(200)
    expect(res.body.data.code).toBe('BIN-A1-01')
  })
})
