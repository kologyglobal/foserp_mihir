import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody } from '../../../middleware/validation.middleware.js'
import * as controller from './import.controller.js'
import { importPayloadSchema } from './import.validation.js'

const router = Router({ mergeParams: true })

router.get('/companies/template', requirePermission('crm.import.view'), controller.getCompanyImportTemplate)
router.get('/contacts/template', requirePermission('crm.import.view'), controller.getContactImportTemplate)
router.get('/leads/template', requirePermission('crm.import.view'), controller.getLeadImportTemplate)
router.post('/companies', requirePermission('crm.import.execute'), validateBody(importPayloadSchema), controller.importCompanies)
router.post('/contacts', requirePermission('crm.import.execute'), validateBody(importPayloadSchema), controller.importContacts)
router.post('/leads', requirePermission('crm.import.execute'), validateBody(importPayloadSchema), controller.importLeads)

export default router
