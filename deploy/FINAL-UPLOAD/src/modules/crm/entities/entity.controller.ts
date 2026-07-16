import type { Request, Response } from 'express'
import type { CrmEntityType } from '@prisma/client'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import * as noteService from '../notes/note.service.js'
import * as attachmentService from '../attachments/attachment.service.js'
import type { CreateAttachmentInput, CreateNoteInput, UpdateNoteInput } from '../notes/note.validation.js'

export const listNotes = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const entityType = getRouteParam(req, 'entityType') as CrmEntityType
  const entityId = getRouteParam(req, 'entityId')
  const data = await noteService.listNotes(tenantId, entityType, entityId)
  sendSuccess(res, 'Notes retrieved', data)
})

export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const entityType = getRouteParam(req, 'entityType') as CrmEntityType
  const entityId = getRouteParam(req, 'entityId')
  const data = await noteService.createNote(req, tenantId, entityType, entityId, req.body as CreateNoteInput)
  sendCreated(res, 'Note created', data)
})

export const updateNote = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await noteService.updateNote(req, tenantId, getRouteParam(req, 'noteId'), req.body as UpdateNoteInput)
  sendSuccess(res, 'Note updated', data)
})

export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  await noteService.deleteNote(req, tenantId, getRouteParam(req, 'noteId'))
  sendSuccess(res, 'Note deleted', null)
})

export const listAttachments = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const entityType = getRouteParam(req, 'entityType') as CrmEntityType
  const entityId = getRouteParam(req, 'entityId')
  const data = await attachmentService.listAttachments(tenantId, entityType, entityId)
  sendSuccess(res, 'Attachments retrieved', data)
})

export const createAttachment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const entityType = getRouteParam(req, 'entityType') as CrmEntityType
  const entityId = getRouteParam(req, 'entityId')
  const data = await attachmentService.createAttachment(req, tenantId, entityType, entityId, req.body as CreateAttachmentInput)
  sendCreated(res, 'Attachment uploaded', data)
})

export const deleteAttachment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  await attachmentService.deleteAttachment(req, tenantId, getRouteParam(req, 'attachmentId'))
  sendSuccess(res, 'Attachment deleted', null)
})

export const downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const file = await attachmentService.downloadAttachment(tenantId, getRouteParam(req, 'attachmentId'))
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/"/g, '')}"`)
  res.send(file.buffer)
})
