import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './shift.controller.js'
import {
  createShiftSchema,
  listShiftsQuerySchema,
  shiftIdParamSchema,
  updateShiftSchema,
} from './shift.schemas.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('hrms.shift.view'), validateQuery(listShiftsQuerySchema), controller.list)
router.post('/', requirePermission('hrms.shift.manage'), validateBody(createShiftSchema), controller.create)
router.get(
  '/:shiftId',
  validateParams(shiftIdParamSchema),
  requirePermission('hrms.shift.view'),
  controller.getById,
)
router.patch(
  '/:shiftId',
  validateParams(shiftIdParamSchema),
  requirePermission('hrms.shift.manage'),
  validateBody(updateShiftSchema),
  controller.update,
)

export default router
