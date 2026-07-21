import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'

/**
 * Phase 1A — Purchase Setup (live DB integration).
 * Defaults-on-empty GET, create/update, FK validation, plant overrides,
 * RBAC, tenant isolation, audit, optimistic concurrency.
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
      data: { name: 'Purchase Setup', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
  } else {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    slug = tenant.slug
  }
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: 'Setup',
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
  await prisma.purchaseApprovalTierRole.deleteMany({
    where: { tier: { tenantId } },
  })
  await prisma.purchaseApprovalTier.deleteMany({ where: { tenantId } })
  await prisma.purchaseInspectionCategory.deleteMany({ where: { tenantId } })
  await prisma.purchasePlantSettings.deleteMany({ where: { tenantId } })
  await prisma.purchaseSettings.deleteMany({ where: { tenantId } })
  await prisma.codeSeries.deleteMany({ where: { tenantId } })
  await prisma.crmMaster.deleteMany({ where: { tenantId } })
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

const SETUP_PERMS = [
  'purchase.setup.view',
  'purchase.setup.manage',
] as PermissionName[]

describe.skipIf(!dbAvailable)('Purchase setup (full persistence)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let viewerToken = ''
  let otherTenantId = ''
  let otherSlug = ''
  let otherToken = ''

  let plantId = ''
  let warehouseId = ''
  let locationId = ''
  let otherLocationId = ''
  let otherWarehouseId = ''
  let paymentTermCode = 'NET30'

  const setupBase = (s = slug) => `/api/v1/t/${s}/purchase/setup`
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })

  beforeAll(async () => {
    await ensurePermissions()
    const main = await createTenantUser({
      slugPrefix: 'po-setup',
      permissionNames: SETUP_PERMS,
    })
    tenantId = main.tenantId
    slug = main.slug
    token = main.token

    const viewer = await createTenantUser({
      slugPrefix: 'po-setup-view',
      permissionNames: ['purchase.setup.view'],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      slugPrefix: 'po-setup-other',
      permissionNames: SETUP_PERMS,
    })
    otherTenantId = other.tenantId
    otherSlug = other.slug
    otherToken = other.token

    const plant = await prisma.masterPlant.create({
      data: { tenantId, code: 'PL-S1', name: 'Setup Plant', status: 'ACTIVE' },
    })
    plantId = plant.id

    const wh = await prisma.masterWarehouse.create({
      data: {
        tenantId,
        plantId,
        code: 'WH-S1',
        name: 'Setup WH',
        warehouseType: 'receiving',
        status: 'ACTIVE',
      },
    })
    warehouseId = wh.id

    const loc = await prisma.masterLocation.create({
      data: {
        tenantId,
        warehouseId,
        code: 'LOC-S1',
        name: 'Receiving Dock',
        status: 'ACTIVE',
      },
    })
    locationId = loc.id

    const plant2 = await prisma.masterPlant.create({
      data: { tenantId, code: 'PL-S2', name: 'Other Plant', status: 'ACTIVE' },
    })
    const wh2 = await prisma.masterWarehouse.create({
      data: {
        tenantId,
        plantId: plant2.id,
        code: 'WH-S2',
        name: 'Other WH',
        warehouseType: 'storage',
        status: 'ACTIVE',
      },
    })
    otherWarehouseId = wh2.id
    const loc2 = await prisma.masterLocation.create({
      data: {
        tenantId,
        warehouseId: otherWarehouseId,
        code: 'LOC-S2',
        name: 'Other Loc',
        status: 'ACTIVE',
      },
    })
    otherLocationId = loc2.id

    await prisma.crmMaster.create({
      data: {
        tenantId,
        kind: 'payment-terms',
        code: paymentTermCode,
        name: 'Net 30 Days',
        status: 'active',
      },
    })
  }, 120_000)

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId)
    if (otherTenantId) await cleanupTenant(otherTenantId)
  }, 120_000)

  it('GET returns server defaults without persisting when empty', async () => {
    const before = await prisma.purchaseSettings.count({ where: { tenantId } })
    const res = await request(app).get(setupBase()).set(auth())
    expect(res.status).toBe(200)
    expect(res.body.data.isConfigured).toBe(false)
    expect(res.body.data.general.defaultCurrency).toBe('INR')
    expect(res.body.data.version).toBe(0)
    expect(res.body.data.notifications.status).toBe('ON_HOLD')
    expect(res.body.data.numberSeries.purchaseOrder.prefix).toBeTruthy()
    const after = await prisma.purchaseSettings.count({ where: { tenantId } })
    expect(after).toBe(before)
  })

  it('denies manage without purchase.setup.manage', async () => {
    const res = await request(app)
      .put(setupBase())
      .set(auth(viewerToken))
      .send({
        version: 0,
        general: { defaultWarehouseId: warehouseId },
      })
    expect(res.status).toBe(403)
  })

  it('creates setup via PUT and persists nested sections', async () => {
    const res = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        version: 0,
        general: {
          defaultPlantId: plantId,
          defaultWarehouseId: warehouseId,
          defaultPaymentTermCode: paymentTermCode,
          requirePoWarehouse: true,
          allowOverReceipt: true,
          overReceiptTolerancePct: 10,
          requireQuotationComparison: true,
          allowShortClose: false,
        },
        receiving: {
          requireVendorChallan: true,
          defaultReceivingLocationId: locationId,
          requireBatch: true,
        },
        tax: {
          defaultGstScheme: 'igst',
          placeOfSupplyState: 'Maharashtra',
          placeOfSupplyStateCode: '27',
          tdsEnabled: true,
        },
        invoiceMatchTolerances: {
          requirePoMatch: true,
          quantityTolerancePct: 2,
        },
        allowDirectInvoice: false,
        approvalMatrix: [
          {
            minAmount: 0,
            maxAmount: 100000,
            requiredRoles: ['purchase_head'],
            sortOrder: 1,
            isActive: true,
            label: 'Up to 1L',
            documentType: 'all',
          },
        ],
        quality: {
          inspectionRequiredCategories: ['raw_material'],
          allowAcceptanceUnderDeviation: true,
          deviationApproverRole: 'purchase_head',
        },
        print: {
          companyName: 'Test Co',
          logoUrl: null,
          defaultCopies: 2,
          paperSize: 'A4',
          orientation: 'portrait',
        },
        numberSeries: {
          purchaseOrder: { prefix: 'POX', padLength: 5 },
        },
        requisition: {
          skipRfq: false,
          autoCompleteRef: true,
        },
      })
    expect(res.status).toBe(200)
    expect(res.body.data.isConfigured).toBe(true)
    expect(res.body.data.version).toBe(1)
    expect(res.body.data.general.defaultWarehouseId).toBe(warehouseId)
    expect(res.body.data.general.defaultPaymentTerms).toBe('Net 30 Days')
    expect(res.body.data.receiving.requireVendorChallan).toBe(true)
    expect(res.body.data.receiving.requireBatch).toBe(true)
    expect(res.body.data.tax.defaultGstScheme).toBe('igst')
    expect(res.body.data.approvalMatrix).toHaveLength(1)
    expect(res.body.data.quality.inspectionRequiredCategories).toContain('raw_material')
    expect(res.body.data.print.companyName).toBe('Test Co')
    expect(res.body.data.numberSeries.purchaseOrder.prefix).toBe('POX')
    expect(res.body.data.numberSeries.purchaseOrder.padLength).toBe(5)
    expect(res.body.data.requisition.autoCompleteRef).toBe(true)
    expect(res.body.data.notifications.status).toBe('ON_HOLD')

    const row = await prisma.purchaseSettings.findUnique({ where: { tenantId } })
    expect(row?.defaultWarehouseId).toBe(warehouseId)
    expect(row?.version).toBe(1)
    expect(row?.requireBatch).toBe(true)
  })

  it('writes SETUP_CREATED audit on first save', async () => {
    const audits = await prisma.auditLog.findMany({
      where: { tenantId, entity: 'PurchaseSettings', action: 'SETUP_CREATED' },
    })
    expect(audits.length).toBeGreaterThanOrEqual(1)
  })

  it('updates setup and increments version', async () => {
    const res = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        version: 1,
        general: {
          defaultPlantId: plantId,
          defaultWarehouseId: warehouseId,
        },
        receiving: {
          defaultReceivingLocationId: locationId,
          requireGateEntry: true,
        },
      })
    expect(res.status).toBe(200)
    expect(res.body.data.version).toBe(2)
    expect(res.body.data.receiving.requireGateEntry).toBe(true)

    const audits = await prisma.auditLog.findMany({
      where: { tenantId, entity: 'PurchaseSettings', action: 'SETUP_UPDATED' },
    })
    expect(audits.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 409 on stale version', async () => {
    const res = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        version: 1,
        general: { defaultWarehouseId: warehouseId },
      })
    expect(res.status).toBe(409)
    expect(res.body.error?.code || res.body.code).toMatch(/SETUP_VERSION_CONFLICT|VERSION/)
  })

  it('rejects inactive warehouse', async () => {
    await prisma.masterWarehouse.update({
      where: { id: warehouseId },
      data: { status: 'INACTIVE' },
    })
    const current = await request(app).get(setupBase()).set(auth())
    const res = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        version: current.body.data.version,
        general: { defaultWarehouseId: warehouseId },
      })
    expect(res.status).toBe(400)
    expect(res.body.error?.code || res.body.code).toMatch(/SETUP_WAREHOUSE_INACTIVE|VALIDATION/)
    await prisma.masterWarehouse.update({
      where: { id: warehouseId },
      data: { status: 'ACTIVE' },
    })
  })

  it('rejects location not under configured warehouse', async () => {
    const current = await request(app).get(setupBase()).set(auth())
    const res = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        version: current.body.data.version,
        general: { defaultWarehouseId: warehouseId },
        receiving: { defaultReceivingLocationId: otherLocationId },
      })
    expect(res.status).toBe(400)
    expect(res.body.error?.code || res.body.code).toMatch(
      /SETUP_LOCATION_WAREHOUSE_MISMATCH|VALIDATION/,
    )
  })

  it('rejects invalid payment term code', async () => {
    const current = await request(app).get(setupBase()).set(auth())
    const res = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        version: current.body.data.version,
        general: {
          defaultWarehouseId: warehouseId,
          defaultPaymentTermCode: 'NOPE',
        },
      })
    expect(res.status).toBe(400)
    expect(res.body.error?.code || res.body.code).toMatch(/SETUP_PAYMENT_TERM_INVALID|VALIDATION/)
  })

  it('rejects cross-tenant warehouse id', async () => {
    const foreignPlant = await prisma.masterPlant.create({
      data: {
        tenantId: otherTenantId,
        code: 'PL-FX',
        name: 'Foreign',
        status: 'ACTIVE',
      },
    })
    const foreignWh = await prisma.masterWarehouse.create({
      data: {
        tenantId: otherTenantId,
        plantId: foreignPlant.id,
        code: 'WH-FX',
        name: 'Foreign WH',
        warehouseType: 'receiving',
        status: 'ACTIVE',
      },
    })
    const current = await request(app).get(setupBase()).set(auth())
    const res = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        version: current.body.data.version,
        general: { defaultWarehouseId: foreignWh.id },
      })
    expect(res.status).toBe(400)
  })

  it('rejects overlapping approval tiers', async () => {
    const current = await request(app).get(setupBase()).set(auth())
    const res = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        version: current.body.data.version,
        approvalMatrix: [
          {
            minAmount: 0,
            maxAmount: 100,
            requiredRoles: ['purchase_head'],
            sortOrder: 1,
            isActive: true,
            label: 'A',
            documentType: 'all',
          },
          {
            minAmount: 50,
            maxAmount: 200,
            requiredRoles: ['finance_head'],
            sortOrder: 2,
            isActive: true,
            label: 'B',
            documentType: 'all',
          },
        ],
      })
    expect(res.status).toBe(400)
  })

  it('ignores notifications payload and keeps ON_HOLD', async () => {
    const current = await request(app).get(setupBase()).set(auth())
    const res = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        version: current.body.data.version,
        notifications: {
          prPendingApproval: { inApp: true, email: true },
        },
      })
    // Nested schema strips unknown notifications; save still succeeds with version bump if other fields absent
    expect([200, 400]).toContain(res.status)
    const after = await request(app).get(setupBase()).set(auth())
    expect(after.body.data.notifications.status).toBe('ON_HOLD')
  })

  it('upserts plant override and validates plant–warehouse match', async () => {
    const ok = await request(app)
      .put(`${setupBase()}/plants/${plantId}`)
      .set(auth())
      .send({
        defaultWarehouseId: warehouseId,
        defaultReceivingLocationId: locationId,
      })
    expect(ok.status).toBe(200)
    expect(ok.body.data.defaultWarehouseId).toBe(warehouseId)

    const mismatch = await request(app)
      .put(`${setupBase()}/plants/${plantId}`)
      .set(auth())
      .send({
        defaultWarehouseId: otherWarehouseId,
      })
    expect(mismatch.status).toBe(400)
    expect(mismatch.body.error?.code || mismatch.body.code).toMatch(
      /SETUP_PLANT_WAREHOUSE_MISMATCH|VALIDATION/,
    )

    const list = await request(app).get(`${setupBase()}/plants`).set(auth())
    expect(list.status).toBe(200)
    expect(list.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('enforces tenant isolation on GET', async () => {
    const res = await request(app).get(setupBase(otherSlug)).set(auth(otherToken))
    expect(res.status).toBe(200)
    expect(res.body.data.isConfigured).toBe(false)

    const leak = await request(app).get(setupBase(otherSlug)).set(auth())
    expect([401, 403, 404]).toContain(leak.status)
  })

  it('allows viewer to GET setup', async () => {
    const res = await request(app).get(setupBase()).set(auth(viewerToken))
    expect(res.status).toBe(200)
    expect(res.body.data.isConfigured).toBe(true)
  })
})
