import { Router } from 'express'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './outbound-dispatch.controller.js'
import {
  cancelOutboundDispatchSchema,
  createOutboundDispatchSchema,
  listOutboundDispatchesQuerySchema,
  reverseOutboundDispatchSchema,
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

/** Phase 7C5 hardened post — workbench drafts require ISSUED Delivery Challan. */
router.post(
  '/:id/post',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.post'),
  controller.post,
)

/** Phase 7C5 reverse — compensating FG_DISPATCH inward, status → REVERSED. */
router.post(
  '/:id/reverse',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.post'),
  validateBody(reverseOutboundDispatchSchema),
  controller.reverse,
)

router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.cancel'),
  validateBody(cancelOutboundDispatchSchema),
  controller.cancel,
)

export default router
