import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './follow-up.controller.js'
import {
  completeFollowUpSchema,
  createFollowUpSchema,
  listFollowUpsQuerySchema,
  rescheduleFollowUpSchema,
  snoozeFollowUpSchema,
  updateFollowUpSchema,
} from './follow-up.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.follow_up.view'), validateQuery(listFollowUpsQuerySchema), controller.listFollowUps)
router.post('/', requirePermission('crm.follow_up.create'), validateBody(createFollowUpSchema), controller.createFollowUp)
router.get('/:id', requirePermission('crm.follow_up.view'), validateParams(uuidParamSchema), controller.getFollowUp)
router.patch('/:id', requirePermission('crm.follow_up.update'), validateParams(uuidParamSchema), validateBody(updateFollowUpSchema), controller.updateFollowUp)
router.delete('/:id', requirePermission('crm.follow_up.delete'), validateParams(uuidParamSchema), controller.deleteFollowUp)
router.post('/:id/complete', requirePermission('crm.follow_up.update'), validateParams(uuidParamSchema), validateBody(completeFollowUpSchema), controller.completeFollowUp)
router.post('/:id/reschedule', requirePermission('crm.follow_up.update'), validateParams(uuidParamSchema), validateBody(rescheduleFollowUpSchema), controller.rescheduleFollowUp)
router.post('/:id/snooze', requirePermission('crm.follow_up.update'), validateParams(uuidParamSchema), validateBody(snoozeFollowUpSchema), controller.snoozeFollowUp)
router.post('/:id/cancel', requirePermission('crm.follow_up.update'), validateParams(uuidParamSchema), controller.cancelFollowUp)

export default router
