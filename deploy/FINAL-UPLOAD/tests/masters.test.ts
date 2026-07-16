import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS } from '../src/constants/permissions.js'

const app = createApp()

async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const existing = await prisma.permission.findUnique({ where: { name } })
    if (existing) continue
    const [module] = name.split('.')
    await prisma.permission.create({ data: { name, module, description: name } }).catch(() => {})
  }
}

async function createTenantWithMasterAdmin(suffix: string) {
  const { hashPassword } = await import('../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `master-test-${suffix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: `Master Test ${suffix}`, slug, email: `${suffix}@test.com`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Master',
      lastName: suffix,
      email: `master-${suffix}-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { startsWith: 'master.' } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Master Admin ${suffix} ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id } })

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })

  return {
    tenantId: tenant.id,
    slug,
    token: loginRes.body.data?.accessToken ?? '',
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.masterLocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterWarehouse.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterCity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterState.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterCountry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterUom.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe('Master data APIs', () => {
  let tenantA = { tenantId: '', slug: '', token: '' }
  let tenantB = { tenantId: '', slug: '', token: '' }

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`
    await ensurePermissions()
    tenantA = await createTenantWithMasterAdmin('a')
    tenantB = await createTenantWithMasterAdmin('b')
  })

  afterAll(async () => {
    if (tenantA.tenantId) await cleanupTenant(tenantA.tenantId)
    if (tenantB.tenantId) await cleanupTenant(tenantB.tenantId)
  })

  it('creates country and rejects duplicate code', async () => {
    const code = `T${Date.now()}`.slice(-8)
    const createRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/countries`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code, name: 'Test Country', status: 'ACTIVE' })
    expect(createRes.status).toBe(201)
    expect(createRes.body.data.code).toBe(code)

    const dupRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/countries`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code, name: 'Duplicate Country', status: 'ACTIVE' })
    expect(dupRes.status).toBe(409)
  })

  it('blocks delete of state referenced by cities', async () => {
    const stateRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/states`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code: `S${Date.now()}`.slice(-7), name: 'Test State', status: 'ACTIVE' })
    expect(stateRes.status).toBe(201)
    const stateId = stateRes.body.data.id

    const cityRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/cities`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ stateId, name: 'Test City', status: 'ACTIVE' })
    expect(cityRes.status).toBe(201)

    const deleteRes = await request(app)
      .delete(`/api/v1/t/${tenantA.slug}/masters/states/${stateId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
    expect(deleteRes.status).toBe(409)
  })

  it('blocks delete of warehouse referenced by locations', async () => {
    const whRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/warehouses`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code: `W${Date.now()}`.slice(-7), name: 'Test WH', status: 'ACTIVE' })
    expect(whRes.status).toBe(201)
    const warehouseId = whRes.body.data.id

    const locRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/locations`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ warehouseId, code: `L${Date.now()}`.slice(-7), name: 'Test Location', status: 'ACTIVE' })
    expect(locRes.status).toBe(201)

    const deleteRes = await request(app)
      .delete(`/api/v1/t/${tenantA.slug}/masters/warehouses/${warehouseId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
    expect(deleteRes.status).toBe(409)
  })

  it('lookup returns active records only', async () => {
    const code = `U${Date.now()}`.slice(-7)
    const createRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/uom`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code, name: 'Test UOM', uomType: 'integer', decimalPlaces: 0, status: 'ACTIVE' })
    expect(createRes.status).toBe(201)
    const uomId = createRes.body.data.id

    await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/uom/${uomId}/deactivate`)
      .set('Authorization', `Bearer ${tenantA.token}`)

    const lookupRes = await request(app)
      .get(`/api/v1/t/${tenantA.slug}/lookups/uom`)
      .set('Authorization', `Bearer ${tenantA.token}`)
    expect(lookupRes.status).toBe(200)
    expect(lookupRes.body.data.some((r: { id: string }) => r.id === uomId)).toBe(false)
  })

  it('tenant B user cannot access tenant A master list', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${tenantA.slug}/masters/countries`)
      .set('Authorization', `Bearer ${tenantB.token}`)
    expect([403, 404]).toContain(res.status)
    expect(res.body.success).toBe(false)
  })

  it('deactivates and reactivates country', async () => {
    const code = `D${Date.now()}`.slice(-7)
    const createRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/countries`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code, name: 'Deactivate Test', status: 'ACTIVE' })
    expect(createRes.status).toBe(201)
    const countryId = createRes.body.data.id

    const deactivateRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/countries/${countryId}/deactivate`)
      .set('Authorization', `Bearer ${tenantA.token}`)
    expect(deactivateRes.status).toBe(200)
    expect(deactivateRes.body.data.status).toBe('INACTIVE')

    const activateRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/countries/${countryId}/activate`)
      .set('Authorization', `Bearer ${tenantA.token}`)
    expect(activateRes.status).toBe(200)
    expect(activateRes.body.data.status).toBe('ACTIVE')
  })

  it('same code allowed across different tenants', async () => {
    const code = `X${Date.now()}`.slice(-7)
    const resA = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/countries`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code, name: 'Tenant A Country', status: 'ACTIVE' })
    expect(resA.status).toBe(201)

    const resB = await request(app)
      .post(`/api/v1/t/${tenantB.slug}/masters/countries`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ code, name: 'Tenant B Country', status: 'ACTIVE' })
    expect(resB.status).toBe(201)
  })
})
