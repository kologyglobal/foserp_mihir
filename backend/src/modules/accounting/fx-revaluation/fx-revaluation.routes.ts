import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  listFxRatesQuerySchema,
  reverseFxRunSchema,
  upsertFxRateSchema,
} from './fx-revaluation.schemas.js'
import * as controller from './fx-revaluation.controller.js'

const periodParamSchema = z.object({ periodId: z.string().uuid() })

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/rates',
  requirePermission('finance.fx_revaluation.view'),
  validateQuery(listFxRatesQuerySchema),
  controller.listFxRates,
)
router.put(
  '/rates',
  requirePermission('finance.fx_revaluation.manage'),
  validateBody(upsertFxRateSchema),
  controller.upsertFxRate,
)

router.get(
  '/periods/:periodId/run',
  validateParams(periodParamSchema),
  requirePermission('finance.fx_revaluation.view'),
  controller.getFxRunForPeriod,
)
router.post(
  '/periods/:periodId/preview',
  validateParams(periodParamSchema),
  requirePermission('finance.fx_revaluation.preview'),
  controller.previewFxRevaluation,
)

router.post(
  '/runs/:id/post',
  validateParams(uuidParamSchema),
  requirePermission('finance.fx_revaluation.post'),
  controller.postFxRevaluation,
)
router.post(
  '/runs/:id/reverse',
  validateParams(uuidParamSchema),
  requirePermission('finance.fx_revaluation.reverse'),
  validateBody(reverseFxRunSchema),
  controller.reverseFxRevaluation,
)

export default router
