import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  cancelCustomerReceiptSchema,
  createCustomerReceiptSchema,
  listCustomerReceiptsQuerySchema,
  updateCustomerReceiptSchema,
  validateCustomerReceiptSchema,
} from './customer-receipt.schemas.js'
import * as controller from './customer-receipt.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/',
  requirePermission('finance.ar.receipt.view'),
  validateQuery(listCustomerReceiptsQuerySchema),
  controller.listCustomerReceipts,
)
router.post(
  '/',
  requirePermission('finance.ar.receipt.create'),
  validateBody(createCustomerReceiptSchema),
  controller.createCustomerReceipt,
)
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.receipt.view'),
  controller.getCustomerReceipt,
)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.receipt.edit'),
  validateBody(updateCustomerReceiptSchema),
  controller.updateCustomerReceipt,
)
router.post(
  '/:id/validate',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.receipt.view'),
  validateBody(validateCustomerReceiptSchema),
  controller.validateCustomerReceipt,
)
router.post(
  '/:id/mark-ready',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.receipt.edit'),
  controller.markCustomerReceiptReady,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.receipt.cancel'),
  validateBody(cancelCustomerReceiptSchema),
  controller.cancelCustomerReceipt,
)

export default router
