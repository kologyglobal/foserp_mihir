import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  createLegalEntitySchema,
  listLegalEntitiesQuerySchema,
  updateLegalEntitySchema,
} from './legal-entity.validation.js'
import * as controller from './legal-entity.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('finance.legal_entity.view'), validateQuery(listLegalEntitiesQuerySchema), controller.listLegalEntities)
router.post('/', requirePermission('finance.legal_entity.manage'), validateBody(createLegalEntitySchema), controller.createLegalEntity)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.legal_entity.view'), controller.getLegalEntity)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.legal_entity.manage'),
  validateBody(updateLegalEntitySchema),
  controller.updateLegalEntity,
)
router.post(
  '/:id/set-default',
  validateParams(uuidParamSchema),
  requirePermission('finance.legal_entity.manage'),
  controller.setDefaultLegalEntity,
)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('finance.legal_entity.manage'),
  controller.activateLegalEntity,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('finance.legal_entity.manage'),
  controller.deactivateLegalEntity,
)

export default router
