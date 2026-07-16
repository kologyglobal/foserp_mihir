import type { Request } from 'express'
import type { CrmEntityType } from '@prisma/client'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import { assertCrmEntityInTenant } from '../crm.entity-refs.js'
import { prisma } from '../../../config/database.js'
import * as repo from './note.repository.js'
import type { CreateNoteInput, UpdateNoteInput } from './note.validation.js'

async function mapNote(row: Awaited<ReturnType<typeof repo.listNotes>>[number], tenantId: string) {
  const names = await resolveUserNames([row.createdBy, row.updatedBy], tenantId, prisma)
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    content: row.content,
    authorId: row.createdBy ?? '',
    authorName: row.createdBy ? names.get(row.createdBy) ?? '' : '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listNotes(tenantId: string, entityType: CrmEntityType, entityId: string) {
  await assertCrmEntityInTenant(tenantId, entityType, entityId)
  const rows = await repo.listNotes(tenantId, entityType, entityId)
  return Promise.all(rows.map((r) => mapNote(r, tenantId)))
}

export async function createNote(
  req: Request,
  tenantId: string,
  entityType: CrmEntityType,
  entityId: string,
  input: CreateNoteInput,
) {
  await assertCrmEntityInTenant(tenantId, entityType, entityId)
  const userId = req.context?.userId ?? ''
  const row = await repo.createNote(tenantId, entityType, entityId, userId, input)
  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'crm',
    entity: 'crmNote',
    entityId: row.id,
    action: 'CREATE',
    newValues: { entityType, entityId, content: input.content },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return mapNote(row, tenantId)
}

export async function updateNote(req: Request, tenantId: string, noteId: string, input: UpdateNoteInput) {
  const existing = await repo.findNoteById(tenantId, noteId)
  if (!existing) throw new NotFoundError('Note not found')
  const userId = req.context?.userId ?? ''
  const row = await repo.updateNote(tenantId, noteId, userId, input)
  return mapNote(row, tenantId)
}

export async function deleteNote(req: Request, tenantId: string, noteId: string) {
  const existing = await repo.findNoteById(tenantId, noteId)
  if (!existing) throw new NotFoundError('Note not found')
  const userId = req.context?.userId ?? ''
  await repo.softDeleteNote(tenantId, noteId, userId)
}
