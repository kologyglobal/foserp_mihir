import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './reservation.service.js'
import type { CancelReservationInput, CreateReservationInput, ListReservationsQuery } from './reservation.schemas.js'

export const createReservation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const reservation = await service.createReservation(req, tenantId, req.body as CreateReservationInput)
  return sendCreated(res, 'Reservation created', reservation)
})

export const listReservations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listReservations(tenantId, req.query as unknown as ListReservationsQuery)
  return sendPaginated(
    res,
    'Reservations listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const cancelReservation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const reservation = await service.cancelReservation(req, tenantId, id, req.body as CancelReservationInput)
  return sendSuccess(res, 'Reservation cancelled', reservation)
})
