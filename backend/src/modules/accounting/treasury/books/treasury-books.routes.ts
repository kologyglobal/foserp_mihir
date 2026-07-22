import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../utils/pagination.js'
import { bookQuerySchema } from './treasury-books.schemas.js'
import * as controller from './treasury-books.controller.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/bankbook', requirePermission('finance.treasury.book.view'), validateQuery(bookQuerySchema), controller.getBankbook)
router.get('/bankbook/export', requirePermission('finance.treasury.book.view'), validateQuery(bookQuerySchema), controller.exportBankbookCsv)
router.get('/cashbook', requirePermission('finance.treasury.book.view'), validateQuery(bookQuerySchema), controller.getCashbook)
router.get('/cashbook/export', requirePermission('finance.treasury.book.view'), validateQuery(bookQuerySchema), controller.exportCashbookCsv)

export default router
