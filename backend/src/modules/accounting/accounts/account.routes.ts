import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  accountTreeQuerySchema,
  applyTemplateSchema,
  createAccountSchema,
  listAccountsQuerySchema,
  updateAccountSchema,
} from './account.validation.js'
import * as controller from './account.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('finance.coa.view'), validateQuery(listAccountsQuerySchema), controller.listAccounts)
router.get('/tree', requirePermission('finance.coa.view'), validateQuery(accountTreeQuerySchema), controller.getAccountTree)
router.post('/apply-template', requirePermission('finance.coa.manage'), validateBody(applyTemplateSchema), controller.applyTemplate)
router.post('/', requirePermission('finance.coa.manage'), validateBody(createAccountSchema), controller.createAccount)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.coa.view'), controller.getAccount)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.coa.manage'),
  validateBody(updateAccountSchema),
  controller.updateAccount,
)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('finance.coa.manage'),
  controller.activateAccount,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('finance.coa.manage'),
  controller.deactivateAccount,
)

export default router
