import { Router } from 'express'
import salesInvoiceRoutes from './sales-invoices/sales-invoice.routes.js'
import customerReceiptRoutes from './receipts/customer-receipt.routes.js'
import reportingRoutes from './reporting/receivable-reporting.routes.js'

const router = Router({ mergeParams: true })

router.use('/', reportingRoutes)
router.use('/invoices', salesInvoiceRoutes)
router.use('/receipts', customerReceiptRoutes)

export default router
