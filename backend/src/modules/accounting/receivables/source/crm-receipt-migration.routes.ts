import { Router } from 'express'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { validateQuery, validateParams } from '../../../../middleware/validation.middleware.js'
import { uuidParamSchema, paginationSchema } from '../../../../utils/pagination.js'
import { z } from 'zod'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { getTenantId, getRouteParam } from '../../../../types/request-context.js'
import { sendPaginated, sendSuccess } from '../../../../utils/response.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import {
  getCrmPaymentReceiptAccountingStatus,
  listCrmReceiptMigration,
} from '../source/crm-payment-receipt-ar.service.js'

const listMigrationQuerySchema = paginationSchema.extend({
  companyId: z.string().uuid().optional(),
  migrationStatus: z.string().optional(),
  search: z.string().optional(),
})

const router = Router({ mergeParams: true })

router.get(
  '/crm-receipt-migration',
  requirePermission('finance.ar.crm_receipt_migration.view'),
  validateQuery(listMigrationQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await listCrmReceiptMigration(getTenantId(req), req.query as never)
    sendPaginated(
      res,
      'CRM receipt migration list',
      result.items,
      buildPaginationMeta(result.total, result.page, result.limit),
    )
  }),
)

router.get(
  '/crm-receipt-migration/:id',
  requirePermission('finance.ar.crm_receipt_migration.view'),
  validateParams(uuidParamSchema),
  asyncHandler(async (req, res) => {
    const data = await getCrmPaymentReceiptAccountingStatus(getTenantId(req), getRouteParam(req, 'id'))
    sendSuccess(res, 'CRM receipt migration detail', data)
  }),
)

export default router
