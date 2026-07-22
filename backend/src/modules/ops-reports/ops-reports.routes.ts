import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as controller from './ops-reports.controller.js'
import { reportFiltersSchema, reportKeyParamSchema } from './schemas.js'
import savedViewRoutes from './saved-views/saved-view.routes.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/manufacturing/catalog', controller.getCatalog)
router.post(
  '/manufacturing/:reportKey/query',
  validateParams(reportKeyParamSchema),
  validateBody(reportFiltersSchema),
  controller.queryReport,
)
router.post(
  '/manufacturing/:reportKey/export',
  validateParams(reportKeyParamSchema),
  validateBody(reportFiltersSchema),
  controller.exportReport,
)

router.use('/saved-views', savedViewRoutes)

export default router
