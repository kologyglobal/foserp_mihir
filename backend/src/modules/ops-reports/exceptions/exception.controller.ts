import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './exception.service.js'
import type { AssignExceptionInput, ListExceptionsQueryInput, ResolveExceptionInput } from './exception.schemas.js'

export const listExceptions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListExceptionsQueryInput
  const exceptions = await service.listExceptions(tenantId, query)
  return sendSuccess(res, 'Operational exceptions listed', { exceptions, count: exceptions.length })
})

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const summary = await service.getExceptionsSummary(tenantId)
  return sendSuccess(res, 'Operational exception summary fetched', summary)
})

export const acknowledgeException = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const exceptionKey = getRouteParam(req, 'exceptionKey')
  const exception = await service.acknowledgeException(tenantId, userId, exceptionKey)
  return sendSuccess(res, 'Exception acknowledged', exception)
})

export const assignException = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const exceptionKey = getRouteParam(req, 'exceptionKey')
  const body = req.body as AssignExceptionInput
  const exception = await service.assignException(tenantId, exceptionKey, body.assignedTo)
  return sendSuccess(res, 'Exception assigned', exception)
})

export const resolveException = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const exceptionKey = getRouteParam(req, 'exceptionKey')
  const body = req.body as ResolveExceptionInput
  const exception = await service.resolveException(tenantId, userId, exceptionKey, body.resolutionNote, body.dismiss)
  return sendSuccess(res, 'Exception resolved', exception)
})
