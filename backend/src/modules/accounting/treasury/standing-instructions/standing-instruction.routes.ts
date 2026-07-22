import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  cancelStandingInstructionSchema,
  createStandingInstructionSchema,
  generateDueDraftsSchema,
  listStandingInstructionsQuerySchema,
  pauseStandingInstructionSchema,
  resumeStandingInstructionSchema,
  updateStandingInstructionSchema,
} from './standing-instruction.schemas.js'
import * as controller from './standing-instruction.controller.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('finance.treasury.standing_instruction.view'), validateQuery(listStandingInstructionsQuerySchema), controller.listStandingInstructions)
router.post('/', requirePermission('finance.treasury.standing_instruction.manage'), validateBody(createStandingInstructionSchema), controller.createStandingInstruction)
router.post(
  '/generate-due-drafts',
  requirePermission('finance.treasury.standing_instruction.generate'),
  validateBody(generateDueDraftsSchema),
  controller.generateDueDraftsHandler,
)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.treasury.standing_instruction.view'), controller.getStandingInstruction)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.standing_instruction.manage'),
  validateBody(updateStandingInstructionSchema),
  controller.updateStandingInstruction,
)
router.post(
  '/:id/pause',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.standing_instruction.manage'),
  validateBody(pauseStandingInstructionSchema),
  controller.pauseStandingInstruction,
)
router.post(
  '/:id/resume',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.standing_instruction.manage'),
  validateBody(resumeStandingInstructionSchema),
  controller.resumeStandingInstruction,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.standing_instruction.manage'),
  validateBody(cancelStandingInstructionSchema),
  controller.cancelStandingInstruction,
)

export default router
