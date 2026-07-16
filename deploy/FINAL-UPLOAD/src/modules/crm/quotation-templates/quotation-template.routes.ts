import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './quotation-template.controller.js'
import {
  createQuotationTemplateSchema,
  duplicateQuotationTemplateSchema,
  listQuotationTemplatesQuerySchema,
  updateQuotationTemplateSchema,
} from './quotation-template.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('crm.quotation.view'),
  validateQuery(listQuotationTemplatesQuerySchema),
  controller.listQuotationTemplates,
)
router.post(
  '/',
  requirePermission('crm.quotation.create'),
  validateBody(createQuotationTemplateSchema),
  controller.createQuotationTemplate,
)
router.get('/:id', requirePermission('crm.quotation.view'), validateParams(uuidParamSchema), controller.getQuotationTemplate)
router.patch(
  '/:id',
  requirePermission('crm.quotation.update'),
  validateParams(uuidParamSchema),
  validateBody(updateQuotationTemplateSchema),
  controller.updateQuotationTemplate,
)
router.post(
  '/:id/duplicate',
  requirePermission('crm.quotation.create'),
  validateParams(uuidParamSchema),
  validateBody(duplicateQuotationTemplateSchema),
  controller.duplicateQuotationTemplate,
)
router.delete(
  '/:id',
  requirePermission('crm.quotation.delete'),
  validateParams(uuidParamSchema),
  controller.deleteQuotationTemplate,
)

export default router
