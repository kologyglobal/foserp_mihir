import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../../utils/pagination.js'
import * as controller from './bank-statement-import.controller.js'
import {
  createImportBatchBodySchema,
  executeImportBatchSchema,
  importBatchLifecycleSchema,
  inspectImportBatchSchema,
  previewImportBatchSchema,
} from './bank-statement-import.schemas.js'
import { BANK_STATEMENT_MAX_FILE_BYTES } from './bank-statement-limits.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BANK_STATEMENT_MAX_FILE_BYTES },
})

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.post(
  '/',
  requirePermission('finance.treasury.statement.import'),
  upload.single('file'),
  (req, res, next) => {
    const parsed = createImportBatchBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: parsed.error.flatten() })
    }
    req.body = parsed.data
    return next()
  },
  controller.createImportBatch,
)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.treasury.statement.view'), controller.getImportBatch)

router.post(
  '/:id/inspect',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.import'),
  validateBody(inspectImportBatchSchema),
  controller.inspectImportBatch,
)

router.post(
  '/:id/preview',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.import'),
  validateBody(previewImportBatchSchema),
  controller.previewImportBatch,
)

router.post(
  '/:id/import',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.import'),
  validateBody(executeImportBatchSchema),
  controller.importImportBatch,
)

router.post(
  '/:id/retry',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.import'),
  validateBody(executeImportBatchSchema),
  controller.retryImportBatch,
)

router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.cancel'),
  validateBody(importBatchLifecycleSchema),
  controller.cancelImportBatch,
)

router.get(
  '/:id/file',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.statement.file.download'),
  controller.downloadImportBatchFile,
)

export default router
