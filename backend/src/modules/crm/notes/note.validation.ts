import { z } from 'zod'

export const CRM_ENTITY_TYPES = [
  'COMPANY',
  'CONTACT',
  'LEAD',
  'OPPORTUNITY',
  'ACTIVITY',
  'FOLLOW_UP',
  'QUOTATION',
] as const

export const entityParamsSchema = z.object({
  entityType: z.enum(CRM_ENTITY_TYPES),
  entityId: z.string().uuid(),
})

export const createNoteSchema = z.object({
  content: z.string().trim().min(1).max(10000),
})

export const updateNoteSchema = z.object({
  content: z.string().trim().min(1).max(10000),
})

export const createAttachmentSchema = z.object({
  originalFilename: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(128),
  contentBase64: z.string().min(1),
  /** CRM Document Type Master code (`document-types`). Required before upload. */
  documentType: z.string().trim().min(1).max(64),
})

export const noteIdParamSchema = z.object({
  noteId: z.string().uuid(),
})

export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>
