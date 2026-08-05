/**
 * Quality inspection photo storage — tenant-scoped disk (same pattern as maintenance).
 * Env: QUALITY_UPLOAD_DIR (default: uploads/quality under process.cwd()).
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import type { Request } from 'express'
import { prisma } from '../../../config/prisma.js'
import { getTenantId } from '../../../types/request-context.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'

export const MAX_QC_PHOTOS = 8
export const MAX_QC_PHOTO_BYTES = 8 * 1024 * 1024

const uploadRoot = process.env.QUALITY_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'quality')

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenantId = getTenantId(req)
    const dir = path.join(uploadRoot, tenantId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 20) || '.jpg'
    cb(null, `${randomUUID()}${ext}`)
  },
})

export const qualityPhotoUpload = multer({
  storage,
  limits: { fileSize: MAX_QC_PHOTO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new ValidationError('Only image uploads are allowed'))
      return
    }
    cb(null, true)
  },
})

export type QcPhotoDto = {
  id: string
  inspectionId: string
  originalFilename: string
  mimeType: string
  fileSize: number
  caption: string | null
  uploadedBy: string | null
  uploadedAt: string
}

export function mapPhoto(row: {
  id: string
  inspectionId: string
  originalFilename: string
  mimeType: string
  fileSize: number
  caption: string | null
  uploadedBy: string | null
  uploadedAt: Date
}): QcPhotoDto {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    caption: row.caption,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt.toISOString(),
  }
}

export async function listInspectionPhotos(tenantId: string, inspectionId: string) {
  const inspection = await prisma.manufacturingQualityInspection.findFirst({
    where: { id: inspectionId, tenantId },
    select: { id: true },
  })
  if (!inspection) throw new NotFoundError('Inspection not found')
  const rows = await prisma.qualityInspectionPhoto.findMany({
    where: { tenantId, inspectionId, deletedAt: null },
    orderBy: { uploadedAt: 'asc' },
  })
  return rows.map(mapPhoto)
}

export async function countActivePhotos(tenantId: string, inspectionId: string): Promise<number> {
  return prisma.qualityInspectionPhoto.count({
    where: { tenantId, inspectionId, deletedAt: null },
  })
}

export async function uploadInspectionPhoto(
  req: Request,
  tenantId: string,
  inspectionId: string,
  file: Express.Multer.File,
  caption?: string | null,
) {
  const userId = req.context?.userId ?? ''
  const inspection = await prisma.manufacturingQualityInspection.findFirst({
    where: { id: inspectionId, tenantId },
    select: {
      id: true,
      status: true,
      _count: { select: { photos: { where: { deletedAt: null } } } },
    },
  })
  if (!inspection) throw new NotFoundError('Inspection not found')
  if (inspection.status !== 'PENDING' && inspection.status !== 'REWORK' && inspection.status !== 'IN_PROGRESS') {
    throw new ValidationError(`Photos cannot be added when inspection is ${inspection.status}`)
  }
  if (inspection._count.photos >= MAX_QC_PHOTOS) {
    throw new ValidationError(`Maximum ${MAX_QC_PHOTOS} photographs allowed per inspection`)
  }

  const photo = await prisma.qualityInspectionPhoto.create({
    data: {
      tenantId,
      inspectionId,
      originalFilename: file.originalname || 'photo.jpg',
      storedFilename: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
      storagePath: file.path,
      caption: caption?.trim() || null,
      uploadedBy: userId || null,
    },
  })

  const auditMeta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: auditMeta.userId,
    module: 'quality',
    entity: 'manufacturingQualityInspection',
    entityId: inspectionId,
    action: 'PHOTO_UPLOAD',
    newValues: { photoId: photo.id, mimeType: photo.mimeType, fileSize: photo.fileSize },
    ipAddress: auditMeta.ipAddress,
    userAgent: auditMeta.userAgent,
  })

  return mapPhoto(photo)
}

export async function softDeleteInspectionPhoto(
  req: Request,
  tenantId: string,
  inspectionId: string,
  photoId: string,
) {
  const photo = await prisma.qualityInspectionPhoto.findFirst({
    where: { id: photoId, tenantId, inspectionId, deletedAt: null },
  })
  if (!photo) throw new NotFoundError('Photo not found')

  const inspection = await prisma.manufacturingQualityInspection.findFirst({
    where: { id: inspectionId, tenantId },
    select: { status: true },
  })
  if (!inspection) throw new NotFoundError('Inspection not found')
  if (inspection.status !== 'PENDING' && inspection.status !== 'REWORK' && inspection.status !== 'IN_PROGRESS') {
    throw new ValidationError(`Photos cannot be removed when inspection is ${inspection.status}`)
  }

  await prisma.qualityInspectionPhoto.update({
    where: { id: photoId },
    data: { deletedAt: new Date() },
  })

  const auditMeta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: auditMeta.userId,
    module: 'quality',
    entity: 'manufacturingQualityInspection',
    entityId: inspectionId,
    action: 'PHOTO_DELETE',
    newValues: { photoId },
    ipAddress: auditMeta.ipAddress,
    userAgent: auditMeta.userAgent,
  })

  return { id: photoId, deleted: true }
}
