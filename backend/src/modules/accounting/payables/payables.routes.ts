import { Router } from 'express'
import reportingRoutes from './reporting/payable-reporting.routes.js'
import vendorInvoiceRoutes from './vendor-invoices/vendor-invoice.routes.js'
import vendorPaymentRoutes from './vendor-payments/vendor-payment.routes.js'
import vendorAdjustmentRoutes from './vendor-adjustments/vendor-adjustment.routes.js'
import payableAllocationRoutes from './allocations/payable-allocation.routes.js'
import payableReconciliationRoutes from './reconciliation/payable-reconciliation.routes.js'
import payableCloseGateRoutes from './reconciliation/payable-close-gate.routes.js'

const router = Router({ mergeParams: true })

router.use('/', reportingRoutes)
router.use('/vendor-invoices', vendorInvoiceRoutes)
router.use('/vendor-payments', vendorPaymentRoutes)
router.use('/vendor-adjustments', vendorAdjustmentRoutes)
router.use('/allocations', payableAllocationRoutes)
router.use('/reconciliation', payableReconciliationRoutes)
router.use('/close-gate', payableCloseGateRoutes)

export default router
