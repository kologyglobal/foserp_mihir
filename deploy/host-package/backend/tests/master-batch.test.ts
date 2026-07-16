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
  const slug = `batch-test-${suffix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: `Batch Test ${suffix}`, slug, email: `${suffix}@batch.test`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Batch',
      lastName: suffix,
      email: `batch-${suffix}-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { startsWith: 'master.' } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Batch Admin ${suffix} ${Date.now()}`,
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
  await prisma.masterCity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterState.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterCountry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterGstRate.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterHsnCode.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterGstGroup.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterItemCategory.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterLocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterWarehouse.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterUom.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe('Master batch phase 3-4 APIs', () => {
  let ctx = { tenantId: '', slug: '', token: '' }

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`
    await ensurePermissions()
    ctx = await createTenantWithMasterAdmin('main')
  })

  afterAll(async () => {
    if (ctx.tenantId) await cleanupTenant(ctx.tenantId)
  })

  it('creates GST group, HSN, category, item and rejects duplicate codes', async () => {
    const gstRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/gst-groups`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `GG${Date.now()}`.slice(-8), goodsType: 'goods', description: 'Goods 18%', status: 'ACTIVE' })
    expect(gstRes.status).toBe(201)
    const gstGroupId = gstRes.body.data.id

    const hsnCode = `HSN${Date.now()}`.slice(-8)
    const hsnRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/hsn-sac`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: hsnCode, gstGroupId, description: 'Steel parts', status: 'ACTIVE' })
    expect(hsnRes.status).toBe(201)

    const dupHsn = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/hsn-sac`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: hsnCode, gstGroupId, description: 'Duplicate', status: 'ACTIVE' })
    expect(dupHsn.status).toBe(409)

    const catRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/item-categories`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `CAT${Date.now()}`.slice(-7), name: 'Raw Materials', level: 1, status: 'ACTIVE' })
    expect(catRes.status).toBe(201)
    const categoryId = catRes.body.data.id

    const uomRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/uom`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `U${Date.now()}`.slice(-7), name: 'NOS', uomType: 'integer', decimalPlaces: 0, status: 'ACTIVE' })
    expect(uomRes.status).toBe(201)
    const baseUomId = uomRes.body.data.id

    const itemCode = `ITM${Date.now()}`.slice(-7)
    const itemRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/items`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: itemCode,
        name: 'Test Item',
        categoryId,
        baseUomId,
        itemType: 'raw',
        productType: 'raw_material',
        hsnId: hsnRes.body.data.id,
        gstGroupId,
        status: 'ACTIVE',
      })
    expect(itemRes.status).toBe(201)

    const dupItem = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/items`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: itemCode,
        name: 'Duplicate Item',
        categoryId,
        baseUomId,
        itemType: 'raw',
        status: 'ACTIVE',
      })
    expect(dupItem.status).toBe(409)
  })

  it('rejects invalid GST rate effective dates and inter-state SGST', async () => {
    const gstRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/gst-groups`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `GR${Date.now()}`.slice(-7), goodsType: 'goods', description: 'Rate group', status: 'ACTIVE' })
    expect(gstRes.status).toBe(201)

    const badDateRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/gst-rates`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: `RT${Date.now()}`.slice(-7),
        gstGroupId: gstRes.body.data.id,
        fromState: 'GJ',
        locationStateCode: 'GJ',
        dateFrom: '2026-01-01',
        dateTo: '2025-01-01',
        sgst: 9,
        cgst: 9,
        igst: 18,
        status: 'ACTIVE',
      })
    expect(badDateRes.status).toBe(400)

    const badInterRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/gst-rates`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: `RT${Date.now()}`.slice(-7),
        gstGroupId: gstRes.body.data.id,
        fromState: 'GJ',
        locationStateCode: 'MH',
        dateFrom: '2026-01-01',
        sgst: 9,
        cgst: 9,
        igst: 18,
        status: 'ACTIVE',
      })
    expect(badInterRes.status).toBe(400)
  })

  it('blocks delete when references exist', async () => {
    const gstRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/gst-groups`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `GX${Date.now()}`.slice(-7), goodsType: 'goods', description: 'Ref group', status: 'ACTIVE' })
    const gstGroupId = gstRes.body.data.id

    const hsnRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/hsn-sac`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `HX${Date.now()}`.slice(-7), gstGroupId, description: 'Ref HSN', status: 'ACTIVE' })
    const hsnId = hsnRes.body.data.id

    const catRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/item-categories`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `CX${Date.now()}`.slice(-7), name: 'Ref Cat', level: 1, status: 'ACTIVE' })
    const categoryId = catRes.body.data.id

    const uomRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/uom`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `UX${Date.now()}`.slice(-7), name: 'KG', uomType: 'weight', decimalPlaces: 2, status: 'ACTIVE' })
    const baseUomId = uomRes.body.data.id

    await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/items`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: `IX${Date.now()}`.slice(-7),
        name: 'Ref Item',
        categoryId,
        baseUomId,
        itemType: 'raw',
        hsnId,
        gstGroupId,
        status: 'ACTIVE',
      })

    expect(
      (await request(app).delete(`/api/v1/t/${ctx.slug}/masters/item-categories/${categoryId}`).set('Authorization', `Bearer ${ctx.token}`)).status,
    ).toBe(409)
    expect(
      (await request(app).delete(`/api/v1/t/${ctx.slug}/masters/uom/${baseUomId}`).set('Authorization', `Bearer ${ctx.token}`)).status,
    ).toBe(409)
    expect(
      (await request(app).delete(`/api/v1/t/${ctx.slug}/masters/hsn-sac/${hsnId}`).set('Authorization', `Bearer ${ctx.token}`)).status,
    ).toBe(409)
    expect(
      (await request(app).delete(`/api/v1/t/${ctx.slug}/masters/gst-groups/${gstGroupId}`).set('Authorization', `Bearer ${ctx.token}`)).status,
    ).toBe(409)
  })

  it('creates vendor and supports lookup listing', async () => {
    const code = `V${Date.now()}`.slice(-7)
    const createRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/vendors`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code,
        name: 'Acme Supplies',
        city: 'Pune',
        state: 'Maharashtra',
        gstin: '',
        vendorType: 'manufacturer',
        status: 'ACTIVE',
      })
    expect(createRes.status).toBe(201)

    const lookupRes = await request(app)
      .get(`/api/v1/t/${ctx.slug}/lookups/vendors`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(lookupRes.status).toBe(200)
    expect(lookupRes.body.data.some((v: { code: string }) => v.code === code)).toBe(true)
  })

  it('supports vendor lookup search and pagination', async () => {
    const code = `VS${Date.now()}`.slice(-6)
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/vendors`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code, name: 'Searchable Vendor Co', city: 'Mumbai', state: 'MH', vendorType: 'trader', status: 'ACTIVE' })

    const searchRes = await request(app)
      .get(`/api/v1/t/${ctx.slug}/lookups/vendors?search=Searchable&limit=5&page=1`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(searchRes.status).toBe(200)
    expect(searchRes.body.meta).toBeDefined()
    expect(searchRes.body.data.some((v: { code: string }) => v.code === code)).toBe(true)
  })

  it('blocks delete when geography references exist', async () => {
    const countryRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/countries`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `CN${Date.now()}`.slice(-6), name: 'Test Country', status: 'ACTIVE' })
    const countryId = countryRes.body.data.id

    const stateRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/states`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `ST${Date.now()}`.slice(-6), name: 'Test State', status: 'ACTIVE' })
    const stateId = stateRes.body.data.id

    const cityRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/cities`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ stateId, name: `Test City ${Date.now()}`, status: 'ACTIVE' })
    const cityId = cityRes.body.data.id

    const vendorCode = `VG${Date.now()}`.slice(-6)
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/vendors`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: vendorCode,
        name: 'Geo Vendor',
        countryId,
        stateId,
        cityId,
        city: 'Test City',
        state: 'Test State',
        vendorType: 'service',
        status: 'ACTIVE',
      })

    expect(
      (await request(app).delete(`/api/v1/t/${ctx.slug}/masters/countries/${countryId}`).set('Authorization', `Bearer ${ctx.token}`)).status,
    ).toBe(409)
    expect(
      (await request(app).delete(`/api/v1/t/${ctx.slug}/masters/states/${stateId}`).set('Authorization', `Bearer ${ctx.token}`)).status,
    ).toBe(409)
    expect(
      (await request(app).delete(`/api/v1/t/${ctx.slug}/masters/cities/${cityId}`).set('Authorization', `Bearer ${ctx.token}`)).status,
    ).toBe(409)
  })

  it('rejects invalid vendor geography hierarchy', async () => {
    const stateA = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/states`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `SA${Date.now()}`.slice(-6), name: 'State A', status: 'ACTIVE' })
    const stateB = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/states`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: `SB${Date.now()}`.slice(-6), name: 'State B', status: 'ACTIVE' })

    const cityRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/cities`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ stateId: stateA.body.data.id, name: `City A ${Date.now()}`, status: 'ACTIVE' })

    const badRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/vendors`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: `VB${Date.now()}`.slice(-6),
        name: 'Bad Geo Vendor',
        stateId: stateB.body.data.id,
        cityId: cityRes.body.data.id,
        vendorType: 'manufacturer',
      })
    expect(badRes.status).toBe(400)
  })
})
