import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './machine.controller.js'
import {
  createMachineSchema,
  listMachinesQuerySchema,
  setMachineStatusSchema,
  updateMachineSchema,
} from './machine.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('manufacturing.machine.view'),
  validateQuery(listMachinesQuerySchema),
  controller.listMachines,
)
router.post(
  '/',
  requirePermission('manufacturing.machine.manage'),
  validateBody(createMachineSchema),
  controller.createMachine,
)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.machine.view'), controller.getMachine)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.machine.manage'),
  validateBody(updateMachineSchema),
  controller.updateMachine,
)
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.machine.manage'),
  controller.deleteMachine,
)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.machine.manage'),
  controller.activateMachine,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.machine.manage'),
  controller.deactivateMachine,
)
router.post(
  '/:id/status',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.machine.manage'),
  validateBody(setMachineStatusSchema),
  controller.setMachineStatus,
)

export default router
