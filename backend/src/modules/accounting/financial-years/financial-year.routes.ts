import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  createFinancialYearSchema,
  listFinancialYearsQuerySchema,
  updateFinancialYearSchema,
} from './financial-year.validation.js'
import * as controller from './financial-year.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('finance.financial_year.view'), validateQuery(listFinancialYearsQuerySchema), controller.listFinancialYears)
router.post('/', requirePermission('finance.financial_year.manage'), validateBody(createFinancialYearSchema), controller.createFinancialYear)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.financial_year.view'), controller.getFinancialYear)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.financial_year.manage'),
  validateBody(updateFinancialYearSchema),
  controller.updateFinancialYear,
)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('finance.financial_year.manage'),
  controller.activateFinancialYear,
)
router.post(
  '/:id/close',
  validateParams(uuidParamSchema),
  requirePermission('finance.financial_year.manage'),
  controller.closeFinancialYear,
)

export default router
