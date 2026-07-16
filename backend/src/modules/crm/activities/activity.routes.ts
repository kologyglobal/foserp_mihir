import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './activity.controller.js'
import {
  completeActivitySchema,
  createActivitySchema,
  listActivitiesQuerySchema,
  updateActivitySchema,
} from './activity.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.activity.view'), validateQuery(listActivitiesQuerySchema), controller.listActivities)
router.post('/', requirePermission('crm.activity.create'), validateBody(createActivitySchema), controller.createActivity)
router.get('/:id', requirePermission('crm.activity.view'), validateParams(uuidParamSchema), controller.getActivity)
router.patch('/:id', requirePermission('crm.activity.update'), validateParams(uuidParamSchema), validateBody(updateActivitySchema), controller.updateActivity)
router.delete('/:id', requirePermission('crm.activity.delete'), validateParams(uuidParamSchema), controller.deleteActivity)
router.post('/:id/complete', requirePermission('crm.activity.complete'), validateParams(uuidParamSchema), validateBody(completeActivitySchema), controller.completeActivity)

export default router
