import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './designation.controller.js'
import {
  createDesignationSchema,
  designationIdParamSchema,
  listDesignationsQuerySchema,
  updateDesignationSchema,
} from './designation.schemas.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('hrms.designation.view'),
  validateQuery(listDesignationsQuerySchema),
  controller.list,
)

router.post(
  '/',
  requirePermission('hrms.designation.manage'),
  validateBody(createDesignationSchema),
  controller.create,
)

router.get(
  '/:designationId',
  validateParams(designationIdParamSchema),
  requirePermission('hrms.designation.view'),
  controller.getById,
)

router.patch(
  '/:designationId',
  validateParams(designationIdParamSchema),
  requirePermission('hrms.designation.manage'),
  validateBody(updateDesignationSchema),
  controller.update,
)

export default router
