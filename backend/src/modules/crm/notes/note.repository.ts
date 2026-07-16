import type { CrmEntityType } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { CreateNoteInput, UpdateNoteInput } from './note.validation.js'

export async function listNotes(tenantId: string, entityType: CrmEntityType, entityId: string) {
  return prisma.crmNote.findMany({
    where: { tenantId, entityType, entityId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createNote(
  tenantId: string,
  entityType: CrmEntityType,
  entityId: string,
  userId: string,
  input: CreateNoteInput,
) {
  return prisma.crmNote.create({
    data: {
      tenantId,
      entityType,
      entityId,
      content: input.content,
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

export async function findNoteById(tenantId: string, noteId: string) {
  return prisma.crmNote.findFirst({ where: { id: noteId, ...tenantActiveFilter(tenantId) } })
}

export async function updateNote(tenantId: string, noteId: string, userId: string, input: UpdateNoteInput) {
  return prisma.crmNote.update({
    where: { id: noteId, tenantId },
    data: { content: input.content, updatedBy: userId },
  })
}

export async function softDeleteNote(tenantId: string, noteId: string, userId: string) {
  return prisma.crmNote.update({
    where: { id: noteId, tenantId },
    data: { deletedAt: new Date(), updatedBy: userId },
  })
}
