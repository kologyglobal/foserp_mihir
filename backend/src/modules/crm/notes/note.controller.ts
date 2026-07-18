import type { Request, Response } from 'express'
import type { CrmEntityType } from '@prisma/client'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import * as service from './note.service.js'
import type { CreateNoteInput, ListNotesQuery, UpdateNoteInput } from './note.validation.js'

export const listNotes = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const entityType = getRouteParam(req, 'entityType') as CrmEntityType
  const entityId = getRouteParam(req, 'entityId')
  const filters = req.query as ListNotesQuery
  const data = await service.listNotes(tenantId, entityType, entityId, filters)
  sendSuccess(res, 'Notes retrieved', data)
})

export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const entityType = getRouteParam(req, 'entityType') as CrmEntityType
  const entityId = getRouteParam(req, 'entityId')
  const data = await service.createNote(req, tenantId, entityType, entityId, req.body as CreateNoteInput)
  sendCreated(res, 'Note created', data)
})

export const updateNote = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.updateNote(req, tenantId, getRouteParam(req, 'noteId'), req.body as UpdateNoteInput)
  sendSuccess(res, 'Note updated', data)
})

export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  await service.deleteNote(req, tenantId, getRouteParam(req, 'noteId'))
  sendSuccess(res, 'Note deleted', null)
})
