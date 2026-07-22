import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import * as controller from './treasury-liquidity.controller.js'
import {
  createDayCloseSchema,
  dayCloseLifecycleSchema,
  forecastQuerySchema,
  listDayClosesQuerySchema,
  liquidityQuerySchema,
  reopenDayCloseSchema,
} from './treasury-liquidity.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/cash-position',
  requirePermission('finance.treasury.liquidity.view'),
  validateQuery(liquidityQuerySchema),
  controller.getCashPositionHandler,
)
router.get(
  '/daily',
  requirePermission('finance.treasury.liquidity.view'),
  validateQuery(liquidityQuerySchema),
  controller.getDailyLiquidityHandler,
)
router.get(
  '/forecast',
  requirePermission('finance.treasury.liquidity.view'),
  validateQuery(forecastQuerySchema),
  controller.getForecastHandler,
)
router.get(
  '/closing-controls',
  requirePermission('finance.treasury.closing.view'),
  validateQuery(liquidityQuerySchema),
  controller.getClosingControlsHandler,
)
router.get(
  '/dashboard',
  requirePermission('finance.treasury.liquidity.view'),
  validateQuery(forecastQuerySchema),
  controller.getDashboardHandler,
)

router.get(
  '/day-closes',
  requirePermission('finance.treasury.closing.view'),
  validateQuery(listDayClosesQuerySchema),
  controller.listDayClosesHandler,
)
router.post(
  '/day-closes',
  requirePermission('finance.treasury.closing.manage'),
  validateBody(createDayCloseSchema),
  controller.createDayCloseHandler,
)
router.get(
  '/day-closes/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.closing.view'),
  controller.getDayCloseHandler,
)
router.post(
  '/day-closes/:id/review',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.closing.manage'),
  validateBody(dayCloseLifecycleSchema),
  controller.reviewDayCloseHandler,
)
router.post(
  '/day-closes/:id/close',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.closing.manage'),
  validateBody(dayCloseLifecycleSchema),
  controller.closeDayCloseHandler,
)
router.post(
  '/day-closes/:id/reopen',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.closing.manage'),
  validateBody(reopenDayCloseSchema),
  controller.reopenDayCloseHandler,
)

export default router
