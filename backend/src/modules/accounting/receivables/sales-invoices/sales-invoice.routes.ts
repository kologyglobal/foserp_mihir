import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  cancelSalesInvoiceSchema,
  createSalesInvoiceSchema,
  listSalesInvoicesQuerySchema,
  updateSalesInvoiceSchema,
} from './sales-invoice.schemas.js'
import * as controller from './sales-invoice.controller.js'

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
  requirePermission('finance.ar.invoice.view'),
  validateQuery(listSalesInvoicesQuerySchema),
  controller.listSalesInvoices,
)
router.post(
  '/',
  requirePermission('finance.ar.invoice.create'),
  validateBody(createSalesInvoiceSchema),
  controller.createSalesInvoice,
)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.ar.invoice.view'), controller.getSalesInvoice)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.invoice.edit'),
  validateBody(updateSalesInvoiceSchema),
  controller.updateSalesInvoice,
)
router.post(
  '/:id/validate',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.invoice.view'),
  controller.validateSalesInvoice,
)
router.post(
  '/:id/mark-ready',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.invoice.edit'),
  controller.markSalesInvoiceReady,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.invoice.cancel'),
  validateBody(cancelSalesInvoiceSchema),
  controller.cancelSalesInvoice,
)
router.post(
  '/:id/post',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.invoice.post'),
  controller.postSalesInvoice,
)

export default router
