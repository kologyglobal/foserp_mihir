import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../utils/errors.js'
import type { ItemLookupQuery, ListItemsQuery } from './item.validation.js'
import * as repo from './item.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(_req: Request, tenantId: string, query: ListItemsQuery) {
  return repo.listItems(tenantId, query)
}

export async function listLookups(_req: Request, tenantId: string, query: ItemLookupQuery) {
  return repo.listItemLookups(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getItem(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, input: Record<string, unknown>) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.createItem(tenantId, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterItem',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function updateRecord(
  req: Request,
  tenantId: string,
  id: string,
  input: Record<string, unknown>,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getItem(tenantId, id)
  const record = await repo.updateItem(tenantId, id, userId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterItem',
    entityId: id,
    action: 'UPDATE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function deleteRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const before = await repo.getItem(tenantId, id)
  const record = await repo.softDeleteItem(tenantId, id, userId)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterItem',
    entityId: id,
    action: 'DELETE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function activateRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.setItemStatus(tenantId, id, userId, 'ACTIVE')
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterItem',
    entityId: id,
    action: 'ACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function deactivateRecord(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.setItemStatus(tenantId, id, userId, 'INACTIVE')
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterItem',
    entityId: id,
    action: 'DEACTIVATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

const MAX_ITEM_IMAGE_BYTES = 4 * 1024 * 1024

export async function uploadItemImage(
  req: Request,
  tenantId: string,
  id: string,
  file: Express.Multer.File,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  if (!file?.buffer?.length) {
    throw new ValidationError('Image file is required')
  }
  if (file.size > MAX_ITEM_IMAGE_BYTES) {
    throw new ValidationError('Image must be 4 MB or smaller')
  }
  const ext = file.originalname.includes('.')
    ? file.originalname.slice(file.originalname.lastIndexOf('.'))
    : '.jpg'
  const { saveItemImageFile } = await import('../../services/fileStorage.service.js')
  const storageKey = await saveItemImageFile(tenantId, id, file.buffer, ext)
  const record = await repo.setItemImageUrl(tenantId, id, userId, storageKey)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterItem',
    entityId: id,
    action: 'UPDATE',
    newValues: { imageUrl: storageKey },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function getItemImage(tenantId: string, id: string) {
  const item = await repo.getItem(tenantId, id)
  if (!item.imageUrl) {
    throw new NotFoundError('Item has no image')
  }
  const { readItemImageFile, itemImageContentType } = await import('../../services/fileStorage.service.js')
  const buffer = await readItemImageFile(item.imageUrl)
  return { buffer, contentType: itemImageContentType(item.imageUrl) }
}

export async function removeItemImage(req: Request, tenantId: string, id: string) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const record = await repo.setItemImageUrl(tenantId, id, userId, null)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity: 'masterItem',
    entityId: id,
    action: 'UPDATE',
    newValues: { imageUrl: null },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}
