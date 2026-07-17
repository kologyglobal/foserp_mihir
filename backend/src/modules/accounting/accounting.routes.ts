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

export default router
