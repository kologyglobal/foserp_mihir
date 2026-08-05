import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import { ValidationError } from '../../../utils/errors.js'
import * as controller from './inspection.controller.js'
import * as photoService from './inspection-photo.service.js'
import {
  cancelInspectionSchema,
  createInspectionSchema,
  decideInspectionSchema,
  listInspectionsQuerySchema,
} from './inspection.schemas.js'

const router = Router({ mergeParams: true })

const photoParamsSchema = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
})

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('quality.view'),
  validateQuery(listInspectionsQuerySchema),
  controller.listInspections,
)

router.post(
  '/',
  requirePermission('quality.create'),
  validateBody(createInspectionSchema),
  controller.createInspection,
)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('quality.view'), controller.getInspection)

router.get(
  '/:id/photos',
  validateParams(uuidParamSchema),
  requirePermission('quality.view'),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const id = getRouteParam(req, 'id')
    const photos = await photoService.listInspectionPhotos(tenantId, id)
    return sendSuccess(res, 'QC photos listed', photos)
  }),
)

router.post(
  '/:id/photos',
  validateParams(uuidParamSchema),
  requireAnyPermission('quality.submit', 'manufacturing.quality.inspect', 'quality.create'),
  photoService.qualityPhotoUpload.single('file'),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const id = getRouteParam(req, 'id')
    if (!req.file) throw new ValidationError('file is required')
    const caption = typeof req.body?.caption === 'string' ? req.body.caption : null
    const photo = await photoService.uploadInspectionPhoto(req, tenantId, id, req.file, caption)
    return sendSuccess(res, 'QC photo uploaded', photo)
  }),
)

router.delete(
  '/:id/photos/:photoId',
  validateParams(photoParamsSchema),
  requireAnyPermission('quality.submit', 'manufacturing.quality.inspect', 'quality.create'),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const id = getRouteParam(req, 'id')
    const photoId = getRouteParam(req, 'photoId')
    const result = await photoService.softDeleteInspectionPhoto(req, tenantId, id, photoId)
    return sendSuccess(res, 'QC photo deleted', result)
  }),
)

router.post(
  '/:id/decide',
  validateParams(uuidParamSchema),
  requireAnyPermission('quality.submit', 'manufacturing.quality.inspect'),
  validateBody(decideInspectionSchema),
  controller.decideInspection,
)

router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('quality.cancel'),
  validateBody(cancelInspectionSchema),
  controller.cancelInspection,
)

export default router
