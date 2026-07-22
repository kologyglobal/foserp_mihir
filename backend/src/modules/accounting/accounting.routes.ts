import { Router } from 'express'
import legalEntityRoutes from './legal-entities/legal-entity.routes.js'
import branchRoutes, { nestedBranchRouter } from './branches/branch.routes.js'
import financialYearRoutes from './financial-years/financial-year.routes.js'
import accountingPeriodRoutes from './accounting-periods/accounting-period.routes.js'
import accountRoutes from './accounts/account.routes.js'
import defaultMappingRoutes from './default-mappings/default-mapping.routes.js'
import financeSettingsRoutes, { activateRouter, setupStatusRouter } from './finance-settings/finance-settings.routes.js'
import costCentreRoutes from './cost-centres/cost-centre.routes.js'
import financeNumberSeriesRoutes from './finance-number-series/finance-number-series.routes.js'
import financeApprovalRuleRoutes from './finance-approval-rules/finance-approval-rule.routes.js'
import ledgerRoutes from './ledger/ledger.routes.js'
import voucherRoutes from './posting/voucher.routes.js'
import postingEventRoutes from './posting/posting-event.routes.js'
import journalRoutes from './journals/journal.routes.js'
import approvalRoutes from './approvals/approval.routes.js'
import receivablesRoutes from './receivables/receivables.routes.js'
import payablesRoutes from './payables/payables.routes.js'
import treasuryRoutes from './treasury/treasury.routes.js'
import taxComplianceRoutes from './tax-compliance/tax-compliance.routes.js'
import fixedAssetsRoutes from './fixed-assets/fixed-assets.routes.js'
import budgetingRoutes from './budgeting/budgeting.routes.js'

const router = Router({ mergeParams: true })

router.use('/legal-entities', legalEntityRoutes)
router.use('/legal-entities/:legalEntityId/branches', nestedBranchRouter)
router.use('/branches', branchRoutes)
router.use('/financial-years', financialYearRoutes)
router.use('/periods', accountingPeriodRoutes)
router.use('/accounts', accountRoutes)
router.use('/default-mappings', defaultMappingRoutes)
router.use('/settings', financeSettingsRoutes)
router.use('/setup-status', setupStatusRouter)
router.use('/activate', activateRouter)
router.use('/cost-centres', costCentreRoutes)
router.use('/number-series', financeNumberSeriesRoutes)
router.use('/approval-rules', financeApprovalRuleRoutes)
router.use('/ledger', ledgerRoutes)
router.use('/vouchers', voucherRoutes)
router.use('/journals', journalRoutes)
router.use('/approvals', approvalRoutes)
router.use('/receivables', receivablesRoutes)
router.use('/payables', payablesRoutes)
router.use('/treasury', treasuryRoutes)
router.use('/tax-compliance', taxComplianceRoutes)
router.use('/fixed-assets', fixedAssetsRoutes)
router.use('/budgeting', budgetingRoutes)
router.use('/posting-events', postingEventRoutes)

export default router
