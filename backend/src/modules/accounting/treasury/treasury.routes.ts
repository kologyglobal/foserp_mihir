import { Router } from 'express'
import treasuryAccountRoutes from './accounts/treasury-account.routes.js'
import bankReconciliationProfileRoutes from './reconciliation/bank-reconciliation-profile.routes.js'
import paymentAccountMappingRoutes from './payment-mappings/payment-account-mapping.routes.js'
import bankStatementRoutes from './bank-statements/bank-statement.routes.js'
import bankStatementImportRoutes from './bank-statements/import/bank-statement-import.routes.js'
import bankStatementMappingTemplateRoutes from './bank-statements/mapping-templates/bank-statement-mapping-template.routes.js'
import bankReconciliationRoutes from './bank-reconciliation/bank-reconciliation.routes.js'
import treasuryTransferRoutes from './transfers/treasury-transfer.routes.js'
import treasuryChequeRoutes from './cheques/treasury-cheque.routes.js'
import treasuryAdjustmentRoutes from './adjustments/treasury-adjustment.routes.js'
import treasuryAdjustmentStatementRoutes from './adjustments/treasury-adjustment-statement.routes.js'
import bankPostingRuleRoutes from './adjustments/classification/bank-posting-rule.routes.js'
import standingInstructionRoutes from './standing-instructions/standing-instruction.routes.js'
import treasuryBooksRoutes from './books/treasury-books.routes.js'
import treasuryLiquidityRoutes from './liquidity/treasury-liquidity.routes.js'
import bankConnectorRoutes from './bank-connectors/bank-connector.routes.js'

const router = Router({ mergeParams: true })

router.use('/accounts', treasuryAccountRoutes)
router.use('/accounts', bankReconciliationProfileRoutes)
router.use('/payment-account-mappings', paymentAccountMappingRoutes)
router.use('/bank-statements/import-batches', bankStatementImportRoutes)
router.use('/bank-statement-mapping-templates', bankStatementMappingTemplateRoutes)
router.use('/bank-statements', bankStatementRoutes)
// Phase 5A3 — bank reconciliation. Defines its own absolute sub-paths under both
// /bank-statements/:statementId/reconciliation/... and /bank-reconciliation/... so it is mounted
// at the router root rather than under a single fixed prefix.
router.use('/', bankReconciliationRoutes)
// Phase 5B1 — internal treasury transfers.
router.use('/transfers', treasuryTransferRoutes)
// Phase 5B2 — cheque management.
router.use('/cheques', treasuryChequeRoutes)
// Phase 5B3 — treasury adjustments (bank charges/interest/direct debit-credit), classification
// posting rules, standing instructions (draft-only), and read-only bankbook/cashbook.
router.use('/treasury-adjustments', treasuryAdjustmentRoutes)
router.use('/', treasuryAdjustmentStatementRoutes)
// Defines its own absolute sub-paths under both /bank-posting-rules/... and
// /bank-statements/:statementId/lines/:lineId/classify, so it is mounted at the router root.
router.use('/', bankPostingRuleRoutes)
router.use('/standing-instructions', standingInstructionRoutes)
router.use('/books', treasuryBooksRoutes)
// Phase 5C1 — cash position, daily liquidity, short-term forecast, closing controls, dashboard.
router.use('/liquidity', treasuryLiquidityRoutes)
// Phase 5D1 — bank connector scaffold (config only; no live bank calls).
router.use('/bank-connectors', bankConnectorRoutes)

export default router
