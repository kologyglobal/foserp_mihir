import type { Request, Response } from 'express'
import { prisma } from '../../../config/database.js'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { NotFoundError } from '../../../utils/errors.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dec } from '../shared/quantity.helpers.js'
import * as eventService from './inventory-accounting-event.service.js'
import { getInventoryAccountingGateStatus } from './inventory-accounting-gate.service.js'
import type { ListInventoryAccountingEventsQuery } from './inventory-accounting.schemas.js'

function mapEvent(row: {
  id: string
  legalEntityId: string | null
  eventType: string
  status: string
  movementId: string | null
  idempotencyKey: string
  sourceDocumentType: string
  sourceDocumentId: string
  quantity: unknown
  amount: unknown
  currencyCode: string
  voucherId: string | null
  postingEventId: string | null
  failureReason: string | null
  postedAt: Date | null
  createdAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    eventType: row.eventType,
    status: row.status,
    movementId: row.movementId,
    idempotencyKey: row.idempotencyKey,
    sourceDocumentType: row.sourceDocumentType,
    sourceDocumentId: row.sourceDocumentId,
    quantity: dec(row.quantity as never),
    amount: dec(row.amount as never),
    currencyCode: row.currencyCode,
    voucherId: row.voucherId,
    postingEventId: row.postingEventId,
    failureReason: row.failureReason,
    postedAt: row.postedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export const getGateStatus = asyncHandler(async (req: Request, res: Response) => {
  const legalEntityId =
    typeof req.query.legalEntityId === 'string' ? req.query.legalEntityId : undefined
  return sendSuccess(
    res,
    'Inventory accounting gate status',
    await getInventoryAccountingGateStatus(getTenantId(req), legalEntityId),
  )
})

export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const result = await eventService.listInventoryAccountingEvents(
    getTenantId(req),
    req.query as unknown as ListInventoryAccountingEventsQuery,
  )
  return sendPaginated(
    res,
    'Inventory accounting events listed',
    result.data.map(mapEvent),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await prisma.inventoryAccountingEvent.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('Inventory accounting event not found')
  return sendSuccess(res, 'Inventory accounting event fetched', mapEvent(row))
})
