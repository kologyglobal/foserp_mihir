import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './cost-master.controller.js'
import {
  createLabourRateCardSchema,
  createOverheadCostPoolSchema,
  listCostMastersQuerySchema,
  updateLabourRateCardSchema,
  updateOverheadCostPoolSchema,
} from './cost-master.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/labour-rate-cards', requirePermission('manufacturing.costing_policy.view'), validateQuery(listCostMastersQuerySchema), controller.listLabourRateCards)
router.post('/labour-rate-cards', requirePermission('manufacturing.costing_policy.manage'), validateBody(createLabourRateCardSchema), controller.createLabourRateCard)
router.get('/labour-rate-cards/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.view'), controller.getLabourRateCard)
router.patch('/labour-rate-cards/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.manage'), validateBody(updateLabourRateCardSchema), controller.updateLabourRateCard)
router.delete('/labour-rate-cards/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.manage'), controller.deleteLabourRateCard)

router.get('/overhead-cost-pools', requirePermission('manufacturing.costing_policy.view'), validateQuery(listCostMastersQuerySchema), controller.listOverheadCostPools)
router.post('/overhead-cost-pools', requirePermission('manufacturing.costing_policy.manage'), validateBody(createOverheadCostPoolSchema), controller.createOverheadCostPool)
router.get('/overhead-cost-pools/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.view'), controller.getOverheadCostPool)
router.patch('/overhead-cost-pools/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.manage'), validateBody(updateOverheadCostPoolSchema), controller.updateOverheadCostPool)
router.delete('/overhead-cost-pools/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.manage'), controller.deleteOverheadCostPool)

export default router
