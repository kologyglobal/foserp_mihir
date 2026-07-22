import { Router } from 'express'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './company.controller.js'
import * as commercialPositionController from '../sales-orders/commercial-position/sales-order-commercial-position.controller.js'
import { createCompanySchema, listCompaniesQuerySchema, updateCompanySchema } from './company.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.company.view'), validateQuery(listCompaniesQuerySchema), controller.listCompanies)
router.post('/', requirePermission('crm.company.create'), validateBody(createCompanySchema), controller.createCompany)
router.get(
  '/:id/commercial-position',
  requireAnyPermission('crm.company.view', 'crm.sales_order.view', 'finance.ar.view'),
  validateParams(uuidParamSchema),
  commercialPositionController.getCompanyCommercialPosition,
)
router.get('/:id', requirePermission('crm.company.view'), validateParams(uuidParamSchema), controller.getCompany)
router.patch('/:id', requirePermission('crm.company.update'), validateParams(uuidParamSchema), validateBody(updateCompanySchema), controller.updateCompany)
router.delete('/:id', requirePermission('crm.company.delete'), validateParams(uuidParamSchema), controller.deleteCompany)

export default router
