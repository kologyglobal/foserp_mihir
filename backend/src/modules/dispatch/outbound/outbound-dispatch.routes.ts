import { Router } from 'express'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './outbound-dispatch.controller.js'
import {
  cancelOutboundDispatchSchema,
  createOutboundDispatchSchema,
  listOutboundDispatchesQuerySchema,
  updateOutboundDispatchSchema,
} from './outbound-dispatch.schemas.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('dispatch.view'),
  validateQuery(listOutboundDispatchesQuerySchema),
  controller.list,
)

router.post(
  '/',
  requirePermission('dispatch.create'),
  validateBody(createOutboundDispatchSchema),
  controller.create,
)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('dispatch.view'), controller.get)

router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.edit'),
  validateBody(updateOutboundDispatchSchema),
  controller.update,
)

router.post(
  '/:id/confirm',
  validateParams(uuidParamSchema),
  requireAnyPermission('dispatch.post', 'dispatch.basic_confirm'),
  controller.confirm,
)

router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.cancel'),
  validateBody(cancelOutboundDispatchSchema),
  controller.cancel,
)

export default router
