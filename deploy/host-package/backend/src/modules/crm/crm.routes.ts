import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import activityRoutes from './activities/activity.routes.js'
import companyRoutes from './companies/company.routes.js'
import contactRoutes from './contacts/contact.routes.js'
import leadRoutes from './leads/lead.routes.js'
import opportunityRoutes from './opportunities/opportunity.routes.js'
import followUpRoutes from './follow-ups/follow-up.routes.js'
import importRoutes from './imports/import.routes.js'
import pipelineRoutes from './pipelines/pipeline.routes.js'
import dashboardRoutes from './dashboard/dashboard.routes.js'
import reportRoutes from './reports/report.routes.js'
import searchRoutes from './search/search.routes.js'
import crmMasterRoutes from './masters/crm-master.routes.js'
import entityRoutes from './entities/entity.routes.js'
import exportRoutes from './exports/export.routes.js'
import quotationRoutes from './quotations/quotation.routes.js'
import quotationTemplateRoutes from './quotation-templates/quotation-template.routes.js'
import salesOrderRoutes from './sales-orders/sales-order.routes.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.use('/companies', companyRoutes)
router.use('/contacts', contactRoutes)
router.use('/leads', leadRoutes)
router.use('/activities', activityRoutes)
router.use('/pipelines', pipelineRoutes)
router.use('/opportunities', opportunityRoutes)
router.use('/quotations', quotationRoutes)
router.use('/quotation-templates', quotationTemplateRoutes)
router.use('/sales-orders', salesOrderRoutes)
router.use('/follow-ups', followUpRoutes)
router.use('/imports', importRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/reports', reportRoutes)
router.use('/search', searchRoutes)
router.use('/masters', crmMasterRoutes)
router.use('/entities', entityRoutes)
router.use('/exports', exportRoutes)

export default router
