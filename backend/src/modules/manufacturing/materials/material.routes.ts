import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './material.controller.js'
import {
  addMaterialRequirementSchema,
  issueMaterialSchema,
  issuePreviewSchema,
  reallocateReservationSchema,
  releaseReservationSchema,
  reserveMaterialsSchema,
  returnMaterialSchema,
  shortageRequisitionSchema,
  updateMaterialRequirementSchema,
} from './material.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('manufacturing.materials.view'), controller.listMaterials)
router.get('/readiness', requirePermission('manufacturing.materials.view'), controller.getMaterialsReadiness)
router.get(
  '/position',
  requireAnyPermission('manufacturing.material_position.view', 'manufacturing.materials.view'),
  controller.getMaterialPosition,
)
router.get(
  '/reconciliation',
  requireAnyPermission('manufacturing.material.reconcile', 'manufacturing.materials.view'),
  controller.getMaterialReconciliation,
)
router.post(
  '/sync-requirements',
  requirePermission('manufacturing.materials.create_requirement'),
  controller.syncRequirements,
)
router.post(
  '/',
  requirePermission('manufacturing.materials.create_requirement'),
  validateBody(addMaterialRequirementSchema),
  controller.addMaterialRequirement,
)
router.patch(
  '/:materialId',
  requirePermission('manufacturing.materials.create_requirement'),
  validateBody(updateMaterialRequirementSchema),
  controller.updateMaterialRequirement,
)
router.delete(
  '/:materialId',
  requirePermission('manufacturing.materials.create_requirement'),
  controller.removeMaterialRequirement,
)
router.post(
  '/reserve',
  requirePermission('manufacturing.materials.reserve'),
  validateBody(reserveMaterialsSchema),
  controller.reserveMaterials,
)
router.post(
  '/release-reservation',
  requirePermission('manufacturing.material.release_reservation'),
  validateBody(releaseReservationSchema),
  controller.releaseReservation,
)
router.post(
  '/reallocate-reservation',
  requirePermission('manufacturing.material.reallocate'),
  validateBody(reallocateReservationSchema),
  controller.reallocateReservation,
)
router.post(
  '/issue/preview',
  requirePermission('manufacturing.materials.issue'),
  validateBody(issuePreviewSchema),
  controller.previewIssue,
)
router.post(
  '/issue',
  requirePermission('manufacturing.materials.issue'),
  validateBody(issueMaterialSchema),
  controller.issueMaterial,
)
router.post(
  '/return',
  requirePermission('manufacturing.materials.return'),
  validateBody(returnMaterialSchema),
  controller.returnMaterial,
)
router.post(
  '/shortage-requisition',
  requirePermission('manufacturing.materials.create_requirement'),
  validateBody(shortageRequisitionSchema),
  controller.createShortageRequisition,
)

export default router
