import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import * as controller from './payment-account-mapping.controller.js'
import {
  createPaymentAccountMappingSchema,
  listPaymentAccountMappingsQuerySchema,
  paymentAccountMappingLifecycleSchema,
  resolvePaymentAccountMappingSchema,
  updatePaymentAccountMappingSchema,
} from './payment-account-mapping.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

// Mounted before `/:id` so it is not shadowed by the uuid param route.
router.post(
  '/resolve',
  requirePermission('finance.treasury.payment_mapping.view'),
  validateBody(resolvePaymentAccountMappingSchema),
  controller.resolvePaymentAccountMapping,
)

router.get(
  '/',
  requirePermission('finance.treasury.payment_mapping.view'),
  validateQuery(listPaymentAccountMappingsQuerySchema),
  controller.listPaymentAccountMappings,
)

router.post(
  '/',
  requirePermission('finance.treasury.payment_mapping.manage'),
  validateBody(createPaymentAccountMappingSchema),
  controller.createPaymentAccountMapping,
)

router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.payment_mapping.view'),
  controller.getPaymentAccountMapping,
)

router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.payment_mapping.manage'),
  validateBody(updatePaymentAccountMappingSchema),
  controller.updatePaymentAccountMapping,
)

router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.payment_mapping.manage'),
  validateBody(paymentAccountMappingLifecycleSchema),
  controller.activatePaymentAccountMapping,
)

router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.payment_mapping.manage'),
  validateBody(paymentAccountMappingLifecycleSchema),
  controller.deactivatePaymentAccountMapping,
)

export default router
