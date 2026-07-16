import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './crm-master.controller.js'
import {
  createCrmMasterSchema,
  kindIdParamSchema,
  kindParamSchema,
  listCrmMastersQuerySchema,
  updateCrmMasterSchema,
} from './crm-master.validation.js'

const router = Router({ mergeParams: true })

router.get('/sync', requirePermission('crm.master.view'), controller.syncAllMasters)
router.get('/:kind/lookup', requirePermission('crm.master.view'), validateParams(kindParamSchema), controller.lookupMasters)
router.get('/:kind', requirePermission('crm.master.view'), validateParams(kindParamSchema), validateQuery(listCrmMastersQuerySchema), controller.listMasters)
router.post('/:kind', requirePermission('crm.master.create'), validateParams(kindParamSchema), validateBody(createCrmMasterSchema), controller.createMaster)
router.get('/:kind/:id', requirePermission('crm.master.view'), validateParams(kindIdParamSchema), controller.getMaster)
router.patch('/:kind/:id', requirePermission('crm.master.update'), validateParams(kindIdParamSchema), validateBody(updateCrmMasterSchema), controller.updateMaster)
router.delete('/:kind/:id', requirePermission('crm.master.delete'), validateParams(kindIdParamSchema), controller.deleteMaster)
router.post('/:kind/:id/activate', requirePermission('crm.master.update'), validateParams(kindIdParamSchema), controller.activateMaster)
router.post('/:kind/:id/deactivate', requirePermission('crm.master.update'), validateParams(kindIdParamSchema), controller.deactivateMaster)

export default router
