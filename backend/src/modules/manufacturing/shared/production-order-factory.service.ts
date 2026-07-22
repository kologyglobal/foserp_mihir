import { Prisma, type ProductionDemandSourceType } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ValidationError } from '../../../utils/errors.js'
import { assertItem, assertManufacturingProfile } from './manufacturing.helpers.js'
import { toDecimal } from './quantity.service.js'
import { logProductionActivity } from './activity.service.js'

export interface CreateProductionOrderParams {
  tenantId: string
  userId: string
  demandId?: string | null
  sourceType: ProductionDemandSourceType
  sourceDocumentId?: string | null
  sourceLineReference?: string | null
  salesOrderId?: string | null
  customerId?: string | null
  projectRef?: string | null
  productItemId: string
  manufacturingProfileId?: string | null
  plannedQuantity: Prisma.Decimal.Value
  requiredCompletionDate: Date
  plannedStartDate?: Date | null
  priority?: string
  plantCode?: string | null
  managerId?: string | null
  supervisorId?: string | null
  jobNumber?: string | null
  notes?: string | null
  idempotencyKey?: string | null
}

/**
 * Resolves the active manufacturing profile + its default BOM/routing versions for an item,
 * validating that both are in ACTIVE status. Phase 2A always snapshots a routing at release,
 * so an active default routing version is required in addition to the BOM version.
 */
export async function resolveActiveManufacturingSetup(
  tenantId: string,
  productItemId: string,
  manufacturingProfileId?: string | null,
) {
  const profile = manufacturingProfileId
    ? await assertManufacturingProfile(tenantId, manufacturingProfileId)
    : await prisma.manufacturingProfile.findFirst({
        where: { productItemId, isActive: true, ...tenantActiveFilter(tenantId) },
      })

  if (!profile) {
    throw new ValidationError(`No active manufacturing profile found for item ${productItemId}`)
  }
  if (profile.productItemId !== productItemId) {
    throw new ValidationError('Manufacturing profile does not belong to the specified product item')
  }
  if (!profile.isActive) {
    throw new ValidationError('Manufacturing profile is not active')
  }

  if (!profile.defaultBomVersionId) {
    throw new ValidationError('Manufacturing profile has no default BOM version configured')
  }
  const bomVersion = await prisma.manufacturingBomVersion.findFirst({
    where: { id: profile.defaultBomVersionId, tenantId, deletedAt: null },
  })
  if (!bomVersion || bomVersion.status !== 'ACTIVE') {
    throw new ValidationError('Manufacturing profile default BOM version is not ACTIVE')
  }

  if (!profile.defaultRoutingVersionId) {
    throw new ValidationError('Manufacturing profile has no default routing version configured')
  }
  const routingVersion = await prisma.manufacturingRoutingVersion.findFirst({
    where: { id: profile.defaultRoutingVersionId, tenantId, deletedAt: null },
  })
  if (!routingVersion || routingVersion.status !== 'ACTIVE') {
    throw new ValidationError('Manufacturing profile default routing version is not ACTIVE')
  }

  return { profile, bomVersion, routingVersion }
}

/**
 * Creates a DRAFT ProductionOrder (Work Order) tied to `productItemId`'s active manufacturing
 * profile/BOM/routing. Used by both manual WO creation and Sales Order line conversion.
 */
export async function createProductionOrderRecord(tx: Prisma.TransactionClient, params: CreateProductionOrderParams) {
  await assertItem(params.tenantId, params.productItemId)
  const { profile, bomVersion, routingVersion } = await resolveActiveManufacturingSetup(
    params.tenantId,
    params.productItemId,
    params.manufacturingProfileId,
  )

  if (params.sourceType === 'MANUAL' && !profile.directProductionOrderAllowed) {
    throw new ValidationError("Direct/manual work orders are not allowed for this item's manufacturing profile")
  }

  const orderNumber = await nextCode(params.tenantId, 'PRODUCTION_ORDER', tx)

  const order = await tx.productionOrder.create({
    data: {
      tenantId: params.tenantId,
      orderNumber,
      demandId: params.demandId ?? null,
      sourceType: params.sourceType,
      sourceDocumentId: params.sourceDocumentId ?? null,
      sourceLineReference: params.sourceLineReference ?? null,
      salesOrderId: params.salesOrderId ?? null,
      customerId: params.customerId ?? null,
      projectRef: params.projectRef ?? null,
      productItemId: params.productItemId,
      manufacturingProfileId: profile.id,
      bomVersionId: bomVersion.id,
      routingVersionId: routingVersion.id,
      plannedQuantity: toDecimal(params.plannedQuantity),
      uomId: bomVersion.baseUomId,
      plantCode: params.plantCode ?? profile.plantCode ?? null,
      plannedStartDate: params.plannedStartDate ?? null,
      requiredCompletionDate: params.requiredCompletionDate,
      priority: params.priority ?? 'MEDIUM',
      managerId: params.managerId ?? null,
      supervisorId: params.supervisorId ?? null,
      jobNumber: params.jobNumber ?? null,
      outputTrackingType: profile.outputTrackingMethod,
      status: 'DRAFT',
      healthStatus: 'ON_TRACK',
      materialControlStatus: 'NOT_CONNECTED',
      qualityStatus: 'PENDING_INTEGRATION',
      notes: params.notes ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      createdBy: params.userId,
      updatedBy: params.userId,
    },
  })

  await logProductionActivity(
    {
      tenantId: params.tenantId,
      productionOrderId: order.id,
      activityType: params.sourceType === 'SALES_ORDER' ? 'DEMAND_CONVERTED' : 'CREATED',
      userId: params.userId,
      message:
        params.sourceType === 'SALES_ORDER'
          ? `Work order ${orderNumber} created from sales order demand`
          : `Work order ${orderNumber} created`,
      newValue: order,
    },
    tx,
  )

  return order
}
