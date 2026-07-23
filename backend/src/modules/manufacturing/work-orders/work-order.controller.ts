import type { Request, Response } from 'express'
import type { ProductionOrder } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dec, isoDate, mapProductionOrder, mapProductionOrderListItem } from '../shared/manufacturing.mappers.js'
import * as service from './work-order.service.js'
import * as releaseService from './work-order-release.service.js'
import * as lifecycleService from './work-order-lifecycle.service.js'
import * as progressService from './work-order-progress.service.js'
import * as dashboardService from './work-order-dashboard.service.js'
import * as splitService from './work-order-split.service.js'
import * as childOrdersService from './child-orders.service.js'
import * as saReceiptService from './sa-receipt.service.js'
import { collectQualityBlockers } from '../../quality/shared/blockers.service.js'
import { getWipPosition as fetchWipPosition } from '../wip-movements/wip-position.service.js'
import { getCloseReadiness as fetchCloseReadiness } from './close-readiness.service.js'
import type {
  CancelWorkOrderInput,
  CompleteStageInput,
  CompleteWorkOrderInput,
  CorrectProgressInput,
  CreateManualWorkOrderInput,
  HoldWorkOrderInput,
  ListWorkOrdersQuery,
  RecordProgressInput,
  ResumeWorkOrderInput,
  StartWorkOrderInput,
  SplitWorkOrderInput,
} from './work-order.schemas.js'
import type { GenerateChildOrdersInput, PostSaReceiptInput } from './sa-receipt.schemas.js'
import * as bomService from './work-order-bom.service.js'
import type { AddWorkOrderBomLineInput, UpdateWorkOrderBomLineInput } from './work-order-bom.schemas.js'

function mapStage(row: {
  plannedQuantity: unknown
  goodQuantity: unknown
  reworkQuantity: unknown
  rejectedQuantity: unknown
  scrapQuantity: unknown
  startedAt: Date | null
  completedAt: Date | null
  [key: string]: unknown
}) {
  return {
    ...row,
    plannedQuantity: dec(row.plannedQuantity as never),
    goodQuantity: dec(row.goodQuantity as never),
    reworkQuantity: dec(row.reworkQuantity as never),
    rejectedQuantity: dec(row.rejectedQuantity as never),
    scrapQuantity: dec(row.scrapQuantity as never),
    startedAt: isoDate(row.startedAt),
    completedAt: isoDate(row.completedAt),
  }
}

function mapOperation(row: {
  setupTimeMinutes: unknown
  runTimeValue: unknown
  plannedQuantity: unknown
  goodQuantity: unknown
  reworkQuantity: unknown
  rejectedQuantity: unknown
  scrapQuantity: unknown
  startedAt: Date | null
  completedAt: Date | null
  [key: string]: unknown
}) {
  return {
    ...row,
    setupTimeMinutes: dec(row.setupTimeMinutes as never),
    runTimeValue: dec(row.runTimeValue as never),
    plannedQuantity: dec(row.plannedQuantity as never),
    goodQuantity: dec(row.goodQuantity as never),
    reworkQuantity: dec(row.reworkQuantity as never),
    rejectedQuantity: dec(row.rejectedQuantity as never),
    scrapQuantity: dec(row.scrapQuantity as never),
    startedAt: isoDate(row.startedAt),
    completedAt: isoDate(row.completedAt),
  }
}

function mapLedgerEntry(row: {
  goodQuantity: unknown
  reworkQuantity: unknown
  rejectedQuantity: unknown
  scrapQuantity: unknown
  createdAt: Date
  [key: string]: unknown
}) {
  return {
    ...row,
    goodQuantity: dec(row.goodQuantity as never),
    reworkQuantity: dec(row.reworkQuantity as never),
    rejectedQuantity: dec(row.rejectedQuantity as never),
    scrapQuantity: dec(row.scrapQuantity as never),
    createdAt: isoDate(row.createdAt),
  }
}

export const listWorkOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listWorkOrders(tenantId, req.query as unknown as ListWorkOrdersQuery)

  const supervisorIds = [
    ...new Set(result.items.map((row) => row.supervisorId).filter((id): id is string => Boolean(id))),
  ]
  const supervisorNameById = new Map<string, string>()
  if (supervisorIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { tenantId, id: { in: supervisorIds }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    })
    for (const user of users) {
      supervisorNameById.set(user.id, `${user.firstName} ${user.lastName}`.trim())
    }
  }

  return sendPaginated(
    res,
    'Work orders listed',
    result.items.map((row) =>
      mapProductionOrderListItem(row, row.supervisorId ? supervisorNameById.get(row.supervisorId) ?? null : null),
    ),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getWorkOrder(tenantId, id)
  return sendSuccess(res, 'Work order fetched', mapProductionOrder(item))
})

export const getWorkOrderDetail = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getWorkOrderDetail(tenantId, id)
  const { bomSnapshot, routingSnapshot, stages, operations, dependencies, productItem, ...order } = item

  let relatedSalesOrder: {
    id: string
    salesOrderNo: string
    status: string
    customerId: string | null
    customerName: string | null
    customerCode: string | null
  } | null = null

  if (order.salesOrderId) {
    const so = await prisma.crmSalesOrder.findFirst({
      where: { id: order.salesOrderId, tenantId, deletedAt: null },
      select: {
        id: true,
        salesOrderNo: true,
        status: true,
        companyId: true,
        customerCode: true,
        company: { select: { name: true, companyCode: true } },
      },
    })
    if (so) {
      relatedSalesOrder = {
        id: so.id,
        salesOrderNo: so.salesOrderNo,
        status: so.status,
        customerId: so.companyId,
        customerName: so.company?.name ?? null,
        customerCode: so.company?.companyCode ?? so.customerCode ?? null,
      }
    }
  }

  const currentStage =
    (order.currentStageId ? stages.find((s) => s.id === order.currentStageId) : null) ??
    stages.find((s) => s.status === 'IN_PROGRESS') ??
    null

  return sendSuccess(res, 'Work order detail fetched', {
    ...mapProductionOrder(order as ProductionOrder),
    productItemCode: productItem?.code ?? null,
    productItemName: productItem?.name ?? null,
    currentStageName: currentStage?.name ?? null,
    currentStageCode: currentStage?.code ?? null,
    relatedSalesOrder,
    bomSnapshot: bomSnapshot
      ? {
          ...bomSnapshot,
          baseQuantity: dec(bomSnapshot.baseQuantity),
          lines: bomSnapshot.lines.map((line) => ({
            ...line,
            perUnitQuantity: dec(line.perUnitQuantity),
            scrapPercent: dec(line.scrapPercent),
            requiredQuantity: dec(line.requiredQuantity),
          })),
        }
      : null,
    routingSnapshot,
    stages: stages.map(mapStage),
    operations: operations.map(mapOperation),
    dependencies: dependencies.map((dep) => ({ ...dep, minimumCompletionPercent: dec(dep.minimumCompletionPercent) })),
  })
})

export const getWorkOrderActivities = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const items = await service.getWorkOrderActivities(tenantId, id)
  return sendSuccess(res, 'Work order activities fetched', items.map((row) => ({ ...row, createdAt: isoDate(row.createdAt) })))
})

export const getWorkOrderLedger = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const items = await service.getWorkOrderLedger(tenantId, id)
  return sendSuccess(res, 'Work order ledger fetched', items.map(mapLedgerEntry))
})

export const createManualWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createManualWorkOrder(req, tenantId, req.body as CreateManualWorkOrderInput)
  return sendCreated(res, 'Work order created', mapProductionOrder(item))
})

export const cancelWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.cancelWorkOrder(req, tenantId, id, req.body as CancelWorkOrderInput)
  return sendSuccess(res, 'Work order cancelled', mapProductionOrder(item))
})

export const splitWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await splitService.splitWorkOrder(
    tenantId,
    id,
    req.body as SplitWorkOrderInput,
    req.context?.userId ?? '',
  )
  return sendCreated(res, 'Work order split', {
    parentId: result.parentId,
    child: mapProductionOrder(result.child),
    split: { ...result.split, splitQty: dec(result.split.splitQty) },
    correctionId: result.correctionId,
  })
})

export const releaseWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await releaseService.releaseWorkOrder(req, tenantId, id)
  return sendSuccess(res, 'Work order released', mapProductionOrder(item))
})

export const startWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await lifecycleService.startWorkOrder(req, tenantId, id, req.body as StartWorkOrderInput)
  return sendSuccess(res, 'Work order started', {
    ...mapProductionOrder(result.order),
    warnings: result.warnings,
  })
})

export const holdWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await lifecycleService.holdWorkOrder(req, tenantId, id, req.body as HoldWorkOrderInput)
  return sendSuccess(res, 'Work order put on hold', mapProductionOrder(item))
})

export const resumeWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await lifecycleService.resumeWorkOrder(req, tenantId, id, req.body as ResumeWorkOrderInput)
  return sendSuccess(res, 'Work order resumed', mapProductionOrder(item))
})

export const completeWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await lifecycleService.completeWorkOrder(req, tenantId, id, req.body as CompleteWorkOrderInput)
  return sendSuccess(res, 'Work order completed', { order: mapProductionOrder(result.order), warnings: result.warnings })
})

export const recordProgress = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await progressService.recordProgress(req, tenantId, id, req.body as RecordProgressInput)
  return sendCreated(res, 'Progress recorded', {
    ledgerEntry: mapLedgerEntry(result.ledgerEntry),
    stage: result.stage ? mapStage(result.stage) : null,
    order: mapProductionOrder(result.order),
    warnings: result.warnings ?? [],
  })
})

export const completeStage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await progressService.completeStage(req, tenantId, id, req.body as CompleteStageInput)
  return sendSuccess(res, 'Stage completed', {
    stage: mapStage(result.stage),
    promotedStages: (result.promotedStages ?? []).map(mapStage),
    order: mapProductionOrder(result.order),
    warnings: result.warnings ?? [],
    ...(result.awaitingQuality
      ? { awaitingQuality: true, inspection: result.inspection }
      : { awaitingQuality: false }),
  })
})

export const correctProgress = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await progressService.correctProgress(req, tenantId, id, req.body as CorrectProgressInput)
  return sendCreated(res, 'Progress corrected', {
    reversal: mapLedgerEntry(result.reversal),
    correction: mapLedgerEntry(result.correction),
    stage: mapStage(result.stage),
    order: mapProductionOrder(result.order),
  })
})

export const getQualityBlockers = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const blockers = await collectQualityBlockers(tenantId, id)
  return sendSuccess(res, 'Quality blockers listed', { blockers })
})

export const getWipPosition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  return sendSuccess(res, 'WIP position fetched', await fetchWipPosition(tenantId, id))
})

export const getCloseReadiness = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const allowInProgress = req.query.allowInProgress === 'true'
  return sendSuccess(
    res,
    'Close readiness fetched',
    await fetchCloseReadiness(tenantId, id, { allowInProgress }),
  )
})

export const getWorkOrdersSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await dashboardService.getWorkOrdersSummary(tenantId)
  return sendSuccess(res, 'Work orders summary fetched', result)
})

export const getTodayOverview = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await dashboardService.getTodayOverview(tenantId)
  return sendSuccess(res, 'Today overview fetched', result)
})

export const getControlRoomOverview = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await dashboardService.getControlRoomOverview(tenantId)
  return sendSuccess(res, 'Control room overview fetched', result)
})

export const generateChildOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const userId = req.context?.userId ?? ''
  const body = req.body as GenerateChildOrdersInput
  const result = await childOrdersService.generateChildOrdersForParent(tenantId, userId, id, {
    force: body.force,
  })
  return sendCreated(res, 'Child work orders generated', {
    parent: mapProductionOrder(result.parent),
    children: result.children.map(mapProductionOrder),
    skipped: result.skipped,
  })
})

export const listChildOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const rows = await saReceiptService.listChildOrders(tenantId, id)
  return sendSuccess(
    res,
    'Child work orders listed',
    rows.map((row) => ({
      ...mapProductionOrder(row),
      productItem: row.productItem,
    })),
  )
})

export const postSaReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await saReceiptService.postSemiFinishedReceipt(
    req,
    tenantId,
    id,
    req.body as PostSaReceiptInput,
  )
  return sendCreated(res, 'Semi-finished receipt posted', result)
})

export const addWorkOrderBomLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const line = await bomService.addWorkOrderBomLine(
    req,
    tenantId,
    id,
    req.body as AddWorkOrderBomLineInput,
  )
  return sendCreated(res, 'BOM line added', line)
})

export const updateWorkOrderBomLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const lineId = getRouteParam(req, 'lineId')
  const line = await bomService.updateWorkOrderBomLine(
    req,
    tenantId,
    id,
    lineId,
    req.body as UpdateWorkOrderBomLineInput,
  )
  return sendSuccess(res, 'BOM line updated', line)
})

export const removeWorkOrderBomLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const lineId = getRouteParam(req, 'lineId')
  const result = await bomService.removeWorkOrderBomLine(req, tenantId, id, lineId)
  return sendSuccess(res, 'BOM line removed', result)
})
