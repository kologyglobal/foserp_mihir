import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './reservation.controller.js'
import { cancelReservationSchema, createReservationSchema, listReservationsQuerySchema } from './reservation.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requireAnyPermission('inventory.reservations.view', 'inventory.reservations.manage'),
  validateQuery(listReservationsQuerySchema),
  controller.listReservations,
)

router.post(
  '/',
  requirePermission('inventory.reservations.manage'),
  validateBody(createReservationSchema),
  controller.createReservation,
)

router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('inventory.reservations.manage'),
  validateBody(cancelReservationSchema),
  controller.cancelReservation,
)

export default router
