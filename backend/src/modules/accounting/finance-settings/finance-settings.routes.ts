import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import {
  activateFinanceSchema,
  financeSettingsQuerySchema,
  upsertFinanceSettingsSchema,
} from './finance-settings.validation.js'
import * as controller from './finance-settings.controller.js'

const settingsRouter = Router({ mergeParams: true })

settingsRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

settingsRouter.get('/', requirePermission('finance.settings.view'), validateQuery(financeSettingsQuerySchema), controller.getFinanceSettings)
settingsRouter.put('/', requirePermission('finance.settings.manage'), validateBody(upsertFinanceSettingsSchema), controller.upsertFinanceSettings)

export const setupStatusRouter = Router({ mergeParams: true })
setupStatusRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)
setupStatusRouter.get('/', requirePermission('finance.settings.view'), validateQuery(financeSettingsQuerySchema), controller.getSetupStatus)

export const activateRouter = Router({ mergeParams: true })
activateRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)
activateRouter.post('/', requirePermission('finance.activate'), validateBody(activateFinanceSchema), controller.activateFinance)

export default settingsRouter
