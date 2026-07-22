import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './bom.controller.js'
import {
  confirmBomImportSchema,
  createBomSchema,
  createBomVersionSchema,
  listBomVersionsQuerySchema,
  listBomsQuerySchema,
  previewBomImportSchema,
} from './bom.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const bomIdParamSchema = z.object({ bomId: z.string().uuid() })

router.get('/', requirePermission('manufacturing.bom.view'), validateQuery(listBomsQuerySchema), controller.listBoms)
router.post('/', requirePermission('manufacturing.bom.create'), validateBody(createBomSchema), controller.createBom)
router.get('/import/template', requirePermission('manufacturing.bom.import'), controller.getBomImportTemplate)
router.post(
  '/import/preview',
  requirePermission('manufacturing.bom.import'),
  validateBody(previewBomImportSchema),
  controller.previewBomImport,
)
router.post(
  '/import',
  requirePermission('manufacturing.bom.import'),
  validateBody(confirmBomImportSchema),
  controller.confirmBomImport,
)

router.get(
  '/:bomId',
  validateParams(bomIdParamSchema),
  requirePermission('manufacturing.bom.view'),
  controller.getBom,
)

router.get(
  '/:bomId/versions',
  validateParams(bomIdParamSchema),
  requirePermission('manufacturing.bom.view'),
  validateQuery(listBomVersionsQuerySchema),
  controller.listBomVersions,
)
router.post(
  '/:bomId/versions',
  validateParams(bomIdParamSchema),
  requirePermission('manufacturing.bom.create'),
  validateBody(createBomVersionSchema),
  controller.createBomVersion,
)

export default router
