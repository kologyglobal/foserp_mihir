import { Router } from 'express'
import balanceRoutes from './balances/balance.routes.js'
import ledgerRoutes from './ledger/ledger.routes.js'
import movementRoutes from './movements/movement.routes.js'
import reservationRoutes from './reservations/reservation.routes.js'
import transferRoutes from './transfers/transfer.routes.js'
import stockCountRoutes from './stock-counts/stock-count.routes.js'
import adjustmentRoutes from './adjustments/adjustment.routes.js'
import traceabilityRoutes from './traceability/traceability.routes.js'
import { lotRoutes, serialRoutes } from './tracking-masters/tracking-master.routes.js'
import storeWorkbenchRoutes from './store-workbench/store-workbench.routes.js'
import accountingRoutes from './accounting/inventory-accounting.routes.js'

const router = Router({ mergeParams: true })

router.use('/balances', balanceRoutes)
router.use('/ledger', ledgerRoutes)
router.use('/movements', movementRoutes)
router.use('/reservations', reservationRoutes)
router.use('/transfers', transferRoutes)
router.use('/stock-counts', stockCountRoutes)
router.use('/adjustments', adjustmentRoutes)
router.use('/traceability', traceabilityRoutes)
router.use('/lots', lotRoutes)
router.use('/serials', serialRoutes)
// Aggregated cross-module store workbench (summary + needs-action projections).
router.use('/store-workbench', storeWorkbenchRoutes)
// Inventory GL events — flag-gated by FinanceFeatureKey.INVENTORY_ACCOUNTING.
router.use('/accounting', accountingRoutes)

export default router
