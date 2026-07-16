import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './dashboard.controller.js'
import { dashboardQuerySchema } from './dashboard.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/metrics',
  requirePermission('crm.dashboard.view'),
  validateQuery(dashboardQuerySchema),
  controller.getDashboard,
)

export default router
