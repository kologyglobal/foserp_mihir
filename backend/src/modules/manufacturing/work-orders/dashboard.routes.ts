import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './work-order.controller.js'

export const todayRouter = Router({ mergeParams: true })
todayRouter.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)
todayRouter.get('/', requirePermission('manufacturing.control_room.view'), controller.getTodayOverview)

export const controlRoomRouter = Router({ mergeParams: true })
controlRoomRouter.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)
controlRoomRouter.get('/', requirePermission('manufacturing.control_room.view'), controller.getControlRoomOverview)
