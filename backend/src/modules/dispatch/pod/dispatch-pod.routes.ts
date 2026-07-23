import { Router } from 'express'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './dispatch-pod.controller.js'
import {
  capturePodSchema,
  markInTransitSchema,
  podAttachmentSchema,
  podExceptionSchema,
} from './dispatch-pod.schemas.js'

/** Mounted under /outbound — paths are /:id/pod… */
const router = Router({ mergeParams: true })

router.get(
  '/:id/pod',
  validateParams(uuidParamSchema),
  requireAnyPermission('dispatch.pod.view', 'dispatch.view'),
  controller.getPod,
)

router.post(
  '/:id/pod/in-transit',
  validateParams(uuidParamSchema),
  requireAnyPermission('dispatch.pod.record', 'dispatch.post'),
  validateBody(markInTransitSchema),
  controller.markInTransit,
)

router.post(
  '/:id/pod/capture',
  validateParams(uuidParamSchema),
  requireAnyPermission('dispatch.pod.record', 'dispatch.post'),
  validateBody(capturePodSchema),
  controller.capturePod,
)

router.post(
  '/:id/pod/exception',
  validateParams(uuidParamSchema),
  requireAnyPermission('dispatch.pod.record', 'dispatch.post'),
  validateBody(podExceptionSchema),
  controller.recordException,
)

router.post(
  '/:id/pod/attachments',
  validateParams(uuidParamSchema),
  requireAnyPermission('dispatch.pod.record', 'dispatch.post'),
  validateBody(podAttachmentSchema),
  controller.addAttachment,
)

export default router
