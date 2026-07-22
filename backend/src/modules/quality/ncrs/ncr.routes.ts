import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './ncr.controller.js'
import { actionNcrSchema, closeNcrSchema, dispositionNcrSchema, listNcrsQuerySchema, verifyNcrSchema } from './ncr.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('quality.view'), validateQuery(listNcrsQuerySchema), controller.listNcrs)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('quality.view'), controller.getNcr)
router.post('/:id/disposition', validateParams(uuidParamSchema), requirePermission('quality.edit'), validateBody(dispositionNcrSchema), controller.dispositionNcr)
router.post('/:id/submit-action', validateParams(uuidParamSchema), requirePermission('quality.edit'), validateBody(actionNcrSchema), controller.submitAction)
router.post('/:id/verify', validateParams(uuidParamSchema), requirePermission('quality.approve'), validateBody(verifyNcrSchema), controller.verifyNcr)

router.post(
  '/:id/close',
  validateParams(uuidParamSchema),
  requireAnyPermission('quality.approve', 'quality.close'),
  validateBody(closeNcrSchema),
  controller.closeNcr,
)

export default router
