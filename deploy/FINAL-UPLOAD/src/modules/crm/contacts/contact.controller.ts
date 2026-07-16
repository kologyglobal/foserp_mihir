import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './contact.service.js'

export const listContacts = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listContacts(tenantId, req.query as never)
  sendPaginated(res, 'Contacts retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getContact = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getContact(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Contact retrieved', data)
})

export const createContact = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createContact(tenantId, userId, req.body)
  sendCreated(res, 'Contact created', data)
})

export const updateContact = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateContact(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Contact updated', data)
})

export const deleteContact = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deleteContact(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Contact deleted', null)
})
