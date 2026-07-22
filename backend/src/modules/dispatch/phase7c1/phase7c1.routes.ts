import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './phase7c1.controller.js'
import {
  createDraftFromRequirementsSchema,
  holdRequirementSchema,
  listRequirementsQuerySchema,
  readinessPreviewSchema,
  synchroniseRequirementsSchema,
  workbenchSummaryQuerySchema,
} from './phase7c1.schemas.js'

const router = Router({ mergeParams: true })

router.get(
  '/workbench/summary',
  requirePermission('dispatch.requirement.view'),
  validateQuery(workbenchSummaryQuerySchema),
  controller.workbenchSummary,
)

router.get(
  '/requirements',
  requirePermission('dispatch.requirement.view'),
  validateQuery(listRequirementsQuerySchema),
  controller.listRequirements,
)

router.post(
  '/requirements/synchronise',
  requirePermission('dispatch.requirement.synchronise'),
  validateBody(synchroniseRequirementsSchema),
  controller.synchroniseRequirements,
)

router.post(
  '/requirements/readiness-preview',
  requirePermission('dispatch.readiness.view'),
  validateBody(readinessPreviewSchema),
  controller.readinessPreview,
)

router.get(
  '/requirements/:id',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.requirement.view'),
  controller.getRequirement,
)

router.get(
  '/requirements/:id/readiness',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.readiness.view'),
  controller.getRequirementReadiness,
)

router.get(
  '/requirements/:id/fulfilment',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.fulfilment.view'),
  controller.getRequirementFulfilment,
)

router.post(
  '/requirements/:id/hold',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.requirement.hold'),
  validateBody(holdRequirementSchema),
  controller.holdRequirement,
)

router.post(
  '/requirements/:id/release-hold',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.requirement.release_hold'),
  controller.releaseHold,
)

router.post(
  '/orders/from-requirements',
  requirePermission('dispatch.order.create'),
  validateBody(createDraftFromRequirementsSchema),
  controller.createDraftOrder,
)

export default router
