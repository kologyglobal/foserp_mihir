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
  const slug = `iso-test-${suffix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: `Isolation ${suffix}`, slug, email: `${suffix}@iso.test`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Iso',
      lastName: suffix,
      email: `iso-${suffix}-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { startsWith: 'master.' } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Iso Admin ${suffix} ${Date.now()}`,
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
  await prisma.masterItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterGstRate.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterHsnCode.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterGstGroup.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterItemCategory.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterUom.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe('Master tenant isolation', () => {
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

  it('tenant B cannot list tenant A items', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${tenantA.slug}/masters/items`)
      .set('Authorization', `Bearer ${tenantB.token}`)
    expect([403, 404]).toContain(res.status)
    expect(res.body.success).toBe(false)
  })

  it('rejects cross-tenant FK on item create', async () => {
    const catRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/item-categories`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code: `CA${Date.now()}`.slice(-7), name: 'Tenant A Cat', level: 1, status: 'ACTIVE' })
    expect(catRes.status).toBe(201)

    const uomRes = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/uom`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code: `UA${Date.now()}`.slice(-7), name: 'NOS', uomType: 'integer', decimalPlaces: 0, status: 'ACTIVE' })
    expect(uomRes.status).toBe(201)

    const crossRes = await request(app)
      .post(`/api/v1/t/${tenantB.slug}/masters/items`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({
        code: `XB${Date.now()}`.slice(-7),
        name: 'Cross Tenant Item',
        categoryId: catRes.body.data.id,
        baseUomId: uomRes.body.data.id,
        itemType: 'raw',
        status: 'ACTIVE',
      })
    expect(crossRes.status).toBe(400)
  })

  it('same item code allowed in different tenants', async () => {
    const code = `SAME${Date.now()}`.slice(-7)

    async function seedTenant(slug: string, token: string) {
      const cat = await request(app)
        .post(`/api/v1/t/${slug}/masters/item-categories`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: `C${Date.now()}`.slice(-7), name: 'Cat', level: 1, status: 'ACTIVE' })
      const uom = await request(app)
        .post(`/api/v1/t/${slug}/masters/uom`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: `U${Date.now()}`.slice(-7), name: 'NOS', uomType: 'integer', decimalPlaces: 0, status: 'ACTIVE' })
      return { categoryId: cat.body.data.id, baseUomId: uom.body.data.id }
    }

    const refsA = await seedTenant(tenantA.slug, tenantA.token)
    const refsB = await seedTenant(tenantB.slug, tenantB.token)

    const resA = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/items`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code, name: 'Shared Code A', ...refsA, itemType: 'raw', status: 'ACTIVE' })
    expect(resA.status).toBe(201)

    const resB = await request(app)
      .post(`/api/v1/t/${tenantB.slug}/masters/items`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ code, name: 'Shared Code B', ...refsB, itemType: 'raw', status: 'ACTIVE' })
    expect(resB.status).toBe(201)
  })

  it('item lookup supports pagination and activeOnly filter', async () => {
    const cat = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/item-categories`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code: `LC${Date.now()}`.slice(-7), name: 'Lookup Cat', level: 1, status: 'ACTIVE' })
    const uom = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/uom`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ code: `LU${Date.now()}`.slice(-7), name: 'NOS', uomType: 'integer', decimalPlaces: 0, status: 'ACTIVE' })

    const ts = Date.now()
    const activeCode = `ACT${ts}`
    const inactiveCode = `INA${ts + 1}`

    const activeItem = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/items`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        code: activeCode,
        name: 'Active Lookup Item',
        categoryId: cat.body.data.id,
        baseUomId: uom.body.data.id,
        itemType: 'raw',
        status: 'ACTIVE',
      })
    expect(activeItem.status).toBe(201)

    const inactiveItem = await request(app)
      .post(`/api/v1/t/${tenantA.slug}/masters/items`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({
        code: inactiveCode,
        name: 'Inactive Lookup Item',
        categoryId: cat.body.data.id,
        baseUomId: uom.body.data.id,
        itemType: 'bought_out',
        status: 'INACTIVE',
      })
    expect(inactiveItem.status).toBe(201)

    const pageRes = await request(app)
      .get(`/api/v1/t/${tenantA.slug}/lookups/items?limit=1&page=1&activeOnly=true`)
      .set('Authorization', `Bearer ${tenantA.token}`)
    expect(pageRes.status).toBe(200)
    expect(pageRes.body.meta.limit).toBe(1)
    expect(pageRes.body.data.every((row: { status: string }) => row.status === 'ACTIVE')).toBe(true)

    const filteredRes = await request(app)
      .get(`/api/v1/t/${tenantA.slug}/lookups/items?itemType=bought_out&activeOnly=false`)
      .set('Authorization', `Bearer ${tenantA.token}`)
    expect(filteredRes.status).toBe(200)
    expect(filteredRes.body.data.some((row: { code: string }) => row.code === inactiveCode)).toBe(true)
    expect(filteredRes.body.data.every((row: { itemType: string }) => row.itemType === 'bought_out')).toBe(true)
  })
})
