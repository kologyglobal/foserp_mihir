import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import requisitionRoutes from './requisitions/purchase-requisition.routes.js'
import planningRoutes from './planning/purchase-planning.routes.js'
import rfqRoutes from './rfq/rfq.routes.js'
import vendorQuotationRoutes from './vendor-quotations/vendor-quotation.routes.js'
import comparisonRoutes from './comparisons/comparison.routes.js'
import orderRoutes from './orders/purchase-order.routes.js'
import grnRoutes from './grn/goods-receipt.routes.js'
import invoiceRoutes from './invoices/purchase-invoice.routes.js'
import qualityInspectionRoutes from './quality-inspections/quality-inspection.routes.js'
import returnRoutes from './returns/purchase-return.routes.js'
import approvalRoutes from './approvals/purchase-approval.routes.js'
import setupRoutes from './setup/purchase-setup.routes.js'
import * as grnController from './grn/goods-receipt.controller.js'
import timelineRoutes from './timeline/purchase-timeline.routes.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.use('/setup', setupRoutes)
router.use('/requisitions', requisitionRoutes)
router.use('/approvals', approvalRoutes)
router.use('/planning-sheet', planningRoutes)
router.use('/rfqs', rfqRoutes)
router.use('/vendor-quotations', vendorQuotationRoutes)
router.use('/comparisons', comparisonRoutes)
router.use('/orders', orderRoutes)
router.get(
  '/orders/:id/receivable-lines',
  requirePermission('purchase.grn.view'),
  validateParams(uuidParamSchema),
  grnController.getReceivableLines,
)
router.use('/grns', grnRoutes)
router.use('/invoices', invoiceRoutes)
router.use('/quality-inspections', qualityInspectionRoutes)
router.use('/returns', returnRoutes)
router.use('/timeline', timelineRoutes)

export default router
