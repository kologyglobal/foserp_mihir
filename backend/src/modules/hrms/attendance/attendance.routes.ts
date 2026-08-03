import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './attendance.controller.js'
import {
  createPunchSchema,
  finalizeAttendanceDaySchema,
  listAttendanceDaysQuerySchema,
  listExceptionsQuerySchema,
} from './attendance.schemas.js'

const router = Router({ mergeParams: true })

router.get(
  '/days',
  requirePermission('hrms.attendance.view'),
  validateQuery(listAttendanceDaysQuerySchema),
  controller.listDays,
)

router.get(
  '/exceptions',
  requirePermission('hrms.attendance.view'),
  validateQuery(listExceptionsQuerySchema),
  controller.listExceptions,
)

/** Manual/import punch for UAT and controlled entry — never deletes punches. */
router.post(
  '/punches',
  requirePermission('hrms.attendance.manage'),
  validateBody(createPunchSchema),
  controller.createPunch,
)

/** Locks the day for OT purposes — must precede overtime approval workflow. */
router.post(
  '/days/finalize',
  requirePermission('hrms.attendance.manage'),
  validateBody(finalizeAttendanceDaySchema),
  controller.finalizeDay,
)

export default router
