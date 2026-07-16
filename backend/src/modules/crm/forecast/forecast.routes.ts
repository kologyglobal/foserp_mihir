import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './forecast.controller.js'
import { forecastQuerySchema } from './forecast.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('crm.dashboard.view'),
  validateQuery(forecastQuerySchema),
  controller.getForecast,
)

export default router
