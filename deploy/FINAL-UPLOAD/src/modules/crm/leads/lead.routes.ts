import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './lead.controller.js'
import {
  assignLeadSchema,
  changeLeadStageSchema,
  convertLeadSchema,
  createLeadSchema,
  disqualifyLeadSchema,
  listLeadsQuerySchema,
  qualifyLeadSchema,
  updateLeadSchema,
} from './lead.validation.js'
import {
  bulkArchiveLeadsSchema,
  bulkAssignLeadsSchema,
  bulkRestoreLeadsSchema,
  bulkStatusLeadsSchema,
} from './lead-bulk.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.lead.view'), validateQuery(listLeadsQuerySchema), controller.listLeads)
router.post('/bulk-assign', requirePermission('crm.lead.assign'), validateBody(bulkAssignLeadsSchema), controller.bulkAssignLeads)
router.post('/bulk-status', requirePermission('crm.lead.update'), validateBody(bulkStatusLeadsSchema), controller.bulkStatusLeads)
router.post('/bulk-archive', requirePermission('crm.lead.update'), validateBody(bulkArchiveLeadsSchema), controller.bulkArchiveLeads)
router.post('/bulk-restore', requirePermission('crm.lead.update'), validateBody(bulkRestoreLeadsSchema), controller.bulkRestoreLeads)
router.post('/', requirePermission('crm.lead.create'), validateBody(createLeadSchema), controller.createLead)
router.get('/:id/status-history', requirePermission('crm.lead.view'), validateParams(uuidParamSchema), controller.getLeadStatusHistory)
router.get('/:id/assignment-history', requirePermission('crm.lead.view'), validateParams(uuidParamSchema), controller.getLeadAssignmentHistory)
router.get('/:id', requirePermission('crm.lead.view'), validateParams(uuidParamSchema), controller.getLead)
router.patch('/:id', requirePermission('crm.lead.update'), validateParams(uuidParamSchema), validateBody(updateLeadSchema), controller.updateLead)
router.delete('/:id', requirePermission('crm.lead.delete'), validateParams(uuidParamSchema), controller.deleteLead)
router.post('/:id/assign', requirePermission('crm.lead.assign'), validateParams(uuidParamSchema), validateBody(assignLeadSchema), controller.assignLead)
router.post('/:id/qualify', requirePermission('crm.lead.qualify'), validateParams(uuidParamSchema), validateBody(qualifyLeadSchema), controller.qualifyLead)
router.post('/:id/change-stage', requirePermission('crm.lead.update'), validateParams(uuidParamSchema), validateBody(changeLeadStageSchema), controller.changeLeadStage)
router.post('/:id/disqualify', requirePermission('crm.lead.qualify'), validateParams(uuidParamSchema), validateBody(disqualifyLeadSchema), controller.disqualifyLead)
router.post('/:id/convert', requirePermission('crm.lead.convert'), validateParams(uuidParamSchema), validateBody(convertLeadSchema), controller.convertLead)

export default router
