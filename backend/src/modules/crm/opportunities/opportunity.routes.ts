import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './opportunity.controller.js'
import {
  createOpportunitySchema,
  listOpportunitiesQuerySchema,
  loseOpportunitySchema,
  reopenOpportunitySchema,
  assignOpportunitySchema,
  moveStageOpportunitySchema,
  updateOpportunitySchema,
  winOpportunitySchema,
} from './opportunity.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.opportunity.view'), validateQuery(listOpportunitiesQuerySchema), controller.listOpportunities)
router.post('/', requirePermission('crm.opportunity.create'), validateBody(createOpportunitySchema), controller.createOpportunity)
router.get('/:id', requirePermission('crm.opportunity.view'), validateParams(uuidParamSchema), controller.getOpportunity)
router.patch('/:id', requirePermission('crm.opportunity.update'), validateParams(uuidParamSchema), validateBody(updateOpportunitySchema), controller.updateOpportunity)
router.delete('/:id', requirePermission('crm.opportunity.delete'), validateParams(uuidParamSchema), controller.deleteOpportunity)
router.post('/:id/win', requirePermission('crm.opportunity.close'), validateParams(uuidParamSchema), validateBody(winOpportunitySchema), controller.winOpportunity)
router.post('/:id/lose', requirePermission('crm.opportunity.close'), validateParams(uuidParamSchema), validateBody(loseOpportunitySchema), controller.loseOpportunity)
router.post('/:id/reopen', requirePermission('crm.opportunity.close'), validateParams(uuidParamSchema), validateBody(reopenOpportunitySchema), controller.reopenOpportunity)
router.post('/:id/assign', requirePermission('crm.opportunity.update'), validateParams(uuidParamSchema), validateBody(assignOpportunitySchema), controller.assignOpportunity)
router.post('/:id/move-stage', requirePermission('crm.opportunity.update'), validateParams(uuidParamSchema), validateBody(moveStageOpportunitySchema), controller.moveOpportunityStage)
router.get('/:id/stage-history', requirePermission('crm.opportunity.view'), validateParams(uuidParamSchema), controller.getStageHistory)
router.get('/:id/assignment-history', requirePermission('crm.opportunity.view'), validateParams(uuidParamSchema), controller.getAssignmentHistory)
router.get('/:id/amount-history', requirePermission('crm.opportunity.view'), validateParams(uuidParamSchema), controller.getAmountHistory)
router.get('/:id/status-history', requirePermission('crm.opportunity.view'), validateParams(uuidParamSchema), controller.getStatusHistory)

export default router
