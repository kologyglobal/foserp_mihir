import type { Request } from 'express'
import type { CrmEntityType } from '@prisma/client'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import { assertCrmEntityInTenant } from '../crm.entity-refs.js'
import { prisma } from '../../../config/database.js'
import * as repo from './attachment.repository.js'
import type { CreateAttachmentInput } from '../notes/note.validation.js'

async function mapAttachment(row: NonNullable<Awaited<ReturnType<typeof repo.findAttachmentById>>>, tenantId: string) {
  const names = await resolveUserNames([row.uploadedBy], tenantId, prisma)
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    documentType: row.documentType ?? undefined,
    uploadedById: row.uploadedBy ?? '',
    uploadedByName: row.uploadedBy ? names.get(row.uploadedBy) ?? '' : '',
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listAttachments(tenantId: string, entityType: CrmEntityType, entityId: string) {
  await assertCrmEntityInTenant(tenantId, entityType, entityId)
  const rows = await repo.listAttachments(tenantId, entityType, entityId)
  return Promise.all(rows.map((r) => mapAttachment(r, tenantId)))
}

export async function createAttachment(
  req: Request,
  tenantId: string,
  entityType: CrmEntityType,
  entityId: string,
  input: CreateAttachmentInput,
) {
  await assertCrmEntityInTenant(tenantId, entityType, entityId)
  const userId = req.context?.userId ?? ''
  try {
    const row = await repo.createAttachment(tenantId, entityType, entityId, userId, input)
    const audit = auditFromRequest(req)
    await createAuditLog({
      tenantId,
      userId: audit.userId,
      module: 'crm',
      entity: 'crmAttachment',
      entityId: row.id,
      action: 'CREATE',
      newValues: { entityType, entityId, filename: input.originalFilename },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
    return mapAttachment(row, tenantId)
  } catch (err) {
    throw new ValidationError(err instanceof Error ? err.message : 'Upload failed')
  }
}

export async function deleteAttachment(_req: Request, tenantId: string, attachmentId: string) {
  const existing = await repo.findAttachmentById(tenantId, attachmentId)
  if (!existing) throw new NotFoundError('Attachment not found')
  await repo.softDeleteAttachment(tenantId, attachmentId)
}

export async function downloadAttachment(tenantId: string, attachmentId: string) {
  const result = await repo.readAttachmentContent(tenantId, attachmentId)
  if (!result) throw new NotFoundError('Attachment not found')
  return {
    filename: result.row.originalFilename,
    mimeType: result.row.mimeType,
    buffer: result.buffer,
  }
}
