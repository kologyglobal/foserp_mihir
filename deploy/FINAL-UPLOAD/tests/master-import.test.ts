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
  const slug = `import-test-${suffix}-${Date.now()}`

  const tenant = await prisma.tenant.create({
    data: { name: `Import Test ${suffix}`, slug, email: `${suffix}@import.test`, status: 'ACTIVE' },
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Import',
      lastName: suffix,
      email: `import-${suffix}-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { startsWith: 'master.' } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Import Admin ${suffix} ${Date.now()}`,
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
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterHsnCode.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterGstGroup.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterItemCategory.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterCity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterState.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterCountry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterUom.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

describe('Master import/export phase 6-8', () => {
  let ctx = { tenantId: '', slug: '', token: '' }
  let categoryCode = ''
  let uomCode = ''
  let gstGroupCode = ''
  let categoryId = ''
  let baseUomId = ''
  let gstGroupId = ''

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`
    await ensurePermissions()
    ctx = await createTenantWithMasterAdmin('main')

    categoryCode = `CAT${Date.now()}`.slice(-7)
    uomCode = `U${Date.now()}`.slice(-7)
    gstGroupCode = `GG${Date.now()}`.slice(-7)

    const catRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/item-categories`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: categoryCode, name: 'Import Category', level: 1, status: 'ACTIVE' })
    categoryId = catRes.body.data.id

    const uomRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/uom`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: uomCode, name: 'NOS', uomType: 'integer', decimalPlaces: 0, status: 'ACTIVE' })
    baseUomId = uomRes.body.data.id

    const gstRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/gst-groups`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: gstGroupCode, goodsType: 'goods', description: 'Import GST', status: 'ACTIVE' })
    gstGroupId = gstRes.body.data.id
  })

  afterAll(async () => {
    if (ctx.tenantId) await cleanupTenant(ctx.tenantId)
  })

  it('downloads CSV import templates', async () => {
    const itemTpl = await request(app)
      .get(`/api/v1/t/${ctx.slug}/masters/imports/items/template`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(itemTpl.status).toBe(200)
    expect(itemTpl.headers['content-type']).toContain('text/csv')
    expect(itemTpl.text).toContain('Item Code')

    const vendorTpl = await request(app)
      .get(`/api/v1/t/${ctx.slug}/masters/imports/vendors/template`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(vendorTpl.status).toBe(200)
    expect(vendorTpl.text).toContain('Vendor Code')
  })

  it('imports items with skip and update duplicate modes', async () => {
    const itemCode = `IMP${Date.now()}`.slice(-7)
    const importRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/imports/items`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        duplicateMode: 'skip',
        rows: [
          {
            'Item Code': itemCode,
            'Item Name': 'Imported Item',
            'Category Code': categoryCode,
            'Base UOM Code': uomCode,
            'Item Type': 'raw',
            Status: 'ACTIVE',
          },
        ],
      })
    expect(importRes.status).toBe(200)
    expect(importRes.body.data.imported).toBe(1)

    const skipRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/imports/items`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        duplicateMode: 'skip',
        rows: [{ 'Item Code': itemCode, 'Item Name': 'Dup', 'Category Code': categoryCode, 'Base UOM Code': uomCode }],
      })
    expect(skipRes.body.data.skipped).toBe(1)

    const updateRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/imports/items`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        duplicateMode: 'update',
        rows: [
          {
            'Item Code': itemCode,
            'Item Name': 'Updated Imported Item',
            'Category Code': categoryCode,
            'Base UOM Code': uomCode,
            'Item Type': 'raw',
          },
        ],
      })
    expect(updateRes.body.data.updated).toBe(1)

    const rejectRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/imports/items`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        duplicateMode: 'reject',
        rows: [{ 'Item Code': itemCode, 'Item Name': 'Reject', 'Category Code': categoryCode, 'Base UOM Code': uomCode }],
      })
    expect(rejectRes.body.data.failed).toBe(1)

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId: ctx.tenantId, entity: 'masterItem', action: 'IMPORT' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).toBeTruthy()
  })

  it('imports vendors and HSN/SAC records', async () => {
    const vendorCode = `VIMP${Date.now()}`.slice(-6)
    const vendorRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/imports/vendors`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        duplicateMode: 'skip',
        rows: [
          {
            'Vendor Code': vendorCode,
            'Vendor Name': 'Import Vendor Ltd',
            City: 'Pune',
            State: 'Maharashtra',
            'Vendor Type': 'manufacturer',
          },
        ],
      })
    expect(vendorRes.status).toBe(200)
    expect(vendorRes.body.data.imported).toBe(1)

    const hsnCode = `HSN${Date.now()}`.slice(-8)
    const hsnRes = await request(app)
      .post(`/api/v1/t/${ctx.slug}/masters/imports/hsn-sac`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        duplicateMode: 'skip',
        rows: [{ 'HSN Code': hsnCode, 'GST Group Code': gstGroupCode, Description: 'Imported HSN', Status: 'ACTIVE' }],
      })
    expect(hsnRes.status).toBe(200)
    expect(hsnRes.body.data.imported).toBe(1)
  })

  it('exports items, vendors and hsn-sac as CSV', async () => {
    const itemExport = await request(app)
      .get(`/api/v1/t/${ctx.slug}/masters/exports/items`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(itemExport.status).toBe(200)
    expect(itemExport.headers['content-type']).toContain('text/csv')
    expect(itemExport.text).toContain('Item Code')

    const vendorExport = await request(app)
      .get(`/api/v1/t/${ctx.slug}/masters/exports/vendors`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(vendorExport.status).toBe(200)
    expect(vendorExport.text).toContain('Vendor Code')

    const hsnExport = await request(app)
      .get(`/api/v1/t/${ctx.slug}/masters/exports/hsn-sac`)
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(hsnExport.status).toBe(200)
    expect(hsnExport.text).toContain('HSN Code')
  })
})
