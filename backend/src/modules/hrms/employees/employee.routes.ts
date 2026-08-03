import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { prisma } from '../../../config/prisma.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { loadHrScope } from '../hrms-scope.js'
import { assertEmployeeAccessible } from './employee.service.js'
import * as controller from './employee.controller.js'
import {
  createBankDetailSchema,
  createEmployeeSchema,
  employeeBankIdParamSchema,
  employeeDocumentIdParamSchema,
  employeeIdParamSchema,
  listEmployeesQuerySchema,
  updateBankDetailSchema,
  updateEmployeeSchema,
  uploadDocumentMetaSchema,
  upsertStatutoryDetailSchema,
} from './employee.schemas.js'

const uploadRoot = process.env.HRMS_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'hrms')
const ALLOWED_DOCUMENT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenantId = getTenantId(req)
    const dir = path.join(uploadRoot, tenantId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 20)
    cb(null, `${randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_DOCUMENT_MIME.has(file.mimetype)) {
      cb(new ValidationError('Only JPEG/PNG/WEBP images or PDF uploads are allowed'))
      return
    }
    cb(null, true)
  },
})

const router = Router({ mergeParams: true })

router.get('/', requirePermission('hrms.employee.view'), validateQuery(listEmployeesQuerySchema), controller.list)
router.post('/', requirePermission('hrms.employee.create'), validateBody(createEmployeeSchema), controller.create)

router.get(
  '/:employeeId',
  validateParams(employeeIdParamSchema),
  requirePermission('hrms.employee.view'),
  controller.getById,
)
router.patch(
  '/:employeeId',
  validateParams(employeeIdParamSchema),
  requirePermission('hrms.employee.edit'),
  validateBody(updateEmployeeSchema),
  controller.update,
)

router.get(
  '/:employeeId/history',
  validateParams(employeeIdParamSchema),
  requirePermission('hrms.employee.view'),
  controller.history,
)

router.get(
  '/:employeeId/bank',
  validateParams(employeeIdParamSchema),
  requirePermission('hrms.employee.sensitive.view'),
  controller.listBank,
)
router.post(
  '/:employeeId/bank',
  validateParams(employeeIdParamSchema),
  requirePermission('hrms.employee.edit', 'hrms.employee.sensitive.view'),
  validateBody(createBankDetailSchema),
  controller.createBank,
)
router.patch(
  '/:employeeId/bank/:bankId',
  validateParams(employeeBankIdParamSchema),
  requirePermission('hrms.employee.edit', 'hrms.employee.sensitive.view'),
  validateBody(updateBankDetailSchema),
  controller.updateBank,
)

router.get(
  '/:employeeId/statutory',
  validateParams(employeeIdParamSchema),
  requirePermission('hrms.employee.sensitive.view'),
  controller.getStatutory,
)
router.put(
  '/:employeeId/statutory',
  validateParams(employeeIdParamSchema),
  requirePermission('hrms.employee.edit', 'hrms.employee.sensitive.view'),
  validateBody(upsertStatutoryDetailSchema),
  controller.putStatutory,
)

router.get(
  '/:employeeId/documents',
  validateParams(employeeIdParamSchema),
  requirePermission('hrms.employee.view'),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const scope = await loadHrScope(req)
    const employeeId = getRouteParam(req, 'employeeId')
    await assertEmployeeAccessible(tenantId, scope, employeeId)
    const docs = await prisma.hrEmployeeDocument.findMany({
      where: { tenantId, employeeId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
    })
    return sendSuccess(res, 'Documents fetched', docs)
  }),
)

router.post(
  '/:employeeId/documents',
  validateParams(employeeIdParamSchema),
  requirePermission('hrms.employee.edit'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const scope = await loadHrScope(req)
    const employeeId = getRouteParam(req, 'employeeId')
    await assertEmployeeAccessible(tenantId, scope, employeeId)
    if (!req.file) throw new ValidationError('file is required')
    const meta = uploadDocumentMetaSchema.parse(req.body ?? {})

    const doc = await prisma.hrEmployeeDocument.create({
      data: {
        tenantId,
        employeeId,
        documentType: meta.documentType,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storagePath: req.file.path,
        notes: meta.notes ?? null,
        uploadedBy: req.context?.userId ?? null,
      },
    })

    const auditMeta = auditFromRequest(req)
    await createAuditLog({
      tenantId,
      userId: auditMeta.userId,
      module: 'hrms',
      entity: 'HrEmployeeDocument',
      entityId: doc.id,
      action: 'UPLOAD',
      newValues: { documentType: doc.documentType, employeeId },
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
    })

    return sendCreated(res, 'Document uploaded', doc)
  }),
)

router.delete(
  '/:employeeId/documents/:documentId',
  validateParams(employeeDocumentIdParamSchema),
  requirePermission('hrms.employee.edit'),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const scope = await loadHrScope(req)
    const employeeId = getRouteParam(req, 'employeeId')
    const documentId = getRouteParam(req, 'documentId')
    await assertEmployeeAccessible(tenantId, scope, employeeId)

    const doc = await prisma.hrEmployeeDocument.findFirst({
      where: { id: documentId, tenantId, employeeId, deletedAt: null },
    })
    if (!doc) throw new NotFoundError('Document not found')

    const updated = await prisma.hrEmployeeDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    })

    const auditMeta = auditFromRequest(req)
    await createAuditLog({
      tenantId,
      userId: auditMeta.userId,
      module: 'hrms',
      entity: 'HrEmployeeDocument',
      entityId: documentId,
      action: 'DELETE',
      oldValues: { documentType: doc.documentType },
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
    })

    return sendSuccess(res, 'Document removed', updated)
  }),
)

export default router
