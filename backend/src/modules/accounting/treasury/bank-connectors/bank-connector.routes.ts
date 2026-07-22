import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import * as controller from './bank-connector.controller.js'
import {
  bankConnectorConsentCallbackSchema,
  bankConnectorLifecycleSchema,
  createBankConnectorSchema,
  listBankConnectorsQuerySchema,
  revokeBankConnectorConsentSchema,
  startBankConnectorConsentSchema,
  updateBankConnectorSchema,
} from './bank-connector.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/providers',
  requirePermission('finance.bank_connector.view'),
  controller.listProviders,
)

router.get(
  '/',
  requirePermission('finance.bank_connector.view'),
  validateQuery(listBankConnectorsQuerySchema),
  controller.listBankConnectors,
)

router.post(
  '/',
  requirePermission('finance.bank_connector.manage'),
  validateBody(createBankConnectorSchema),
  controller.createBankConnector,
)

router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.bank_connector.view'),
  controller.getBankConnector,
)

router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.bank_connector.manage'),
  validateBody(updateBankConnectorSchema),
  controller.updateBankConnector,
)

router.post(
  '/:id/enable',
  validateParams(uuidParamSchema),
  requirePermission('finance.bank_connector.manage'),
  validateBody(bankConnectorLifecycleSchema),
  controller.enableBankConnector,
)

router.post(
  '/:id/disable',
  validateParams(uuidParamSchema),
  requirePermission('finance.bank_connector.manage'),
  validateBody(bankConnectorLifecycleSchema),
  controller.disableBankConnector,
)

router.post(
  '/:id/test-connection',
  validateParams(uuidParamSchema),
  requirePermission('finance.bank_connector.manage'),
  controller.testBankConnectorConnection,
)

router.post(
  '/:id/sync',
  validateParams(uuidParamSchema),
  requirePermission('finance.bank_connector.sync'),
  controller.syncBankConnector,
)

router.post(
  '/:id/consents/start',
  validateParams(uuidParamSchema),
  requirePermission('finance.bank_connector.manage'),
  validateBody(startBankConnectorConsentSchema),
  controller.startBankConnectorConsent,
)

router.post(
  '/:id/consents/callback',
  validateParams(uuidParamSchema),
  requirePermission('finance.bank_connector.manage'),
  validateBody(bankConnectorConsentCallbackSchema),
  controller.bankConnectorConsentCallback,
)

router.post(
  '/:id/consents/revoke',
  validateParams(uuidParamSchema),
  requirePermission('finance.bank_connector.manage'),
  validateBody(revokeBankConnectorConsentSchema),
  controller.revokeBankConnectorConsent,
)

export default router
