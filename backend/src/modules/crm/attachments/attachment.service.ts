import type { Request } from 'express'
import type { CrmEntityType } from '@prisma/client'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { resolveUserNames, tenantActiveFilter } from '../../../shared/index.js'
import { assertCrmEntityInTenant } from '../crm.entity-refs.js'
import { prisma } from '../../../config/database.js'
import * as repo from './attachment.repository.js'
import {
  assertAttachmentUploadAllowed,
  parseFileTypesAttribute,
  parseMaxSizeMbAttribute,
} from './attachment-upload.validation.js'
import type { CreateAttachmentInput } from '../notes/note.validation.js'

async function resolveDocumentTypeLabels(
  tenantId: string,
  codes: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set(codes.filter((c): c is string => Boolean(c)))]
  if (unique.length === 0) return new Map()
  const rows = await prisma.crmMaster.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      kind: 'document-types',
      code: { in: unique },
    },
    select: { code: true, name: true },
  })
  return new Map(rows.map((r) => [r.code, r.name]))
}

type DocumentTypeRow = {
  code: string
  name: string
  attributes: unknown
}

async function loadActiveDocumentType(tenantId: string, code: string): Promise<DocumentTypeRow> {
  const row = await prisma.crmMaster.findFirst({
    where: {
      ...tenantActiveFilter(tenantId),
      kind: 'document-types',
      code,
      status: 'active',
    },
    select: { code: true, name: true, attributes: true },
  })
  if (!row) {
    throw new ValidationError('Invalid attachment type', [
      { field: 'documentType', message: 'Select a document type from Attachment Master' },
    ])
  }
  return row
}

async function mapAttachment(
  row: NonNullable<Awaited<ReturnType<typeof repo.findAttachmentById>>>,
  tenantId: string,
  typeNames?: Map<string, string>,
) {
  const names = await resolveUserNames([row.uploadedBy], tenantId, prisma)
  const code = row.documentType ?? undefined
  const documentTypeName = code
    ? typeNames?.get(code) ?? (await resolveDocumentTypeLabels(tenantId, [code])).get(code) ?? code
    : undefined
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    documentType: code,
    documentTypeName,
    uploadedById: row.uploadedBy ?? '',
    uploadedByName: row.uploadedBy ? names.get(row.uploadedBy) ?? '' : '',
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listAttachments(tenantId: string, entityType: CrmEntityType, entityId: string) {
  await assertCrmEntityInTenant(tenantId, entityType, entityId)
  const rows = await repo.listAttachments(tenantId, entityType, entityId)
  const typeNames = await resolveDocumentTypeLabels(
    tenantId,
    rows.map((r) => r.documentType),
  )
  return Promise.all(rows.map((r) => mapAttachment(r, tenantId, typeNames)))
}

/**
 * Validate MIME + size against Document Type master, then persist.
 * Rejects with ValidationError (400) when type/size is invalid.
 */
export function validateAttachmentAgainstDocumentType(
  input: CreateAttachmentInput,
  docType: DocumentTypeRow,
  sizeBytes: number,
) {
  const attrs =
    docType.attributes && typeof docType.attributes === 'object' && !Array.isArray(docType.attributes)
      ? (docType.attributes as Record<string, unknown>)
      : {}
  assertAttachmentUploadAllowed({
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sizeBytes,
    allowedExtensions: parseFileTypesAttribute(attrs.fileTypes),
    maxSizeMb: parseMaxSizeMbAttribute(attrs.maxSizeMb, 10),
    documentTypeLabel: docType.name,
  })
}

export async function createAttachment(
  req: Request,
  tenantId: string,
  entityType: CrmEntityType,
  entityId: string,
  input: CreateAttachmentInput,
) {
  await assertCrmEntityInTenant(tenantId, entityType, entityId)
  const docType = await loadActiveDocumentType(tenantId, input.documentType)

  let buffer: Buffer
  try {
    buffer = Buffer.from(input.contentBase64, 'base64')
  } catch {
    throw new ValidationError('Invalid file content', [
      { field: 'contentBase64', message: 'Could not decode base64 content' },
    ])
  }

  validateAttachmentAgainstDocumentType(input, docType, buffer.length)

  const userId = req.context?.userId ?? ''
  try {
    const row = await repo.createAttachment(tenantId, entityType, entityId, userId, input, buffer)
    const audit = auditFromRequest(req)
    await createAuditLog({
      tenantId,
      userId: audit.userId,
      module: 'crm',
      entity: 'crmAttachment',
      entityId: row.id,
      action: 'CREATE',
      newValues: { entityType, entityId, filename: input.originalFilename, documentType: input.documentType },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
    return mapAttachment(row, tenantId)
  } catch (err) {
    if (err instanceof ValidationError) throw err
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
