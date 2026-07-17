import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import {
  listNumberSeriesQuerySchema,
  upsertNumberSeriesSchema,
} from './finance-number-series.validation.js'
import * as controller from './finance-number-series.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('finance.number_series.view'), validateQuery(listNumberSeriesQuerySchema), controller.listNumberSeries)
router.put('/', requirePermission('finance.number_series.manage'), validateBody(upsertNumberSeriesSchema), controller.upsertNumberSeries)
router.get('/preview-next', requirePermission('finance.number_series.view'), controller.previewNextNumber)

export default router
