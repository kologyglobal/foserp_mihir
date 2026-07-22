import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendSuccess, sendPaginated } from '../../../utils/response.js'
import { dec, isoDate } from '../shared/manufacturing.mappers.js'
import type { PlanRow } from './plan.repository.js'
import * as service from './plan.service.js'
import type {
  CancelPlanInput,
  CreatePlanInput,
  GenerateWorkOrdersInput,
  ListPlansQuery,
  UpdatePlanInput,
} from './plan.schemas.js'

function mapPlan(row: PlanRow) {
  const plannedQty = row.lines.reduce((sum, l) => sum + Number(dec(l.demandQuantity)), 0)
  const wosCreated = row.lines.filter((l) => l.productionOrderId).length
  return {
    id: row.id,
    planNumber: row.planNumber,
    planName: row.planName,
    planDate: isoDate(row.planDate),
    sourceType: row.sourceType,
    status: row.status,
    warehouseId: row.warehouseId,
    warehouseCode: row.warehouse?.code ?? null,
    warehouseName: row.warehouse?.name ?? null,
    plantCode: row.plantCode,
    periodFrom: isoDate(row.periodFrom),
    periodTo: isoDate(row.periodTo),
    notes: row.notes,
    ownerUserId: row.ownerUserId,
    releasedAt: row.releasedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    totalItems: row.lines.length,
    plannedQty,
    wosCreated,
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      productItemId: line.productItemId,
      productItemCode: line.productItem.code,
      productItemName: line.productItem.name,
      uomId: line.uomId,
      uomCode: line.uom.code,
      demandQuantity: dec(line.demandQuantity),
      safetyStockQuantity: dec(line.safetyStockQuantity),
      suggestedQuantity: dec(line.suggestedQuantity),
      availableFinishedStock: dec(line.availableFinishedStock),
      openWorkOrderQuantity: dec(line.openWorkOrderQuantity),
      requiredDate: isoDate(line.requiredDate),
      demandId: line.demandId,
      demandNumber: line.demand?.demandNumber ?? null,
      productionOrderId: line.productionOrderId,
      productionOrderNumber: line.productionOrder?.orderNumber ?? null,
      salesOrderId: line.salesOrderId,
      sourceDocumentId: line.sourceDocumentId,
      sourceDocumentNo: line.sourceDocumentNo,
      ignored: line.ignored,
      bomReady: line.bomReady,
      materialStatus: line.materialStatus,
      notes: line.notes,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
  }
}

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPlans(getTenantId(req), req.query as unknown as ListPlansQuery)
  return sendPaginated(
    res,
    'Production plans listed',
    result.data.map(mapPlan),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getPlan = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Production plan fetched', mapPlan(await service.getPlan(getTenantId(req), getRouteParam(req, 'id')))),
)

export const createPlan = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(
    res,
    'Production plan created',
    mapPlan(await service.createPlan(req, getTenantId(req), req.body as CreatePlanInput)),
  ),
)

export const updatePlan = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Production plan updated',
    mapPlan(await service.updatePlan(req, getTenantId(req), getRouteParam(req, 'id'), req.body as UpdatePlanInput)),
  ),
)

export const releasePlan = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Production plan released',
    mapPlan(await service.releasePlan(req, getTenantId(req), getRouteParam(req, 'id'))),
  ),
)

export const previewNetting = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Netting preview computed',
    await service.previewNetting(req, getTenantId(req), getRouteParam(req, 'id')),
  ),
)

export const generateWorkOrders = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.generateWorkOrders(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    (req.body ?? {}) as GenerateWorkOrdersInput,
  )
  return sendSuccess(res, 'Draft work orders generated', {
    plan: mapPlan(result.plan),
    created: result.created,
  })
})

export const closePlan = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Production plan closed',
    mapPlan(await service.closePlan(req, getTenantId(req), getRouteParam(req, 'id'))),
  ),
)

export const cancelPlan = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Production plan cancelled',
    mapPlan(
      await service.cancelPlan(req, getTenantId(req), getRouteParam(req, 'id'), req.body as CancelPlanInput),
    ),
  ),
)
