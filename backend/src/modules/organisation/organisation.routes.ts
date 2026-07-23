import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import * as controller from './organisation.controller.js'
import {
  createOrgAccountSchema,
  createOrgFiscalYearSchema,
  createOrgLegalEntitySchema,
  createRegistrationSchema,
  generateOrgPeriodsSchema,
  listOrgLegalEntitiesQuerySchema,
  listOrgPeriodsQuerySchema,
  listRegistrationsQuerySchema,
  orgLegalEntityIdQuerySchema,
  updateOrgLegalEntitySchema,
  updateRegistrationSchema,
  upsertOrgMappingsSchema,
} from './organisation.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

// Legal entities
router.get(
  '/legal-entities',
  requireAnyPermission('organisation.view', 'finance.legal_entity.view'),
  validateQuery(listOrgLegalEntitiesQuerySchema),
  controller.listLegalEntities,
)
router.post(
  '/legal-entities',
  requireAnyPermission('organisation.create', 'finance.legal_entity.manage'),
  validateBody(createOrgLegalEntitySchema),
  controller.createLegalEntity,
)
router.get(
  '/legal-entities/:id',
  validateParams(uuidParamSchema),
  requireAnyPermission('organisation.view', 'finance.legal_entity.view'),
  controller.getLegalEntity,
)
router.put(
  '/legal-entities/:id',
  validateParams(uuidParamSchema),
  requireAnyPermission('organisation.update', 'finance.legal_entity.manage'),
  validateBody(updateOrgLegalEntitySchema),
  controller.updateLegalEntity,
)

// Registrations
router.get(
  '/registrations',
  requireAnyPermission('organisation.view', 'finance.legal_entity.view'),
  validateQuery(listRegistrationsQuerySchema),
  controller.listRegistrations,
)
router.post(
  '/registrations',
  requireAnyPermission('organisation.create', 'finance.legal_entity.manage'),
  validateBody(createRegistrationSchema),
  controller.createRegistration,
)
router.put(
  '/registrations/:id',
  validateParams(uuidParamSchema),
  requireAnyPermission('organisation.update', 'finance.legal_entity.manage'),
  validateBody(updateRegistrationSchema),
  controller.updateRegistration,
)

// Chart of accounts
router.get(
  '/chart-of-accounts',
  requireAnyPermission('finance.chart_accounts.view', 'finance.coa.view'),
  validateQuery(orgLegalEntityIdQuerySchema),
  controller.listChartOfAccounts,
)
router.post(
  '/chart-of-accounts',
  requireAnyPermission('finance.chart_accounts.create', 'finance.coa.manage'),
  validateBody(createOrgAccountSchema),
  controller.createChartAccount,
)

// Account mappings
router.get(
  '/account-mappings',
  requireAnyPermission('finance.account_mapping.manage', 'finance.default_mapping.view'),
  validateQuery(orgLegalEntityIdQuerySchema),
  controller.listAccountMappings,
)
router.put(
  '/account-mappings',
  requireAnyPermission('finance.account_mapping.manage', 'finance.default_mapping.manage'),
  validateBody(upsertOrgMappingsSchema),
  controller.upsertAccountMappings,
)

// Fiscal years
router.get(
  '/fiscal-years',
  requireAnyPermission('finance.fiscal_year.manage', 'finance.financial_year.view'),
  validateQuery(orgLegalEntityIdQuerySchema),
  controller.listFiscalYears,
)
router.post(
  '/fiscal-years',
  requireAnyPermission('finance.fiscal_year.manage', 'finance.financial_year.manage'),
  validateBody(createOrgFiscalYearSchema),
  controller.createFiscalYear,
)

// Posting periods
router.get(
  '/posting-periods',
  requireAnyPermission('finance.posting_period.manage', 'finance.period.view'),
  validateQuery(listOrgPeriodsQuerySchema),
  controller.listPostingPeriods,
)
router.post(
  '/posting-periods/generate',
  requireAnyPermission('finance.posting_period.manage', 'finance.period.manage'),
  validateBody(generateOrgPeriodsSchema),
  controller.generatePostingPeriods,
)

export default router
