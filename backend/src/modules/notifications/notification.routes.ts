import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import * as controller from './notification.controller.js'
import {
  listNotificationsQuerySchema,
  putPreferencesSchema,
  snoozeNotificationSchema,
} from './notification.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

// Recipient always sees own notifications — no extra CRM permission.
router.get('/', validateQuery(listNotificationsQuerySchema), controller.list)
router.get('/unread-count', controller.unreadCount)
router.get('/summary', controller.summary)
router.get('/preferences', controller.getPreferences)
router.put('/preferences', validateBody(putPreferencesSchema), controller.putPreferences)
router.get('/settings', controller.getTenantSettings)
router.patch('/read-all', controller.markAllRead)
router.patch('/:id/read', validateParams(uuidParamSchema), controller.markRead)
router.patch('/:id/resolve', validateParams(uuidParamSchema), controller.resolve)
router.patch('/:id/dismiss', validateParams(uuidParamSchema), controller.dismiss)
router.patch(
  '/:id/snooze',
  validateParams(uuidParamSchema),
  validateBody(snoozeNotificationSchema),
  controller.snooze,
)

export default router
