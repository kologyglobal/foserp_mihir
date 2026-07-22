import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import { listMyWorkQuerySchema } from './assignment.schemas.js'
import * as myWorkService from './my-work.service.js'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated } from '../../../utils/response.js'
import { dateOnly, dec, isoDate } from '../shared/manufacturing.mappers.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('manufacturing.operator.my_work'),
  validateQuery(listMyWorkQuerySchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const result = await myWorkService.listMyWork(req, tenantId, req.query as never)
    return sendPaginated(
      res,
      'My work listed',
      result.items.map((item) => ({
        ...item,
        assignedQuantity: dec(item.assignedQuantity),
        completedQuantity: dec(item.completedQuantity),
        assignmentDate: dateOnly(item.assignmentDate),
        plannedStartAt: isoDate(item.plannedStartAt),
        plannedEndAt: isoDate(item.plannedEndAt),
        acceptedAt: isoDate(item.acceptedAt),
        startedAt: isoDate(item.startedAt),
        pausedAt: isoDate(item.pausedAt),
        completedAt: isoDate(item.completedAt),
        cancelledAt: isoDate(item.cancelledAt),
      })),
      buildPaginationMeta(result.total, result.page, result.limit),
    )
  }),
)

export default router
