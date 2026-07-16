import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import { createItemSchema, itemLookupQuerySchema, listItemsQuerySchema, updateItemSchema } from './item.validation.js'
import * as controller from './item.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('master.item.view'), validateQuery(listItemsQuerySchema), controller.listItems)
router.post('/', requirePermission('master.item.create'), validateBody(createItemSchema), controller.createItem)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('master.item.view'), controller.getItem)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('master.item.update'),
  validateBody(updateItemSchema),
  controller.updateItem,
)
router.delete('/:id', validateParams(uuidParamSchema), requirePermission('master.item.delete'), controller.deleteItem)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('master.item.update'),
  controller.activateItem,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('master.item.update'),
  controller.deactivateItem,
)

export default router

export const itemLookupRouter = Router({ mergeParams: true })

itemLookupRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

itemLookupRouter.get(
  '/',
  requirePermission('master.lookup.view'),
  validateQuery(itemLookupQuerySchema),
  controller.listItemLookups,
)
