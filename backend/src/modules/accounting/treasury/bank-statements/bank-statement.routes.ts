import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema, statementLineParamSchema } from '../../../../utils/pagination.js'
import * as controller from './bank-statement.controller.js'
import {
  bankStatementLifecycleSchema,
  createManualStatementSchema,
  createStatementLineSchema,
  listBankStatementsQuerySchema,
  updateBankStatementSchema,
  updateStatementLineSchema,
} from './bank-statement.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.post(
  '/manual',
  requirePermission('finance.treasury.statement.manual_entry'),
  validateBody(createManualStatementSchema),
  controller.createManualBankStatement,
)

router.get('/', requirePermission('finance.treasury.statement.view'), validateQuery(listBankStatementsQuerySchema), controller.listBankStatements)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.treasury.statement.view'), controller.getBankStatement)

router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.edit'),
  validateBody(updateBankStatementSchema),
  controller.updateBankStatement,
)

router.post(
  '/:id/validate',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.validate'),
  validateBody(bankStatementLifecycleSchema),
  controller.validateBankStatement,
)

router.post(
  '/:id/reopen-draft',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.edit'),
  validateBody(bankStatementLifecycleSchema),
  controller.reopenBankStatementDraft,
)

router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.cancel'),
  validateBody(bankStatementLifecycleSchema),
  controller.cancelBankStatement,
)

router.post(
  '/:id/lines',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.edit'),
  validateBody(createStatementLineSchema),
  controller.addBankStatementLine,
)

router.patch(
  '/:id/lines/:lineId',
  validateParams(statementLineParamSchema),
  requirePermission('finance.treasury.statement.edit'),
  validateBody(updateStatementLineSchema),
  controller.updateBankStatementLine,
)

router.delete(
  '/:id/lines/:lineId',
  validateParams(statementLineParamSchema),
  requirePermission('finance.treasury.statement.edit'),
  validateBody(bankStatementLifecycleSchema.pick({ expectedUpdatedAt: true })),
  controller.deleteBankStatementLine,
)

export default router
