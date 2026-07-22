import { Router, type NextFunction, type Request, type Response } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateQuery } from '../../../middleware/validation.middleware.js'
import { ValidationError } from '../../../utils/errors.js'
import { z } from 'zod'
import * as controller from './runtime-change.controller.js'
import {
  applyRuntimeChangeSchema,
  approveRuntimeChangeSchema,
  cancelRuntimeChangeSchema,
  createRuntimeChangeSchema,
  listRuntimeChangesQuerySchema,
  previewRuntimeChangeSchema,
  rejectRuntimeChangeSchema,
  updateRuntimeChangeSchema,
} from './runtime-change.schemas.js'

/**
 * Mounted at `/work-orders/:id/runtime-changes`.
 * Parent already authenticated + tenant-resolved + validated `:id`.
 * Merge changeId into params — do not replace (Zod object strips siblings).
 */
function requireChangeId(req: Request, _res: Response, next: NextFunction): void {
  const parsed = z.object({ changeId: z.string().uuid() }).safeParse(req.params)
  if (!parsed.success) {
    next(
      new ValidationError(
        'Validation failed',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.') || 'params', message: issue.message })),
      ),
    )
    return
  }
  Object.assign(req.params, parsed.data)
  next()
}

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('manufacturing.runtime_change.view'),
  validateQuery(listRuntimeChangesQuerySchema),
  controller.list,
)
router.post(
  '/preview',
  requirePermission('manufacturing.runtime_change.request'),
  validateBody(previewRuntimeChangeSchema),
  controller.preview,
)
router.post(
  '/',
  requirePermission('manufacturing.runtime_change.request'),
  validateBody(createRuntimeChangeSchema),
  controller.create,
)
router.get('/:changeId', requireChangeId, requirePermission('manufacturing.runtime_change.view'), controller.get)
router.patch(
  '/:changeId',
  requireChangeId,
  requirePermission('manufacturing.runtime_change.request'),
  validateBody(updateRuntimeChangeSchema),
  controller.update,
)
router.post('/:changeId/validate', requireChangeId, requirePermission('manufacturing.runtime_change.request'), controller.validate)
router.post('/:changeId/submit', requireChangeId, requirePermission('manufacturing.runtime_change.request'), controller.submit)
router.post(
  '/:changeId/approve',
  requireChangeId,
  requirePermission('manufacturing.runtime_change.approve'),
  validateBody(approveRuntimeChangeSchema),
  controller.approve,
)
router.post(
  '/:changeId/reject',
  requireChangeId,
  requirePermission('manufacturing.runtime_change.reject'),
  validateBody(rejectRuntimeChangeSchema),
  controller.reject,
)
router.post(
  '/:changeId/apply',
  requireChangeId,
  requirePermission('manufacturing.runtime_change.apply'),
  validateBody(applyRuntimeChangeSchema),
  controller.apply,
)
router.post(
  '/:changeId/cancel',
  requireChangeId,
  requirePermission('manufacturing.runtime_change.request'),
  validateBody(cancelRuntimeChangeSchema),
  controller.cancel,
)

export default router
