import request from 'supertest'
import type { Express } from 'express'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'

export const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

export const FULL_PURCHASE_PERMS = PERMISSIONS.filter(
  (p) => p.startsWith('purchase.'),
) as PermissionName[]

export async function ensurePermissions() {
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

export async function createTenantUser(opts: {
  app: Express
  slugPrefix: string
  permissionNames: PermissionName[]
  tenantId?: string
}) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  let tenantId = opts.tenantId
  let slug = ''
  if (!tenantId) {
    slug = `${opts.slugPrefix}-${suffix}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Purchase Live', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
  } else {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    slug = tenant.slug
  }
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: 'Pur',
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
  const loginRes = await request(opts.app).post('/api/v1/auth/login').send({
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

export async function cleanupPurchaseTenant(tenantId: string) {
  await prisma.vendorInvoiceSourceLink.deleteMany({ where: { tenantId } })
  await prisma.vendorInvoiceLine.deleteMany({ where: { tenantId } })
  await prisma.vendorInvoice.deleteMany({ where: { tenantId } })
  await prisma.purchaseInvoiceLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseInvoice.deleteMany({ where: { tenantId } })
  await prisma.purchaseQualityInspectionLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseQualityInspection.deleteMany({ where: { tenantId } })
  await prisma.purchaseReturnLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseReturn.deleteMany({ where: { tenantId } })
  await prisma.goodsReceiptLine.deleteMany({ where: { tenantId } })
  await prisma.goodsReceipt.deleteMany({ where: { tenantId } })
  await prisma.purchaseOrderLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } })
  await prisma.purchaseStatusHistory.deleteMany({ where: { tenantId } })
  await prisma.purchasePlantSettings.deleteMany({ where: { tenantId } })
  await prisma.purchaseSettings.deleteMany({ where: { tenantId } })
  await prisma.purchaseApproval.deleteMany({ where: { tenantId } })
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockReservation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterBin.deleteMany({ where: { tenantId } })
  await prisma.masterLocation.deleteMany({ where: { tenantId } })
  await prisma.masterWarehouse.deleteMany({ where: { tenantId } })
  await prisma.masterPlant.deleteMany({ where: { tenantId } })
  await prisma.masterVendor.deleteMany({ where: { tenantId } })
  await prisma.masterUom.deleteMany({ where: { tenantId } })
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.auditLog.deleteMany({ where: { tenantId } })
  await prisma.codeSeries.deleteMany({ where: { tenantId } })
  await prisma.userRole.deleteMany({ where: { tenantId } })
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } })
  await prisma.role.deleteMany({ where: { tenantId } })
  await prisma.user.deleteMany({ where: { tenantId } })
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

export type PurchaseMasterIds = {
  vendorId: string
  uomId: string
  warehouseId: string
  locationId: string
  binId: string
}

export async function seedPurchaseMasters(tenantId: string): Promise<PurchaseMasterIds> {
  const vendor = await prisma.masterVendor.create({
    data: { tenantId, code: `V-${Date.now()}`, name: 'Live Vendor', status: 'ACTIVE' },
  })
  const uom = await prisma.masterUom.create({
    data: { tenantId, code: 'NOS', name: 'Numbers', uomType: 'integer', status: 'ACTIVE' },
  })
  const plant = await prisma.masterPlant.create({
    data: { tenantId, code: 'PL-L', name: 'Live Plant', status: 'ACTIVE' },
  })
  const wh = await prisma.masterWarehouse.create({
    data: {
      tenantId,
      plantId: plant.id,
      code: 'WH-L',
      name: 'Live WH',
      warehouseType: 'receiving',
      status: 'ACTIVE',
    },
  })
  const loc = await prisma.masterLocation.create({
    data: { tenantId, warehouseId: wh.id, code: 'SL-L', name: 'Dock', status: 'ACTIVE' },
  })
  const bin = await prisma.masterBin.create({
    data: {
      tenantId,
      warehouseId: wh.id,
      storageLocationId: loc.id,
      code: 'B-L',
      name: 'Bin L',
      status: 'ACTIVE',
    },
  })
  return {
    vendorId: vendor.id,
    uomId: uom.id,
    warehouseId: wh.id,
    locationId: loc.id,
    binId: bin.id,
  }
}

export async function ensureLegalEntity(tenantId: string) {
  const existing = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
  })
  let legalEntityId = existing?.id
  if (!legalEntityId) {
    const le = await prisma.legalEntity.create({
      data: {
        tenantId,
        code: 'LE-LIVE',
        legalName: 'Live Test Entity Pvt Ltd',
        displayName: 'Live Test Entity',
        isDefault: true,
        isActive: true,
      },
    })
    legalEntityId = le.id
  }

  await prisma.financeSettings.upsert({
    where: { legalEntityId },
    create: { tenantId, legalEntityId, financeActivated: true },
    update: { financeActivated: true },
  })

  const fyExisting = await prisma.financialYear.findFirst({
    where: { tenantId, legalEntityId, isCurrent: true },
  })
  if (!fyExisting) {
    const now = new Date()
    const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
    const fy = await prisma.financialYear.create({
      data: {
        tenantId,
        legalEntityId,
        name: `FY ${startYear}`,
        startDate: new Date(`${startYear}-04-01`),
        endDate: new Date(`${startYear + 1}-03-31`),
        status: 'ACTIVE',
        isCurrent: true,
      },
    })
    await prisma.accountingPeriod.create({
      data: {
        tenantId,
        legalEntityId,
        financialYearId: fy.id,
        periodNumber: 1,
        name: 'Open',
        startDate: fy.startDate,
        endDate: fy.endDate,
        status: 'OPEN',
      },
    })
  }

  return legalEntityId
}

export async function createSentPo(
  app: Express,
  opts: {
    slug: string
    token: string
    approverToken: string
    vendorId: string
    uomId: string
    warehouseId?: string
    qty?: number
    itemCode?: string
  },
) {
  const poBase = `/api/v1/t/${opts.slug}/purchase/orders`
  const auth = { Authorization: `Bearer ${opts.token}` }
  const createPo = await request(app)
    .post(poBase)
    .set(auth)
    .send({
      vendorId: opts.vendorId,
      orderDate: '2026-07-21',
      deliveryWarehouseId: opts.warehouseId,
      lines: [
        {
          itemCode: opts.itemCode ?? `ITM-${Date.now()}`,
          itemName: 'Live Item',
          quantity: opts.qty ?? 10,
          uomId: opts.uomId,
          rate: 100,
        },
      ],
    })
  const poId = createPo.body.data.id as string
  const poLineId = createPo.body.data.lines[0].id as string
  await request(app).post(`${poBase}/${poId}/submit`).set(auth).send({})
  await request(app)
    .post(`${poBase}/${poId}/approve`)
    .set({ Authorization: `Bearer ${opts.approverToken}` })
    .send({})
  await request(app).post(`${poBase}/${poId}/send-to-vendor`).set(auth).send({})
  return { poId, poLineId }
}

export async function createSubmittedGrn(
  app: Express,
  opts: {
    slug: string
    token: string
    poId: string
    poLineId: string
    vendorId: string
    warehouseId: string
    locationId: string
    binId: string
    receivedQuantity?: number
    inspectionRequired?: boolean
  },
) {
  const grnBase = `/api/v1/t/${opts.slug}/purchase/grns`
  const auth = { Authorization: `Bearer ${opts.token}` }
  const created = await request(app)
    .post(grnBase)
    .set(auth)
    .send({
      purchaseOrderId: opts.poId,
      receiptDate: '2026-07-21',
      warehouseId: opts.warehouseId,
      storageLocationId: opts.locationId,
      vendorChallanNumber: `CH-${Date.now()}`,
      inspectionRequired: opts.inspectionRequired ?? false,
      lines: [
        {
          purchaseOrderLineId: opts.poLineId,
          receivedQuantity: opts.receivedQuantity ?? 10,
          binId: opts.binId,
        },
      ],
    })
  const grnId = created.body.data.id as string
  const grnLineId = created.body.data.lines[0].id as string
  const submit = await request(app).post(`${grnBase}/${grnId}/submit`).set(auth).send({})
  return { grnId, grnLineId, status: submit.body.data?.status as string, grn: submit.body.data }
}
