import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { requireModule } from '../../middleware/require-module.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import { getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendSuccess } from '../../utils/response.js'
import { NotFoundError, ValidationError } from '../../utils/errors.js'
import { prisma } from '../../config/prisma.js'
import { auditFromRequest, createAuditLog } from '../../services/audit.service.js'
import * as controller from './ticket.controller.js'
import * as pmController from './pm.controller.js'
import {
  addPartSchema,
  closeTicketSchema,
  createTicketSchema,
  holdTicketSchema,
  linkPartPrSchema,
  listTicketsQuerySchema,
  machineHealthQuerySchema,
  activeTicketByMachineQuerySchema,
  MAX_MAINTENANCE_PHOTOS,
  reportQuerySchema,
  resumeTicketSchema,
  startRepairSchema,
  testMachineSchema,
  updateRepairSchema,
} from './ticket.schemas.js'
import {
  createPmPlanSchema,
  createPmTicketSchema,
  listPmPlansQuerySchema,
  pmComplianceQuerySchema,
  updatePmPlanSchema,
} from './pm.schemas.js'

const uploadRoot = process.env.MAINTENANCE_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'maintenance')

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
    if (!file.mimetype.startsWith('image/')) {
      cb(new ValidationError('Only image uploads are allowed'))
      return
    }
    cb(null, true)
  },
})

const photoMetaSchema = z.object({
  category: z.enum(['BEFORE', 'DURING', 'AFTER', 'OTHER']).default('OTHER'),
})

const machineHistoryParamsSchema = z.object({
  machineId: z.string().uuid(),
})

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
  requireModule('maintenance'),
)

router.get('/dashboard', requirePermission('maintenance.view'), controller.dashboard)
router.get('/reports', requirePermission('maintenance.report.view'), validateQuery(reportQuerySchema), controller.reports)
router.get(
  '/reports/pm-compliance',
  requirePermission('maintenance.report.view'),
  validateQuery(pmComplianceQuerySchema),
  pmController.pmCompliance,
)

router.get(
  '/preventive',
  requirePermission('maintenance.view'),
  validateQuery(listPmPlansQuerySchema),
  pmController.listPlans,
)
router.post(
  '/preventive',
  requirePermission('maintenance.create'),
  validateBody(createPmPlanSchema),
  pmController.createPlan,
)
router.get(
  '/preventive/:id',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.view'),
  pmController.getPlan,
)
router.patch(
  '/preventive/:id',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.update'),
  validateBody(updatePmPlanSchema),
  pmController.updatePlan,
)
router.post(
  '/preventive/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.update'),
  pmController.deactivatePlan,
)
router.post(
  '/preventive/:id/create-ticket',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.create'),
  validateBody(createPmTicketSchema),
  pmController.createTicketFromPlan,
)
router.get(
  '/machines/:machineId/preventive',
  validateParams(machineHistoryParamsSchema),
  requirePermission('maintenance.view'),
  pmController.machinePlans,
)

router.get(
  '/machine-health',
  requirePermission('maintenance.view'),
  validateQuery(machineHealthQuerySchema),
  controller.machineHealth,
)
router.get(
  '/machine-health/:machineId',
  validateParams(machineHistoryParamsSchema),
  requirePermission('maintenance.view'),
  validateQuery(machineHealthQuerySchema),
  controller.machineHealthDetail,
)
router.get(
  '/active-ticket',
  requirePermission('maintenance.view'),
  validateQuery(activeTicketByMachineQuerySchema),
  controller.activeTicketForMachine,
)
router.get(
  '/machines/:machineId/history',
  validateParams(machineHistoryParamsSchema),
  requirePermission('maintenance.view'),
  controller.machineHistory,
)

router.get('/tickets', requirePermission('maintenance.view'), validateQuery(listTicketsQuerySchema), controller.listTickets)
router.post('/tickets', requirePermission('maintenance.create'), validateBody(createTicketSchema), controller.createTicket)
router.get('/tickets/:id', validateParams(uuidParamSchema), requirePermission('maintenance.view'), controller.getTicket)
router.post(
  '/tickets/:id/start-repair',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.start'),
  validateBody(startRepairSchema),
  controller.startRepair,
)
router.patch(
  '/tickets/:id',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.update'),
  validateBody(updateRepairSchema),
  controller.updateRepair,
)
router.post(
  '/tickets/:id/hold',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.update'),
  validateBody(holdTicketSchema),
  controller.holdTicket,
)
router.post(
  '/tickets/:id/resume',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.update'),
  validateBody(resumeTicketSchema),
  controller.resumeTicket,
)
router.post(
  '/tickets/:id/parts',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.update'),
  validateBody(addPartSchema),
  controller.addPart,
)
router.post(
  '/tickets/:id/link-part-pr',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.update'),
  validateBody(linkPartPrSchema),
  controller.linkPartPr,
)
router.post(
  '/tickets/:id/test',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.test'),
  validateBody(testMachineSchema),
  controller.testMachine,
)
router.get(
  '/tickets/:id/close-readiness',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.view'),
  controller.closeReadiness,
)
router.post(
  '/tickets/:id/close',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.close'),
  validateBody(closeTicketSchema),
  controller.closeTicket,
)

router.post(
  '/tickets/:id/photos',
  validateParams(uuidParamSchema),
  requirePermission('maintenance.update'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const ticketId = getRouteParam(req, 'id')
    const userId = req.context?.userId ?? ''
    if (!req.file) throw new ValidationError('file is required')
    const meta = photoMetaSchema.parse(req.body ?? {})
    const ticket = await prisma.maintenanceTicket.findFirst({
      where: { id: ticketId, tenantId, deletedAt: null },
      select: { id: true, _count: { select: { photos: { where: { deletedAt: null } } } } },
    })
    if (!ticket) throw new NotFoundError('Ticket not found')
    if (ticket._count.photos >= MAX_MAINTENANCE_PHOTOS) {
      throw new ValidationError(`Maximum ${MAX_MAINTENANCE_PHOTOS} photographs allowed per maintenance ticket`)
    }

    const photo = await prisma.maintenanceAttachment.create({
      data: {
        tenantId,
        ticketId,
        category: meta.category,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storagePath: req.file.path,
        uploadedBy: userId || null,
      },
    })
    const auditMeta = auditFromRequest(req)
    await createAuditLog({
      tenantId,
      userId: auditMeta.userId,
      module: 'maintenance',
      entity: 'maintenanceTicket',
      entityId: ticketId,
      action: 'PHOTO_UPLOAD',
      newValues: { photoId: photo.id, category: meta.category },
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
    })
    return sendSuccess(res, 'Photo uploaded', photo)
  }),
)

export default router
