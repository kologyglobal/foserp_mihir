import { Router } from 'express'
import salesInvoiceRoutes from './sales-invoices/sales-invoice.routes.js'
import customerReceiptRoutes from './receipts/customer-receipt.routes.js'
import reportingRoutes from './reporting/receivable-reporting.routes.js'
import allocationRoutes from './allocations/customer-receipt-allocation.routes.js'
import customerCreditNoteRoutes from './credit-notes/customer-credit-note.routes.js'
import creditNoteAllocationRoutes from './credit-notes/allocations/customer-credit-note-allocation.routes.js'

const router = Router({ mergeParams: true })

router.use('/', reportingRoutes)
router.use('/', allocationRoutes)
router.use('/', creditNoteAllocationRoutes)
router.use('/invoices', salesInvoiceRoutes)
router.use('/receipts', customerReceiptRoutes)
router.use('/credit-notes', customerCreditNoteRoutes)

export default router
