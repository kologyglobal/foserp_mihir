import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { attachmentIdParamSchema } from '../attachments/attachment.validation.js'
import {
  createAttachmentSchema,
  createNoteSchema,
  entityParamsSchema,
  listNotesQuerySchema,
  noteIdParamSchema,
  updateNoteSchema,
} from '../notes/note.validation.js'
import * as controller from './entity.controller.js'

const router = Router({ mergeParams: true })

router.get(
  '/:entityType/:entityId/notes',
  requirePermission('crm.note.view'),
  validateParams(entityParamsSchema),
  validateQuery(listNotesQuerySchema),
  controller.listNotes,
)
router.post(
  '/:entityType/:entityId/notes',
  requirePermission('crm.note.create'),
  validateParams(entityParamsSchema),
  validateBody(createNoteSchema),
  controller.createNote,
)
router.patch(
  '/notes/:noteId',
  requirePermission('crm.note.update'),
  validateParams(noteIdParamSchema),
  validateBody(updateNoteSchema),
  controller.updateNote,
)
router.delete(
  '/notes/:noteId',
  requirePermission('crm.note.delete'),
  validateParams(noteIdParamSchema),
  controller.deleteNote,
)

router.get(
  '/:entityType/:entityId/attachments',
  requirePermission('crm.attachment.view'),
  validateParams(entityParamsSchema),
  controller.listAttachments,
)
router.post(
  '/:entityType/:entityId/attachments',
  requirePermission('crm.attachment.create'),
  validateParams(entityParamsSchema),
  validateBody(createAttachmentSchema),
  controller.createAttachment,
)
router.get(
  '/attachments/:attachmentId/download',
  requirePermission('crm.attachment.view'),
  validateParams(attachmentIdParamSchema),
  controller.downloadAttachment,
)
router.delete(
  '/attachments/:attachmentId',
  requirePermission('crm.attachment.delete'),
  validateParams(attachmentIdParamSchema),
  controller.deleteAttachment,
)

export default router
