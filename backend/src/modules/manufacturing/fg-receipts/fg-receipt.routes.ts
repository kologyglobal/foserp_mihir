import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody } from '../../../middleware/validation.middleware.js'
import * as controller from './fg-receipt.controller.js'
import { createFgDraftSchema, postFgReceiptSchema, previewFgReceiptSchema } from './fg-receipt.schemas.js'

/**
 * Nested under `/work-orders/:id`.
 * Mounts: /fg-eligibility (via work-order routes separately), /fg-receipts
 */
const router = Router({ mergeParams: true })

router.get('/', requirePermission('manufacturing.fg_receipt.view'), controller.list)

router.post(
  '/preview',
  requirePermission('manufacturing.fg_receipt.view'),
  validateBody(previewFgReceiptSchema),
  controller.preview,
)

router.post(
  '/draft',
  requirePermission('manufacturing.fg_receipt.create'),
  validateBody(createFgDraftSchema),
  controller.createDraft,
)

router.post(
  '/',
  requirePermission('manufacturing.fg_receipt.post'),
  validateBody(postFgReceiptSchema),
  controller.post,
)

export default router

/** Standalone GET /fg-receipts/:receiptId under manufacturing router */
export const fgReceiptByIdRouter = Router({ mergeParams: true })

fgReceiptByIdRouter.get(
  '/:receiptId',
  requirePermission('manufacturing.fg_receipt.view'),
  controller.getById,
)
