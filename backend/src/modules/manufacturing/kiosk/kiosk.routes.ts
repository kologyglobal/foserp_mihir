import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { buildPaginationMeta, tenantRouteParamSchema } from '../../../utils/pagination.js'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import { listMyWorkQuerySchema } from '../assignments/assignment.schemas.js'
import * as service from './kiosk.service.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

/** GET /manufacturing/kiosk/my-work — shopfloor kiosk assignment cards. */
router.get(
  '/my-work',
  requireAnyPermission('manufacturing.operator.my_work', 'manufacturing.assignment.view', 'manufacturing.view'),
  validateQuery(listMyWorkQuerySchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const result = await service.listShopfloorKiosk(req, tenantId, req.query as never)
    return sendPaginated(
      res,
      'Shopfloor kiosk work listed',
      result.items,
      buildPaginationMeta(result.total, result.page, result.limit),
    )
  }),
)

/** GET /manufacturing/kiosk/summary — counts for kiosk home tile. */
router.get(
  '/summary',
  requireAnyPermission('manufacturing.operator.my_work', 'manufacturing.assignment.view', 'manufacturing.view'),
  validateQuery(listMyWorkQuerySchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const result = await service.listShopfloorKiosk(req, tenantId, {
      page: 1,
      limit: 50,
      sortOrder: 'desc',
      ...(req.query as object),
    } as never)
    return sendSuccess(res, 'Shopfloor kiosk summary', result.summary)
  }),
)

export default router
