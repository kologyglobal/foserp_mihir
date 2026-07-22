import { Router } from 'express'
import { authenticate } from '../../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../../utils/pagination.js'
import * as controller from './bank-statement-mapping-template.controller.js'
import {
  createMappingTemplateSchema,
  listMappingTemplatesQuerySchema,
  mappingTemplateLifecycleSchema,
  updateMappingTemplateSchema,
} from './bank-statement-mapping-template.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.post(
  '/',
  requirePermission('finance.treasury.statement.mapping.manage'),
  validateBody(createMappingTemplateSchema),
  controller.createMappingTemplate,
)

router.get(
  '/',
  requirePermission('finance.treasury.statement.mapping.view'),
  validateQuery(listMappingTemplatesQuerySchema),
  controller.listMappingTemplates,
)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.treasury.statement.mapping.view'), controller.getMappingTemplate)

router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.mapping.manage'),
  validateBody(updateMappingTemplateSchema),
  controller.updateMappingTemplate,
)

router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.mapping.manage'),
  validateBody(mappingTemplateLifecycleSchema),
  controller.activateMappingTemplate,
)

router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.mapping.manage'),
  validateBody(mappingTemplateLifecycleSchema),
  controller.deactivateMappingTemplate,
)

export default router
