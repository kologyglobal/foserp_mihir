import type { Request, Response } from 'express'
import { prisma } from '../../../config/database.js'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { NotFoundError } from '../../../utils/errors.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dec } from '../shared/manufacturing.mappers.js'
import * as eventService from './manufacturing-accounting-event.service.js'
import * as featureControlService from './manufacturing-feature-control.service.js'
import { getManufacturingAccountingGateStatus } from './manufacturing-accounting-gate.service.js'
import { getWorkOrderCostPreview } from './manufacturing-cost-preview.service.js'
import type {
  ListAccountingEventsQuery,
  ListFeatureControlsQuery,
  PutFeatureControlInput,
  ReadinessQuery,
  InventorySignOffBody,
  FinancePilotSignOffBody,
  EnableBody,
  DisableBody,
} from './manufacturing-accounting.schemas.js'
import * as enablementService from './manufacturing-accounting-enablement.service.js'
import { getReadiness } from './manufacturing-accounting-readiness.service.js'

function mapEvent(row: {
  id: string
  legalEntityId: string
  eventType: string
  status: string
  productionOrderId: string | null
  idempotencyKey: string
  sourceDocumentType: string
  sourceDocumentId: string
  quantity: unknown
  amount: unknown
  currencyCode: string
  voucherId: string | null
  postingEventId: string | null
  postedAt: Date | null
  createdAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    eventType: row.eventType,
    status: row.status,
    productionOrderId: row.productionOrderId,
    idempotencyKey: row.idempotencyKey,
    sourceDocumentType: row.sourceDocumentType,
    sourceDocumentId: row.sourceDocumentId,
    quantity: dec(row.quantity as never),
    amount: dec(row.amount as never),
    currencyCode: row.currencyCode,
    voucherId: row.voucherId,
    postingEventId: row.postingEventId,
    postedAt: row.postedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export const getGateStatus = asyncHandler(async (req: Request, res: Response) => {
  const legalEntityId =
    typeof req.query.legalEntityId === 'string' ? req.query.legalEntityId : undefined
  return sendSuccess(
    res,
    'Manufacturing accounting gate status',
    await getManufacturingAccountingGateStatus(getTenantId(req), legalEntityId),
  )
})

export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const result = await eventService.listAccountingEvents(
    getTenantId(req),
    req.query as unknown as ListAccountingEventsQuery,
  )
  return sendPaginated(
    res,
    'Production accounting events listed',
    result.data.map(mapEvent),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await prisma.productionAccountingEvent.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('Accounting event not found')
  return sendSuccess(res, 'Production accounting event fetched', mapEvent(row))
})

export const listFeatureControls = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListFeatureControlsQuery
  return sendSuccess(
    res,
    'Finance feature controls listed',
    await featureControlService.listFeatureControls(getTenantId(req), query.featureKey),
  )
})

export const getManufacturingAccountingFeatureControl = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.context
  const includeTechnicalDetails = Boolean(
    ctx?.isSuperAdmin ||
      ctx?.permissions.includes('finance.settings.manage') ||
      ctx?.permissions.includes('manufacturing.accounting.post'),
  )

  return sendSuccess(
    res,
    'Manufacturing accounting feature status fetched',
    await featureControlService.getManufacturingAccountingFeatureStatus(
      getTenantId(req),
      getRouteParam(req, 'legalEntityId'),
      { includeTechnicalDetails },
    ),
  )
})

export const putManufacturingAccountingFeatureControl = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as PutFeatureControlInput
  return sendSuccess(
    res,
    body.isEnabled ? 'Manufacturing accounting enabled' : 'Manufacturing accounting disabled',
    await featureControlService.setManufacturingAccountingFeature(
      req,
      getTenantId(req),
      getRouteParam(req, 'legalEntityId'),
      body,
    ),
  )
})

export const getCostPreview = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Work order cost preview',
    await getWorkOrderCostPreview(getTenantId(req), getRouteParam(req, 'id')),
  ),
)

export const getAccountingReadiness = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ReadinessQuery
  const ctx = req.context
  const includeTechnicalDetails = Boolean(
    ctx?.isSuperAdmin ||
      ctx?.permissions.includes('finance.settings.manage') ||
      ctx?.permissions.includes('manufacturing.accounting.post') ||
      ctx?.permissions.includes('manufacturing.accounting.enable') ||
      (query.includeTechnicalDetails === 'true' || query.includeTechnicalDetails === '1'),
  )
  // Technical details only for elevated roles even if query asks.
  const allowTechnical =
    Boolean(ctx?.isSuperAdmin) ||
    Boolean(ctx?.permissions.includes('finance.settings.manage')) ||
    Boolean(ctx?.permissions.includes('manufacturing.accounting.post')) ||
    Boolean(ctx?.permissions.includes('manufacturing.accounting.enable'))

  return sendSuccess(
    res,
    'Manufacturing accounting readiness fetched',
    await getReadiness({
      tenantId: getTenantId(req),
      legalEntityId: query.legalEntityId,
      postingDate: query.postingDate,
      userId: ctx?.userId ?? null,
      includeTechnicalDetails: includeTechnicalDetails && allowTechnical,
    }),
  )
})

export const postInventoryReconciliationSignOff = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as InventorySignOffBody
  return sendCreated(
    res,
    'Inventory reconciliation sign-off recorded',
    await enablementService.createInventoryReconciliationSignOff(req, getTenantId(req), body),
  )
})

export const postFinancePilotSignOff = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as FinancePilotSignOffBody
  return sendCreated(
    res,
    'Finance pilot sign-off recorded',
    await enablementService.createFinancePilotSignOff(req, getTenantId(req), body),
  )
})

export const postEnableManufacturingAccounting = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as EnableBody
  const result = await enablementService.enableManufacturingAccounting(req, getTenantId(req), body)
  return sendSuccess(res, 'Manufacturing Accounting enabled', result)
})

export const postDisableManufacturingAccounting = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as DisableBody
  const result = await enablementService.disableManufacturingAccounting(req, getTenantId(req), body)
  return sendSuccess(res, 'Manufacturing Accounting disabled', result)
})
