import request from 'supertest'
import type { Express } from 'express'
import { prisma } from '../../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../../src/constants/permissions.js'

export const MANUFACTURING_PERMS = PERMISSIONS.filter(
  (p) => p.startsWith('manufacturing.') || p.startsWith('master.'),
) as PermissionName[]

export interface ManufacturingFixture {
  tenantId: string
  userId: string
  slug: string
  token: string
  itemId: string
  componentItemId: string
  subComponentItemId: string
  uomId: string
  warehouseId: string
  locationId: string
  vendorId: string
}

export async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({ where: { name }, create: { name, module, description: name }, update: {} })
      .catch(() => {})
  }
}

export async function createUserWithPerms(
  app: Express,
  tenantId: string,
  slug: string,
  permNames: PermissionName[],
  label: string,
): Promise<{ userId: string; token: string }> {
  const { hashPassword } = await import('../../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}@${slug}.test`
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: label,
      lastName: 'User',
      email,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const perms = await prisma.permission.findMany({ where: { name: { in: permNames } } })
  const role = await prisma.role.create({
    data: {
      tenantId,
      name: `${label} Role ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'Test@123', tenantSlug: slug })
  return { userId: user.id, token: loginRes.body.data?.accessToken ?? '' }
}

export async function createManufacturingAdminTenant(app: Express, slugPrefix: string) {
  const slug = `${slugPrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const tenant = await prisma.tenant.create({
    data: { name: 'Manufacturing Test Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
  })
  const { userId, token } = await createUserWithPerms(app, tenant.id, slug, MANUFACTURING_PERMS, 'mfg-admin')
  return { tenantId: tenant.id, userId, slug, token }
}

export async function bootstrapManufacturingFixture(ctx: {
  tenantId: string
  slug: string
  token: string
  userId: string
}): Promise<ManufacturingFixture> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`

  const category = await prisma.masterItemCategory.create({
    data: { tenantId: ctx.tenantId, code: `CAT${suffix}`.slice(-16), name: 'Manufacturing Test Category' },
  })
  const uom = await prisma.masterUom.create({
    data: { tenantId: ctx.tenantId, code: `EA${suffix}`.slice(-16), name: 'Each', uomType: 'integer', isBaseUnit: true },
  })
  const warehouse = await prisma.masterWarehouse.create({
    data: { tenantId: ctx.tenantId, code: `WH${suffix}`.slice(-16), name: 'Main Warehouse' },
  })
  const location = await prisma.masterLocation.create({
    data: { tenantId: ctx.tenantId, warehouseId: warehouse.id, code: `LOC${suffix}`.slice(-16), name: 'Main Location' },
  })
  const item = await prisma.masterItem.create({
    data: {
      tenantId: ctx.tenantId,
      code: `ITEM${suffix}`.slice(-24),
      name: 'Finished Trailer Assembly',
      categoryId: category.id,
      baseUomId: uom.id,
      itemType: 'finished_good',
    },
  })
  const componentItem = await prisma.masterItem.create({
    data: {
      tenantId: ctx.tenantId,
      code: `COMP${suffix}`.slice(-24),
      name: 'Chassis Component',
      categoryId: category.id,
      baseUomId: uom.id,
      itemType: 'semi_finished',
    },
  })
  const subComponentItem = await prisma.masterItem.create({
    data: {
      tenantId: ctx.tenantId,
      code: `SUBC${suffix}`.slice(-24),
      name: 'Raw Steel Sheet',
      categoryId: category.id,
      baseUomId: uom.id,
      itemType: 'raw_material',
    },
  })
  const vendor = await prisma.masterVendor.create({
    data: { tenantId: ctx.tenantId, code: `VEN${suffix}`.slice(-16), name: 'Test Subcontractor Pvt Ltd' },
  })

  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    slug: ctx.slug,
    token: ctx.token,
    itemId: item.id,
    componentItemId: componentItem.id,
    subComponentItemId: subComponentItem.id,
    uomId: uom.id,
    warehouseId: warehouse.id,
    locationId: location.id,
    vendorId: vendor.id,
  }
}

export async function cleanupTenant(tenantId: string): Promise<void> {
  await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.refreshToken.deleteMany({ where: { user: { tenantId } } }).catch(() => {})
  await prisma.productionOrderMaterial.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockReservation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.purchaseRequisitionLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.codeSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.purchaseRequisition.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.qualityInspectionParameterResult.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.qualityNcr.deleteMany({ where: { tenantId } }).catch(() => {})
  // Legacy QualityInspection / QualityInspectionLine models were removed from schema;
  // keep optional guards so cleanup does not throw when the Prisma delegate is absent.
  const prismaAny = prisma as unknown as Record<string, { deleteMany?: (args: unknown) => Promise<unknown> } | undefined>
  await prismaAny.qualityInspectionLine?.deleteMany?.({ where: { tenantId } })?.catch?.(() => {})
  await prismaAny.qualityInspection?.deleteMany?.({ where: { tenantId } })?.catch?.(() => {})
  await prisma.manufacturingQualityInspection.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.qualityInspectionPlanLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.qualityInspectionPlan.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.qualityParameter.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingOperationDependency.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingRoutingOperation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingStageGroup.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingProfile
    .updateMany({
      where: { tenantId },
      data: { defaultBomVersionId: null, defaultRoutingVersionId: null },
    })
    .catch(() => {})
  await prisma.manufacturingProfile.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingRoutingVersion.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingRouting.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingBomLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingBomVersion.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingBom.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingMachine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingWorkCentre.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterItemCategory.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterLocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterWarehouse.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterUom.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.masterVendor.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } }).catch(() => {})
  await prisma.role.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}
