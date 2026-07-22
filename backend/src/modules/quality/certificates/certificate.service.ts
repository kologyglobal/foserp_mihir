import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'

export async function listCertificates(tenantId: string, inspectionId?: string) {
  return prisma.qualityCertificate.findMany({
    where: { tenantId, ...(inspectionId ? { inspectionId } : {}) },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createCertificate(req: Request, tenantId: string, input: {
  certificateNumber: string; certificateType: any; inspectionId?: string; itemId?: string;
  documentNumber?: string; issueDate?: string; expiryDate?: string; supplierOrLab?: string; attachmentRef?: string; remarks?: string
}) {
  const existing = await prisma.qualityCertificate.findFirst({ where: { tenantId, certificateNumber: input.certificateNumber } })
  if (existing) throw new ConflictError('Certificate number already exists')
  if (input.inspectionId) {
    const inspection = await prisma.manufacturingQualityInspection.findFirst({ where: { id: input.inspectionId, tenantId } })
    if (!inspection) throw new NotFoundError('Inspection not found')
  }
  return prisma.qualityCertificate.create({
    data: { tenantId, certificateNumber: input.certificateNumber, certificateType: input.certificateType, inspectionId: input.inspectionId,
      itemId: input.itemId, documentNumber: input.documentNumber, issueDate: input.issueDate ? new Date(input.issueDate) : null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null, supplierOrLab: input.supplierOrLab,
      attachmentRef: input.attachmentRef, remarks: input.remarks, createdBy: req.context?.userId ?? '' },
  })
}

export async function verifyCertificate(req: Request, tenantId: string, id: string) {
  const certificate = await prisma.qualityCertificate.findFirst({ where: { id, tenantId } })
  if (!certificate) throw new NotFoundError('Certificate not found')
  const row = await prisma.qualityCertificate.update({
    where: { id }, data: { status: 'VERIFIED', verifiedBy: req.context?.userId ?? '', verifiedAt: new Date(), updatedBy: req.context?.userId ?? '' },
  })
  if (row.inspectionId) await prisma.manufacturingQualityInspection.updateMany({ where: { id: row.inspectionId, tenantId }, data: { certificateStatus: 'VERIFIED' } })
  return row
}

export async function assertCertificatesAllowPass(tenantId: string, inspectionId: string) {
  const inspection = await prisma.manufacturingQualityInspection.findFirst({ where: { id: inspectionId, tenantId }, select: { certificateRequired: true } })
  if (!inspection?.certificateRequired) return
  const verified = await prisma.qualityCertificate.count({ where: { tenantId, inspectionId, status: 'VERIFIED' } })
  if (!verified) throw new ValidationError('A verified certificate is required before passing this inspection')
}
