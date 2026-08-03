import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './roster.controller.js'
import {
  bulkAssignSchema,
  clearOverrideSchema,
  copyAssignmentSchema,
  createAssignmentSchema,
  effectiveShiftQuerySchema,
  rosterGridQuerySchema,
} from './roster.schemas.js'

const router = Router({ mergeParams: true })

router.get(
  '/grid',
  requirePermission('hrms.roster.view'),
  validateQuery(rosterGridQuerySchema),
  controller.grid,
)
router.get(
  '/effective-shift',
  requirePermission('hrms.roster.view'),
  validateQuery(effectiveShiftQuerySchema),
  controller.effective,
)
router.post(
  '/assignments',
  requirePermission('hrms.roster.manage'),
  validateBody(createAssignmentSchema),
  controller.create,
)
router.post(
  '/assignments/bulk',
  requirePermission('hrms.roster.manage'),
  validateBody(bulkAssignSchema),
  controller.bulk,
)
router.post(
  '/assignments/copy',
  requirePermission('hrms.roster.manage'),
  validateBody(copyAssignmentSchema),
  controller.copy,
)
router.post(
  '/assignments/clear',
  requirePermission('hrms.roster.manage'),
  validateBody(clearOverrideSchema),
  controller.clear,
)

export default router
