import request from 'supertest'
import type { Express } from 'express'
import { prisma } from '../../../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../../../src/constants/permissions.js'
import { createUserWithPerms, MANUFACTURING_PERMS, type ManufacturingFixture } from './manufacturing-fixture.js'

/** Deletes Phase 2A/2B production + CRM sales order data for a tenant before the shared cleanup runs. */
export async function cleanupProductionData(tenantId: string): Promise<void> {
  await prisma.productionPlanLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionPlan.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionOrderMaterial.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionDowntime.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionIssue.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dailyProductionLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dailyProductionBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionAssignment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionActivity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionStageLedger.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionOrderDependency.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionOrderOperation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionOrderStage.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionOrderRoutingSnapshot.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionOrderBomLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionOrderBomSnapshot.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionOrder.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.productionDemand.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmSalesOrder.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.purchaseRequisitionLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.purchaseRequisition.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.qualityNcr.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.qualityInspectionParameterResult.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.manufacturingQualityInspection.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockReservation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
}

export const PRODUCTION_TEST_PERMS = Array.from(
  new Set([...MANUFACTURING_PERMS, ...PERMISSIONS.filter((p) => p.startsWith('crm.'))]),
) as PermissionName[]

/** A single tenant-wide user/token with both manufacturing and CRM permissions, for building test fixtures (SO creation) that span both modules. */
export async function createProductionCapableToken(app: Express, fx: Pick<ManufacturingFixture, 'tenantId' | 'slug'>) {
  return createUserWithPerms(app, fx.tenantId, fx.slug, PRODUCTION_TEST_PERMS, 'prod-fixture')
}

function base(slug: string) {
  return `/api/v1/t/${slug}/manufacturing`
}

function crmBase(slug: string) {
  return `/api/v1/t/${slug}/crm`
}

export interface ProductionReadySetup {
  profileId: string
  bomId: string
  bomVersionId: string
  routingId: string
  routingVersionId: string
  stage1Id: string // parallel stage A (no predecessors)
  stage2Id: string // parallel stage B (no predecessors)
  stage3Id: string // final assembly stage — depends on both stage1 + stage2 operations
  op1Id: string
  op2Id: string
  op3Id: string
  bomLineId: string
}

/**
 * Builds a fully ACTIVE manufacturing profile + BOM version + routing version
 * (two parallel stages feeding into one final assembly stage) for `fx.itemId`,
 * ready for Work Order creation/release tests.
 */
export async function buildProductionReadySetup(app: Express, fx: ManufacturingFixture): Promise<ProductionReadySetup> {
  const b = base(fx.slug)
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${fx.token}`)
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`

  const bom = await auth(
    request(app)
      .post(`${b}/boms`)
      .send({ code: `PBOM-${suffix}`, name: 'Production BOM', productItemId: fx.itemId }),
  )
  if (bom.status !== 201) throw new Error(`Failed to create BOM: ${JSON.stringify(bom.body)}`)
  const bomId = bom.body.data.id as string

  const bomVersion = await auth(
    request(app)
      .post(`${b}/boms/${bomId}/versions`)
      .send({
        revisionCode: 'REV-A',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        baseQuantity: '1',
        baseUomId: fx.uomId,
        expectedYieldPercent: '100',
      }),
  )
  if (bomVersion.status !== 201) throw new Error(`Failed to create BOM version: ${JSON.stringify(bomVersion.body)}`)
  const bomVersionId = bomVersion.body.data.id as string

  const bomLine = await auth(
    request(app)
      .post(`${b}/bom-versions/${bomVersionId}/lines`)
      .send({
        itemId: fx.subComponentItemId,
        quantity: '2',
        uomId: fx.uomId,
        lineType: 'RAW_MATERIAL',
        makeOrBuy: 'BUY',
      }),
  )
  if (bomLine.status !== 201) throw new Error(`Failed to create BOM line: ${JSON.stringify(bomLine.body)}`)
  const bomLineId = bomLine.body.data.id as string

  const activatedBom = await auth(request(app).post(`${b}/bom-versions/${bomVersionId}/activate`))
  if (activatedBom.status !== 200) throw new Error(`Failed to activate BOM version: ${JSON.stringify(activatedBom.body)}`)

  const routing = await auth(
    request(app)
      .post(`${b}/routings`)
      .send({ code: `PRT-${suffix}`, name: 'Production Routing', productItemId: fx.itemId }),
  )
  if (routing.status !== 201) throw new Error(`Failed to create routing: ${JSON.stringify(routing.body)}`)
  const routingId = routing.body.data.id as string

  const routingVersion = await auth(
    request(app)
      .post(`${b}/routings/${routingId}/versions`)
      .send({ revisionCode: 'REV-A', effectiveFrom: new Date().toISOString().slice(0, 10) }),
  )
  if (routingVersion.status !== 201) throw new Error(`Failed to create routing version: ${JSON.stringify(routingVersion.body)}`)
  const routingVersionId = routingVersion.body.data.id as string

  const stage1 = await auth(
    request(app)
      .post(`${b}/routing-versions/${routingVersionId}/stage-groups`)
      .send({ code: 'ST-01', name: 'Cutting', displayOrder: 1 }),
  )
  const stage1Id = stage1.body.data.id as string

  const stage2 = await auth(
    request(app)
      .post(`${b}/routing-versions/${routingVersionId}/stage-groups`)
      .send({ code: 'ST-02', name: 'Welding', displayOrder: 2 }),
  )
  const stage2Id = stage2.body.data.id as string

  const stage3 = await auth(
    request(app)
      .post(`${b}/routing-versions/${routingVersionId}/stage-groups`)
      .send({ code: 'ST-03', name: 'Assembly', displayOrder: 3 }),
  )
  const stage3Id = stage3.body.data.id as string

  const op1 = await auth(
    request(app)
      .post(`${b}/routing-versions/${routingVersionId}/operations`)
      .send({ stageGroupId: stage1Id, code: 'OP-10', name: 'Cut Steel Sheet', sequence: 10 }),
  )
  const op1Id = op1.body.data.id as string

  const op2 = await auth(
    request(app)
      .post(`${b}/routing-versions/${routingVersionId}/operations`)
      .send({ stageGroupId: stage2Id, code: 'OP-20', name: 'Weld Frame', sequence: 20 }),
  )
  const op2Id = op2.body.data.id as string

  const op3 = await auth(
    request(app)
      .post(`${b}/routing-versions/${routingVersionId}/operations`)
      .send({ stageGroupId: stage3Id, code: 'OP-30', name: 'Final Assembly', sequence: 30 }),
  )
  const op3Id = op3.body.data.id as string

  const dep1 = await auth(
    request(app)
      .post(`${b}/routing-versions/${routingVersionId}/dependencies`)
      .send({ predecessorOperationId: op1Id, successorOperationId: op3Id }),
  )
  if (dep1.status !== 201) throw new Error(`Failed to create dependency 1: ${JSON.stringify(dep1.body)}`)

  const dep2 = await auth(
    request(app)
      .post(`${b}/routing-versions/${routingVersionId}/dependencies`)
      .send({ predecessorOperationId: op2Id, successorOperationId: op3Id }),
  )
  if (dep2.status !== 201) throw new Error(`Failed to create dependency 2: ${JSON.stringify(dep2.body)}`)

  const activatedRouting = await auth(request(app).post(`${b}/routing-versions/${routingVersionId}/activate`))
  if (activatedRouting.status !== 200) throw new Error(`Failed to activate routing version: ${JSON.stringify(activatedRouting.body)}`)

  const profile = await auth(
    request(app)
      .post(`${b}/profiles`)
      .send({
        code: `PPROF-${suffix}`,
        name: 'Production Ready Profile',
        productItemId: fx.itemId,
        productionType: 'ASSEMBLY',
        executionMode: 'DETAILED',
      }),
  )
  if (profile.status !== 201) throw new Error(`Failed to create profile: ${JSON.stringify(profile.body)}`)
  const profileId = profile.body.data.id as string

  const updatedProfile = await auth(
    request(app)
      .patch(`${b}/profiles/${profileId}`)
      .send({
        defaultBomVersionId: bomVersionId,
        defaultRoutingVersionId: routingVersionId,
        productionWarehouseId: fx.warehouseId,
        finishedGoodsWarehouseId: fx.warehouseId,
      }),
  )
  if (updatedProfile.status !== 200) throw new Error(`Failed to update profile defaults: ${JSON.stringify(updatedProfile.body)}`)

  return {
    profileId,
    bomId,
    bomVersionId,
    routingId,
    routingVersionId,
    stage1Id,
    stage2Id,
    stage3Id,
    op1Id,
    op2Id,
    op3Id,
    bomLineId,
  }
}

export async function createConfirmedSalesOrderWithLine(
  app: Express,
  fx: Pick<ManufacturingFixture, 'slug'>,
  token: string,
  opts: { productId: string; qty: number; unitPrice?: number },
): Promise<{ salesOrderId: string; lineId: string; companyId: string }> {
  const cb = crmBase(fx.slug)
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`)
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`

  const company = await auth(
    request(app)
      .post(`${cb}/companies`)
      .send({ customerName: `Production Test Customer ${suffix}`, customerType: 'corporate', isActive: true }),
  )
  if (company.status !== 201) throw new Error(`Failed to create CRM company: ${JSON.stringify(company.body)}`)
  const companyId = company.body.data.id as string

  const salesOrder = await auth(
    request(app)
      .post(`${cb}/sales-orders`)
      .send({
        customerId: companyId,
        source: 'direct',
        directSoReason: 'Production demand conversion test',
        customerPoNumber: `PO-PROD-${suffix}`,
        paymentTerms: 'Net 30',
        deliveryTerms: 'Ex-works',
        lines: [
          {
            productOrItem: 'Manufactured Item',
            description: 'Line for production demand conversion',
            productId: opts.productId,
            qty: opts.qty,
            uom: 'NOS',
            unitPrice: opts.unitPrice ?? 10000,
            discountPct: 0,
            taxPct: 18,
          },
        ],
      }),
  )
  if (salesOrder.status !== 201) throw new Error(`Failed to create sales order: ${JSON.stringify(salesOrder.body)}`)
  const salesOrderId = salesOrder.body.data.id as string
  const lineId = salesOrder.body.data.lines[0].id as string

  const confirmed = await auth(request(app).post(`${cb}/sales-orders/${salesOrderId}/confirm`))
  if (confirmed.status !== 200) throw new Error(`Failed to confirm sales order: ${JSON.stringify(confirmed.body)}`)

  return { salesOrderId, lineId, companyId }
}

export async function createOpenSalesOrderWithLine(
  app: Express,
  fx: Pick<ManufacturingFixture, 'slug'>,
  token: string,
  opts: { productId: string; qty: number; unitPrice?: number },
): Promise<{ salesOrderId: string; lineId: string; companyId: string }> {
  const cb = crmBase(fx.slug)
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`)
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`

  const company = await auth(
    request(app)
      .post(`${cb}/companies`)
      .send({ customerName: `Production Test Customer (Open) ${suffix}`, customerType: 'corporate', isActive: true }),
  )
  if (company.status !== 201) throw new Error(`Failed to create CRM company: ${JSON.stringify(company.body)}`)
  const companyId = company.body.data.id as string

  const salesOrder = await auth(
    request(app)
      .post(`${cb}/sales-orders`)
      .send({
        customerId: companyId,
        source: 'direct',
        directSoReason: 'Production demand conversion test (unconfirmed)',
        customerPoNumber: `PO-PROD-OPEN-${suffix}`,
        paymentTerms: 'Net 30',
        deliveryTerms: 'Ex-works',
        lines: [
          {
            productOrItem: 'Manufactured Item',
            description: 'Line for production demand conversion (unconfirmed)',
            productId: opts.productId,
            qty: opts.qty,
            uom: 'NOS',
            unitPrice: opts.unitPrice ?? 10000,
            discountPct: 0,
            taxPct: 18,
          },
        ],
      }),
  )
  if (salesOrder.status !== 201) throw new Error(`Failed to create sales order: ${JSON.stringify(salesOrder.body)}`)
  const salesOrderId = salesOrder.body.data.id as string
  const lineId = salesOrder.body.data.lines[0].id as string

  return { salesOrderId, lineId, companyId }
}
