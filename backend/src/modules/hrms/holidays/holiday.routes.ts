import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './holiday.controller.js'
import {
  calendarIdParamSchema,
  createCalendarSchema,
  createHolidayDaySchema,
  holidayDayParamSchema,
  listCalendarsQuerySchema,
  resolveHolidayQuerySchema,
  updateCalendarSchema,
  updateHolidayDaySchema,
} from './holiday.schemas.js'

const router = Router({ mergeParams: true })

router.get(
  '/resolve',
  requirePermission('hrms.holiday.view'),
  validateQuery(resolveHolidayQuerySchema),
  controller.resolve,
)

router.get(
  '/',
  requirePermission('hrms.holiday.view'),
  validateQuery(listCalendarsQuerySchema),
  controller.list,
)
router.post(
  '/',
  requirePermission('hrms.holiday.manage'),
  validateBody(createCalendarSchema),
  controller.create,
)
router.get(
  '/:calendarId',
  validateParams(calendarIdParamSchema),
  requirePermission('hrms.holiday.view'),
  controller.getById,
)
router.patch(
  '/:calendarId',
  validateParams(calendarIdParamSchema),
  requirePermission('hrms.holiday.manage'),
  validateBody(updateCalendarSchema),
  controller.update,
)
router.post(
  '/:calendarId/days',
  validateParams(calendarIdParamSchema),
  requirePermission('hrms.holiday.manage'),
  validateBody(createHolidayDaySchema),
  controller.addDay,
)
router.patch(
  '/:calendarId/days/:dayId',
  validateParams(holidayDayParamSchema),
  requirePermission('hrms.holiday.manage'),
  validateBody(updateHolidayDaySchema),
  controller.updateDay,
)
router.delete(
  '/:calendarId/days/:dayId',
  validateParams(holidayDayParamSchema),
  requirePermission('hrms.holiday.manage'),
  controller.removeDay,
)

export default router
