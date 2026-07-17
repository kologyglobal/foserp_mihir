import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  costCentreTreeQuerySchema,
  createCostCentreSchema,
  listCostCentresQuerySchema,
  updateCostCentreSchema,
} from './cost-centre.validation.js'
import * as controller from './cost-centre.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('finance.cost_centre.view'), validateQuery(listCostCentresQuerySchema), controller.listCostCentres)
router.get('/tree', requirePermission('finance.cost_centre.view'), validateQuery(costCentreTreeQuerySchema), controller.getCostCentreTree)
router.post('/', requirePermission('finance.cost_centre.manage'), validateBody(createCostCentreSchema), controller.createCostCentre)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.cost_centre.manage'),
  validateBody(updateCostCentreSchema),
  controller.updateCostCentre,
)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('finance.cost_centre.manage'),
  controller.activateCostCentre,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('finance.cost_centre.manage'),
  controller.deactivateCostCentre,
)

export default router
