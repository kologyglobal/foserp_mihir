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
  /** Optional WO-scoped override; must be ACTIVE and belong to the item. */
  bomVersionId?: string | null
  /** Optional WO-scoped override; must be ACTIVE (item route or generic template). */
  routingVersionId?: string | null
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
  /** Parent finished-goods WO when creating a BOM child / SA work order. */
  parentProductionOrderId?: string | null
}

export type ResolveManufacturingSetupOptions = {
  manufacturingProfileId?: string | null
  bomVersionId?: string | null
  routingVersionId?: string | null
}

/**
 * Resolves the manufacturing profile + BOM/routing versions for an item.
 * Defaults come from the active profile; optional IDs override for this work order only.
 */
export async function resolveActiveManufacturingSetup(
  tenantId: string,
  productItemId: string,
  options?: ResolveManufacturingSetupOptions | null,
) {
  const manufacturingProfileId =
    options && typeof options === 'object' ? options.manufacturingProfileId : undefined
  const bomVersionOverride = options && typeof options === 'object' ? options.bomVersionId : undefined
  const routingVersionOverride = options && typeof options === 'object' ? options.routingVersionId : undefined

  const profile = manufacturingProfileId
    ? await assertManufacturingProfile(tenantId, manufacturingProfileId)
    : await prisma.manufacturingProfile.findFirst({
        where: { productItemId, isActive: true, ...tenantActiveFilter(tenantId) },
      })

  if (!profile) {
    throw new ValidationError(`No active manufacturing profile found for item ${productItemId}`)
  }
  if (profile.productItemId !== productItemId) {
    throw new ValidationError('Manufacturing profile does not belong to the specified item')
  }
  if (!profile.isActive) {
    throw new ValidationError('Manufacturing profile is not active')
  }

  const bomVersionId = bomVersionOverride || profile.defaultBomVersionId
  if (!bomVersionId) {
    throw new ValidationError('Manufacturing profile has no default BOM version configured')
  }
  const bomVersion = await prisma.manufacturingBomVersion.findFirst({
    where: { id: bomVersionId, tenantId, deletedAt: null },
    include: { bom: { select: { productItemId: true } } },
  })
  if (!bomVersion || bomVersion.status !== 'ACTIVE') {
    throw new ValidationError(
      bomVersionOverride
        ? 'Selected BOM version is not ACTIVE'
        : 'Manufacturing profile default BOM version is not ACTIVE',
    )
  }
  if (bomVersion.bom.productItemId !== productItemId) {
    throw new ValidationError('Selected BOM version does not belong to this item')
  }

  const routingVersionId = routingVersionOverride || profile.defaultRoutingVersionId
  if (!routingVersionId) {
    throw new ValidationError('Manufacturing profile has no default routing version configured')
  }
  const routingVersion = await prisma.manufacturingRoutingVersion.findFirst({
    where: { id: routingVersionId, tenantId, deletedAt: null },
    include: { routing: { select: { productItemId: true } } },
  })
  if (!routingVersion || routingVersion.status !== 'ACTIVE') {
    throw new ValidationError(
      routingVersionOverride
        ? 'Selected routing version is not ACTIVE'
        : 'Manufacturing profile default routing version is not ACTIVE',
    )
  }
  const routeItemId = routingVersion.routing.productItemId
  if (routeItemId && routeItemId !== productItemId) {
    throw new ValidationError('Selected routing version does not belong to this item')
  }

  return { profile, bomVersion, routingVersion }
}

/**
 * Creates a DRAFT ProductionOrder (Work Order) tied to `productItemId`'s manufacturing
 * profile/BOM/routing. Used by both manual WO creation and Sales Order line conversion.
 */
export async function createProductionOrderRecord(tx: Prisma.TransactionClient, params: CreateProductionOrderParams) {
  await assertItem(params.tenantId, params.productItemId)
  const { profile, bomVersion, routingVersion } = await resolveActiveManufacturingSetup(
    params.tenantId,
    params.productItemId,
    {
      manufacturingProfileId: params.manufacturingProfileId,
      bomVersionId: params.bomVersionId,
      routingVersionId: params.routingVersionId,
    },
  )

  // Direct/manual WO is allowed via Item Master when the item has an active
  // manufacturing profile + BOM + routing (resolved above).

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
      parentProductionOrderId: params.parentProductionOrderId ?? null,
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
