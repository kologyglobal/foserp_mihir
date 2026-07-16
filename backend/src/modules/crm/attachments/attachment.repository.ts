import type { CrmEntityType } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../../config/database.js'
import { env } from '../../../config/env.js'
import {
  getAttachmentExtension,
  readCrmAttachmentFile,
  saveCrmAttachmentFile,
} from '../../../services/fileStorage.service.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { CreateAttachmentInput } from '../notes/note.validation.js'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
])

export async function listAttachments(tenantId: string, entityType: CrmEntityType, entityId: string) {
  return prisma.crmAttachment.findMany({
    where: { tenantId, entityType, entityId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findAttachmentById(tenantId: string, attachmentId: string) {
  return prisma.crmAttachment.findFirst({ where: { id: attachmentId, ...tenantActiveFilter(tenantId) } })
}

export async function createAttachment(
  tenantId: string,
  entityType: CrmEntityType,
  entityId: string,
  userId: string,
  input: CreateAttachmentInput,
) {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new Error('File type not allowed')
  }
  const buffer = Buffer.from(input.contentBase64, 'base64')
  if (buffer.length > env.CRM_MAX_UPLOAD_BYTES) {
    const maxMb = Math.round(env.CRM_MAX_UPLOAD_BYTES / (1024 * 1024))
    throw new Error(`File exceeds maximum size of ${maxMb} MB`)
  }
  const id = randomUUID()
  const ext = getAttachmentExtension(input.originalFilename)
  const storageKey = await saveCrmAttachmentFile(tenantId, id, buffer, ext)
  return prisma.crmAttachment.create({
    data: {
      id,
      tenantId,
      entityType,
      entityId,
      originalFilename: input.originalFilename,
      storedFilename: `${id}${ext}`,
      mimeType: input.mimeType,
      fileSize: buffer.length,
      storageKey,
      documentType: input.documentType,
      uploadedBy: userId,
    },
  })
}

export async function softDeleteAttachment(tenantId: string, attachmentId: string) {
  return prisma.crmAttachment.update({
    where: { id: attachmentId, tenantId },
    data: { deletedAt: new Date() },
  })
}

export async function readAttachmentContent(tenantId: string, attachmentId: string) {
  const row = await findAttachmentById(tenantId, attachmentId)
  if (!row) return null
  const buffer = await readCrmAttachmentFile(row.storageKey)
  return { row, buffer }
}
