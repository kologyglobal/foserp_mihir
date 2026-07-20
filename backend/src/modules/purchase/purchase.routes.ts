import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import requisitionRoutes from './requisitions/purchase-requisition.routes.js'
import planningRoutes from './planning/purchase-planning.routes.js'
import rfqRoutes from './rfq/rfq.routes.js'
import vendorQuotationRoutes from './vendor-quotations/vendor-quotation.routes.js'
import comparisonRoutes from './comparisons/comparison.routes.js'
import orderRoutes from './orders/purchase-order.routes.js'
import timelineRoutes from './timeline/purchase-timeline.routes.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.use('/requisitions', requisitionRoutes)
router.use('/planning-sheet', planningRoutes)
router.use('/rfqs', rfqRoutes)
router.use('/vendor-quotations', vendorQuotationRoutes)
router.use('/comparisons', comparisonRoutes)
router.use('/orders', orderRoutes)
router.use('/timeline', timelineRoutes)

export default router
