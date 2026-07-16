import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './contact.controller.js'
import { createContactSchema, listContactsQuerySchema, updateContactSchema } from './contact.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.contact.view'), validateQuery(listContactsQuerySchema), controller.listContacts)
router.post('/', requirePermission('crm.contact.create'), validateBody(createContactSchema), controller.createContact)
router.get('/:id', requirePermission('crm.contact.view'), validateParams(uuidParamSchema), controller.getContact)
router.patch('/:id', requirePermission('crm.contact.update'), validateParams(uuidParamSchema), validateBody(updateContactSchema), controller.updateContact)
router.delete('/:id', requirePermission('crm.contact.delete'), validateParams(uuidParamSchema), controller.deleteContact)

export default router
