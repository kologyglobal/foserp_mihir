import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import * as controller from './treasury-account.controller.js'
import {
  createTreasuryAccountSchema,
  listTreasuryAccountsQuerySchema,
  treasuryAccountLifecycleSchema,
  updateTreasuryAccountSchema,
} from './treasury-account.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('finance.treasury.account.view'), validateQuery(listTreasuryAccountsQuerySchema), controller.listTreasuryAccounts)

router.post(
  '/',
  requirePermission('finance.treasury.account.create'),
  validateBody(createTreasuryAccountSchema),
  controller.createTreasuryAccount,
)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.treasury.account.view'), controller.getTreasuryAccount)

router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.account.edit'),
  validateBody(updateTreasuryAccountSchema),
  controller.updateTreasuryAccount,
)

router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.account.activate'),
  validateBody(treasuryAccountLifecycleSchema),
  controller.activateTreasuryAccount,
)

router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.account.deactivate'),
  validateBody(treasuryAccountLifecycleSchema),
  controller.deactivateTreasuryAccount,
)

router.post(
  '/:id/close',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.account.close'),
  validateBody(treasuryAccountLifecycleSchema),
  controller.closeTreasuryAccount,
)

export default router
