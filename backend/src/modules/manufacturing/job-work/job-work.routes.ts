import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './job-work.controller.js'
import { createJobWorkSchema, dispatchJobWorkSchema, invoiceSchema, listJobWorkQuerySchema, reasonSchema, receiveJobWorkSchema, reconcileSchema, returnMaterialSchema, updateJobWorkSchema } from './job-work.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)
router.get('/', requirePermission('manufacturing.job_work.view'), validateQuery(listJobWorkQuerySchema), controller.list)
router.post('/', requirePermission('manufacturing.job_work.create'), validateBody(createJobWorkSchema), controller.create)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.view'), controller.get)
router.patch('/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.edit'), validateBody(updateJobWorkSchema), controller.update)
router.post('/:id/dispatch', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.dispatch'), validateBody(dispatchJobWorkSchema), controller.dispatch)
router.post('/:id/receive', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.receive'), validateBody(receiveJobWorkSchema), controller.receive)
router.post('/:id/return-material', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.return_material'), validateBody(returnMaterialSchema), controller.returnMaterial)
router.post('/:id/reconcile', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.reconcile'), validateBody(reconcileSchema), controller.reconcile)
router.post('/:id/approve-difference', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.approve_difference'), validateBody(reasonSchema), controller.approveDifference)
router.post('/:id/link-invoice', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.link_invoice'), validateBody(invoiceSchema), controller.linkInvoice)
router.post('/:id/close', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.close'), controller.close)
router.post('/:id/cancel', validateParams(uuidParamSchema), requirePermission('manufacturing.job_work.cancel'), validateBody(reasonSchema), controller.cancel)
export default router
