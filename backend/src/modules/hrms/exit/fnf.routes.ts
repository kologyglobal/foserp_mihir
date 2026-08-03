import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './fnf.controller.js'
import { exitIdParamSchema, listFnfQuerySchema, payFnfSchema } from './exit.schemas.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('hrms.fnf.view'), validateQuery(listFnfQuerySchema), controller.listSettlements)
router.get('/:exitId', validateParams(exitIdParamSchema), requirePermission('hrms.fnf.view'), controller.getSettlement)
router.post(
  '/:exitId/calculate',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.fnf.calculate'),
  controller.calculate,
)
router.post(
  '/:exitId/review',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.fnf.approve'),
  controller.review,
)
router.post(
  '/:exitId/approve',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.fnf.approve'),
  controller.approve,
)
router.post(
  '/:exitId/post',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.fnf.post'),
  controller.postSettlement,
)
router.post(
  '/:exitId/pay',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.fnf.pay'),
  validateBody(payFnfSchema),
  controller.pay,
)

export default router
